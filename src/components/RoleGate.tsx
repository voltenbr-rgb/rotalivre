"use client";

import { useState } from "react";
import { ArrowLeft, Bike, KeyRound, LoaderCircle, Lock, LogIn, Mail, Store as StoreIcon, UserPlus } from "lucide-react";
import AuthScreen from "./AuthScreen";
import { InstallButton } from "./InstallApp";
import ForgotPassword, { TermsCheckbox } from "./ForgotPassword";
import type { Courier, Store } from "@/lib/types";

const inputCls =
  "h-13 w-full rounded-2xl border border-white/10 bg-white/4 px-4 py-3.5 text-[15px] text-white placeholder-zinc-600 outline-none transition focus:border-lime-400/60";

interface Props {
  onCourier: (c: Courier, token: string) => void;
  onStore: (s: Store, token: string) => void;
  onAdmin: (token: string) => void;
}

type Step = "choose" | "courier" | "store" | "admin";

/** Porta de entrada: "Sou lojista" ou "Sou entregador" (+ acesso master escondido) */
export default function RoleGate({ onCourier, onStore, onAdmin }: Props) {
  const [step, setStep] = useState<Step>("choose");

  if (step === "courier") return <AuthScreen onAuthenticated={onCourier} onBack={() => setStep("choose")} />;

  return (
    <div className="min-h-dvh bg-[#05070a]">
      <main className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-5 py-8">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="RotaLivre" className="h-12 w-12 shrink-0 rounded-2xl" />
          <div>
            <p className="font-display text-2xl leading-none font-black text-white">
              Rota<span className="text-lime-400">Livre</span>
            </p>
            <p className="text-[11px] text-zinc-500">Entregas de Corumbá e Ladário</p>
          </div>
        </div>

        {step === "choose" && (
          <div className="slide-up mt-10">
            <h1 className="font-display text-[28px] leading-tight font-black text-white">Como você vai usar o RotaLivre?</h1>
            <p className="mt-1.5 text-sm text-zinc-400">Escolha o seu perfil para entrar ou se cadastrar.</p>

            <div className="mt-7 space-y-3">
              <RoleCard
                onClick={() => setStep("store")}
                icon={<StoreIcon className="h-7 w-7" />}
                color="bg-amber-400 text-zinc-950"
                title="Sou lojista / comércio"
                text="Restaurante, lanchonete, mercado, farmácia… Lance pedidos e chame entregadores da região."
              />
              <RoleCard
                onClick={() => setStep("courier")}
                icon={<Bike className="h-7 w-7" />}
                color="bg-lime-400 text-zinc-950"
                title="Sou entregador"
                text="Moto, bicicleta, patinete ou carro. Veja as corridas perto de você e fale com a rede."
              />
            </div>

            <InstallButton className="mt-6 h-12 w-full text-sm" />
          </div>
        )}

        {step === "store" && <StoreAuth onBack={() => setStep("choose")} onDone={onStore} />}
        {step === "admin" && <AdminLogin onBack={() => setStep("choose")} onDone={onAdmin} />}

        {/* Rodapé com o acesso master escondido (o "pingo") */}
        <footer className="mt-auto flex items-center justify-center gap-1.5 pt-10 text-[11px] text-zinc-700">
          RotaLivre © {new Date().getFullYear()}
          <button
            onClick={() => setStep("admin")}
            className="h-2 w-2 rounded-full bg-zinc-800"
            aria-label="Acesso restrito"
          />
        </footer>
      </main>
    </div>
  );
}

