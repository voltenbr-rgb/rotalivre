"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Download, Monitor, Plus, Share, Smartphone, X } from "lucide-react";
import { dismissInstall, isInstallDismissed } from "@/lib/session";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type Platform = "ios" | "android" | "desktop";

/*
 * O navegador dispara "beforeinstallprompt" uma única vez, logo que a página
 * carrega. Capturamos aqui no nível do módulo para não perder o evento quando
 * o botão de instalar só aparece depois (perfil, tela de login etc.).
 */
let earlyPrompt: any = null;
if (typeof window !== "undefined") {
  // Capturado ainda mais cedo por um script no <head> (layout.tsx)
  earlyPrompt = (window as any).__rlInstallPrompt ?? null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    earlyPrompt = e;
    window.dispatchEvent(new Event("rl-install-available"));
  });
}

function detectPlatform(): Platform {
  const ua = window.navigator.userAgent;
  // iPad com iPadOS se apresenta como Mac: detecta pelo toque
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/android|mobile/i.test(ua)) return "android";
  return "desktop";
}

export function usePwaInstall() {
  const [deferred, setDeferred] = useState<any>(null);
  const [standalone, setStandalone] = useState(false);
  const [platform, setPlatform] = useState<Platform>("android");

  useEffect(() => {
    const mq = window.matchMedia("(display-mode: standalone)");
    setStandalone(mq.matches || (window.navigator as any).standalone === true);
    setPlatform(detectPlatform());
    const current = () => earlyPrompt ?? (window as any).__rlInstallPrompt ?? null;
    if (current()) setDeferred(current());
    const onAvailable = () => {
      earlyPrompt = current();
      setDeferred(earlyPrompt);
    };
    window.addEventListener("rl-install-available", onAvailable);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      earlyPrompt = e;
      setDeferred(e);
    };
    const onInstalled = () => {
      earlyPrompt = null;
      setStandalone(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("rl-install-available", onAvailable);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return false;
    // O convite do Chrome só pode ser usado UMA vez: descarta já, aceito ou não
    const ev = deferred;
    earlyPrompt = null;
    (window as any).__rlInstallPrompt = null;
    setDeferred(null);
    try {
      ev.prompt();
      const choice = await ev.userChoice;
      if (choice.outcome === "accepted") return true;
    } catch {
      /* convite já usado/expirado: mostra o passo a passo */
    }
    return false;
  }, [deferred]);

  return { canPrompt: !!deferred, standalone, isIOS: platform === "ios", platform, promptInstall };
}

/** Botão "Baixar no telefone" — instala direto quando o navegador permite; senão abre o guia */
export function InstallButton({ className = "", label }: { className?: string; label?: string }) {
  const { canPrompt, standalone, platform, promptInstall } = usePwaInstall();
  const [open, setOpen] = useState(false);

  if (standalone) return null;

  const click = async () => {
    if (canPrompt) {
      const ok = await promptInstall();
      if (!ok) setOpen(true);
    } else {
      setOpen(true);
    }
  };

  return (
    <>
      <button
        onClick={click}
        className={`flex items-center justify-center gap-2 rounded-2xl bg-lime-400 font-black text-zinc-950 shadow-[0_10px_26px_rgba(163,230,53,0.3)] transition active:scale-95 ${className}`}
      >
        {platform === "desktop" ? <Monitor className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}{" "}
        {label ?? (platform === "desktop" ? "Instalar no computador" : "Instalar no celular")}
      </button>
      <InstallModal open={open} onClose={() => setOpen(false)} platform={platform} canPrompt={canPrompt} onPrompt={promptInstall} />
    </>
  );
}

/** Banner de instalação exibido no topo da tela inicial */
export function InstallBanner() {
  const { canPrompt, standalone, platform, promptInstall } = usePwaInstall();
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!isInstallDismissed());
  }, []);

  if (standalone || !visible) return null;

  const click = async () => {
    if (canPrompt) {
      const ok = await promptInstall();
      if (!ok) setOpen(true);
    } else setOpen(true);
  };

  return (
    <>
      <section className="slide-up flex items-center gap-3 rounded-3xl border border-lime-400/25 bg-[#101408] p-3.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-512.png" alt="RotaLivre" className="h-12 w-12 shrink-0 rounded-2xl" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-white">
            {platform === "desktop" ? "RotaLivre no seu computador" : "RotaLivre no seu celular"}
          </p>
          <p className="text-[11px] leading-snug text-zinc-400">
            Instale o app: abre em tela cheia, mais rápido e com o rádio a um toque.
          </p>
        </div>
        <button
          onClick={click}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-lime-400 px-3.5 py-2.5 text-xs font-black text-zinc-950 active:scale-95"
        >
          <Download className="h-4 w-4" /> Instalar
        </button>
        <button
          onClick={() => {
            dismissInstall();
            setVisible(false);
          }}
          className="shrink-0 rounded-lg p-1.5 text-zinc-500 active:scale-90"
          aria-label="Dispensar"
        >
          <X className="h-4 w-4" />
        </button>
      </section>
      <InstallModal open={open} onClose={() => setOpen(false)} platform={platform} canPrompt={canPrompt} onPrompt={promptInstall} />
    </>
  );
}

