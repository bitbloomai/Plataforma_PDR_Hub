"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Crop, Minus, Move, Plus, RotateCw } from "lucide-react";

import { toast } from "@/lib/toast";

import { Button } from "./Button";
import { Modal } from "./Modal";
import { cn } from "./utils";

/** Tamanho máximo do arquivo original; o recorte final é bem menor. */
export const MAX_CROP_SOURCE_SIZE = 15 * 1024 * 1024;

const STAGE_SIZE = 288;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const KEYBOARD_STEP = 8;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function rotatedSize(natural, rotation) {
  if (!natural) return null;
  return rotation % 180 === 0
    ? { width: natural.width, height: natural.height }
    : { width: natural.height, height: natural.width };
}

/** Escala que faz a imagem cobrir todo o quadro de recorte. */
function displayScale(natural, rotation, zoom) {
  const size = rotatedSize(natural, rotation);
  if (!size) return 1;
  return Math.max(STAGE_SIZE / size.width, STAGE_SIZE / size.height) * zoom;
}

function clampOffset(offset, natural, rotation, zoom) {
  const size = rotatedSize(natural, rotation);
  if (!size) return { x: 0, y: 0 };

  const scale = displayScale(natural, rotation, zoom);
  const maxX = Math.max(0, (size.width * scale - STAGE_SIZE) / 2);
  const maxY = Math.max(0, (size.height * scale - STAGE_SIZE) / 2);

  return {
    x: clamp(offset.x, -maxX, maxX),
    y: clamp(offset.y, -maxY, maxY),
  };
}

/**
 * Modal para enquadrar uma imagem antes do upload (avatar, logo...).
 * O estado interno nasce na montagem: use uma `key` nova para cada arquivo.
 */