function RoleCard({ onClick, icon, color, title, text }: { onClick: () => void; icon: React.ReactNode; color: string; title: string; text: string }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-3xl border border-white/8 bg-[#101319] p-4 text-left transition active:scale-[0.98]"
    >
      <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${color}`}>{icon}</span>
      <span>
        <span className="block font-display text-lg leading-tight font-extrabold text-white">{title}</span>
        <span className="mt-0.5 block text-[13px] leading-snug text-zinc-400">{text}</span>
      </span>
    </button>
  );
}

function BackLink({ onClick, label = "Voltar" }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} className="mb-4 flex items-center gap-1 text-sm font-bold text-zinc-400">
      <ArrowLeft className="h-4 w-4" /> {label}
    </button>
  );
}

/** Login/cadastro da loja: só e-mail e senha (fase de testes) */
function StoreAuth({ onBack, onDone }: { onBack: () => void; onDone: (s: Store, token: string) => void }) {
  const [mode, setMode] = useState<"login" | "register">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  const submit = async () => {
    setError("");
    if (mode === "register" && password !== password2) {
      setError("As senhas não são iguais");
      return;
    }
    if (mode === "register" && !acceptTerms) {
      setError("Para criar a conta, aceite os Termos de Uso e a Política de Privacidade.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/store/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: mode, email, password, acceptTerms }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Algo deu errado");
        return;
      }
      onDone(data.store, data.token);
    } catch {
      setError("Falha de conexão. Verifique sua internet.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="slide-up mt-8">
      <BackLink onClick={onBack} label="Trocar perfil" />
      <h2 className="font-display text-2xl font-black text-white">{mode === "register" ? "Cadastrar minha loja" : "Entrar na minha loja"}</h2>
      <p className="mt-1 text-sm text-zinc-400">
        {mode === "register" ? "Só e-mail e senha. O nome e o endereço da loja você completa em seguida." : "Use o e-mail e a senha da loja."}
      </p>
      <div className="mt-5 space-y-3">
        <label className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold tracking-wide text-zinc-400 uppercase">
            <Mail className="h-3.5 w-3.5" /> E-mail da loja
          </span>
          <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="loja@email.com" inputMode="email" autoComplete="email" />
        </label>
        <label className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold tracking-wide text-zinc-400 uppercase">
            <Lock className="h-3.5 w-3.5" /> Senha
          </span>
          <input
            className={inputCls}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && mode === "login" && submit()}
            placeholder={mode === "register" ? "mínimo 6 caracteres" : "sua senha"}
            autoComplete={mode === "register" ? "new-password" : "current-password"}
          />
        </label>
        {mode === "register" && (
          <input
            className={inputCls}
            type="password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="repita a senha"
            autoComplete="new-password"
          />
        )}
        {mode === "register" && <TermsCheckbox checked={acceptTerms} onChange={setAcceptTerms} />}
        {mode === "login" && (
          <button onClick={() => setForgotOpen(true)} className="text-[13px] font-bold text-amber-300">
            Esqueci minha senha
          </button>
        )}
        {forgotOpen && <ForgotPassword accountType="store" initialEmail={email} onClose={() => setForgotOpen(false)} />}
        {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
        <button
          onClick={submit}
          disabled={busy}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 text-base font-black text-zinc-950 transition active:scale-[0.98] disabled:opacity-60"
        >
          {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : mode === "register" ? <UserPlus className="h-5 w-5" /> : <LogIn className="h-5 w-5" />}
          {mode === "register" ? "CRIAR CONTA DA LOJA" : "ENTRAR"}
        </button>
        <button
          onClick={() => {
            setMode(mode === "register" ? "login" : "register");
            setError("");
          }}
          className="w-full py-1 text-center text-sm font-bold text-amber-300"
        >
          {mode === "register" ? "Já tenho conta — entrar" : "Ainda não tenho conta — cadastrar"}
        </button>
      </div>
    </div>
  );
}

/** Acesso master (senha) */
function AdminLogin({ onBack, onDone }: { onBack: () => void; onDone: (token: string) => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Senha incorreta");
        return;
      }
      onDone(data.token);
    } catch {
      setError("Falha de conexão");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="slide-up mt-8">
      <BackLink onClick={onBack} />
      <h2 className="flex items-center gap-2 font-display text-2xl font-black text-white">
        <KeyRound className="h-6 w-6 text-zinc-400" /> Acesso restrito
      </h2>
      <p className="mt-1 text-sm text-zinc-400">Painel geral do RotaLivre.</p>
      <input
        className={`${inputCls} mt-5`}
        type="password"
        inputMode="numeric"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Senha master"
        autoFocus
      />
      {error && <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
      <button
        onClick={submit}
        disabled={busy || !password}
        className="mt-4 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-white/10 py-3.5 text-sm font-black text-white disabled:opacity-50"
      >
        {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <KeyRound className="h-5 w-5" />} ENTRAR NO PAINEL
      </button>
    </div>
  );
}
