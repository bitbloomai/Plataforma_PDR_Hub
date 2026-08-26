# CONTEXTO DE UI, TEMA E PROVIDERS DA PLATAFORMA

## 1. Objetivo deste arquivo

Este documento define o padrão visual, a arquitetura de providers, os caminhos dos arquivos, os tokens de tema, as cores e as regras de uso da interface da plataforma.

Ele deve ser usado como fonte de contexto ao criar novas páginas, componentes, layouts e funcionalidades.

A plataforma deve manter consistência visual em todos os módulos. Novos arquivos e componentes devem seguir este padrão, evitando estilos isolados ou decisões visuais diferentes em cada módulo.

---

# 2. Stack visual da plataforma

A interface utiliza:

- Next.js com App Router
- JavaScript / JSX
- Tailwind CSS v4
- Fonte Inter
- next-themes para tema claro e escuro
- Sonner para notificações / toast
- Lucide React para ícones

Dependências relacionadas:

```bash
npm install next-themes sonner lucide-react
```

IMPORTANTE:

O projeto utiliza JavaScript e JSX.

Não criar arquivos TypeScript ou TSX, exceto se houver uma mudança explícita no padrão do projeto.

Usar:

- `.js` para arquivos sem JSX
- `.jsx` para componentes React

---

# 3. Padrão visual geral

A plataforma deve ter uma aparência:

- clean
- minimalista
- moderna
- profissional
- elegante
- leve
- com bastante espaço visual
- sem excesso de bordas
- sem excesso de sombras
- sem excesso de cores
- com hierarquia visual clara

O amarelo é a cor de identidade da plataforma.

Ele deve ser utilizado como destaque e não como cor predominante de grandes superfícies.

A interface não deve parecer um template SaaS genérico.

---

# 4. Regra principal de cores

Os cinzas da plataforma devem ser neutros ou levemente quentes.

NÃO utilizar cinzas azulados.

Evitar especialmente tons no estilo:

```txt
#0f172a
#111827
#1e293b
#334155
```

Evitar como base visual:

- slate
- blue-gray
- navy
- backgrounds azulados

O dark mode deve ter aparência de carvão/grafite neutro.

---

# 5. Estrutura de arquivos

A estrutura principal relacionada ao tema e aos providers é:

```txt
src/
├── app/
│   ├── globals.css
│   ├── layout.jsx
│   └── page.jsx
│
├── components/
│   ├── providers/
│   │   ├── providers.jsx
│   │   ├── theme-provider.jsx
│   │   └── toast-provider.jsx
│   │
│   └── theme/
│       └── theme-toggle.jsx
│
└── lib/
    └── toast.js
```

---

# 6. Root Layout

Arquivo:

```txt
src/app/layout.jsx
```

Responsabilidades:

- carregar a fonte Inter
- carregar o `globals.css`
- configurar os metadados principais
- envolver a aplicação com `Providers`
- permitir alteração de tema sem erro de hydration

Estrutura esperada:

```jsx
import { Inter } from "next/font/google";

import { Providers } from "@/components/providers/providers";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata = {
  title: {
    default: "Plataforma",
    template: "%s | Plataforma",
  },
  description: "Plataforma de gestão.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={inter.variable}
    >
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

---

# 7. Provider principal

Arquivo:

```txt
src/components/providers/providers.jsx
```

Este arquivo é o ponto central para providers globais.

Atualmente deve conter:

- ThemeProvider
- ToastProvider

Exemplo:

```jsx
"use client";

import { ThemeProvider } from "./theme-provider";
import { ToastProvider } from "./toast-provider";

