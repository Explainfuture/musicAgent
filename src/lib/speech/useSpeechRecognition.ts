"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onstart: (() => void) | null;
  onresult:
    | ((event: {
        resultIndex: number;
        results: ArrayLike<{
          isFinal: boolean;
          0: { transcript: string };
        }>;
      }) => void)
    | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

function getRecognitionConstructor() {
  const speechWindow = window as SpeechWindow;
  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition || null;
}

function getMediaErrorMessage(error: unknown) {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "麦克风权限被系统拦截了。请在系统设置里允许桌面应用访问麦克风。";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "没有检测到可用麦克风，可以检查输入设备后再试。";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "麦克风正被其他应用占用，关闭占用后再试。";
  }
  return "麦克风没拿到权限，可以直接打字。";
}

function encodeWav(samples: Float32Array, sampleRate: number) {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * bytesPerSample, true);

  let offset = 44;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += bytesPerSample;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function downsampleBuffer(chunks: Float32Array[], inputSampleRate: number, outputSampleRate: number) {
  const inputLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const input = new Float32Array(inputLength);
  let writeOffset = 0;
  for (const chunk of chunks) {
    input.set(chunk, writeOffset);
    writeOffset += chunk.length;
  }

  if (inputSampleRate === outputSampleRate) return input;

  const ratio = inputSampleRate / outputSampleRate;
  const outputLength = Math.floor(input.length / ratio);
  const output = new Float32Array(outputLength);

  for (let index = 0; index < outputLength; index += 1) {
    const start = Math.floor(index * ratio);
    const end = Math.floor((index + 1) * ratio);
    let sum = 0;
    let count = 0;
    for (let inputIndex = start; inputIndex < end && inputIndex < input.length; inputIndex += 1) {
      sum += input[inputIndex];
      count += 1;
    }
    output[index] = count > 0 ? sum / count : 0;
  }

  return output;
}

