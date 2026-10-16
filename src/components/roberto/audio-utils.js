/**
 * Utilitários de áudio do lado do cliente para o ditado do Roberto.
 *
 * O MediaRecorder grava em formatos diferentes por navegador (webm/opus no
 * Chrome, mp4/aac no Safari). Para a transcrição, tudo é convertido para WAV
 * PCM 16 bits, mono, 16 kHz: formato universal e suficiente para voz.
 */

export const TRANSCRIPTION_SAMPLE_RATE = 16_000;

const RECORDER_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

export function isAudioRecordingSupported() {
  return (
    typeof window !== "undefined" &&
    typeof window.MediaRecorder !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

export function pickRecorderMimeType() {
  if (typeof window === "undefined" || typeof window.MediaRecorder === "undefined") return "";
  return RECORDER_MIME_TYPES.find((type) => window.MediaRecorder.isTypeSupported?.(type)) || "";
}

export function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function writeString(view, offset, value) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return new Blob([view], { type: "audio/wav" });
}

/** Converte qualquer gravação suportada pelo navegador em WAV mono 16 kHz. */
export async function blobToWav(blob, sampleRate = TRANSCRIPTION_SAMPLE_RATE) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const decoder = new AudioContextClass();

  try {
    const decoded = await decoder.decodeAudioData(await blob.arrayBuffer());
    const length = Math.max(1, Math.ceil(decoded.duration * sampleRate));
    const offline = new OfflineAudioContext(1, length, sampleRate);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();

    const rendered = await offline.startRendering();
    return {
      wav: encodeWav(rendered.getChannelData(0), sampleRate),
      duration: decoded.duration,
    };
  } finally {
    decoder.close?.().catch(() => {});
  }
}
