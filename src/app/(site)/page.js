import { Landing } from "@/components/landing/landing";

export const metadata = {
  title: {
    absolute: "PDR Hub · Gestão para empresas de martelinho de ouro",
  },
  description:
    "Serviços, oficinas parceiras, técnicos, repasses e DRE numa plataforma só. O financeiro se monta sozinho a cada serviço lançado.",
  openGraph: {
    title: "PDR Hub · Do martelinho ao DRE",
    description:
      "Gestão completa para empresas de PDR: serviços, oficinas, técnicos, repasses automáticos e resultado financeiro.",
    images: ["/Logo_Completa.png"],
    locale: "pt_BR",
    type: "website",
  },
};

export default function Home() {
  return <Landing />;
}
