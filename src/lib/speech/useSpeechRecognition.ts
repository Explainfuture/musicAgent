"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onstart: (() => void) | null;
  onresult:
    | ((event: {
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

  const stop = useCallback(() => {
    manualStopRef.current = true;
    recognitionRef.current?.stop();
    emitTranscript();
    setIsListening(false);
  }, [emitTranscript]);

  const start = useCallback(async () => {
    if (typeof window === "undefined") return;

    const speechWindow = window as SpeechWindow;
    const Recognition =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

    if (!Recognition) {
      optionsRef.current?.onUnsupported?.();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch {
      optionsRef.current?.onError?.("麦克风没拿到权限，可以直接打字。");
      return;
    }

    manualStopRef.current = false;
    transcriptRef.current = "";
    emittedTextRef.current = "";
    setInterimText("");

    const recognition = new Recognition();
    recognition.lang = "zh-CN";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      let interim = "";
      let finalText = "";

      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      const nextText = `${finalText}${interim}`.trim();
      transcriptRef.current = nextText;
      setInterimText(nextText);

      if (finalText.trim() && finalText.trim() !== emittedTextRef.current) {
        emittedTextRef.current = finalText.trim();
        optionsRef.current?.onFinalText?.(finalText.trim());
      }
    };
    recognition.onerror = (event) => {
      setIsListening(false);
      const messages: Record<string, string> = {
        "not-allowed": "麦克风没拿到权限，可以直接打字。",
        "audio-capture": "没有检测到可用麦克风，可以直接打字。",
        "no-speech": "我没有听到声音，可以再点一次说话。",
        network: "当前语音识别服务不可用，可以先直接打字。",
      };
      optionsRef.current?.onError?.(messages[event.error] || "识别失败，可以直接打字。");
    };
    recognition.onend = () => {
      emitTranscript();
      setIsListening(false);

      if (!manualStopRef.current && !transcriptRef.current.trim()) {
        optionsRef.current?.onError?.("我没有听到声音，可以再点一次说话。");
      }
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setIsListening(false);
      optionsRef.current?.onError?.("语音识别启动失败，可以再点一次或直接打字。");
    }
  }, [emitTranscript]);

  return {
    isSupported,
    isListening,
    interimText,
    start,
    stop,
  };
}
