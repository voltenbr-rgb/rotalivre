"use client";

import { useState } from "react";
import { CircleCheck, LifeBuoy, LoaderCircle, X } from "lucide-react";
import { apiFetch } from "@/lib/session";

const inputCls =
  "h-12 w-full rounded-2xl border border-white/10 bg-white/4 px-4 text-[15px] text-white placeholder-zinc-600 outline-none focus:border-lime-400/60";

/** "Esqueci minha senha": abre um pedido para o suporte (painel master) */
export default function ForgotPassword({
  accountType, initialEmail, onClose,
}: { accountType: "courier" | "store"; initialEmail?: string; onClose: () => void }) {
  const [email, setEmail] = useState(initialEmail ?? "");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const send = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountType, email, contact, message, kind: "senha" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível enviar");
        return;
      }
      setDone(true);
    } catch {
      setError("Falha de conexão");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/80 sm:items-center" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="slide-up w-full max-w-[420px] rounded-t-3xl border border-white/10 bg-[#0d1015] p-6 sm:rounded-3xl"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}
      >
        <div className="flex items-start justify-between">
          <p className="flex items-center gap-2 font-display text-xl font-black text-white">
            <LifeBuoy className="h-5 w-5 text-lime-400" /> Esqueci minha senha
          </p>
          <button onClick={onClose} className="text-zinc-500" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        {done ? (
          <div className="mt-4 text-center">
            <CircleCheck className="mx-auto h-12 w-12 text-lime-400" />
            <p className="mt-2 text-[15px] font-bold text-white">Pedido enviado ao suporte!</p>
            <p className="mt-1 text-[13px] leading-snug text-zinc-400">
              O suporte do RotaLivre vai te chamar no WhatsApp com uma senha provisória. Depois é só trocar no Perfil.
            </p>
            <button onClick={onClose} className="mt-5 h-12 w-full rounded-2xl bg-lime-400 text-sm font-black text-zinc-950">
              OK
            </button>
          </div>
        ) : (
          <>
            <p className="mt-1 text-[13px] leading-snug text-zinc-400">
              Informe o e-mail da conta e um WhatsApp. O suporte confere e te manda uma senha provisória.
            </p>
            <div className="mt-4 space-y-3">
              <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail da conta" inputMode="email" />
              <input className={inputCls} value={contact} onChange={(e) => setContact(e.target.value)} placeholder="WhatsApp com DDD" inputMode="tel" />
              <input className={inputCls} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Observação (opcional)" />
              {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
              <button
                onClick={send}
                disabled={busy}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-lime-400 text-sm font-black text-zinc-950 disabled:opacity-60"
              >
                {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} PEDIR AJUDA AO SUPORTE
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Aceite dos termos (cadastro) */
export function TermsCheckbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-2.5 text-[12px] leading-snug text-zinc-400">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4.5 w-4.5 shrink-0 accent-lime-400"
      />
      <span>
        Li e aceito os{" "}
        <a href="/termos" target="_blank" className="font-bold text-lime-300 underline">
          Termos de Uso
        </a>{" "}
        e a{" "}
        <a href="/privacidade" target="_blank" className="font-bold text-lime-300 underline">
          Política de Privacidade
        </a>
        .
      </span>
    </label>
  );
}

/** Trocar a própria senha (Perfil do entregador / Minha loja) */
export function ChangePassword({
  endpoint, notify,
}: { endpoint: string; notify: (msg: string, tone?: "ok" | "warn" | "sos") => void }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [next2, setNext2] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (next.length < 6) return notify("A nova senha precisa ter pelo menos 6 caracteres", "warn");
    if (next !== next2) return notify("As senhas novas não são iguais", "warn");
    setBusy(true);
    try {
      const res = await apiFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "change_password", current, next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return notify(data.error ?? "Não foi possível trocar a senha", "warn");
      notify("Senha trocada com sucesso!");
      setOpen(false);
      setCurrent("");
      setNext("");
      setNext2("");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 text-sm font-bold text-zinc-200"
      >
        🔑 TROCAR MINHA SENHA
      </button>
    );
  }
  return (
    <div className="space-y-2.5 rounded-2xl border border-white/10 bg-white/4 p-4">
      <p className="text-sm font-bold text-white">Trocar senha</p>
      <input className={inputCls} type="password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="Senha atual (ou a provisória)" autoComplete="current-password" />
      <input className={inputCls} type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="Nova senha (mín. 6)" autoComplete="new-password" />
      <input className={inputCls} type="password" value={next2} onChange={(e) => setNext2(e.target.value)} placeholder="Repita a nova senha" autoComplete="new-password" />
      <div className="flex gap-2">
        <button onClick={() => setOpen(false)} className="h-11 rounded-xl px-4 text-sm font-bold text-zinc-400">
          Cancelar
        </button>
        <button onClick={save} disabled={busy} className="h-11 flex-1 rounded-xl bg-lime-400 text-sm font-black text-zinc-950 disabled:opacity-60">
          SALVAR NOVA SENHA
        </button>
      </div>
    </div>
  );
}
