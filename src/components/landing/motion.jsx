"use client";

import { useEffect, useRef, useState } from "react";

/* =========================================================
   LOOP DE SCROLL COMPARTILHADO
   Um único listener + requestAnimationFrame para todos os
   efeitos da página. Cada efeito só escreve em `style`.
   ========================================================= */

const subscribers = new Set();
let ticking = false;
let listening = false;

function runFrame() {
  ticking = false;
  subscribers.forEach((callback) => callback());
}

function requestFrame() {
  if (ticking) return;
  ticking = true;
  window.requestAnimationFrame(runFrame);
}

function subscribe(callback) {
  subscribers.add(callback);

  if (!listening) {
    listening = true;
    window.addEventListener("scroll", requestFrame, { passive: true });
    window.addEventListener("resize", requestFrame, { passive: true });
  }

  requestFrame();

  return () => {
    subscribers.delete(callback);

    if (!subscribers.size && listening) {
      listening = false;
      window.removeEventListener("scroll", requestFrame);
      window.removeEventListener("resize", requestFrame);
    }
  };
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Executa `onFrame(rect, viewportHeight)` a cada frame de scroll
 * enquanto o elemento existir. Ignorado com reduced motion.
 */
export function useScrollFrame(ref, onFrame) {
  const callbackRef = useRef(onFrame);

  useEffect(() => {
    callbackRef.current = onFrame;
  });

  useEffect(() => {
    if (prefersReducedMotion()) return undefined;

    return subscribe(() => {
      const node = ref.current;
      if (!node) return;
      callbackRef.current(node.getBoundingClientRect(), window.innerHeight, node);
    });
  }, [ref]);
}

/**
 * Desloca o conteúdo no eixo Y proporcionalmente à distância
 * do elemento até o centro da viewport.
 * speed > 0 → mais lento que o scroll; speed < 0 → mais rápido.
 */
export function Parallax({ speed = 0.15, x = 0, rotate = 0, className = "", children, as: Tag = "div" }) {
  const ref = useRef(null);

  useScrollFrame(ref, (rect, vh, node) => {
    const offset = rect.top + rect.height / 2 - vh / 2;
    const ty = offset * speed;
    const tx = offset * x;
    const r = offset * rotate * 0.01;
    node.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0) rotate(${r.toFixed(2)}deg)`;
  });

  return (
    <Tag ref={ref} className={`will-change-transform ${className}`}>
      {children}
    </Tag>
  );
}

/**
 * Revela o conteúdo quando entra na viewport.
 */
export function Reveal({ children, className = "", delay = 0, as: Tag = "div", from = "up" }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      data-shown={shown}
      data-from={from}
      className={`lp-reveal ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}

/**
 * Número que conta até o valor final quando aparece.
 */
export function CountUp({ value, duration = 1400, format = (n) => Math.round(n).toLocaleString("pt-BR") }) {
  const ref = useRef(null);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    if (prefersReducedMotion()) {
      const frame = window.requestAnimationFrame(() => setCurrent(value));
      return () => window.cancelAnimationFrame(frame);
    }

    let frame = 0;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();

      const start = performance.now();

      const step = (now) => {
        const t = clamp((now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 4);
        setCurrent(value * eased);
        if (t < 1) frame = window.requestAnimationFrame(step);
      };

      frame = window.requestAnimationFrame(step);
    });

    observer.observe(node);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [value, duration]);

  return <span ref={ref}>{format(current)}</span>;
}
