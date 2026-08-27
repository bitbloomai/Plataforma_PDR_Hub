export function AuthLayoutShell({
  children,
  aside,
  className = "",
}) {
  const hasAside = Boolean(aside);

  return (
    <main
      className={`
        min-h-screen
        bg-background
        text-foreground
        ${className}
      `}
    >
      <div
        className={`
          min-h-screen
          ${
            hasAside
              ? "grid grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(520px,0.95fr)]"
              : "flex"
          }
        `}
      >
        {/* =====================================================
            ÁREA PRINCIPAL
           ===================================================== */}
        <section
          className={`
            relative
            flex
            min-h-screen
            items-center
            justify-center
            overflow-hidden
            px-5
            py-8
            sm:px-8
            sm:py-10
            lg:px-12
            xl:px-16

            ${hasAside ? "" : "w-full"}
          `}
        >
          {/* Círculo decorativo superior */}
          <div
            aria-hidden="true"
            className="
              pointer-events-none
              absolute
              -left-24
              -top-24
              size-72
              rounded-full
              border
              border-border/50
              sm:size-80
            "
          />

          <div
            aria-hidden="true"
            className="
              pointer-events-none
              absolute
              -left-10
              -top-10
              size-40
              rounded-full
              border
              border-border/40
              sm:size-48
            "
          />

          {/* Glow inferior */}
          <div
            aria-hidden="true"
            className="
              pointer-events-none
              absolute
              -bottom-40
              -right-36
              size-[380px]
              rounded-full
              bg-primary/[0.035]
              blur-3xl
              sm:size-[460px]
            "
          />

          {/* Conteúdo da página */}
          <div
            className="
              relative
              z-10
              w-full
              max-w-[460px]
            "
          >
            {children}
          </div>
        </section>

        {/* =====================================================
            PAINEL LATERAL
            SOMENTE DESKTOP
           ===================================================== */}
        {hasAside && (
          <aside
            className="
              relative
              hidden
              min-h-screen
              overflow-hidden
              bg-[#171715]
              lg:block
              dark:bg-[#0d0d0c]
            "
          >
            {/* Grid */}
            <div
              aria-hidden="true"
              className="
                pointer-events-none
                absolute
                inset-0
                opacity-[0.035]
              "
              style={{
                backgroundImage: `
                  linear-gradient(
                    to right,
                    rgba(255,255,255,0.9) 1px,
                    transparent 1px
                  ),
                  linear-gradient(
                    to bottom,
                    rgba(255,255,255,0.9) 1px,
                    transparent 1px
                  )
                `,
                backgroundSize: "48px 48px",
              }}
            />

            {/* Glow superior */}
            <div
              aria-hidden="true"
              className="
                pointer-events-none
                absolute
                -right-48
                -top-48
                size-[560px]
                rounded-full
                bg-primary/[0.12]
                blur-[130px]
              "
            />

            {/* Glow inferior */}
            <div
              aria-hidden="true"
              className="
                pointer-events-none
                absolute
                -bottom-52
                -left-40
                size-[520px]
                rounded-full
                bg-primary/[0.05]
                blur-[120px]
              "
            />

            {/* Arcos superiores */}
            <div
              aria-hidden="true"
              className="
                pointer-events-none
                absolute
                -right-36
                -top-36
                size-[420px]
                rounded-full
                border
                border-white/[0.05]
              "
            />

            <div
              aria-hidden="true"
              className="
                pointer-events-none
                absolute
                -right-16
                -top-16
                size-[260px]
                rounded-full
                border
                border-primary/[0.12]
              "
            />

            {/* Arcos inferiores */}
            <div
              aria-hidden="true"
              className="
                pointer-events-none
                absolute
                -bottom-52
                -left-36
                size-[500px]
                rounded-full
                border
                border-white/[0.04]
              "
            />

            <div
              aria-hidden="true"
              className="
                pointer-events-none
                absolute
                -bottom-24
                -left-8
                size-[280px]
                rounded-full
                border
                border-primary/[0.08]
              "
            />

            {/* Linha amarela */}
            <div
              aria-hidden="true"
              className="
                pointer-events-none
                absolute
                left-0
                top-1/2
                h-px
                w-24
                bg-gradient-to-r
                from-primary/60
                to-transparent
              "
            />

            <div className="relative z-10 min-h-screen">
              {aside}
            </div>
          </aside>
        )}
      </div>
    </main>
  );
}

export function AuthCard({
  children,
  className = "",
}) {
  return (
    <div
      className={`
        w-full
        rounded-[22px]
        border
        border-border
        bg-surface
        p-5

        shadow-[0_12px_40px_rgba(0,0,0,0.055)]

        sm:rounded-[26px]
        sm:p-7

        dark:shadow-[0_18px_50px_rgba(0,0,0,0.22)]

        ${className}
      `}
    >
      {children}
    </div>
  );
}