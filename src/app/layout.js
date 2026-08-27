import { Inter } from "next/font/google";

import { Providers } from "@/components/providers/providers";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata = {
  applicationName: "PDR Hub",
  title: {
    default: "PDR | Hub",
    template: "%s | PDR Hub",
  },
  description:
    "Plataforma interna para gestao de servicos automotivos, oficinas, tecnicos, veiculos e financeiro.",
  appleWebApp: {
    capable: true,
    title: "PDR Hub",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/Logo_Curta.png",
    apple: "/Logo_Curta.png",
    shortcut: "/Logo_Curta.png",
  },
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
