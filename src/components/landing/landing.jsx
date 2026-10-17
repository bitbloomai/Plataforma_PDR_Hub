"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Mail,
  Menu,
  MessageCircle,
  Mic,
  LockKeyhole,
  Sparkles,
  X,
} from "lucide-react";

import { CountUp, Parallax, Reveal, clamp, useScrollFrame } from "./motion";
import { ScreenShot } from "./mockups";

/* =========================================================
   CONTATO
   ========================================================= */

const EMAIL = "bitbloomai@gmail.com";
const PHONE_LABEL = "+55 32 9 9935-5873";
const WHATSAPP = `https://wa.me/5532999355873?text=${encodeURIComponent(
  "Olá! Quero conhecer o PDR Hub para a minha operação."
)}`;
const DEVELOPER_URL = "https://bitbloomai.com";

const NAV_LINKS = [
  ["Como funciona", "#fluxo"],
  ["Financeiro", "#financeiro"],
  ["Roberto", "#roberto"],
  ["Recursos", "#recursos"],
  ["Contato", "#contato"],
];

/* =========================================================
   PEÇAS VISUAIS
   ========================================================= */

function Hexagon({ className = "", strokeWidth = 1.2 }) {
  return (
    <svg viewBox="0 0 100 115" fill="none" className={className} aria-hidden="true">
      <path
        d="M50 2.5 97 29.5v56L50 112.5 3 85.5v-56L50 2.5Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function Plate({ children, className = "" }) {
  return (
    <span
      className={`inline-flex items-stretch overflow-hidden rounded-md border border-[#171715]/15 bg-white font-mono text-[13px] font-semibold tracking-[0.12em] text-[#171715] shadow-sm ${className}`}
    >
      <span className="flex w-4 items-end justify-center bg-[#1f4fbf] pb-0.5 text-[7px] font-bold tracking-normal text-white">
        I
      </span>
      <span className="px-2.5 py-1">{children}</span>
    </span>
  );
}

function SectionLabel({ index, children, dark = false }) {
  return (
    <p
      className={`flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] ${
        dark ? "text-white/45" : "text-muted-foreground"
      }`}
    >
      <span className={dark ? "text-primary" : "text-foreground"}>{index}</span>
      <span className={`h-px w-8 ${dark ? "bg-white/20" : "bg-border-strong"}`} />
      {children}
    </p>
  );
}

/* =========================================================
   NAVEGAÇÃO
   ========================================================= */

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled || open
          ? "border-b border-black/[0.06] bg-white/85 backdrop-blur-xl"
          : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-[68px] max-w-[1240px] items-center gap-8 px-5 sm:px-8">
        <Link href="/" aria-label="PDR Hub" className="shrink-0">
          <Image
            src="/Logo_Completa.png"
            alt="PDR Hub"
            width={500}
            height={191}
            loading="eager"
            fetchPriority="high"
            className="h-10 w-auto"
          />
        </Link>

        <nav className="hidden items-center gap-7 text-[13px] font-medium text-muted-foreground lg:flex">
          {NAV_LINKS.map(([label, href]) => (
            <a key={href} href={href} className="transition-colors hover:text-foreground">
              {label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <a
            href={WHATSAPP}
            target="_blank"
            rel="noreferrer"
            className="hidden h-10 items-center px-3 text-[13px] font-medium text-foreground transition-colors hover:text-muted-foreground sm:inline-flex"
          >
            Falar com vendas
          </a>
          <Link
            href="/login"
            className="group inline-flex h-10 items-center gap-2 rounded-full bg-[#171715] pl-4 pr-3 text-[13px] font-semibold text-white transition-colors hover:bg-black"
          >
            Área do cliente
            <span className="grid size-5 place-items-center rounded-full bg-primary text-[#171715] transition-transform group-hover:translate-x-0.5">
              <ArrowRight className="size-3" strokeWidth={2.4} />
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            className="grid size-10 place-items-center rounded-full text-foreground lg:hidden"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-black/[0.06] px-5 pb-6 pt-2 lg:hidden">
          {NAV_LINKS.map(([label, href]) => (
            <a
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="flex h-12 items-center justify-between border-b border-black/[0.06] text-[15px] font-medium"
            >
              {label}
              <ArrowRight className="size-4 text-muted-foreground" />
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}

/* =========================================================
   HERO
   ========================================================= */

function HeroScreen() {
  const ref = useRef(null);

  useScrollFrame(ref, (_rect, vh, node) => {
    const p = clamp(window.scrollY / (vh * 0.75));
    const rotate = 22 * (1 - p);
    const scale = 0.9 + 0.1 * p;
    const lift = 40 * (1 - p);
    node.style.transform = `perspective(1800px) translate3d(0, ${lift}px, 0) rotateX(${rotate}deg) scale(${scale})`;
  });

  return (
    <div className="lp-hero-screen">
      <div ref={ref} className="origin-top will-change-transform">
        <ScreenShot screen="dashboard" height={930} />
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden pt-[124px] sm:pt-[150px]">
      {/* Fundo: hexágonos da marca em camadas de parallax */}
      <Parallax speed={-0.25} rotate={-1.2} className="pointer-events-none absolute -right-40 top-10 hidden md:block">
        <Hexagon className="size-[560px] text-primary/50" />
      </Parallax>
      <Parallax speed={-0.12} rotate={0.8} className="pointer-events-none absolute -right-10 top-48 hidden md:block">
        <Hexagon className="size-[300px] text-border-strong" />
      </Parallax>
      <Parallax speed={-0.35} className="pointer-events-none absolute -left-24 top-[520px]">
        <Hexagon className="size-[220px] text-border" />
      </Parallax>

      <div className="relative mx-auto max-w-[1240px] px-5 sm:px-8">
        <h1 className="lp-hero-title max-w-[1000px] text-[clamp(48px,9.4vw,132px)] font-semibold leading-[0.9] tracking-[-0.055em] text-foreground">
          <span className="block">Do martelinho</span>
          <span className="block">
            ao{" "}
            <span className="relative inline-block">
              <span className="relative z-10">DRE.</span>
              <span className="lp-marker absolute inset-x-[-0.06em] bottom-[0.08em] z-0 h-[0.32em] bg-primary" />
            </span>
          </span>
        </h1>

        <div className="mt-10 grid gap-8 md:mt-14 md:grid-cols-[1fr_auto] md:items-end">
          <p className="lp-fade max-w-[560px] text-[17px] leading-[1.65] text-muted-foreground sm:text-[19px]">
            Serviços, oficinas parceiras, técnicos, repasses e resultado
            financeiro numa plataforma só. Feita para empresas de martelinho
            de ouro que cansaram de fechar o mês na planilha.
          </p>

          <div className="lp-fade flex flex-wrap items-center gap-3 [animation-delay:120ms]">
            <a
              href={WHATSAPP}
              target="_blank"
              rel="noreferrer"
              className="group inline-flex h-[52px] items-center gap-3 rounded-full bg-primary pl-6 pr-2 text-[15px] font-semibold text-[#171715] shadow-[0_10px_30px_-8px_rgba(242,194,27,0.55)] transition-all hover:bg-primary-hover"
            >
              Agendar uma demonstração
              <span className="grid size-9 place-items-center rounded-full bg-[#171715] text-primary transition-transform group-hover:rotate-[-35deg]">
                <ArrowRight className="size-4" strokeWidth={2.2} />
              </span>
            </a>
            <Link
              href="/login"
              className="inline-flex h-[52px] items-center gap-2 rounded-full border border-border-strong px-6 text-[15px] font-medium text-foreground transition-colors hover:border-foreground"
            >
              Já sou cliente
            </Link>
          </div>
        </div>
      </div>

      {/* Print principal com perspectiva que se endireita no scroll */}
      <div className="relative mx-auto mt-16 max-w-[1240px] px-3 sm:mt-20 sm:px-8">
        <HeroScreen />

        <Parallax speed={-0.18} className="absolute -left-1 top-[18%] z-10 hidden w-[270px] md:block lg:-left-6">
          <div className="lp-float rounded-2xl border border-black/[0.06] bg-white/95 p-4 shadow-[0_24px_60px_-18px_rgba(23,23,21,0.35)] backdrop-blur">
            <div className="flex items-center justify-between">
              <Plate>GE 482 KT</Plate>
              <span className="text-[11px] font-medium text-success">Concluído</span>
            </div>
            <p className="mt-3 text-[13px] font-semibold">Fiat 500X · Carrozzeria Rossi</p>
            <div className="mt-3 space-y-1.5 border-t border-border pt-3 text-[12px]">
              <p className="flex justify-between"><span className="text-muted-foreground">Receita oficina</span><span className="font-medium text-success">+ € 1.250,00</span></p>
              <p className="flex justify-between"><span className="text-muted-foreground">Repasse Lucas</span><span className="font-medium">− € 375,00</span></p>
              <p className="flex justify-between"><span className="text-muted-foreground">Repasse Rafael</span><span className="font-medium">− € 312,50</span></p>
            </div>
          </div>
        </Parallax>

        <Parallax speed={-0.3} className="absolute -right-1 top-[46%] z-10 hidden w-[290px] md:block lg:-right-6">
          <div className="lp-float rounded-2xl bg-[#171715] p-4 text-white shadow-[0_24px_60px_-18px_rgba(23,23,21,0.55)] [animation-delay:-3s]">
            <div className="flex items-center gap-2 text-[12px] text-white/60">
              <span className="grid size-6 place-items-center rounded-full bg-primary text-[#171715]">
                <Sparkles className="size-3.5" strokeWidth={2} />
              </span>
              Roberto
            </div>
            <p className="mt-2.5 text-[13px] leading-relaxed text-white/90">
              Você tem <span className="font-semibold text-primary">€ 12.510,00</span> a receber
              em 9 lançamentos. O maior vence dia 13/11.
            </p>
          </div>
        </Parallax>
      </div>
    </section>
  );
}

/* =========================================================
   MANIFESTO — texto que acende conforme o scroll
   ========================================================= */

const MANIFESTO =
  "Quem fez o carro? Quanto a oficina ainda deve? Quanto vai para cada técnico no fim do mês? Se a resposta está espalhada entre WhatsApp, caderno e uma planilha que só uma pessoa entende, a operação está trabalhando para a planilha. O PDR Hub inverte isso.";

function Manifesto() {
  const ref = useRef(null);
  const words = MANIFESTO.split(" ");

  useScrollFrame(ref, (rect, vh, node) => {
    const p = clamp((vh * 0.85 - rect.top) / (rect.height + vh * 0.2));
    const lit = p * words.length * 1.15;
    node.querySelectorAll("[data-w]").forEach((span, index) => {
      span.style.opacity = index < lit ? "1" : "0.16";
    });
  });

  return (
    <section className="mx-auto max-w-[1240px] px-5 py-32 sm:px-8 sm:py-44">
      <SectionLabel index="01">O problema</SectionLabel>
      <p
        ref={ref}
        className="mt-10 max-w-[1080px] text-[clamp(28px,4.4vw,58px)] font-medium leading-[1.12] tracking-[-0.035em]"
      >
        {words.map((word, index) => (
          <span key={index} data-w className="transition-opacity duration-300" style={{ opacity: 0.16 }}>
            {word}{" "}
          </span>
        ))}
      </p>
    </section>
  );
}

/* =========================================================
   FAIXA DE MÓDULOS (marquee guiado pelo scroll)
   ========================================================= */

const MODULES = ["Serviços", "Oficinas", "Técnicos", "Veículos", "Financeiro", "DRE", "Auditoria", "Busca global", "Usuários"];

function ModuleBand() {
  const rowA = useRef(null);
  const rowB = useRef(null);
  const wrap = useRef(null);

  useScrollFrame(wrap, (rect, vh) => {
    const offset = (vh - rect.top) * 0.35;
    if (rowA.current) rowA.current.style.transform = `translate3d(${-offset}px,0,0)`;
    if (rowB.current) rowB.current.style.transform = `translate3d(${offset - 600}px,0,0)`;
  });

  const items = [...MODULES, ...MODULES];

  return (
    <div ref={wrap} className="relative select-none overflow-hidden border-y border-border py-8 sm:py-10" aria-hidden="true">
      <div ref={rowA} className="flex whitespace-nowrap will-change-transform">
        {items.map((name, index) => (
          <span key={index} className="flex items-center text-[clamp(40px,7vw,96px)] font-semibold tracking-[-0.05em] text-foreground">
            {name}
            <Hexagon className="mx-6 size-[0.45em] text-primary sm:mx-10" strokeWidth={2} />
          </span>
        ))}
      </div>
      <div ref={rowB} className="mt-2 flex whitespace-nowrap will-change-transform">
        {[...items].reverse().map((name, index) => (
          <span key={index} className="lp-outline flex items-center text-[clamp(40px,7vw,96px)] font-semibold tracking-[-0.05em]">
            {name}
            <span className="mx-6 text-[0.4em] text-border-strong sm:mx-10">/</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   FLUXO — passos com print fixo que troca no scroll
   ========================================================= */

const STEPS = [
  {
    screen: "servicos",
    title: "O serviço entra uma vez.",
    text: "Placa ou chassi, veículo, oficina, data e quem trabalhou no carro. Os status separam o que está agendado, na bancada e entregue — e o cancelado não gera cobrança por engano.",
    points: ["Placa e chassi com busca instantânea", "Vários técnicos por serviço, com percentual de cada um", "Agendado, em andamento, concluído, cancelado"],
  },
  {
    screen: "tecnicos",
    title: "A equipe toda num lugar.",
    text: "Cadastro completo de cada técnico, com foto, documento, dados de pagamento e histórico de serviços e repasses. Oficinas parceiras com seus técnicos vinculados.",
    points: ["Ficha do técnico com dados bancários", "Oficinas e técnicos vinculados", "Histórico de produção por pessoa"],
  },
  {
    screen: "financeiro",
    title: "O financeiro se monta sozinho.",
    text: "Cada serviço gera a receita da oficina e o repasse de cada técnico, já com vencimento calculado. Você só liquida — e se errar, reabre.",
    points: ["Receitas e repasses gerados automaticamente", "Vencimento pelo prazo da sua conta", "Liquidar e reabrir com um clique"],
  },
  {
    screen: "dre",
    title: "E o mês fecha com resultado de verdade.",
    text: "DRE por período, comparado com o anterior, com margem de contribuição depois dos repasses e o resultado líquido que sobra para a empresa.",
    points: ["Comparativo com o período anterior", "Margem depois dos repasses", "Exportação em PDF e Excel"],
  },
];

function Flow() {
  const [active, setActive] = useState(0);
  const stepRefs = useRef([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(Number(entry.target.dataset.index));
        });
      },
      { rootMargin: "-45% 0px -45% 0px" }
    );

    stepRefs.current.forEach((node) => node && observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return (
    <section id="fluxo" className="relative scroll-mt-20 pt-32 sm:pt-44">
      <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
        <SectionLabel index="02">Como funciona</SectionLabel>
        <div className="mt-8 grid gap-6 md:grid-cols-[1.1fr_1fr] md:items-end">
          <Reveal as="h2" className="text-[clamp(36px,5.6vw,76px)] font-semibold leading-[0.95] tracking-[-0.05em]">
            Do carro na bancada ao dinheiro na conta.
          </Reveal>
          <Reveal as="p" delay={120} className="max-w-[440px] text-[17px] leading-relaxed text-muted-foreground md:justify-self-end">
            Quatro telas, um fluxo. Tudo o que acontece na operação vira
            informação financeira sem ninguém redigitar nada.
          </Reveal>
        </div>

        <div className="mt-16 grid gap-10 lg:mt-24 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
          {/* Passos */}
          <div>
            {STEPS.map((step, index) => (
              <div
                key={step.screen}
                ref={(node) => {
                  stepRefs.current[index] = node;
                }}
                data-index={index}
                className="flex min-h-0 flex-col justify-center py-10 lg:min-h-[78vh] lg:py-0"
              >
                <div className={`transition-opacity duration-500 ${active === index ? "lg:opacity-100" : "lg:opacity-30"}`}>
                  <p className="font-mono text-[13px] text-muted-foreground">
                    <span className="text-foreground">0{index + 1}</span> / 04
                  </p>
                  <h3 className="mt-4 text-[32px] font-semibold leading-[1.05] tracking-[-0.04em] sm:text-[40px]">
                    {step.title}
                  </h3>
                  <p className="mt-5 max-w-[460px] text-[16px] leading-relaxed text-muted-foreground">{step.text}</p>
                  <ul className="mt-7 space-y-3 border-t border-border pt-6">
                    {step.points.map((point) => (
                      <li key={point} className="flex items-start gap-3 text-[14px]">
                        <Check className="mt-0.5 size-4 shrink-0 text-primary-active" strokeWidth={2.4} />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Mobile: print logo abaixo de cada passo */}
                <div className="mt-10 lg:hidden">
                  <ScreenShot screen={step.screen} height={760} />
                </div>
              </div>
            ))}
          </div>

          {/* Print fixo (desktop) */}
          <div className="relative hidden lg:block">
            <div className="sticky top-[calc(50vh-280px)]">
              <div className="relative">
                <div className="absolute -inset-8 -z-10 rounded-[32px] bg-[#f4f3ef]" />
                <div className="relative">
                  {STEPS.map((step, index) => (
                    <div
                      key={step.screen}
                      className="absolute inset-x-0 top-0 transition-all duration-700 ease-[cubic-bezier(.2,.7,.2,1)]"
                      style={{
                        opacity: active === index ? 1 : 0,
                        transform: `translateY(${(index - active) * 28}px) scale(${active === index ? 1 : 0.96})`,
                        pointerEvents: active === index ? "auto" : "none",
                      }}
                    >
                      <ScreenShot screen={step.screen} height={760} />
                    </div>
                  ))}
                  {/* Reserva a altura do print */}
                  <div className="invisible">
                    <ScreenShot screen="servicos" height={760} />
                  </div>
                </div>
                <div className="mt-6 flex gap-2">
                  {STEPS.map((step, index) => (
                    <span
                      key={step.screen}
                      className={`h-1 rounded-full transition-all duration-500 ${active === index ? "w-10 bg-[#171715]" : "w-4 bg-border-strong"}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* =========================================================
   UM SERVIÇO → TRÊS LANÇAMENTOS
   ========================================================= */

function Entry({ tone, label, who, value, detail }) {
  const color = tone === "in" ? "text-success" : "text-[#171715]";
  return (
    <div className="rounded-2xl border border-border bg-white p-5 shadow-[0_12px_40px_-24px_rgba(23,23,21,0.35)]">
      <div className="flex items-center justify-between gap-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-warning"><span className="size-1.5 rounded-full bg-warning" />Pendente</span>
      </div>
      <p className="mt-3 text-[15px] font-semibold">{who}</p>
      <div className="mt-1 flex items-baseline justify-between gap-4">
        <p className="text-[13px] text-muted-foreground">{detail}</p>
        <p className={`text-[18px] font-semibold tracking-tight ${color}`}>{value}</p>
      </div>
    </div>
  );
}

function Split() {
  return (
    <section id="financeiro" className="scroll-mt-20 py-32 sm:py-44">
      <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
        <SectionLabel index="03">Financeiro automático</SectionLabel>

        <div className="mt-8 grid gap-6 md:grid-cols-2 md:items-end">
          <Reveal as="h2" className="text-[clamp(36px,5.6vw,76px)] font-semibold leading-[0.95] tracking-[-0.05em]">
            Um serviço.
            <br />
            <span className="text-muted-foreground/60">Três lançamentos.</span>
            <br />
            Zero digitação.
          </Reveal>
          <Reveal as="p" delay={120} className="max-w-[460px] text-[17px] leading-relaxed text-muted-foreground md:justify-self-end">
            Ao salvar o serviço, o PDR Hub cria a receita da oficina e o
            repasse de cada técnico conforme o percentual combinado. Mudou o
            valor? Os lançamentos acompanham. Cancelou? Nada é cobrado.
          </Reveal>
        </div>

        <Reveal className="relative mt-16 sm:mt-24">
          <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_120px_minmax(0,1.1fr)] lg:gap-0">
            {/* Serviço */}
            <div className="relative rounded-[28px] bg-[#171715] p-7 text-white sm:p-9">
              <Hexagon className="absolute right-6 top-6 size-16 text-primary/40" />
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">Serviço</p>
              <div className="mt-5">
                <Plate>GE 482 KT</Plate>
              </div>
              <p className="mt-5 text-[22px] font-semibold tracking-tight">Fiat 500X</p>
              <p className="text-[14px] text-white/50">Carrozzeria Rossi · 14/10/2026</p>

              <div className="mt-8 space-y-3 border-t border-white/10 pt-6 text-[14px]">
                <div className="flex justify-between">
                  <span className="text-white/50">Valor do serviço</span>
                  <span className="font-semibold">€ 1.250,00</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Lucas Andrade</span>
                  <span>30%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Rafael Souza</span>
                  <span>25%</span>
                </div>
              </div>
            </div>

            {/* Conectores */}
            <div className="relative hidden h-full lg:block">
              <svg viewBox="0 0 120 400" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
                {["M0 200 C 60 200, 60 70, 120 70", "M0 200 L 120 200", "M0 200 C 60 200, 60 330, 120 330"].map((d, i) => (
                  <path key={d} d={d} fill="none" stroke="var(--primary-active)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" className="lp-connector" style={{ animationDelay: `${300 + i * 180}ms` }} />
                ))}
              </svg>
            </div>
            <div className="mx-auto h-10 w-px bg-primary lg:hidden" />

            {/* Lançamentos */}
            <div className="space-y-4">
              <Entry tone="in" label="Receita · Serviço" who="Carrozzeria Rossi" detail="Vence em 30 dias" value="+ € 1.250,00" />
              <Entry label="Despesa · Repasse técnico" who="Lucas Andrade" detail="30% do serviço" value="− € 375,00" />
              <Entry label="Despesa · Repasse técnico" who="Rafael Souza" detail="25% do serviço" value="− € 312,50" />
            </div>
          </div>

          <div className="mt-10 flex flex-col items-start justify-between gap-4 rounded-2xl border border-dashed border-border-strong px-6 py-5 sm:flex-row sm:items-center lg:ml-[calc(50%+60px)]">
            <span className="text-[14px] text-muted-foreground">Resultado bruto previsto do serviço</span>
            <span className="text-[26px] font-semibold tracking-tight">€ 562,50</span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* =========================================================
   ROBERTO
   ========================================================= */

const CHAT_STEPS = 6;

function Waveform() {
  return (
    <span className="flex h-6 items-center gap-[3px]" aria-hidden="true">
      {[6, 12, 18, 10, 22, 14, 8, 16, 20, 12, 6, 14, 18, 9, 12, 7, 15, 10].map((h, i) => (
        <span key={i} className="w-[3px] rounded-full bg-[#171715]/70" style={{ height: h }} />
      ))}
    </span>
  );
}

function Typing() {
  return (
    <div className="flex h-10 w-16 items-center justify-center gap-1 rounded-2xl rounded-tl-md bg-white/[0.07]">
      {[0, 1, 2].map((i) => (
        <span key={i} className="lp-dot size-1.5 rounded-full bg-white/60" style={{ animationDelay: `${i * 150}ms` }} />
      ))}
    </div>
  );
}

function RobertoChat() {
  const ref = useRef(null);
  const [step, setStep] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setStarted(true);
        observer.disconnect();
      }
    }, { threshold: 0.35 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return undefined;
    const delay = step === 0 ? 400 : step >= CHAT_STEPS ? 6500 : step % 2 === 1 ? 1300 : 1500;
    const timer = window.setTimeout(() => setStep((current) => (current >= CHAT_STEPS ? 1 : current + 1)), delay);
    return () => window.clearTimeout(timer);
  }, [started, step]);

  const show = (n) => step >= n;

  return (
    <div ref={ref} className="relative mx-auto w-full max-w-[460px]">
      <div className="overflow-hidden rounded-[26px] border border-white/10 bg-[#1e1e1b] shadow-[0_40px_90px_-30px_rgba(0,0,0,0.8)]">
        <div className="flex items-center gap-3 border-b border-white/[0.08] px-5 py-4">
          <span className="grid size-9 place-items-center rounded-full bg-primary text-[#171715]">
            <Sparkles className="size-4" strokeWidth={2} />
          </span>
          <div>
            <p className="flex items-center gap-2 text-[14px] font-semibold text-white">
              Roberto <span className="size-1.5 rounded-full bg-success" />
            </p>
            <p className="text-[11px] text-white/40">Assistente do PDR Hub</p>
          </div>
        </div>

        <div className="flex min-h-[470px] flex-col gap-3 px-5 py-6 text-[13.5px] leading-relaxed">
          {show(1) && (
            <div className="lp-msg ml-auto max-w-[80%] rounded-2xl rounded-tr-md bg-primary px-4 py-2.5 font-medium text-[#171715]">
              Quanto temos para receber esse mês?
            </div>
          )}

          {step === 2 ? (
            <Typing />
          ) : show(2) ? (
            <div className="lp-msg max-w-[88%] rounded-2xl rounded-tl-md bg-white/[0.07] px-4 py-3 text-white/85">
              São <span className="font-semibold text-primary">€ 12.510,00</span> em 9 lançamentos pendentes.
              O maior é da Carrozzeria Rossi, € 4.380,00, com vencimento em 13/11.
            </div>
          ) : null}

          {show(3) && (
            <div className="lp-msg ml-auto flex max-w-[85%] items-center gap-3 rounded-2xl rounded-tr-md bg-primary px-3 py-2.5 text-[#171715]">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#171715] text-primary">
                <Mic className="size-3.5" />
              </span>
              <Waveform />
              <span className="font-mono text-[11px]">0:07</span>
            </div>
          )}

          {step === 4 ? (
            <Typing />
          ) : show(4) ? (
            <div className="lp-msg max-w-[92%] rounded-2xl rounded-tl-md bg-white/[0.07] p-4 text-white/85">
              <p>Preparei o serviço. Confere antes de eu salvar:</p>
              <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-black/20 p-3.5 text-[12.5px]">
                <p className="flex justify-between"><span className="text-white/45">Veículo</span><span>VW Golf · FN907LS</span></p>
                <p className="flex justify-between"><span className="text-white/45">Oficina</span><span>Autofficina Bianchi</span></p>
                <p className="flex justify-between"><span className="text-white/45">Técnico</span><span>Diego Martins</span></p>
                <p className="flex justify-between"><span className="text-white/45">Valor</span><span className="font-semibold text-white">€ 780,00</span></p>
              </div>
              {show(5) ? (
                <p className="lp-msg mt-3 flex items-center gap-2 text-[12.5px] font-medium text-success">
                  <Check className="size-4" strokeWidth={2.4} />
                  Serviço criado e lançamentos gerados.
                </p>
              ) : (
                <div className="mt-3 flex gap-2">
                  <span className="rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-[#171715]">Confirmar</span>
                  <span className="rounded-lg border border-white/15 px-3 py-1.5 text-[12px] text-white/70">Cancelar</span>
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="border-t border-white/[0.08] px-5 py-4">
          <div className="flex h-11 items-center justify-between rounded-xl bg-white/[0.06] px-4 text-[13px] text-white/35">
            Pergunte ou peça algo ao Roberto...
            <Mic className="size-4" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Roberto() {
  return (
    <section id="roberto" className="scroll-mt-20 px-3 sm:px-6">
      <div className="relative mx-auto max-w-[1360px] overflow-hidden rounded-[32px] bg-[#171715] px-5 py-24 text-white sm:rounded-[44px] sm:px-12 sm:py-32 lg:px-20">
        <Parallax speed={-0.2} rotate={1} className="pointer-events-none absolute -left-32 -top-24">
          <Hexagon className="size-[440px] text-white/[0.06]" />
        </Parallax>
        <Parallax speed={-0.1} className="pointer-events-none absolute -bottom-40 right-[30%]">
          <Hexagon className="size-[360px] text-primary/[0.14]" />
        </Parallax>
        <div className="pointer-events-none absolute -right-40 top-0 size-[520px] rounded-full bg-primary/[0.1] blur-[140px]" />

        <div className="relative grid gap-16 lg:grid-cols-[1fr_minmax(0,460px)] lg:items-center lg:gap-20">
          <div>
            <SectionLabel index="04" dark>Assistente com IA</SectionLabel>
            <Reveal as="h2" className="mt-8 text-[clamp(40px,6vw,84px)] font-semibold leading-[0.92] tracking-[-0.05em]">
              Conheça o Roberto.
              <span className="block text-white/35">Ele conhece a sua operação.</span>
            </Reveal>
            <Reveal as="p" delay={100} className="mt-8 max-w-[520px] text-[17px] leading-relaxed text-white/55">
              Pergunte em português, por texto ou áudio. O Roberto consulta
              serviços, oficinas, técnicos e o financeiro da sua conta — e
              prepara cadastros e liquidações para você só confirmar.
            </Reveal>

            <Reveal delay={150} className="mt-12 grid gap-px overflow-hidden rounded-2xl bg-white/10 sm:grid-cols-3">
              {[
                ["Consulta", "Quanto falta receber, quem mais produziu, qual placa passou por aqui."],
                ["Executa", "Cadastra serviços, oficinas e técnicos a partir de uma conversa."],
                ["Confirma", "Nada é gravado sem você aprovar o cartão de confirmação."],
              ].map(([title, text], index) => (
                <div key={title} className="bg-[#171715] p-6">
                  <p className="font-mono text-[11px] text-primary">0{index + 1}</p>
                  <p className="mt-3 text-[16px] font-semibold">{title}</p>
                  <p className="mt-2 text-[13px] leading-relaxed text-white/45">{text}</p>
                </div>
              ))}
            </Reveal>
          </div>

          <RobertoChat />
        </div>
      </div>
    </section>
  );
}

/* =========================================================
   RECURSOS / DETALHES
   ========================================================= */

const DETAILS = [
  ["Busca global", "Digite uma placa, oficina ou técnico no topo de qualquer tela e encontre serviços, lançamentos e registros de auditoria de uma vez."],
  ["Auditoria completa", "Cada criação, edição e liquidação fica registrada com usuário, data, hora e módulo. Ninguém precisa perguntar quem mexeu."],
  ["Equipe com acesso próprio", "Crie usuários para sua equipe administrativa. Todos trabalham na mesma conta, com dados isolados de qualquer outra empresa."],
  ["Datas que não pulam", "Operação no exterior? As datas civis seguem o fuso da conta. O serviço lançado hoje não aparece ontem no financeiro."],
  ["Moeda da sua operação", "Euro, real ou a moeda da sua conta, com formatação local em todos os valores, relatórios e exportações."],
  ["Relatórios para levar", "Dashboard, financeiro e DRE exportam em PDF e Excel, prontos para o contador ou para a reunião com o sócio."],
  ["No celular também", "Layout pensado para o celular, com barra inferior e um botão sempre à mão para lançar o serviço ali mesmo, na oficina."],
  ["Claro ou escuro", "Tema claro para o escritório, escuro para o fim do dia. Cada usuário escolhe o seu."],
];

function Details() {
  return (
    <section id="recursos" className="scroll-mt-20 py-32 sm:py-44">
      <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <SectionLabel index="05">Os detalhes</SectionLabel>
            <Reveal as="h2" className="mt-8 text-[clamp(36px,4.8vw,64px)] font-semibold leading-[0.95] tracking-[-0.05em]">
              O que separa um sistema de uma planilha bonita.
            </Reveal>

            <div className="mt-12 grid grid-cols-2 gap-8 border-t border-border pt-8">
              <div>
                <p className="text-[48px] font-semibold leading-none tracking-[-0.05em]">
                  <CountUp value={10} />
                </p>
                <p className="mt-2 text-[13px] text-muted-foreground">módulos integrados</p>
              </div>
              <div>
                <p className="text-[48px] font-semibold leading-none tracking-[-0.05em]">
                  <CountUp value={100} />
                  <span className="text-primary-active">%</span>
                </p>
                <p className="mt-2 text-[13px] text-muted-foreground">das ações auditadas</p>
              </div>
            </div>
          </div>

          <div className="border-t border-border">
            {DETAILS.map(([title, text], index) => (
              <Reveal key={title} className="group grid grid-cols-[48px_1fr] gap-4 border-b border-border py-8 sm:grid-cols-[64px_1fr_1.3fr] sm:gap-8">
                <span className="font-mono text-[12px] text-muted-foreground transition-colors group-hover:text-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="text-[19px] font-semibold tracking-[-0.02em]">{title}</h3>
                <p className="col-start-2 text-[15px] leading-relaxed text-muted-foreground sm:col-start-3">{text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* =========================================================
   FAIXA DE FOTO (parallax)
   Substitua o placeholder por uma foto real, ex.:
   /public/landing/tecnico.jpg → src="/landing/tecnico.jpg"
   ========================================================= */

const PHOTO_PLACEHOLDER = "https://placehold.co/1920x1280/2a2a26/3a3a35.png?text=Foto+de+t%C3%A9cnico+em+a%C3%A7%C3%A3o&font=inter";

function PhotoBand() {
  const ref = useRef(null);
  const imgRef = useRef(null);

  useScrollFrame(ref, (rect, vh) => {
    const p = (rect.top + rect.height / 2 - vh / 2) / vh;
    if (imgRef.current) imgRef.current.style.transform = `translate3d(0, ${p * -18}%, 0) scale(1.15)`;
  });

  return (
    <section ref={ref} className="relative mx-3 h-[78vh] min-h-[520px] overflow-hidden rounded-[32px] bg-[#2a2a26] sm:mx-6 sm:rounded-[44px]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={PHOTO_PLACEHOLDER}
        alt="Técnico de martelinho de ouro trabalhando em um veículo"
        className="absolute inset-0 h-full w-full object-cover will-change-transform"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-[1240px] px-6 pb-12 sm:px-12 sm:pb-16">
        <Reveal as="p" className="max-w-[900px] text-[clamp(30px,4.6vw,64px)] font-semibold leading-[1] tracking-[-0.045em] text-white">
          Feito para quem tira amassado sem pintura —
          <span className="text-primary"> e não quer perder tempo com papel.</span>
        </Reveal>
      </div>
    </section>
  );
}

/* =========================================================
   CTA / CONTATO
   ========================================================= */

function Contact() {
  return (
    <section id="contato" className="relative scroll-mt-20 overflow-hidden py-32 sm:py-44">
      <Parallax speed={-0.15} rotate={-0.6} className="pointer-events-none absolute -right-32 top-10">
        <Hexagon className="size-[520px] text-primary/40" />
      </Parallax>

      <div className="relative mx-auto max-w-[1240px] px-5 sm:px-8">
        <SectionLabel index="06">Contato</SectionLabel>
        <Reveal as="h2" className="mt-8 max-w-[1000px] text-[clamp(44px,8vw,120px)] font-semibold leading-[0.9] tracking-[-0.055em]">
          Vamos colocar sua operação no{" "}
          <span className="relative inline-block">
            <span className="relative z-10">PDR Hub?</span>
            <span className="absolute inset-x-[-0.04em] bottom-[0.08em] z-0 h-[0.3em] bg-primary" />
          </span>
        </Reveal>

        <div className="mt-16 grid gap-px overflow-hidden rounded-[28px] border border-border bg-border md:grid-cols-3">
          <a href={WHATSAPP} target="_blank" rel="noreferrer" className="group bg-white p-8 transition-colors hover:bg-[#fbfaf6] sm:p-10">
            <MessageCircle className="size-6" strokeWidth={1.6} />
            <p className="mt-10 text-[13px] text-muted-foreground">WhatsApp</p>
            <p className="mt-1 flex items-center justify-between gap-2 text-[20px] font-semibold tracking-tight">
              {PHONE_LABEL}
              <ArrowUpRight className="size-5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </p>
          </a>
          <a href={`mailto:${EMAIL}?subject=${encodeURIComponent("PDR Hub — quero conhecer")}`} className="group bg-white p-8 transition-colors hover:bg-[#fbfaf6] sm:p-10">
            <Mail className="size-6" strokeWidth={1.6} />
            <p className="mt-10 text-[13px] text-muted-foreground">E-mail</p>
            <p className="mt-1 flex items-center justify-between gap-2 break-all text-[20px] font-semibold tracking-tight">
              {EMAIL}
              <ArrowUpRight className="size-5 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </p>
          </a>
          <Link href="/login" className="group bg-[#171715] p-8 text-white transition-colors hover:bg-black sm:p-10">
            <LockKeyhole className="size-6 text-primary" strokeWidth={1.6} />
            <p className="mt-10 text-[13px] text-white/50">Já é cliente?</p>
            <p className="mt-1 flex items-center justify-between gap-2 text-[20px] font-semibold tracking-tight">
              Entrar na plataforma
              <ArrowRight className="size-5 text-primary transition-transform group-hover:translate-x-1" />
            </p>
          </Link>
        </div>
      </div>
    </section>
  );
}

/* =========================================================
   FOOTER
   ========================================================= */

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid max-w-[1240px] gap-12 px-5 py-16 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Image src="/Logo_Completa.png" alt="PDR Hub" width={500} height={191} className="h-14 w-auto" />
          <p className="mt-5 max-w-[320px] text-[14px] leading-relaxed text-muted-foreground">
            Gestão de serviços, oficinas, técnicos e financeiro para
            empresas de martelinho de ouro.
          </p>
        </div>

        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Navegação</p>
          <ul className="mt-5 space-y-3 text-[14px]">
            {NAV_LINKS.map(([label, href]) => (
              <li key={href}>
                <a href={href} className="transition-colors hover:text-muted-foreground">{label}</a>
              </li>
            ))}
            <li>
              <Link href="/login" className="transition-colors hover:text-muted-foreground">Área do cliente</Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Contato</p>
          <ul className="mt-5 space-y-3 text-[14px]">
            <li><a href={`mailto:${EMAIL}`} className="transition-colors hover:text-muted-foreground">{EMAIL}</a></li>
            <li><a href={WHATSAPP} target="_blank" rel="noreferrer" className="transition-colors hover:text-muted-foreground">{PHONE_LABEL}</a></li>
            <li><a href={DEVELOPER_URL} target="_blank" rel="noreferrer" className="transition-colors hover:text-muted-foreground">bitbloomai.com</a></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-[1240px] flex-col items-start justify-between gap-6 px-5 py-8 sm:flex-row sm:items-center sm:px-8">
          <p className="text-[12px] text-muted-foreground">© {new Date().getFullYear()} PDR Hub. Todos os direitos reservados.</p>
          <a href={DEVELOPER_URL} target="_blank" rel="noreferrer" className="group flex items-center gap-3" aria-label="Desenvolvido por BitBloom AI">
            <span className="text-[12px] text-muted-foreground">Desenvolvido por</span>
            <Image
              src="/Logo_Comp_Wt.png"
              alt="BitBloom AI"
              width={2560}
              height={606}
              className="h-8 w-auto opacity-85 transition-opacity group-hover:opacity-100"
            />
          </a>
        </div>
      </div>
    </footer>
  );
}

/* =========================================================
   PÁGINA
   ========================================================= */

export function Landing() {
  return (
    <div className="landing min-h-screen overflow-x-clip bg-white text-foreground">
      <Nav />
      <main>
        <Hero />
        <Manifesto />
        <ModuleBand />
        <Flow />
        <Split />
        <Roberto />
        <Details />
        <PhotoBand />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}
