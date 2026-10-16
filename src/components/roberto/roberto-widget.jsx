"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowUp,
  Check,
  Loader2,
  Mic,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import { Button, Portal } from "@/components/shared";

import { blobToWav, formatDuration, isAudioRecordingSupported } from "./audio-utils";
import { useAudioRecorder } from "./use-audio-recorder";

const MAX_RECORDING_SECONDS = 120;
const MIN_RECORDING_SECONDS = 0.6;

const STORAGE_KEY = "pdr.roberto.conversation.v1";
const STATE_STORAGE_KEY = "pdr.roberto.operational-state.v1";
const MAX_SAVED_MESSAGES = 30;
const MAX_API_MESSAGES = 10;
const SUGGESTIONS = [
  "Quanto temos para receber?",
  "Cadastrar um serviço",
  "Buscar uma oficina",
  "Resumo deste mês",
];

const WELCOME = {
  id: "welcome",
  role: "assistant",
  content:
    "Olá! Eu sou o Roberto. Posso consultar informações, ajudar você a usar o PDR Hub ou executar tarefas na plataforma. Como posso ajudar?",
};

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadConversation() {
  if (typeof window === "undefined") return [WELCOME];
  try {
    const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
    if (Array.isArray(parsed) && parsed.length) return parsed.slice(-MAX_SAVED_MESSAGES);
  } catch {
    // A conversa atual é uma conveniência; falhas de storage não bloqueiam o chat.
  }
  return [WELCOME];
}