export function Providers({ children }) {
  return (
    <ThemeProvider>
      {children}
      <ToastProvider />
    </ThemeProvider>
  );
}
```

Novos providers globais devem preferencialmente ser adicionados aqui.

Exemplos futuros:

- AuthProvider
- QueryClientProvider
- SessionProvider
- Contextos globais
- Providers de permissões

Evitar colocar vários providers diretamente no `layout.jsx`.

---

# 8. Theme Provider

Arquivo:

```txt
src/components/providers/theme-provider.jsx
```

Biblioteca:

```txt
next-themes
```

Configuração esperada:

```jsx
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children, ...props }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="platform-theme"
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
```

O tema é controlado por classe:

```txt
.dark
```

O sistema deve suportar:

- tema claro
- tema escuro
- preferência automática do sistema

---

# 9. Theme Toggle

Arquivo:

```txt
src/components/theme/theme-toggle.jsx
```

Responsabilidade:

Alternar entre tema claro e escuro.

Utiliza:

```txt
useTheme
```

da biblioteca:

```txt
next-themes
```

O botão deve ser discreto.

Ícones recomendados:

- Sun
- Moon

Biblioteca:

```txt
lucide-react
```

---

# 10. Toast Provider

Arquivo:

```txt
src/components/providers/toast-provider.jsx
```

Biblioteca utilizada:

```txt
sonner
```

Padrão:

- posição: canto superior direito
- visual discreto
- fundo baseado no tema
- borda neutra
- radius suave
- sem cores exageradas
- feedback indicado principalmente por uma pequena borda lateral

Tipos previstos:

- success
- error
- warning
- info
- loading

---

# 11. Helper global de Toast

Arquivo:

```txt
src/lib/toast.js
```

IMPORTANTE:

Componentes não devem importar diretamente o toast do Sonner sempre que possível.

Preferir:

```jsx
import { toast } from "@/lib/toast";
```

Exemplos:

```jsx
toast.success(
  "Alterações salvas",
  "As informações foram atualizadas com sucesso."
);
```

```jsx
toast.error(
  "Não foi possível salvar",
  "Verifique os dados e tente novamente."
);
```

```jsx
toast.warning(
  "Atenção",
  "Existem informações pendentes."
);
```

```jsx
toast.info(
  "Informação",
  "Os dados serão atualizados em instantes."
);
```

Motivo:

A biblioteca de toast fica abstraída.

Caso seja necessário trocar Sonner no futuro, o restante da aplicação não precisa ser alterado.

---

# 12. Arquivo global de estilos

Arquivo:

```txt
src/app/globals.css
```

Este arquivo é a principal fonte de verdade visual da plataforma.

Ele contém:

- tokens de cor
- light mode
- dark mode
- integração com Tailwind
- scrollbar
- seleção de texto
- estilos base
- acessibilidade
- fonte
- superfícies
- bordas
- feedback
- radius

---

# 13. Paleta do tema claro

## Background principal

```css
--background: #f7f7f5;
```

Uso:

- fundo geral da aplicação

---

## Foreground

```css
--foreground: #171715;
```

Uso:

- texto principal
- títulos
- ícones principais

---

## Surface

```css
--surface: #ffffff;
```

Uso:

- cards
- modais
- dropdowns
- painéis
- inputs quando necessário

---

## Surface 2

```css
--surface-2: #f1f1ee;
```

Uso:

- hover
- blocos secundários
- fundos internos
- cabeçalhos discretos

---

## Surface 3

```css
--surface-3: #e9e9e5;
```

Uso:

- estados mais destacados
- hover secundário
- áreas internas

---

## Muted

```css
--muted: #edede9;
```

---

## Muted foreground

```css
--muted-foreground: #73736c;
```

Uso:

- textos secundários
- descrição
- labels auxiliares
- placeholders

---

## Border

```css
--border: #dfdfd9;
```

Uso:

- bordas normais

---

## Border strong

```css
--border-strong: #c9c9c1;
```

Uso:

- bordas com maior destaque

---

# 14. Paleta do tema escuro

## Background

```css
--background: #11110f;
```

---

## Foreground

```css
--foreground: #f4f4f0;
```

---

## Surface

```css
--surface: #181816;
```

---

## Surface 2

```css
--surface-2: #20201d;
```

---

## Surface 3

```css
--surface-3: #282824;
```

---

## Muted

```css
--muted: #242421;
```

---

## Muted foreground

```css
--muted-foreground: #999990;
```

---

## Border

```css
--border: #30302b;
```

---

## Border strong

```css
--border-strong: #41413a;
```

O dark mode não deve usar fundo preto puro como padrão.

Evitar:

```txt
#000000
```

Prefira superfícies com pequenas diferenças de luminosidade para criar profundidade sem depender de sombras.

---

# 15. Cor primária

Cor principal da identidade:

```css
--primary: #f2c21b;
```

Hover:

```css
--primary-hover: #e2b20b;
```

Dark hover:

```css
--primary-hover: #ffd23f;
```

Foreground:

```css
--primary-foreground: #171715;
```

O amarelo deve aparecer principalmente em:

- CTA principal
- item selecionado
- pequenos indicadores
- foco
- badges importantes
- detalhes da navegação
- scrollbar
- estados ativos

NÃO usar amarelo em grandes áreas sem necessidade.

Evitar:

- sidebar inteira amarela
- fundo geral amarelo
- cards inteiros amarelos
- grandes blocos amarelos

---

# 16. Cores de feedback

Success:

```css
--success: #16a269;
```

Dark:

```css
--success: #34c785;
```

Danger:

```css
--danger: #dc4c4c;
```

Dark:

```css
--danger: #ef6262;
```

Warning:

```css
--warning: #e7a61a;
```

Dark:

```css
--warning: #f1b83a;
```

Usar essas cores apenas para significado semântico.

Exemplos:

- verde = sucesso
- vermelho = erro ou risco
- amarelo/laranja = atenção

Não usar essas cores puramente como decoração.

---

# 17. Tokens Tailwind disponíveis

Os tokens CSS são mapeados para Tailwind.

Usar preferencialmente:

```txt
bg-background
text-foreground

