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
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
    shortcut: "/icons/icon-192.png",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // Ocupa a tela toda (inclusive atrás do entalhe); o app respeita safe-area-inset
  viewportFit: "cover",
  themeColor: "#05070a",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        {/* Guarda o convite de instalação do Chrome assim que ele aparece (antes do app carregar) */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__rlInstallPrompt=e;window.dispatchEvent(new Event('rl-install-available'));});",
          }}
        />
      </head>
      <body className="bg-[#05070a] text-zinc-100 antialiased">{children}</body>
    </html>
  );
}
