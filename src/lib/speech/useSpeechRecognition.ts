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

export function useSpeechRecognition(options?: {
  onFinalText?: (text: string) => void;
  onUnsupported?: () => void;
  onError?: (message: string) => void;
}) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const optionsRef = useRef(options);
  const manualStopRef = useRef(false);
  const heardSpeechRef = useRef(false);
  const noSpeechTimerRef = useRef<number | null>(null);
  const transcriptRef = useRef("");
  const emittedTextRef = useRef("");
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [interimText, setInterimText] = useState("");

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const speechWindow = window as SpeechWindow;
    setIsSupported(
      Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition),
    );
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

    const speechWindow = window as SpeechWindow;
    const Recognition =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

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

      const nextText = `${transcriptRef.current} ${interim}`.trim();
      setInterimText(nextText);
    };
    recognition.onerror = (event) => {
      setIsListening(false);
      if (noSpeechTimerRef.current) window.clearTimeout(noSpeechTimerRef.current);
      const messages: Record<string, string> = {
        "not-allowed": "麦克风没拿到权限，可以直接打字。",
        "audio-capture": "没有检测到可用麦克风，可以直接打字。",
        "no-speech": "我没有听到声音，可以再点一次说话。",
        network: "当前语音识别服务不可用，可以先直接打字。",
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


  const stop = useCallback(() => {
    manualStopRef.current = true;
    if (noSpeechTimerRef.current) window.clearTimeout(noSpeechTimerRef.current);
    recognitionRef.current?.stop();
    emitTranscript();
    setIsListening(false);
  }, [emitTranscript]);

  const start = useCallback(async () => {
    if (typeof window === "undefined") return;

    const recognition = ensureRecognition();
    if (!recognition) {
      optionsRef.current?.onUnsupported?.();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      optionsRef.current?.onError?.("当前环境无法访问麦克风设备。");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      stream.getTracks().forEach((track) => track.stop());
    } catch {
      optionsRef.current?.onError?.("麦克风没拿到权限，可以直接打字。");
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
  }, [ensureRecognition, isListening]);

  return {
    isSupported,
    isListening,
    interimText,
    start,
    stop,
  };
}
