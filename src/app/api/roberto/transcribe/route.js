import { NextResponse } from "next/server";

import { getRobertoContext, RobertoError } from "@/lib/roberto/context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_TRANSCRIPTION_MODEL = "google/gemini-2.5-flash";
// WAV 16 kHz mono ≈ 1,9 MB por minuto; 2 minutos de ditado cabem com folga.
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
const MAX_TRANSCRIPT_LENGTH = 5000;

function jsonError(message, status = 500, code = "TRANSCRIPTION_ERROR") {
  return NextResponse.json(
    { error: message, code },
    { status, headers: { "Cache-Control": "private, no-store, max-age=0" } }
  );
}

function systemPrompt() {
  return [
    "Você é um transcritor de áudio da plataforma PDR Hub (martelinho de ouro / funilaria).",
    "Transcreva fielmente a fala do áudio, no mesmo idioma em que foi falada.",
    "Normalmente a fala é em português do Brasil; às vezes contém nomes ou termos em italiano.",
    "Use pontuação e letras maiúsculas corretas. Escreva placas, valores e números como foram ditos (ex.: ABC1D23, 350 euros).",
    "Não responda perguntas, não resuma, não traduza e não adicione comentários.",
    "Responda apenas com o texto transcrito. Se não houver fala compreensível, responda com uma string vazia.",
  ].join("\n");
}

function readText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => (typeof part === "string" ? part : part?.text || "")).join("");
  }
  return "";
}

function cleanTranscript(value) {
  return String(value || "")
    .replace(/^["'“”\s]+|["'“”\s]+$/g, "")
    .replace(/\s+\n/g, "\n")
    .trim()
    .slice(0, MAX_TRANSCRIPT_LENGTH);
}

async function transcribe(base64Audio) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_TRANSCRIPTION_MODEL || DEFAULT_TRANSCRIPTION_MODEL;

  if (!apiKey) {
    throw new RobertoError(
      "A transcrição ainda não foi configurada. Defina OPENROUTER_API_KEY no servidor.",
      503,
      "OPENROUTER_NOT_CONFIGURED"
    );
  }

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Title": "PDR Hub - Roberto (transcrição)",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 1500,
      messages: [
        { role: "system", content: systemPrompt() },
        {
          role: "user",
          content: [
            { type: "text", text: "Transcreva este áudio." },
            { type: "input_audio", input_audio: { data: base64Audio, format: "wav" } },
          ],
        },
      ],
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    console.error("OpenRouter transcription error", response.status, payload?.error?.message || payload);
    throw new RobertoError(
      response.status === 429
        ? "O serviço de transcrição está ocupado. Tente novamente em instantes."
        : "Não foi possível transcrever o áudio com o modelo configurado.",
      502,
      "OPENROUTER_ERROR"
    );
  }

  return cleanTranscript(readText(payload?.choices?.[0]?.message?.content));
}

export async function POST(request) {
  try {
    await getRobertoContext();
    const formData = await request.formData().catch(() => null);
    const audio = formData?.get("audio");

    if (!audio || typeof audio === "string") {
      return jsonError("Envie um áudio para transcrever.", 400, "MISSING_AUDIO");
    }

    if (audio.type && !["audio/wav", "audio/x-wav", "audio/wave"].includes(audio.type)) {
      return jsonError("Formato de áudio não suportado.", 415, "UNSUPPORTED_AUDIO");
    }

    if (!audio.size) return jsonError("O áudio está vazio.", 400, "EMPTY_AUDIO");
    if (audio.size > MAX_AUDIO_BYTES) {
      return jsonError("O áudio é muito longo. Grave até 2 minutos.", 413, "AUDIO_TOO_LARGE");
    }

    const base64Audio = Buffer.from(await audio.arrayBuffer()).toString("base64");
    const text = await transcribe(base64Audio);

    return NextResponse.json(
      { text },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  } catch (error) {
    if (error instanceof RobertoError) return jsonError(error.message, error.status, error.code);
    console.error("POST /api/roberto/transcribe", error);
    return jsonError("Não foi possível transcrever o áudio. Tente novamente.", 500, "INTERNAL_ERROR");
  }
}