export function ImageCropModal({
  open,
  file,
  onClose,
  onConfirm,
  title = "Ajustar foto",
  description = "Arraste para posicionar e use o zoom para enquadrar.",
  shape = "circle",
  outputSize = 512,
  outputType = "image/jpeg",
  outputQuality = 0.92,
  confirmLabel = "Aplicar recorte",
}) {
  const imageRef = useRef(null);
  const dragRef = useRef(null);
  const wheelHandlerRef = useRef(null);

  const [natural, setNatural] = useState(null);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);

  const imageUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  const scale = displayScale(natural, rotation, zoom);

  function applyZoom(nextZoom) {
    const value = clamp(Number(nextZoom) || MIN_ZOOM, MIN_ZOOM, MAX_ZOOM);
    setZoom(value);
    setOffset((current) => clampOffset(current, natural, rotation, value));
  }

  function rotate() {
    const next = (rotation + 90) % 360;
    setRotation(next);
    setOffset((current) => clampOffset(current, natural, next, zoom));
  }

  function moveBy(dx, dy) {
    setOffset((current) =>
      clampOffset({ x: current.x + dx, y: current.y + dy }, natural, rotation, zoom)
    );
  }

  useEffect(() => {
    wheelHandlerRef.current = (event) => {
      event.preventDefault();
      applyZoom(zoom - event.deltaY * 0.0015 * zoom);
    };
  });

  function stageRef(node) {
    if (!node) return undefined;
    const handler = (event) => wheelHandlerRef.current?.(event);
    node.addEventListener("wheel", handler, { passive: false });
    return () => node.removeEventListener("wheel", handler);
  }

  function handlePointerDown(event) {
    if (!natural) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
    };
    setDragging(true);
  }

  function handlePointerMove(event) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    setOffset(
      clampOffset(
        {
          x: drag.originX + event.clientX - drag.startX,
          y: drag.originY + event.clientY - drag.startY,
        },
        natural,
        rotation,
        zoom
      )
    );
  }

  function handlePointerUp(event) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
  }

  function handleKeyDown(event) {
    const moves = {
      ArrowLeft: [KEYBOARD_STEP, 0],
      ArrowRight: [-KEYBOARD_STEP, 0],
      ArrowUp: [0, KEYBOARD_STEP],
      ArrowDown: [0, -KEYBOARD_STEP],
    };

    if (moves[event.key]) {
      event.preventDefault();
      moveBy(...moves[event.key]);
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      applyZoom(zoom + 0.1);
    } else if (event.key === "-") {
      event.preventDefault();
      applyZoom(zoom - 0.1);
    }
  }

  async function handleConfirm() {
    const image = imageRef.current;
    if (!image || !natural) return;

    setProcessing(true);

    try {
      const canvas = document.createElement("canvas");
      canvas.width = outputSize;
      canvas.height = outputSize;

      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas indisponível.");

      const ratio = outputSize / STAGE_SIZE;
      const width = natural.width * scale * ratio;
      const height = natural.height * scale * ratio;

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";

      // JPEG não tem transparência: um fundo branco evita bordas pretas em PNGs.
      if (outputType === "image/jpeg") {
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, outputSize, outputSize);
      }

      context.translate(outputSize / 2 + offset.x * ratio, outputSize / 2 + offset.y * ratio);
      context.rotate((rotation * Math.PI) / 180);
      context.drawImage(image, -width / 2, -height / 2, width, height);

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (result) => (result ? resolve(result) : reject(new Error("Falha ao gerar a imagem."))),
          outputType,
          outputQuality
        );
      });

      const extension = outputType === "image/png" ? "png" : outputType === "image/webp" ? "webp" : "jpg";
      const baseName = String(file?.name || "imagem").replace(/\.[^.]+$/, "") || "imagem";
      const cropped = new File([blob], `${baseName}-recorte.${extension}`, {
        type: outputType,
        lastModified: Date.now(),
      });

      await onConfirm?.(cropped);
    } catch (cropError) {
      console.error("Recorte de imagem", cropError);
      toast.error("Não foi possível recortar", "Tente novamente ou escolha outra imagem.");
    } finally {
      setProcessing(false);
    }
  }

  const zoomPercent = Math.round(((zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100);

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!processing) onClose?.();
      }}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={processing}>
            Cancelar
          </Button>
          <Button leftIcon={Crop} onClick={handleConfirm} loading={processing} disabled={!natural}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-4">
        <div
          ref={stageRef}
          role="application"
          tabIndex={0}
          aria-label="Área de recorte. Arraste ou use as setas para posicionar; + e - para zoom."
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onKeyDown={handleKeyDown}
          className={cn(
            "relative shrink-0 touch-none select-none overflow-hidden rounded-xl bg-surface-3 outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            natural ? (dragging ? "cursor-grabbing" : "cursor-grab") : "cursor-wait"
          )}
          style={{ width: STAGE_SIZE, height: STAGE_SIZE }}
        >
          {imageUrl ? (
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Pré-visualização do recorte"
              draggable={false}
              onLoad={(event) => {
                const { naturalWidth, naturalHeight } = event.currentTarget;
                setNatural({ width: naturalWidth, height: naturalHeight });
              }}
              className={cn(
                "pointer-events-none absolute left-1/2 top-1/2 max-w-none transition-opacity",
                natural ? "opacity-100" : "opacity-0"
              )}
              style={
                natural
                  ? {
                      width: natural.width * scale,
                      height: natural.height * scale,
                      transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) rotate(${rotation}deg)`,
                    }
                  : undefined
              }
            />
          ) : null}

          <div
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-0 border-2 border-white/85 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]",
              shape === "circle" ? "rounded-full" : "rounded-lg"
            )}
          />

          <div
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-0 transition-opacity duration-200",
              dragging ? "opacity-100" : "opacity-0"
            )}
          >
            <div className="absolute inset-y-0 left-1/3 w-px bg-white/35" />
            <div className="absolute inset-y-0 left-2/3 w-px bg-white/35" />
            <div className="absolute inset-x-0 top-1/3 h-px bg-white/35" />
            <div className="absolute inset-x-0 top-2/3 h-px bg-white/35" />
          </div>
        </div>

        <div className="flex w-full max-w-[288px] items-center gap-2">
          <Button
            variant="ghost"
            size="iconSm"
            onClick={() => applyZoom(zoom - 0.2)}
            disabled={!natural || zoom <= MIN_ZOOM}
            aria-label="Diminuir zoom"
          >
            <Minus className="size-4" strokeWidth={1.8} />
          </Button>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            disabled={!natural}
            onChange={(event) => applyZoom(event.target.value)}
            aria-label="Zoom"
            className="h-1.5 min-w-0 flex-1 cursor-pointer accent-primary disabled:cursor-not-allowed"
          />
          <Button
            variant="ghost"
            size="iconSm"
            onClick={() => applyZoom(zoom + 0.2)}
            disabled={!natural || zoom >= MAX_ZOOM}
            aria-label="Aumentar zoom"
          >
            <Plus className="size-4" strokeWidth={1.8} />
          </Button>
          <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{zoomPercent}%</span>
        </div>

        <div className="flex w-full max-w-[288px] items-center justify-between gap-2">
          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Move className="size-3.5" strokeWidth={1.8} />
            Arraste para posicionar
          </p>
          <Button variant="outline" size="sm" leftIcon={RotateCw} onClick={rotate} disabled={!natural}>
            Girar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