function loadOperationalState() {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(sessionStorage.getItem(STATE_STORAGE_KEY) || "null");
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function MessageBubble({ message, onConfirm, onCancel, confirming }) {
  const assistant = message.role === "assistant";
  const content = assistant ? String(message.content || "").replace(/\*{2,}/g, "") : message.content;
  return (
    <div className={`flex gap-2.5 ${assistant ? "justify-start" : "justify-end"}`}>
      {assistant ? (
        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-primary text-white">
          <Sparkles className="size-3.5 text-white" strokeWidth={2} />
        </span>
      ) : null}

      <div className={`min-w-0 max-w-[84%] ${assistant ? "space-y-2" : ""}`}>
        <div
          className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-6 ${
            assistant
              ? "rounded-tl-md border border-border bg-surface text-foreground"
              : "rounded-tr-md bg-primary text-primary-foreground"
          }`}
        >
          {content}
        </div>

        {message.confirmation ? (
          <ConfirmationCard
            confirmation={message.confirmation}
            onConfirm={() => onConfirm(message.id, message.confirmation)}
            onCancel={() => onCancel(message.id)}
            confirming={confirming === message.id}
          />
        ) : null}
      </div>
    </div>
  );
}

function ConfirmationCard({ confirmation, onConfirm, onCancel, confirming }) {
  const status = confirmation.status || "pending";
  return (
    <section
      className={`overflow-hidden rounded-xl border bg-surface ${
        confirmation.danger ? "border-danger/30" : "border-primary/35"
      }`}
    >
      <div className="flex items-start gap-2.5 border-b border-border bg-surface-2/70 px-3.5 py-3">
        <span
          className={`grid size-8 shrink-0 place-items-center rounded-lg ${
            confirmation.danger ? "bg-danger/10 text-danger" : "bg-primary/15 text-foreground"
          }`}
        >
          <ShieldCheck className="size-4" strokeWidth={1.9} />
        </span>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-foreground">{confirmation.title}</h4>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{confirmation.description}</p>
        </div>
      </div>

      <dl className="divide-y divide-border px-3.5">
        {(confirmation.fields || []).map((field) => (
          <div key={`${field.label}-${field.value}`} className="grid grid-cols-[90px_minmax(0,1fr)] gap-2 py-2.5 text-xs">
            <dt className="text-muted-foreground">{field.label}</dt>
            <dd className="break-words text-right font-medium text-foreground">{String(field.value)}</dd>
          </div>
        ))}
      </dl>

      {confirmation.items?.length ? (
        <ol className="max-h-72 divide-y divide-border overflow-y-auto border-t border-border bg-background/60">
          {confirmation.items.map((item, index) => (
            <li key={`${index}-${item.title}-${item.subtitle}`} className="flex items-start gap-2.5 px-3.5 py-2.5">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-surface-2 text-[10px] font-semibold text-muted-foreground">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-xs font-semibold text-foreground">{item.title}</p>
                  {item.badge ? (
                    <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                      {item.badge}
                    </span>
                  ) : null}
                </div>
                {item.subtitle ? (
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{item.subtitle}</p>
                ) : null}
                {item.detail ? (
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{item.detail}</p>
                ) : null}
              </div>
              {item.value ? (
                <span className="shrink-0 whitespace-nowrap text-xs font-semibold text-foreground">{item.value}</span>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}

      <div className="flex gap-2 border-t border-border p-3">
        {status === "pending" ? (
          <>
            <Button variant="outline" size="sm" className="flex-1" onClick={onCancel} disabled={confirming}>
              Cancelar
            </Button>
            <Button
              variant={confirmation.danger ? "danger" : "primary"}
              size="sm"
              className="flex-1"
              leftIcon={Check}
              loading={confirming}
              loadingText="Confirmando"
              onClick={onConfirm}
            >
              Confirmar
            </Button>
          </>
        ) : (
          <p className={`w-full py-0.5 text-center text-xs font-semibold ${status === "completed" ? "text-success" : "text-muted-foreground"}`}>
            {status === "completed" ? "Operação confirmada" : "Operação cancelada"}
          </p>
        )}
      </div>
    </section>
  );
}

function RecordingBar({ elapsed, levels, transcribing, onCancel, onFinish }) {
  const remaining = MAX_RECORDING_SECONDS - elapsed;

  if (transcribing) {
    return (
      <div className="flex min-h-9 flex-1 items-center gap-2.5 px-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="size-4 animate-spin text-primary" />
        Transcrevendo áudio...
      </div>
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="size-9 shrink-0 rounded-lg text-danger hover:bg-danger/10"
        onClick={onCancel}
        aria-label="Descartar áudio"
        title="Descartar áudio"
      >
        <Trash2 className="size-4" />
      </Button>

      <div className="flex min-h-9 min-w-0 flex-1 items-center gap-2.5 px-1" role="status" aria-live="off">
        <span className="relative flex size-2.5 shrink-0">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-danger/60" />
          <span className="relative inline-flex size-2.5 rounded-full bg-danger" />
        </span>
        <span
          className={`w-9 shrink-0 text-sm font-medium tabular-nums ${
            remaining <= 10 ? "text-warning" : "text-foreground"
          }`}
          aria-label={`Gravando: ${formatDuration(elapsed)}`}
        >
          {formatDuration(elapsed)}
        </span>
        <div className="flex h-7 min-w-0 flex-1 items-center justify-end gap-[3px] overflow-hidden" aria-hidden="true">
          {levels.map((level, index) => (
            <span
              key={index}
              className="w-[3px] shrink-0 rounded-full bg-primary transition-[height] duration-100"
              style={{ height: `${Math.max(3, Math.round(level * 26))}px`, opacity: 0.35 + (index / levels.length) * 0.65 }}
            />
          ))}
        </div>
      </div>

      <Button
        size="icon"
        className="size-9 shrink-0 rounded-lg"
        onClick={onFinish}
        aria-label="Concluir gravação e transcrever"
        title="Concluir e transcrever"
      >
        <ArrowUp className="size-4" />
      </Button>
    </>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-7 place-items-center rounded-full bg-primary text-white">
        <Sparkles className="size-3.5 text-white" strokeWidth={2} />
      </span>
      <div className="flex h-10 items-center gap-1 rounded-2xl rounded-tl-md border border-border bg-surface px-4" aria-label="Roberto está pensando">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="size-1.5 animate-bounce rounded-full bg-muted-foreground"
            style={{ animationDelay: `${index * 120}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

export function RobertoWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState("");
  const [error, setError] = useState("");
  const [operationalState, setOperationalState] = useState(null);
  const [hydrated, setHydrated] = useState(false);
  const [micSupported, setMicSupported] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const recorder = useAudioRecorder({
    maxDuration: MAX_RECORDING_SECONDS,
    onAutoStop: () => finishRecording(),
  });
  const recording = recorder.status === "recording";
  const cancelRecording = recorder.cancel;
  const voiceBusy = recorder.status !== "idle" || transcribing;

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setMessages(loadConversation());
      setOperationalState(loadOperationalState());
      setMicSupported(isAudioRecordingSupported());
      setHydrated(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_SAVED_MESSAGES)));
    } catch {
      // O chat continua funcional sem persistência na sessão.
    }
  }, [hydrated, messages]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (operationalState) {
        sessionStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(operationalState));
      } else {
        sessionStorage.removeItem(STATE_STORAGE_KEY);
      }
    } catch {
      // O estado compacto é apenas uma otimização; o chat segue funcional sem storage.
    }
  }, [hydrated, operationalState]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      inputRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [loading, messages, open]);

  useEffect(() => {
    if (!open) return undefined;
    function closeOnEscape(event) {
      if (event.key !== "Escape") return;
      // Esc durante a gravação descarta o áudio, como no WhatsApp; senão fecha o chat.
      if (recording) cancelRecording();
      else setOpen(false);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [cancelRecording, open, recording]);

  async function startRecording() {
    if (voiceBusy || loading || confirming) return;
    setError("");
    try {
      await recorder.start();
    } catch (recordError) {
      setError(recordError.message);
    }
  }

  async function finishRecording() {
    if (recorder.status !== "recording") return;
    setTranscribing(true);
    setError("");

    try {
      const blob = await recorder.stop();
      if (!blob) throw new Error("Nenhum áudio foi capturado. Tente novamente.");

      const { wav, duration } = await blobToWav(blob);
      if (duration < MIN_RECORDING_SECONDS) {
        throw new Error("Áudio muito curto. Fale um pouco mais antes de concluir.");
      }

      const formData = new FormData();
      formData.append("audio", wav, "roberto-audio.wav");

      const response = await fetch("/api/roberto/transcribe", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Não foi possível transcrever o áudio.");

      const text = String(payload.text || "").trim();
      if (!text) throw new Error("Não identifiquei fala no áudio. Tente gravar novamente.");

      setInput((current) => [current.trim(), text].filter(Boolean).join(" ").slice(0, 5000));
      requestAnimationFrame(() => {
        const field = inputRef.current;
        if (!field) return;
        field.focus({ preventScroll: true });
        field.setSelectionRange(field.value.length, field.value.length);
      });
    } catch (transcribeError) {
      setError(transcribeError.message || "Não foi possível transcrever o áudio.");
    } finally {
      setTranscribing(false);
    }
  }

  function closeWidget() {
    if (recording) recorder.cancel();
    setOpen(false);
  }

  const hasPendingConfirmation = useMemo(
    () => messages.some((message) => message.confirmation?.status === "pending"),
    [messages]
  );

  const apiHistory = useCallback(
    (nextMessages) =>
      nextMessages
        .filter((message) => ["user", "assistant"].includes(message.role) && message.content)
        .map(({ role, content }) => ({ role, content }))
        .slice(-MAX_API_MESSAGES),
    []
  );

  async function submitMessage(rawValue) {
    const content = String(rawValue || input).trim();
    if (!content || loading || confirming || voiceBusy) return;
    const userMessage = { id: makeId(), role: "user", content };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/roberto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ messages: apiHistory(nextMessages), state: operationalState }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Não foi possível falar com o Roberto.");
      setOperationalState(payload.state || null);
      setMessages((current) => [
        ...current,
        {
          id: makeId(),
          role: "assistant",
          content: payload.message?.content || "Não recebi uma resposta completa.",
          confirmation: payload.confirmation
            ? { ...payload.confirmation, status: "pending" }
            : undefined,
        },
      ]);
    } catch (requestError) {
      setError(requestError.message || "Não foi possível enviar a mensagem.");
    } finally {
      setLoading(false);
    }
  }

  async function confirmAction(messageId, confirmation) {
    if (!confirmation?.token || confirming) return;
    setConfirming(messageId);
    setError("");
    try {
      const response = await fetch("/api/roberto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ confirmationToken: confirmation.token }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Não foi possível confirmar a operação.");
      setOperationalState(null);
      setMessages((current) => [
        ...current.map((message) =>
          message.id === messageId
            ? { ...message, confirmation: { ...message.confirmation, status: "completed" } }
            : message
        ),
        { id: makeId(), role: "assistant", content: payload.message?.content || "Operação concluída." },
      ]);
      window.dispatchEvent(new CustomEvent("roberto:data-changed", { detail: payload.result }));
    } catch (confirmError) {
      setError(confirmError.message || "A confirmação falhou.");
    } finally {
      setConfirming("");
    }
  }

  function cancelAction(messageId) {
    setOperationalState(null);
    setMessages((current) => [
      ...current.map((message) =>
        message.id === messageId
          ? { ...message, confirmation: { ...message.confirmation, status: "cancelled" } }
          : message
      ),
      { id: makeId(), role: "assistant", content: "Operação cancelada. Nenhuma alteração foi feita." },
    ]);
  }

  function resetConversation() {
    if (recording) recorder.cancel();
    setMessages([WELCOME]);
    setInput("");
    setError("");
    setOperationalState(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STATE_STORAGE_KEY);
    } catch {
      // Sem impacto funcional.
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitMessage();
    }
  }

  return (
    <Portal>
      {!open ? (
        <div className="group fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-4 z-[70] md:bottom-[calc(1.5rem+env(safe-area-inset-bottom))] md:right-6">
          <span className="pointer-events-none absolute bottom-[calc(100%+8px)] right-0 whitespace-nowrap rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground opacity-0 shadow-md transition group-hover:opacity-100 group-focus-within:opacity-100">
            Falar com Roberto
          </span>
          <button
            type="button"
            className="relative grid size-14 shrink-0 place-items-center rounded-[50%] border border-primary-hover bg-primary text-white shadow-xl shadow-black/15 transition hover:-translate-y-0.5 hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-[0.98]"
            onClick={() => setOpen(true)}
            aria-label="Falar com Roberto"
          >
            <Sparkles className="size-6 text-white" strokeWidth={2.1} />
          </button>
        </div>
      ) : (
        <section
          role="dialog"
          aria-label="Roberto, assistente PDR Hub"
          className="fixed inset-0 z-[70] flex h-[var(--panel-viewport-height,100dvh)] flex-col overflow-hidden bg-background sm:inset-auto sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom))] sm:right-6 sm:h-[min(720px,calc(100dvh-3rem-env(safe-area-inset-top)))] sm:w-[420px] sm:rounded-2xl sm:border sm:border-border sm:shadow-2xl sm:shadow-black/20"
        >
          <header className="flex shrink-0 items-center gap-3 border-b border-border bg-surface px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] sm:py-3.5">
            <span className="relative grid size-10 shrink-0 place-items-center rounded-full bg-primary text-white">
              <Sparkles className="size-5 text-white" strokeWidth={2} />
              <span className="absolute -bottom-1 -right-1 rounded-full border-2 border-surface bg-success px-1 py-0.5 text-[7px] font-bold leading-none text-white">
                IA
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">Roberto</h2>
                <span className="size-1.5 rounded-full bg-success" title="Disponível" />
              </div>
              <p className="text-xs text-muted-foreground">Assistente PDR Hub</p>
            </div>
            <Button variant="ghost" size="iconSm" onClick={resetConversation} aria-label="Limpar conversa" title="Limpar conversa">
              <RotateCcw className="size-4" />
            </Button>
            <Button variant="ghost" size="iconSm" onClick={closeWidget} aria-label="Fechar Roberto">
              <X className="size-4.5" />
            </Button>
          </header>

          <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-background px-4 py-4" aria-live="polite">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onConfirm={confirmAction}
                onCancel={cancelAction}
                confirming={confirming}
              />
            ))}
            {loading ? <TypingIndicator /> : null}
          </div>

          <footer className="shrink-0 border-t border-border bg-surface px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 sm:p-3">
            {messages.length === 1 ? (
              <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto pb-0.5">
                {SUGGESTIONS.map((suggestion) => (
                  <Button key={suggestion} variant="outline" size="sm" className="whitespace-nowrap" onClick={() => submitMessage(suggestion)}>
                    {suggestion}
                  </Button>
                ))}
              </div>
            ) : null}

            {error ? (
              <div className="mb-2.5 flex items-start gap-2 rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger">
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            <div
              className={`flex items-end gap-2 rounded-xl border bg-background p-1.5 transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15 ${
                recording ? "border-danger/40" : "border-border"
              }`}
            >
              {recording || transcribing ? (
                <RecordingBar
                  elapsed={recorder.elapsed}
                  levels={recorder.levels}
                  transcribing={transcribing}
                  onCancel={cancelRecording}
                  onFinish={finishRecording}
                />
              ) : (
                <>
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={input}
                    onChange={(event) => setInput(event.target.value.slice(0, 5000))}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      hasPendingConfirmation
                        ? "Você pode confirmar acima ou enviar outra mensagem"
                        : micSupported
                          ? "Digite ou grave um áudio..."
                          : "Digite uma mensagem..."
                    }
                    className="max-h-28 min-h-9 min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-5 text-foreground outline-none placeholder:text-muted-foreground"
                    disabled={loading || Boolean(confirming)}
                  />
                  {micSupported ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9 shrink-0 rounded-lg text-muted-foreground hover:text-foreground"
                      onClick={startRecording}
                      disabled={loading || Boolean(confirming) || recorder.status === "requesting"}
                      aria-label="Gravar áudio"
                      title="Gravar áudio"
                    >
                      {recorder.status === "requesting" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Mic className="size-4.5" />
                      )}
                    </Button>
                  ) : null}
                  <Button
                    size="icon"
                    className="size-9 shrink-0 rounded-lg"
                    onClick={() => submitMessage()}
                    disabled={!input.trim() || loading || Boolean(confirming)}
                    aria-label="Enviar mensagem"
                  >
                    {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  </Button>
                </>
              )}
            </div>
            <p className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
              <Sparkles className="size-3 text-primary" />
              Roberto pode cometer erros. Confirme dados importantes.
            </p>
          </footer>
        </section>
      )}
    </Portal>
  );
}