bg-surface
bg-surface-2
bg-surface-3

text-muted-foreground

border-border
border-border-strong

bg-primary
bg-primary-hover
bg-primary-active

text-primary-foreground

text-success
text-danger
text-warning

ring-ring
```

---

# 18. Regra extremamente importante

NÃO espalhar cores hardcoded nos componentes.

Evitar:

```jsx
<div className="bg-[#181816] text-[#f4f4f0]">
```

Evitar:

```jsx
<div className="dark:bg-[#11110f]">
```

Preferir:

```jsx
<div className="bg-surface text-foreground">
```

Motivo:

Todos os componentes devem obedecer automaticamente o tema claro e escuro.

---

# 19. Cards

Card padrão:

```jsx
<div className="rounded-xl border border-border bg-surface p-6">
  ...
</div>
```

Um card deve normalmente ter:

- background `bg-surface`
- borda `border-border`
- radius `rounded-xl`
- padding coerente

Evitar sombras grandes.

Sombras podem ser usadas em:

- dropdown
- popover
- modal
- floating panels

Cards comuns devem depender mais de borda e diferença de superfície.

---

# 20. Botão primário

Padrão:

```jsx
<button
  className="
    rounded-lg
    bg-primary
    px-4 py-2
    text-sm font-semibold
    text-primary-foreground
    transition-colors
    hover:bg-primary-hover
    active:bg-primary-active
  "
>
  Salvar
</button>
```

Usar botão amarelo para a principal ação da tela.

Exemplos:

- Criar
- Salvar
- Confirmar
- Continuar
- Adicionar

Evitar múltiplos botões primários competindo na mesma área.

---

# 21. Botão secundário

Padrão:

```jsx
<button
  className="
    rounded-lg
    border border-border
    bg-surface
    px-4 py-2
    text-sm font-medium
    text-foreground
    transition-colors
    hover:bg-surface-2
  "
>
  Cancelar
</button>
```

---

# 22. Inputs

Padrão:

```jsx
<input
  className="
    h-10 w-full
    rounded-lg
    border border-border
    bg-surface
    px-3
    text-sm
    text-foreground
    placeholder:text-muted-foreground
    transition
    focus:border-primary
    focus:ring-2
    focus:ring-primary/20
  "
