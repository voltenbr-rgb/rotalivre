"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Download, Plus, Share, Smartphone, X } from "lucide-react";
import { dismissInstall, isInstallDismissed } from "@/lib/session";

/* eslint-disable @typescript-eslint/no-explicit-any */

export function usePwaInstall() {
  const [deferred, setDeferred] = useState<any>(null);
  const [standalone, setStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(display-mode: standalone)");
    setStandalone(mq.matches || (window.navigator as any).standalone === true);
    setIsIOS(/iphone|ipad|ipod/i.test(window.navigator.userAgent));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e);
    };
    const onInstalled = () => {
      setStandalone(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return false;
    deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") {
      setDeferred(null);
      return true;
    }
    return false;
  }, [deferred]);

  return { canPrompt: !!deferred, standalone, isIOS, promptInstall };
}

/** Botão "Baixar no telefone" — instala direto quando o navegador permite; senão abre o guia */
export function InstallButton({ className = "", label = "Baixar no telefone" }: { className?: string; label?: string }) {
  const { canPrompt, standalone, isIOS, promptInstall } = usePwaInstall();
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
        <Smartphone className="h-5 w-5" /> {label}
      </button>
      <InstallModal open={open} onClose={() => setOpen(false)} isIOS={isIOS} canPrompt={canPrompt} onPrompt={promptInstall} />
    </>
  );
}

/** Banner de instalação exibido no topo da tela inicial */
export function InstallBanner() {
  const { canPrompt, standalone, isIOS, promptInstall } = usePwaInstall();
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
          <p className="text-sm font-extrabold text-white">RotaLivre no seu telefone</p>
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
      <InstallModal open={open} onClose={() => setOpen(false)} isIOS={isIOS} canPrompt={canPrompt} onPrompt={promptInstall} />
    </>
  );
}

function InstallModal({
  open, onClose, isIOS, canPrompt, onPrompt,
}: {
  open: boolean;
  onClose: () => void;
  isIOS: boolean;
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
              <p className="font-display text-lg leading-tight font-extrabold text-white">Baixar o RotaLivre</p>
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

        {/* QR para abrir no celular a partir do notebook */}
        <div className="mt-5 rounded-2xl border border-white/8 bg-white/3 p-4 text-center">
          <p className="text-xs font-bold tracking-widest text-zinc-400 uppercase">No notebook? Aponte a câmera do celular</p>
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
            {isIOS ? "No iPhone (Safari)" : "No Android (Chrome)"}
          </p>
          {isIOS ? (
            <ol className="space-y-2.5 text-sm text-zinc-300">
              <Step n={1} icon={<Share className="h-4 w-4" />} text="Toque no botão Compartilhar, na barra do Safari" />
              <Step n={2} icon={<Plus className="h-4 w-4" />} text="Escolha “Adicionar à Tela de Início”" />
              <Step n={3} icon={<Check className="h-4 w-4" />} text="Confirme em “Adicionar” — o RotaLivre vira um app na sua tela" />
            </ol>
          ) : (
            <ol className="space-y-2.5 text-sm text-zinc-300">
              <Step n={1} icon={<Smartphone className="h-4 w-4" />} text="Abra este endereço no Chrome do seu celular" />
              <Step n={2} icon={<Download className="h-4 w-4" />} text="Toque no menu ⋮ e em “Instalar app” / “Adicionar à tela inicial”" />
              <Step n={3} icon={<Check className="h-4 w-4" />} text="Pronto! O RotaLivre abre em tela cheia, igual aplicativo nativo" />
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