export function useSpeechRecognition(options?: {
  onFinalText?: (text: string) => void;
  onUnsupported?: () => void;
  onError?: (message: string) => void;
  tencentAsr?: {
    secretId?: string;
    secretKey?: string;
    region?: string;
    engine?: string;
  };
}) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const optionsRef = useRef(options);
  const manualStopRef = useRef(false);
  const heardSpeechRef = useRef(false);
  const noSpeechTimerRef = useRef<number | null>(null);
  const transcriptRef = useRef("");
  const emittedTextRef = useRef("");
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const recorderStreamRef = useRef<MediaStream | null>(null);
  const recorderChunksRef = useRef<Float32Array[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [interimText, setInterimText] = useState("");

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hasBrowserSpeech = Boolean(getRecognitionConstructor());
    const hasRecorder = Boolean(navigator.mediaDevices?.getUserMedia) && "AudioContext" in window;
    setIsSupported(hasBrowserSpeech || hasRecorder);
  }, []);

  const emitTranscript = useCallback(() => {
    const text = transcriptRef.current.trim();
    if (!text || text === emittedTextRef.current) return;

    emittedTextRef.current = text;
    optionsRef.current?.onFinalText?.(text);
  }, []);

  const ensureRecognition = useCallback(() => {
    if (typeof window === "undefined") return null;
    if (recognitionRef.current) return recognitionRef.current;

    const Recognition = getRecognitionConstructor();
    if (!Recognition) return null;

    const recognition = new Recognition();
    recognition.lang = "zh-CN";
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onstart = () => {
      setIsListening(true);
      heardSpeechRef.current = false;
      if (noSpeechTimerRef.current) window.clearTimeout(noSpeechTimerRef.current);
      noSpeechTimerRef.current = window.setTimeout(() => {
        if (!heardSpeechRef.current && !manualStopRef.current) {
          optionsRef.current?.onError?.("没有检测到语音输入，请检查麦克风后再试一次。");
        }
      }, 3500);
    };

    recognition.onresult = (event) => {
      let interim = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const part = result[0].transcript.trim();
        if (!part) continue;
        heardSpeechRef.current = true;

        if (result.isFinal) {
          transcriptRef.current = `${transcriptRef.current} ${part}`.trim();
        } else {
          interim = `${interim} ${part}`.trim();
        }
      }

      setInterimText(`${transcriptRef.current} ${interim}`.trim());
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      if (noSpeechTimerRef.current) window.clearTimeout(noSpeechTimerRef.current);
      const messages: Record<string, string> = {
        "not-allowed": "麦克风没拿到权限，可以直接打字。",
        "audio-capture": "没有检测到可用麦克风，可以直接打字。",
        "no-speech": "我没有听到声音，可以再点一次说话。",
        network: "当前浏览器语音识别服务不可用，可以先直接打字。",
      };
      optionsRef.current?.onError?.(messages[event.error] || "识别失败，可以直接打字。");
    };

    recognition.onend = () => {
      if (noSpeechTimerRef.current) window.clearTimeout(noSpeechTimerRef.current);
      emitTranscript();
      setIsListening(false);

      if (!manualStopRef.current && !transcriptRef.current.trim()) {
        optionsRef.current?.onError?.("我没有听到声音，可以再点一次说话。");
      }
    };

    recognitionRef.current = recognition;
    return recognition;
  }, [emitTranscript]);

  const transcribeRecording = useCallback(async (blob: Blob) => {
    setInterimText("正在转写语音...");
    const form = new FormData();
    const tencentAsr = optionsRef.current?.tencentAsr;
    form.append("file", blob, "speech.wav");
    if (tencentAsr?.secretId) form.append("tencentSecretId", tencentAsr.secretId);
    if (tencentAsr?.secretKey) form.append("tencentSecretKey", tencentAsr.secretKey);
    if (tencentAsr?.region) form.append("tencentRegion", tencentAsr.region);
    if (tencentAsr?.engine) form.append("tencentAsrEngine", tencentAsr.engine);

    const response = await fetch("/api/speech/transcribe", {
      method: "POST",
      body: form,
    });

    const data = (await response.json().catch(() => null)) as { text?: string; error?: string } | null;
    if (!response.ok || !data?.text) {
      throw new Error(data?.error || "语音转写失败，可以直接打字。");
    }

    optionsRef.current?.onFinalText?.(data.text);
    setInterimText("");
  }, []);

  const startRecorder = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) {
      optionsRef.current?.onUnsupported?.();
      return;
    }
    const tencentAsr = optionsRef.current?.tencentAsr;
    if (!tencentAsr?.secretId?.trim() || !tencentAsr.secretKey?.trim()) {
      optionsRef.current?.onError?.("无腾讯云语音识别密钥，请先在设置中填写。");
      return;
    }

    try {
      if (window.musicAgentShell?.getMicrophoneStatus) {
        await window.musicAgentShell.getMicrophoneStatus();
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      recorderChunksRef.current = [];
      recorderStreamRef.current = stream;
      audioContextRef.current = audioContext;
      processorRef.current = processor;

      processor.onaudioprocess = (event) => {
        recorderChunksRef.current.push(new Float32Array(event.inputBuffer.getChannelData(0)));
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
      setIsListening(true);
      setInterimText("正在录音，点一下结束。");
    } catch (error) {
      setIsListening(false);
      setInterimText("");
      optionsRef.current?.onError?.(getMediaErrorMessage(error));
      if (window.musicAgentShell?.openMicrophoneSettings) {
        void window.musicAgentShell.openMicrophoneSettings();
      }
    }
  }, [transcribeRecording]);

  const stop = useCallback(() => {
    manualStopRef.current = true;
    if (noSpeechTimerRef.current) window.clearTimeout(noSpeechTimerRef.current);

    if (processorRef.current && audioContextRef.current) {
      const chunks = recorderChunksRef.current;
      const sampleRate = audioContextRef.current.sampleRate;
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
      recorderStreamRef.current?.getTracks().forEach((track) => track.stop());
      recorderStreamRef.current = null;
      void audioContextRef.current.close();
      audioContextRef.current = null;
      recorderChunksRef.current = [];
      setIsListening(false);

      const samples = downsampleBuffer(chunks, sampleRate, 16000);
      const blob = encodeWav(samples, 16000);
      if (blob.size <= 44) {
        optionsRef.current?.onError?.("没有录到声音，可以再点一次语音。");
        setInterimText("");
        return;
      }

      void transcribeRecording(blob).catch((error: unknown) => {
        optionsRef.current?.onError?.(error instanceof Error ? error.message : "语音转写失败，可以直接打字。");
        setInterimText("");
      });
      return;
    }

    recorderStreamRef.current?.getTracks().forEach((track) => track.stop());
    recognitionRef.current?.stop();
    emitTranscript();
    setIsListening(false);
  }, [emitTranscript]);

  const startBrowserSpeech = useCallback(async () => {
    const recognition = ensureRecognition();
    if (!recognition) {
      await startRecorder();
      return;
    }

    manualStopRef.current = false;
    transcriptRef.current = "";
    emittedTextRef.current = "";
    setInterimText("");

    if (isListening) {
      recognition.stop();
    }

    try {
      recognition.start();
    } catch {
      setIsListening(false);
      optionsRef.current?.onError?.("语音识别启动失败，可以再点一次或直接打字。");
    }
  }, [ensureRecognition, isListening, startRecorder]);

  const start = useCallback(async () => {
    if (typeof window === "undefined") return;

    if (window.musicAgentShell?.isElectron) {
      await startRecorder();
      return;
    }

    await startBrowserSpeech();
  }, [startBrowserSpeech, startRecorder]);

  return {
    isSupported,
    isListening,
    interimText,
    start,
    stop,
  };
}
