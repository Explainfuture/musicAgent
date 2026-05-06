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
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [interimText, setInterimText] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const speechWindow = window as SpeechWindow;
    setIsSupported(
      Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition),
    );
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const start = useCallback(() => {
    if (typeof window === "undefined") return;

    const speechWindow = window as SpeechWindow;
    const Recognition =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

    if (!Recognition) {
      options?.onUnsupported?.();
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "zh-CN";
    recognition.interimResults = true;
    recognition.continuous = false;
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

      setInterimText(interim || finalText);

      if (finalText.trim()) {
        options?.onFinalText?.(finalText.trim());
      }
    };
    recognition.onerror = (event) => {
      setIsListening(false);
      options?.onError?.(event.error === "not-allowed" ? "麦克风没拿到权限，可以直接打字。" : "识别失败，可以直接打字。");
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
  }, [options]);

  return {
    isSupported,
    isListening,
    interimText,
    start,
    stop,
  };
}
