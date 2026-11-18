import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RotaLivre — Hub do Entregador",
    short_name: "RotaLivre",
    description:
      "Feed aberto de corridas, mapa em tempo real, rádio entre motoboys e relatórios financeiros sem caixa-preta.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#05070a",
    theme_color: "#05070a",
    lang: "pt-BR",
    categories: ["business", "navigation", "productivity"],
    icons: [
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