/>
```

Inputs devem seguir o tema automaticamente.

Evitar inputs com background branco fixo.

---

# 23. Radius

Padrão geral:

```txt
rounded-lg
rounded-xl
```

Preferências:

- inputs: rounded-lg
- botões: rounded-lg
- cards: rounded-xl
- modais: rounded-xl
- badges: rounded-full ou rounded-md
- avatares: rounded-full

Evitar arredondamento excessivo em absolutamente tudo.

---

# 24. Tipografia

Fonte oficial:

```txt
Inter
```

Fonte carregada com:

```txt
next/font/google
```

Variável:

```css
--font-inter
```

Tailwind:

```txt
font-sans
```

Hierarquia recomendada:

## Título de página

```txt
text-2xl font-semibold tracking-tight
```

ou em páginas importantes:

```txt
text-3xl font-semibold tracking-tight
```

## Título de seção

```txt
text-lg font-semibold
```

## Texto normal

```txt
text-sm
```

## Texto secundário

```txt
text-sm text-muted-foreground
```

## Labels

```txt
text-sm font-medium
```

Evitar excesso de `font-bold`.

Preferir:

```txt
font-medium
font-semibold
```

---

# 25. Ícones

Biblioteca padrão:

```txt
lucide-react
```

Preferir ícones com:

```jsx
className="size-4"
strokeWidth={1.8}
```

ou:

```jsx
className="size-5"
strokeWidth={1.8}
```

Ícones devem seguir a cor do texto sempre que possível.

Exemplo:

```jsx
<Search className="size-4 text-muted-foreground" />
```

Evitar misturar bibliotecas de ícones sem necessidade.

---

# 26. Scrollbar

A scrollbar nativa visualmente pesada deve ser substituída por uma scrollbar extremamente discreta.

Cor:

```css
--scrollbar: #e7b917;
```

Largura:

```css
4px
```

Track:

```txt
transparente
```

A scrollbar amarela é um pequeno detalhe de identidade visual da plataforma.

Não aumentar sua largura.

---

# 27. Ocultar scrollbar quando necessário

Classe disponível:

```txt
no-scrollbar
```

Exemplo:

```jsx
<div className="overflow-y-auto no-scrollbar">
```

Usar somente em componentes em que esconder completamente a scrollbar faça sentido.

---

# 28. Seleção de texto

A seleção utiliza a cor primária:

```css
::selection {
  background: var(--primary);
  color: var(--primary-foreground);
}
```

---

# 29. Espaçamento

A interface deve respirar.

Evitar componentes espremidos.

Padrões recomendados:

Entre título e descrição:

```txt
gap-1
```

Entre grupos menores:

```txt
gap-2
gap-3
```

Entre componentes:

```txt
gap-4
```

Entre seções:

```txt
gap-6
gap-8
```

Padding de cards:

```txt
p-4
p-5
p-6
```

Não utilizar padding excessivamente grande em dashboards densos.

---

# 30. Layout das páginas

Páginas internas devem preferencialmente seguir:

```jsx
<div className="space-y-6">
  <header>
    ...
  </header>

  <section>
    ...
  </section>
</div>
```

Uma página não deve criar um novo padrão de layout sem motivo.

---

# 31. Cabeçalhos de página

Padrão sugerido:

```jsx
<div className="flex items-start justify-between gap-4">
  <div>
    <h1 className="text-2xl font-semibold tracking-tight text-foreground">
      Título
    </h1>

    <p className="mt-1 text-sm text-muted-foreground">
      Descrição curta da página.
    </p>
  </div>

  <button className="...">
    Nova ação
  </button>