function InstallModal({
  open, onClose, platform, canPrompt, onPrompt,
}: {
  open: boolean;
  onClose: () => void;
  platform: Platform;
  canPrompt: boolean;
  onPrompt: () => Promise<boolean>;
}) {
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (!open) return;
    const origin = window.location.origin;
    setUrl(origin);
    QRCode.toDataURL(origin, {
      width: 240,
      margin: 1,
      color: { dark: "#0a0c10", light: "#ffffff" },
    })
      .then(setQr)
      .catch(() => setQr(""));
  }, [open ]);

  if (!open) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard indisponível */ }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        className="slide-up max-h-[92dvh] w-full max-w-[440px] overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0d1015] p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-512.png" alt="RotaLivre" className="h-12 w-12 rounded-2xl" />
            <div>
              <p className="font-display text-lg leading-tight font-extrabold text-white">Instalar o RotaLivre</p>
              <p className="text-xs text-zinc-400">Grátis • Sem ocupar quase nada de memória</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg bg-white/5 p-2 text-zinc-400" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        {canPrompt && (
          <button
            onClick={async () => {
              if (await onPrompt()) onClose();
            }}
            className="mt-4 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-lime-400 py-3.5 text-sm font-black text-zinc-950 active:scale-[0.98]"
          >
            <Download className="h-5 w-5" /> INSTALAR AGORA
          </button>
        )}

        {/* QR para abrir no celular a partir do computador */}
        <div className="mt-5 rounded-2xl border border-white/8 bg-white/3 p-4 text-center">
          <p className="text-xs font-bold tracking-widest text-zinc-400 uppercase">
            {platform === "desktop" ? "Quer no celular? Aponte a câmera para o código" : "Passe para outro aparelho"}
          </p>
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="QR Code para abrir o RotaLivre no celular" className="mx-auto mt-3 h-44 w-44 rounded-xl" />
          ) : (
            <div className="mx-auto mt-3 h-44 w-44 animate-pulse rounded-xl bg-white/8" />
          )}
          <div className="mt-3 flex items-center gap-2">
            <span className="h-11 flex-1 truncate rounded-xl bg-black/30 px-3 py-3 text-left text-xs font-semibold text-zinc-300">{url}</span>
            <button onClick={copy} className="flex h-11 items-center gap-1.5 rounded-xl bg-white/8 px-3 text-xs font-bold text-white active:scale-95">
              {copied ? <Check className="h-4 w-4 text-lime-400" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>

        {/* Passo a passo por plataforma */}
        <div className="mt-4 space-y-3">
          <p className="text-xs font-bold tracking-widest text-zinc-400 uppercase">
            {platform === "ios" ? "No iPhone (Safari)" : platform === "android" ? "No Android" : "No computador (Chrome ou Edge)"}
          </p>
          {platform === "ios" ? (
            <ol className="space-y-2.5 text-sm text-zinc-300">
              <Step n={1} icon={<Share className="h-4 w-4" />} text="Abra no Safari e toque no botão Compartilhar" />
              <Step n={2} icon={<Plus className="h-4 w-4" />} text="Escolha “Adicionar à Tela de Início”" />
              <Step n={3} icon={<Check className="h-4 w-4" />} text="Toque em “Adicionar”: o RotaLivre aparece com o ícone na sua tela" />
            </ol>
          ) : platform === "android" ? (
            <ol className="space-y-2.5 text-sm text-zinc-300">
              <Step n={1} icon={<Smartphone className="h-4 w-4" />} text="Abra este endereço no Google Chrome (o mais garantido) ou Samsung Internet" />
              <Step n={2} icon={<Download className="h-4 w-4" />} text="Toque no menu ⋮ e em “Instalar app” ou “Adicionar à tela inicial”" />
              <Step n={3} icon={<Check className="h-4 w-4" />} text="Pronto: o RotaLivre abre em tela cheia, como um aplicativo" />
            </ol>
          ) : null}
          {platform === "android" && (
            <p className="rounded-xl bg-white/5 px-3 py-2 text-[11px] leading-snug text-zinc-400">
              Se no menu ⋮ aparecer <b className="text-zinc-200">“Abrir app”</b> em vez de “Instalar”, o RotaLivre já está
              instalado: procure o ícone na tela do celular.
            </p>
          )}
          {platform === "desktop" && (
            <ol className="space-y-2.5 text-sm text-zinc-300">
              <Step n={1} icon={<Monitor className="h-4 w-4" />} text="Abra este endereço no Google Chrome ou no Microsoft Edge" />
              <Step n={2} icon={<Download className="h-4 w-4" />} text="Clique no ícone de instalar no canto direito da barra de endereço, ou no menu ⋮ → “Instalar RotaLivre”" />
              <Step n={3} icon={<Check className="h-4 w-4" />} text="O RotaLivre ganha atalho na área de trabalho e abre em janela própria" />
            </ol>
          )}
        </div>

        <p className="mt-4 text-center text-[11px] text-zinc-600">
          Funciona no celular e no notebook — sua conta acompanha você em qualquer tela.
        </p>
      </div>
    </div>
  );
}

function Step({ n, icon, text }: { n: number; icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-lime-400/15 text-[11px] font-black text-lime-300">{n}</span>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-zinc-300">{icon}</span>
      <span className="leading-snug">{text}</span>
    </li>
  );
}
