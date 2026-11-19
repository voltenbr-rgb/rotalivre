"use client";

import { useState } from "react";
import {
  ArrowLeft, ArrowRight, BadgeCheck, Bike, CalendarDays, Check, CreditCard,
  Eye, EyeOff, Home, IdCard, LoaderCircle, Lock, LogIn, Mail, MapPin, Phone, Radio,
  Route, ShieldCheck, User, UserPlus, Wallet,
} from "lucide-react";
import type { Courier } from "@/lib/types";
import { InstallButton } from "./InstallApp";
import ForgotPassword, { TermsCheckbox } from "./ForgotPassword";

interface Props {
  onAuthenticated: (courier: Courier, token: string) => void;
  /** Volta para a escolha "Sou lojista / Sou entregador" */
  onBack?: () => void;
}

const inputCls =
  "h-13 w-full rounded-2xl border border-white/10 bg-white/4 px-4 py-3.5 text-[15px] text-white placeholder-zinc-600 outline-none transition focus:border-lime-400/60";
const errCls = "border-red-500/60";

type View = "home" | "login" | "register";

const VEHICLE_OPTIONS = [
  { id: "moto", label: "Moto", emoji: "🏍️" },
  { id: "bicicleta", label: "Bicicleta", emoji: "🚲" },
  { id: "scooter", label: "Patinete", emoji: "🛴" },
  { id: "carro", label: "Carro", emoji: "🚗" },
] as const;

