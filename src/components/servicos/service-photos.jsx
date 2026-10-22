"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ImagePlus,
  Images,
  Loader2,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { Button, Portal } from "@/components/shared";
import {
  ACCEPTED_PHOTO_TYPES,
  MAX_SERVICE_PHOTOS,
  compressServicePhotos,
  compressionSummary,
  deleteServicePhotos,
  listServicePhotos,
  uploadServicePhotos,
} from "@/lib/service-photos";
import { toast } from "@/lib/toast";

function isImageFile(file) {
  return /^image\//i.test(file?.type || "") || /\.hei[cf]$/i.test(file?.name || "");
}

function CompressionProgress({ done, total }) {
  const current = Math.min(done + 1, total);
  const percent = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="rounded-xl border border-border bg-surface-2/40 p-4" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 font-medium text-foreground">
          <Loader2 className="size-4 animate-spin" />
          Otimizando foto {current} de {total}
        </span>
        <span className="text-xs text-muted-foreground">{percent}%</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Reduzindo o tamanho sem perder os detalhes do reparo.
      </p>
    </div>
  );
}

function photoKey(photo) {
  return photo.key || photo.id;
}

function photoUrl(photo) {
  return photo.previewUrl || photo.url;
}

function photoName(photo) {
  return photo.file?.name || photo.nome_arquivo || "Foto do serviço";
}

/* =========================================================
   VISUALIZADOR
   ========================================================= */

