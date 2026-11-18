import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "RotaLivre — Hub do Entregador",
  description:
    "Feed aberto de corridas, mapa em tempo real, rádio entre motoboys e relatórios financeiros sem caixa-preta.",
  applicationName: "RotaLivre",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "RotaLivre",
  },
  icons: {
    icon: "/icons/icon-512.png",
    apple: "/icons/icon-512.png",
    shortcut: "/icons/icon-512.png",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#05070a",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-[#05070a] text-zinc-100 antialiased">{children}</body>
    </html>
  );
}
