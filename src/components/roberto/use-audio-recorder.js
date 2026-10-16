"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { isAudioRecordingSupported, pickRecorderMimeType } from "./audio-utils";

export const WAVEFORM_BARS = 32;
const LEVEL_INTERVAL_MS = 90;

function emptyLevels() {
  return Array.from({ length: WAVEFORM_BARS }, () => 0);
}

function microphoneErrorMessage(error) {
  switch (error?.name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "Permissão do microfone negada. Libere o acesso nas configurações do navegador.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "Nenhum microfone foi encontrado neste dispositivo.";
    case "NotReadableError":
    case "TrackStartError":
      return "O microfone está em uso por outro aplicativo.";
    case "SecurityError":
      return "O microfone só funciona em conexão segura (HTTPS).";
    default:
      return error?.message || "Não foi possível acessar o microfone.";
  }
}

/**
 * Grava áudio do microfone e expõe tempo decorrido e níveis para a onda.
 * `stop()` resolve com o Blob gravado; `cancel()` descarta a gravação.
 */
export function useAudioRecorder({ maxDuration = 120, onAutoStop } = {}) {
  const [status, setStatus] = useState("idle");
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState(emptyLevels);

  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const frameRef = useRef(0);
  const stopResolverRef = useRef(null);
  const onAutoStopRef = useRef(onAutoStop);

  useEffect(() => {
    onAutoStopRef.current = onAutoStop;
  });

  const releaseDevices = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    audioContextRef.current?.close?.().catch(() => {});
    streamRef.current = null;
    audioContextRef.current = null;
    recorderRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      stopResolverRef.current = null;
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        recorder.stop();
      }
      releaseDevices();
    };
  }, [releaseDevices]);

  const start = useCallback(async () => {
    if (recorderRef.current) return;

    if (!isAudioRecordingSupported()) {
      throw new Error(
        window.isSecureContext === false
          ? "O microfone só funciona em conexão segura (HTTPS)."
          : "Este navegador não suporta gravação de áudio."
      );
    }

    setStatus("requesting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      const mimeType = pickRecorderMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const blob = chunksRef.current.length
          ? new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" })
          : null;
        chunksRef.current = [];
        releaseDevices();
        setStatus("idle");
        setLevels(emptyLevels());
        stopResolverRef.current?.(blob);
        stopResolverRef.current = null;
      };

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      audioContext.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);

      recorder.start(250);
      const startedAt = performance.now();
      let lastSample = 0;

      setElapsed(0);
      setLevels(emptyLevels());
      setStatus("recording");

      const tick = (now) => {
        const seconds = (now - startedAt) / 1000;

        if (now - lastSample >= LEVEL_INTERVAL_MS) {
          lastSample = now;
          analyser.getByteTimeDomainData(samples);
          let sum = 0;
          for (let index = 0; index < samples.length; index += 1) {
            const value = (samples[index] - 128) / 128;
            sum += value * value;
          }
          const level = Math.min(1, Math.sqrt(sum / samples.length) * 4);
          setLevels((current) => [...current.slice(1), level]);
          setElapsed(seconds);
        }

        if (seconds >= maxDuration) {
          onAutoStopRef.current?.();
          return;
        }

        frameRef.current = requestAnimationFrame(tick);
      };

      frameRef.current = requestAnimationFrame(tick);
    } catch (error) {
      releaseDevices();
      setStatus("idle");
      throw new Error(microphoneErrorMessage(error));
    }
  }, [maxDuration, releaseDevices]);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return Promise.resolve(null);

    cancelAnimationFrame(frameRef.current);
    return new Promise((resolve) => {
      stopResolverRef.current = resolve;
      recorder.requestData?.();
      recorder.stop();
    });
  }, []);

  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    stopResolverRef.current = null;

    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }

    chunksRef.current = [];
    releaseDevices();
    setStatus("idle");
    setElapsed(0);
    setLevels(emptyLevels());
  }, [releaseDevices]);

  return { status, elapsed, levels, start, stop, cancel };
}