</div>
```

---

# 32. Tabelas

Tabelas devem ter aparência limpa.

Preferir:

- borda externa discreta
- header com `bg-surface-2`
- divisores leves
- linhas com hover sutil
- texto compacto

Evitar grades completas com borda em todas as células.

Exemplo de linha:

```txt
hover:bg-surface-2/60
```

---

# 33. Sidebar

Quando implementada, a sidebar deve seguir os mesmos tokens.

Sugestão:

```txt
bg-surface
border-r border-border
```

Item normal:

```txt
text-muted-foreground
```

Hover:

```txt
hover:bg-surface-2
hover:text-foreground
```

Item ativo:

Pode usar uma combinação discreta de:

```txt
bg-primary/10
text-foreground
```

com pequeno detalhe amarelo.

Evitar preencher toda a sidebar com amarelo.

---

# 34. Header

O header deve ser simples.

Sugestão:

```txt
bg-background/80
backdrop-blur
border-b border-border
```

Pode ser sticky quando fizer sentido.

---

# 35. Modais e Dropdowns

Utilizar:

```txt
bg-surface
border-border
```

Radius:

```txt
rounded-xl
```

Sombras moderadas são permitidas nesses elementos.

O overlay deve usar:

```css
--overlay
```

---

# 36. Estados vazios

Empty states devem ser simples.

Estrutura:

- ícone
- título curto
- descrição
- CTA apenas se necessário

Evitar ilustrações excessivas em páginas operacionais.

---

# 37. Loading

Preferir skeletons que respeitem o tema.

Base sugerida:

```txt
bg-surface-2
```

Evitar loaders gigantes em páginas inteiras quando skeletons forem possíveis.

---

# 38. Responsividade

Toda nova página deve funcionar em:

- desktop
- notebook
- tablet
- celular

Prioridade da plataforma pode ser desktop, mas não criar layouts quebrados em telas menores.

Usar Tailwind responsivo:

```txt
sm:
md:
lg:
xl:
2xl:
```

Não criar breakpoints customizados sem necessidade real.

---

# 39. Dark mode

Não criar estilos dark específicos em cada componente se o token já resolver.

Evitar:

```jsx
className="bg-white dark:bg-[#181816]"
```

Preferir:

```jsx
className="bg-surface"
```

Os tokens devem controlar o tema globalmente.

Usar `dark:` somente em situações específicas onde não existe token semântico apropriado.

---

# 40. Padrão para criação de novos componentes

Ao criar um componente novo:

1. Usar tokens globais.
2. Não hardcodar cores.
3. Usar Inter.
4. Usar Lucide para ícones.
5. Considerar light e dark.
6. Considerar hover.
7. Considerar disabled.
8. Considerar loading.
9. Considerar empty state quando aplicável.
10. Considerar responsividade.
11. Manter aparência minimalista.
12. Não criar uma identidade visual paralela.

---

# 41. Padrão de nomes

Componentes React:

```txt
user-card.jsx
theme-toggle.jsx
page-header.jsx
status-badge.jsx
```

Imports:

```jsx
import { ThemeToggle } from "@/components/theme/theme-toggle";
```

Evitar caminhos relativos muito longos:

```jsx
../../../../components/...
```

Preferir alias:

```txt
@/
```

---

# 42. Regra para componentes reutilizáveis

Caso um padrão apareça em várias páginas, criar componente reutilizável.

Exemplos:

```txt
components/ui/button.jsx
components/ui/input.jsx
components/ui/card.jsx
components/ui/badge.jsx
components/ui/modal.jsx
components/ui/empty-state.jsx
components/ui/page-header.jsx
```

Evitar copiar grandes blocos de Tailwind repetidamente.

---

# 43. Design tokens são a fonte de verdade

As cores devem ser modificadas principalmente no:

```txt
src/app/globals.css
```

Não criar múltiplos arquivos definindo a mesma paleta.

O `globals.css` é a fonte principal para:

- cores
- tema
- superfícies
- bordas
- feedback
- radius
- Tailwind tokens

---

# 44. Resumo rápido para IA / desenvolvedor

Ao criar qualquer nova interface nesta plataforma, siga estas regras:

```txt
STACK:
Next.js App Router
JavaScript / JSX
Tailwind CSS v4

FONTE:
Inter

TEMA:
Light + Dark
next-themes

ESTILO:
Clean
Minimalista
Profissional
Cinza neutro/quente
Sem cinza azulado

COR PRINCIPAL:
#F2C21B

LIGHT BACKGROUND:
#F7F7F5

DARK BACKGROUND:
#11110F

LIGHT SURFACE:
#FFFFFF

DARK SURFACE:
#181816

BORDAS:
discretas

SOMBRAS:
mínimas

ÍCONES:
Lucide React

TOAST:
Sonner através de @/lib/toast

CORES:
sempre usar tokens Tailwind

NÃO:
hardcodar cores
criar dark mode manual em cada componente
usar slate/navy como base
encher grandes superfícies de amarelo
misturar TS/TSX
```

---

# 45. Tokens mais usados

```txt
bg-background
bg-surface
bg-surface-2
bg-surface-3

text-foreground
text-muted-foreground

border-border
border-border-strong

bg-primary
bg-primary-hover
bg-primary-active

text-primary-foreground

text-success
text-danger
text-warning
```

---

# 46. Objetivo final

A plataforma inteira deve parecer um único produto.

Mesmo que os módulos possuam funções completamente diferentes, a linguagem visual deve permanecer consistente.

O usuário deve conseguir entrar em qualquer módulo e perceber imediatamente que continua dentro do mesmo sistema.

As diferenças entre módulos devem estar no conteúdo, dados e funcionalidades.

A identidade visual, navegação, feedback, tipografia, espaçamento, cores e comportamento dos componentes devem permanecer coerentes.