export default function AuthScreen({ onAuthenticated, onBack }: Props) {
  const [vehicle, setVehicle] = useState<(typeof VEHICLE_OPTIONS)[number]["id"]>("moto");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [view, setView] = useState<View>("home");
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState("");

  // login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  // cadastro (wizard)
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: "", nickname: "", email: "", phone: "", cpf: "", birthDate: "",
    vehicleModel: "", vehiclePlate: "", vehicleYear: "", vehicleColor: "",
    cnhNumber: "", cnhCategory: "AB", cnhExpiry: "",
    cep: "", street: "", number: "", neighborhood: "", city: "", state: "",
    workRadiusKm: 8, dailyGoal: 200,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cepLoading, setCepLoading] = useState(false);

  const set = (k: keyof typeof form, v: string | number) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
    setServerError("");
  };

  const call = async (payload: Record<string, unknown>) => {
    setBusy(true);
    setServerError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setServerError(data.error ?? "Algo deu errado. Tente de novo.");
        return null;
      }
      return { courier: data.courier as Courier, token: data.token as string };
    } catch {
      setServerError("Falha de conexão. Verifique sua internet.");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const doLogin = async () => {
    const r = await call({ action: "login", email: loginEmail, password: loginPassword });
    if (r) onAuthenticated(r.courier, r.token);
  };

  const lookupCep = async (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm((f) => ({
          ...f,
          street: data.logradouro || f.street,
          neighborhood: data.bairro || f.neighborhood,
          city: data.localidade || f.city,
          state: data.uf || f.state,
        }));
      } else {
        setErrors((e) => ({ ...e, cep: "CEP não encontrado" }));
      }
    } catch {
      setErrors((e) => ({ ...e, cep: "Não foi possível consultar o CEP" }));
    } finally {
      setCepLoading(false);
    }
  };

  const maskCep = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 8);
    return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
  };

  const validateStep = () => {
    const e: Record<string, string> = {};
    if (step === 0) {
      if (form.name.trim().length < 3) e.name = "Informe seu nome completo";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "E-mail inválido";
      if (form.phone.replace(/\D/g, "").length < 10) e.phone = "Celular com DDD";
      if (form.cpf.replace(/\D/g, "").length !== 11) e.cpf = "CPF com 11 dígitos";
      if (password.length < 6) e.password = "Mínimo de 6 caracteres";
      else if (password !== password2) e.password2 = "As senhas não são iguais";
    }
    if (step === 1) {
      if (form.vehicleModel.trim().length < 3) e.vehicleModel = "Informe o modelo da moto";
      const plate = form.vehiclePlate.replace("-", "").toUpperCase();
      if (!(/^[A-Z]{3}\d{4}$/.test(plate) || /^[A-Z]{3}\d[A-Z]\d{2}$/.test(plate))) e.vehiclePlate = "Placa inválida";
      if (form.cnhNumber.replace(/\D/g, "").length < 9) e.cnhNumber = "Número da CNH inválido";
    }
    if (step === 2) {
      if (form.cep.replace(/\D/g, "").length !== 8) e.cep = "CEP com 8 dígitos";
      if (!form.street.trim()) e.street = "Informe a rua";
      if (!form.number.trim()) e.number = "Número";
      if (!form.neighborhood.trim()) e.neighborhood = "Informe o bairro";
      if (!form.city.trim()) e.city = "Informe a cidade";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /** Cadastro simples: e-mail, senha e veículo */
  const submitSimple = async () => {
    const e: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = "E-mail inválido";
    if (password.length < 6) e.password = "Mínimo de 6 caracteres";
    else if (password !== password2) e.password2 = "As senhas não são iguais";
    setErrors(e);
    if (Object.keys(e).length) return;
    if (!acceptTerms) {
      setServerError("Para criar a conta, aceite os Termos de Uso e a Política de Privacidade.");
      return;
    }
    const r = await call({ action: "register", email: form.email.trim(), name: form.name.trim(), password, vehicleType: vehicle, acceptTerms });
    if (r) onAuthenticated(r.courier, r.token);
  };

  const submitRegister = async () => {
    if (!validateStep()) return;
    const r = await call({ action: "register", ...form, password });
    if (r) onAuthenticated(r.courier, r.token);
  };

  return (
    <div className="min-h-dvh bg-[#05070a]">
      <div className="mx-auto grid min-h-dvh w-full max-w-[480px] lg:max-w-6xl lg:grid-cols-2">
        {/* Painel da marca (desktop) */}
        <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-white/6 bg-[#070a06] p-10 lg:flex">
          <div>
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/icon-192.png" alt="RotaLivre" className="h-12 w-12 shrink-0 rounded-2xl" />
              <p className="font-display text-2xl font-black tracking-tight text-white">
                Rota<span className="text-lime-400">Livre</span>
              </p>
            </div>
            <h1 className="mt-12 font-display text-4xl leading-[1.08] font-black text-white">
              A praça é sua.
              <br />
              <span className="text-lime-400">Sem caixa-preta.</span>
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-zinc-400">
              Feed aberto de corridas, mapa com radar de parceiros, rádio PTT com a rede e relatórios
              financeiros transparentes — no celular e no notebook, com a mesma conta.
            </p>
            <ul className="mt-8 space-y-3.5">
              <Benefit icon={<Eye className="h-5 w-5 text-lime-300" />} title="Feed 100% aberto" text="Veja valor, km e R$/km antes de aceitar. Recusar nunca pune." />
              <Benefit icon={<Wallet className="h-5 w-5 text-emerald-300" />} title="Taxa transparente de 5%" text="Bruto, taxa e líquido na sua frente, em relatórios de 1 a 90 dias." />
              <Benefit icon={<Radio className="h-5 w-5 text-sky-300" />} title="Rádio com a rede" text="PTT, alertas de blitz, alagamento e SOS com parceiros num raio de 5 km." />
              <Benefit icon={<Route className="h-5 w-5 text-amber-300" />} title="Mapa em tempo real" text="Coleta, cliente, rota e radar de colegas para rodar com segurança." />
            </ul>
          </div>
          <div className="flex gap-6 text-sm">
            <Stat v="+1.200" l="associados na rede" />
            <Stat v="R$ 0" l="taxa escondida" />
            <Stat v="4.9" l="avaliação média" />
          </div>
        </aside>

        {/* Área de acesso / cadastro */}
        <main className="flex flex-col px-5 py-8 lg:justify-center lg:px-14">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/icon-192.png" alt="RotaLivre" className="h-11 w-11 shrink-0 rounded-2xl" />
            <div>
              <p className="font-display text-xl leading-none font-black text-white">
                Rota<span className="text-lime-400">Livre</span>
              </p>
              <p className="text-[11px] text-zinc-500">Hub do entregador • sem caixa-preta</p>
            </div>
          </div>

          {view === "home" && (
            <div className="slide-up">
              {onBack && <Back onClick={onBack} label="Trocar perfil" />}
              <h2 className="font-display text-[26px] leading-tight font-black text-white">
                Bora rodar do seu jeito?
              </h2>
              <p className="mt-1.5 text-sm text-zinc-400">
                Entre na sua conta de entregador ou cadastre-se. Leva menos de 1 minuto.
              </p>

              <div className="mt-6 space-y-3">
                <button
                  onClick={() => setView("register")}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-lime-400 text-base font-black text-zinc-950 shadow-[0_12px_28px_rgba(163,230,53,0.3)] transition active:scale-[0.98]"
                >
                  <UserPlus className="h-5 w-5" /> QUERO SER ENTREGADOR
                </button>
                <button
                  onClick={() => setView("login")}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/4 text-base font-extrabold text-white transition active:scale-[0.98]"
                >
                  <LogIn className="h-5 w-5 text-lime-300" /> JÁ TENHO CONTA — ENTRAR
                </button>
              </div>

              <InstallButton className="mt-4 h-12 w-full text-sm" />
              <ErrorBox msg={serverError} />
              <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-[11px] text-zinc-600">
                <ShieldCheck className="h-3.5 w-3.5" /> Seus dados ficam só com você. Sem fidelidade, sem punição.
              </p>
            </div>
          )}

          {view === "login" && (
            <div className="slide-up">
              <Back onClick={() => setView("home")} />
              <h2 className="font-display text-2xl font-black text-white">Entrar na minha conta</h2>
              <p className="mt-1 text-sm text-zinc-400">Use o e-mail e a senha do seu cadastro.</p>
              <div className="mt-5 space-y-3.5">
                <Field label="E-mail cadastrado" icon={<Mail className="h-3.5 w-3.5" />}>
                  <input
                    className={inputCls}
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="voce@email.com"
                    inputMode="email"
                    autoComplete="email"
                  />
                </Field>
                <Field label="Senha" icon={<Lock className="h-3.5 w-3.5" />}>
                  <div className="relative">
                    <input
                      className={`${inputCls} pr-11`}
                      type={showPw ? "text" : "password"}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && doLogin()}
                      placeholder="Sua senha"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute top-1/2 right-3 -translate-y-1/2 text-zinc-500"
                      aria-label={showPw ? "Esconder senha" : "Mostrar senha"}
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </Field>
                <button onClick={() => setForgotOpen(true)} className="text-[13px] font-bold text-lime-300">
                  Esqueci minha senha
                </button>
                {forgotOpen && <ForgotPassword accountType="courier" initialEmail={loginEmail} onClose={() => setForgotOpen(false)} />}
                <ErrorBox msg={serverError} />
                <button
                  onClick={doLogin}
                  disabled={busy}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-lime-400 text-base font-black text-zinc-950 transition active:scale-[0.98] disabled:opacity-60"
                >
                  {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />} ENTRAR
                </button>
                <button onClick={() => setView("register")} className="w-full py-1 text-center text-sm font-bold text-lime-300">
                  Ainda não é associado? Cadastre-se grátis
                </button>
              </div>
            </div>
          )}

          {view === "register" && (
            <div className="slide-up">
              <Back onClick={() => setView("home")} />
              <h2 className="font-display text-2xl font-black text-white">Cadastro de entregador</h2>
              <p className="mt-1 text-sm text-zinc-400">Rapidinho: e-mail, senha e o seu veículo. O resto você completa no Perfil.</p>
              <div className="mt-5 space-y-3.5">
                <Field label="Seu nome ou apelido (opcional)" icon={<User className="h-3.5 w-3.5" />}>
                  <input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: João “Relâmpago”" />
                </Field>
                <Field label="E-mail" icon={<Mail className="h-3.5 w-3.5" />} error={errors.email}>
                  <input
                    className={`${inputCls} ${errors.email ? errCls : ""}`}
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    placeholder="voce@email.com"
                    inputMode="email"
                    autoComplete="email"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Senha" icon={<Lock className="h-3.5 w-3.5" />} error={errors.password}>
                    <input
                      className={`${inputCls} ${errors.password ? errCls : ""}`}
                      type="password"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setErrors((x) => ({ ...x, password: "" })); }}
                      placeholder="mín. 6"
                      autoComplete="new-password"
                    />
                  </Field>
                  <Field label="Repita a senha" error={errors.password2}>
                    <input
                      className={`${inputCls} ${errors.password2 ? errCls : ""}`}
                      type="password"
                      value={password2}
                      onChange={(e) => { setPassword2(e.target.value); setErrors((x) => ({ ...x, password2: "" })); }}
                      placeholder="de novo"
                      autoComplete="new-password"
                    />
                  </Field>
                </div>

                <div>
                  <p className="mb-2 text-xs font-bold tracking-wide text-zinc-400 uppercase">Com o que você entrega?</p>
                  <div className="grid grid-cols-4 gap-2">
                    {VEHICLE_OPTIONS.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setVehicle(v.id)}
                        className={`flex flex-col items-center gap-1 rounded-2xl border py-3 text-[11px] font-bold transition ${
                          vehicle === v.id ? "border-lime-400 bg-lime-400/12 text-lime-300" : "border-white/10 bg-white/4 text-zinc-400"
                        }`}
                      >
                        <span className="text-2xl leading-none">{v.emoji}</span>
                        {v.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] leading-snug text-zinc-500">
                    Cada loja escolhe quais veículos aceita. Bicicleta e patinete não precisam de documento de moto.
                  </p>
                </div>

                <TermsCheckbox checked={acceptTerms} onChange={setAcceptTerms} />
                <ErrorBox msg={serverError} />
                <button
                  onClick={submitSimple}
                  disabled={busy}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-lime-400 text-base font-black text-zinc-950 shadow-[0_12px_28px_rgba(163,230,53,0.3)] transition active:scale-[0.98] disabled:opacity-60"
                >
                  {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <BadgeCheck className="h-5 w-5" />}
                  CRIAR MINHA CONTA
                </button>
                <button onClick={() => setView("login")} className="w-full py-1 text-center text-sm font-bold text-lime-300">
                  Já tenho conta — entrar
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function Benefit({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5">{icon}</span>
      <div>
        <p className="text-sm font-bold text-white">{title}</p>
        <p className="text-[13px] leading-snug text-zinc-500">{text}</p>
      </div>
    </li>
  );
}

function Stat({ v, l }: { v: string; l: string }) {
  return (
    <div>
      <p className="font-display text-xl font-black text-lime-300">{v}</p>
      <p className="text-[11px] text-zinc-500">{l}</p>
    </div>
  );
}

function Back({ onClick, label = "Voltar" }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} className="mb-4 flex items-center gap-1.5 text-sm font-bold text-zinc-400 transition active:scale-95">
      <ArrowLeft className="h-4 w-4" /> {label}
    </button>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-center text-[13px] font-semibold text-red-200">
      {msg}
    </p>
  );
}

function Field({
  label, icon, error, hint, children,
}: {
  label: string;
  icon?: React.ReactNode;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1 text-xs font-bold tracking-wide text-zinc-400 uppercase">
        {icon} {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-[11px] font-semibold text-red-400">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-[11px] text-zinc-600">{hint}</p>
      ) : null}
    </div>
  );
}