export function PhotoLightbox({ photos, index, onClose, onIndexChange }) {
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");
  const touchStartRef = useRef(null);
  const total = photos.length;
  const current = photos[index];

  const go = useCallback(
    (delta) => {
      if (total < 2) return;
      setZoomed(false);
      onIndexChange((index + delta + total) % total);
    },
    [index, onIndexChange, total]
  );

  useEffect(() => {
    // Captura antes do Drawer/Modal para que Esc feche só o visualizador.
    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        go(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(-1);
      } else if (event.key === "Tab") {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [go, onClose]);

  if (!current) return null;

  function toggleZoom(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setOrigin(`${x}% ${y}%`);
    setZoomed((value) => !value);
  }

  function onTouchStart(event) {
    touchStartRef.current = event.touches[0]?.clientX ?? null;
  }

  function onTouchEnd(event) {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (start === null || zoomed) return;
    const delta = (event.changedTouches[0]?.clientX ?? start) - start;
    if (Math.abs(delta) > 50) go(delta < 0 ? 1 : -1);
  }

  const url = photoUrl(current);

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[300] flex flex-col bg-black/95 text-white"
        role="dialog"
        aria-modal="true"
        aria-label="Visualizador de fotos"
      >
        <div className="flex h-14 shrink-0 items-center gap-3 px-3 sm:px-5">
          <p className="min-w-0 flex-1 truncate text-sm text-white/80">
            <span className="font-semibold text-white">
              {index + 1} / {total}
            </span>
            <span className="ml-3 hidden sm:inline">{photoName(current)}</span>
          </p>

          <button
            type="button"
            onClick={() => setZoomed((value) => !value)}
            className="grid size-10 place-items-center rounded-lg text-white/80 transition hover:bg-white/10 hover:text-white"
            aria-label={zoomed ? "Reduzir zoom" : "Ampliar"}
          >
            {zoomed ? <ZoomOut className="size-5" /> : <ZoomIn className="size-5" />}
          </button>

          {url && !current.previewUrl ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="grid size-10 place-items-center rounded-lg text-white/80 transition hover:bg-white/10 hover:text-white"
              aria-label="Abrir original"
            >
              <ExternalLink className="size-5" />
            </a>
          ) : null}

          <button
            type="button"
            onClick={onClose}
            className="grid size-10 place-items-center rounded-lg text-white/80 transition hover:bg-white/10 hover:text-white"
            aria-label="Fechar visualizador"
          >
            <X className="size-5" />
          </button>
        </div>

        <div
          className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-2 sm:px-16"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onClick={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={photoKey(current)}
            src={url}
            alt={photoName(current)}
            onClick={toggleZoom}
            draggable={false}
            className={`max-h-full max-w-full select-none object-contain transition-transform duration-300 ${
              zoomed ? "cursor-zoom-out" : "cursor-zoom-in"
            }`}
            style={{ transform: zoomed ? "scale(2.2)" : "none", transformOrigin: origin }}
          />

          {total > 1 ? (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                className="absolute left-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20 sm:left-4"
                aria-label="Foto anterior"
              >
                <ChevronLeft className="size-6" />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                className="absolute right-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20 sm:right-4"
                aria-label="Próxima foto"
              >
                <ChevronRight className="size-6" />
              </button>
            </>
          ) : null}
        </div>

        {total > 1 ? (
          <div className="no-scrollbar flex shrink-0 justify-start gap-2 overflow-x-auto px-3 py-3 sm:justify-center sm:px-5">
            {photos.map((photo, photoIndex) => (
              <button
                key={photoKey(photo)}
                type="button"
                onClick={() => {
                  setZoomed(false);
                  onIndexChange(photoIndex);
                }}
                className={`size-14 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                  photoIndex === index ? "border-primary opacity-100" : "border-transparent opacity-50 hover:opacity-90"
                }`}
                aria-label={`Ver foto ${photoIndex + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl(photo)} alt="" className="size-full object-cover" />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </Portal>
  );
}

/* =========================================================
   PEÇAS COMPARTILHADAS
   ========================================================= */

function PhotoTile({ photo, onOpen, onRemove, removeLabel = "Remover foto", busy = false, badge }) {
  return (
    <div className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-2">
      <button
        type="button"
        onClick={onOpen}
        className="block size-full"
        aria-label={`Abrir ${photoName(photo)}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoUrl(photo)}
          alt={photoName(photo)}
          loading="lazy"
          className="size-full object-cover transition duration-300 group-hover:scale-105"
        />
      </button>

      {badge ? (
        <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
          {badge}
        </span>
      ) : null}

      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-md bg-black/60 text-white opacity-100 transition hover:bg-danger sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
          aria-label={removeLabel}
          title={removeLabel}
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" strokeWidth={2.2} />}
        </button>
      ) : null}
    </div>
  );
}

function filesFromEvent(event) {
  return [...(event.target?.files || event.dataTransfer?.files || [])];
}

function DropZone({ onFiles, disabled, compact = false, children }) {
  const inputId = useId();
  const [dragging, setDragging] = useState(false);

  function openPicker() {
    document.getElementById(inputId)?.click();
  }

  return (
    <div
      onDragOver={(event) => {
        if (disabled) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (!disabled) onFiles(filesFromEvent(event));
      }}
    >
      <input
        id={inputId}
        type="file"
        accept={ACCEPTED_PHOTO_TYPES}
        multiple
        className="hidden"
        onChange={(event) => {
          onFiles(filesFromEvent(event));
          event.target.value = "";
        }}
      />

      {children ? (
        children(openPicker, dragging)
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={openPicker}
          className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-center transition disabled:cursor-not-allowed disabled:opacity-60 ${
            compact ? "py-5" : "py-8"
          } ${dragging ? "border-primary bg-primary/5" : "border-border-strong bg-surface-2/40 hover:border-primary/60 hover:bg-primary/[0.03]"}`}
        >
          <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-foreground">
            <ImagePlus className="size-5" strokeWidth={1.8} />
          </span>
          <span className="text-sm font-medium text-foreground">
            Adicionar fotos
          </span>
          <span className="text-xs text-muted-foreground">
            Arraste aqui ou toque para escolher · JPG, PNG ou WEBP
          </span>
        </button>
      )}
    </div>
  );
}

/* =========================================================
   CAMPO DO FORMULÁRIO
   As fotos ficam em rascunho e sobem depois que o serviço é salvo.
   ========================================================= */

export function ServicePhotoField({
  supabase,
  contaId,
  serviceId,
  draft,
  onChange,
  onBusyChange,
  disabled = false,
}) {
  const [existing, setExisting] = useState([]);
  const [loading, setLoading] = useState(Boolean(serviceId));
  const [viewerIndex, setViewerIndex] = useState(null);
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    let ignore = false;
    if (!serviceId || !contaId) return undefined;

    listServicePhotos(supabase, { contaId, serviceId })
      .then((photos) => {
        if (!ignore) setExisting(photos);
      })
      .catch((error) => {
        console.warn("Fotos do serviço", error);
        if (!ignore) toast.error("Fotos não carregadas", error?.message || "Tente novamente.");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [contaId, serviceId, supabase]);

  const removedIds = new Set(draft.removed.map((photo) => photo.id));
  const visibleExisting = existing.filter((photo) => !removedIds.has(photo.id));
  const allPhotos = [...visibleExisting, ...draft.added];

  async function addFiles(files) {
    const images = files.filter(isImageFile);
    if (images.length < files.length) {
      toast.warning("Arquivo ignorado", "Somente imagens podem ser anexadas ao serviço.");
    }
    if (!images.length) return;

    const room = MAX_SERVICE_PHOTOS - allPhotos.length;
    if (room <= 0) {
      toast.warning("Limite de fotos", `Cada serviço aceita até ${MAX_SERVICE_PHOTOS} fotos.`);
      return;
    }

    const accepted = images.slice(0, room);
    if (accepted.length < images.length) {
      toast.warning("Limite de fotos", `Foram adicionadas ${accepted.length}. Cada serviço aceita até ${MAX_SERVICE_PHOTOS} fotos.`);
    }

    // Comprime já na seleção: a prévia fica leve e o envio, rápido.
    setProgress({ done: 0, total: accepted.length });
    onBusyChange?.(true);

    const result = await compressServicePhotos(accepted, (done, total) => setProgress({ done, total }));

    setProgress(null);
    onBusyChange?.(false);

    if (result.files.length) {
      onChange((current) => ({
        ...current,
        added: [
          ...current.added,
          ...result.files.map((file) => ({
            key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            file,
            previewUrl: URL.createObjectURL(file),
          })),
        ],
      }));
      toast.success("Fotos prontas", compressionSummary(result));
    }

    if (result.errors.length) {
      toast.error("Algumas fotos não foram adicionadas", result.errors.slice(0, 2).join(" "));
    }
  }

  function removePhoto(photo) {
    if (photo.previewUrl) {
      URL.revokeObjectURL(photo.previewUrl);
      onChange((current) => ({ ...current, added: current.added.filter((item) => item.key !== photo.key) }));
    } else {
      onChange((current) => ({
        ...current,
        removed: [...current.removed, { id: photo.id, storage_path: photo.storage_path }],
      }));
    }
  }

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Carregando fotos...
        </div>
      ) : null}

      {allPhotos.length ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {allPhotos.map((photo, index) => (
            <PhotoTile
              key={photoKey(photo)}
              photo={photo}
              badge={photo.previewUrl ? "Nova" : null}
              onOpen={() => setViewerIndex(index)}
              onRemove={disabled ? null : () => removePhoto(photo)}
            />
          ))}
        </div>
      ) : null}

      {progress ? (
        <CompressionProgress done={progress.done} total={progress.total} />
      ) : (
        <DropZone onFiles={addFiles} disabled={disabled} compact={allPhotos.length > 0} />
      )}

      {draft.removed.length ? (
        <p className="text-xs text-muted-foreground">
          {draft.removed.length} foto(s) serão removidas ao salvar.{" "}
          <button
            type="button"
            className="font-medium text-foreground underline-offset-2 hover:underline"
            onClick={() => onChange((current) => ({ ...current, removed: [] }))}
          >
            Desfazer
          </button>
        </p>
      ) : null}

      {viewerIndex !== null && allPhotos[viewerIndex] ? (
        <PhotoLightbox
          photos={allPhotos}
          index={viewerIndex}
          onIndexChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      ) : null}
    </div>
  );
}

/* =========================================================
   GALERIA DO DRAWER
   Envio e remoção acontecem na hora.
   ========================================================= */

export function ServicePhotoGallery({ supabase, contaId, serviceId, usuarioId }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyLabel, setBusyLabel] = useState("");
  const [removingId, setRemovingId] = useState("");
  const [confirmId, setConfirmId] = useState("");
  const [viewerIndex, setViewerIndex] = useState(null);

  const reload = useCallback(async () => {
    try {
      const list = await listServicePhotos(supabase, { contaId, serviceId });
      setPhotos(list);
    } catch (error) {
      console.warn("Fotos do serviço", error);
      toast.error("Fotos não carregadas", error?.message || "Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [contaId, serviceId, supabase]);

  useEffect(() => {
    if (!serviceId || !contaId) return undefined;
    const frame = requestAnimationFrame(() => reload());
    return () => cancelAnimationFrame(frame);
  }, [contaId, reload, serviceId]);

  async function handleFiles(files) {
    const images = files.filter(isImageFile);
    if (!images.length) {
      if (files.length) toast.warning("Arquivo ignorado", "Somente imagens podem ser anexadas ao serviço.");
      return;
    }

    const room = MAX_SERVICE_PHOTOS - photos.length;
    if (room <= 0) {
      toast.warning("Limite de fotos", `Cada serviço aceita até ${MAX_SERVICE_PHOTOS} fotos.`);
      return;
    }

    const accepted = images.slice(0, room);
    setBusyLabel(`Otimizando 0/${accepted.length}`);

    const compressed = await compressServicePhotos(accepted, (done, total) =>
      setBusyLabel(`Otimizando ${Math.min(done + 1, total)}/${total}`)
    );

    let uploaded = 0;
    const errors = [...compressed.errors];

    if (compressed.files.length) {
      setBusyLabel(`Enviando ${compressed.files.length}...`);
      const result = await uploadServicePhotos(supabase, {
        contaId,
        serviceId,
        usuarioId,
        files: compressed.files,
      });
      uploaded = result.uploaded;
      errors.push(...result.errors);
    }

    setBusyLabel("");
    await reload();

    if (uploaded) {
      toast.success(
        uploaded === 1 ? "Foto adicionada" : `${uploaded} fotos adicionadas`,
        compressionSummary(compressed)
      );
    }

    if (errors.length) {
      toast.error("Algumas fotos não foram enviadas", errors.slice(0, 2).join(" "));
    }
  }

  async function handleRemove(photo) {
    setRemovingId(photo.id);
    try {
      await deleteServicePhotos(supabase, { contaId, photos: [photo] });
      setPhotos((current) => current.filter((item) => item.id !== photo.id));
      toast.success("Foto removida");
    } catch (error) {
      toast.error("Não foi possível remover", error?.message || "Tente novamente.");
    } finally {
      setRemovingId("");
      setConfirmId("");
    }
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <DropZone onFiles={handleFiles} disabled={Boolean(busyLabel)}>
        {(openPicker, dragging) => (
          <div className={`rounded-lg transition ${dragging ? "bg-primary/5 ring-2 ring-primary/40" : ""}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Images className="size-5" strokeWidth={1.8} />
                <div>
                  <p className="text-sm font-semibold text-foreground">Fotos do serviço</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {loading
                      ? "Carregando..."
                      : photos.length
                        ? `${photos.length} foto(s) · toque para ampliar`
                        : "Registre o antes e depois do reparo."}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                leftIcon={ImagePlus}
                loading={Boolean(busyLabel)}
                loadingText={busyLabel}
                onClick={openPicker}
              >
                Adicionar
              </Button>
            </div>

            {loading ? (
              <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="aspect-square animate-pulse rounded-lg bg-surface-2" />
                ))}
              </div>
            ) : photos.length ? (
              <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {photos.map((photo, index) =>
                  confirmId === photo.id ? (
                    <div
                      key={photo.id}
                      className="flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border border-danger/30 bg-danger/5 p-2 text-center"
                    >
                      <p className="text-xs font-medium text-foreground">Remover foto?</p>
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          variant="danger"
                          leftIcon={Trash2}
                          loading={removingId === photo.id}
                          onClick={() => handleRemove(photo)}
                          aria-label="Confirmar remoção"
                        />
                        <Button size="sm" variant="secondary" onClick={() => setConfirmId("")}>
                          Não
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <PhotoTile
                      key={photo.id}
                      photo={photo}
                      onOpen={() => setViewerIndex(index)}
                      onRemove={() => setConfirmId(photo.id)}
                    />
                  )
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={openPicker}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong py-6 text-sm text-muted-foreground transition hover:border-primary/60 hover:text-foreground"
              >
                <ImagePlus className="size-4" strokeWidth={1.8} />
                Nenhuma foto ainda · arraste ou toque para adicionar
              </button>
            )}
          </div>
        )}
      </DropZone>

      {viewerIndex !== null && photos[viewerIndex] ? (
        <PhotoLightbox
          photos={photos}
          index={viewerIndex}
          onIndexChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      ) : null}
    </section>
  );
}
