"use client";

import { useState } from "react";
import {
  ArrowLeft, ArrowRight, BadgeCheck, Bike, CalendarDays, Check, CreditCard,
  Eye, Home, IdCard, LoaderCircle, LogIn, Mail, MapPin, Phone, Radio,
  Route, ShieldCheck, User, UserPlus, Wallet,
} from "lucide-react";
import type { Courier } from "@/lib/types";

interface Props {
  onAuthenticated: (courier: Courier) => void;
}

const inputCls =
  "h-13 w-full rounded-2xl border border-white/10 bg-white/4 px-4 py-3.5 text-[15px] text-white placeholder-zinc-600 outline-none transition focus:border-lime-400/60";
const errCls = "border-red-500/60";

type View = "home" | "login" | "register";

export default function AuthScreen({ onAuthenticated }: Props) {
  const [view, setView] = useState<View>("home");
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState("");

  // login
  const [loginEmail, setLoginEmail] = useState("");

  // cadastro (wizard)
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: "", nickname: "", email: "", phone: "", cpf: "", birthDate: "", photoUrl: "",
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
      return data.courier as Courier;
    } catch {
      setServerError("Falha de conexão. Verifique sua internet.");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const doLogin = async () => {
    const c = await call({ action: "login", email: loginEmail });
    if (c) onAuthenticated(c);
  };

  const doDemo = async () => {
    const c = await call({ action: "demo" });
    if (c) onAuthenticated(c);
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

  const submitRegister = async () => {
    if (!validateStep()) return;
    const c = await call({ action: "register", ...form });
    if (c) onAuthenticated(c);
  };

  return (
    <div className="min-h-dvh bg-[#05070a]">
      <div className="mx-auto grid min-h-dvh w-full max-w-[480px] lg:max-w-6xl lg:grid-cols-2">
        {/* Painel da marca (desktop) */}
        <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-white/6 bg-[#070a06] p-10 lg:flex">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lime-400 shadow-[0_12px_30px_rgba(163,230,53,0.35)]">
                <Bike className="h-6 w-6 text-zinc-950" />
              </span>
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
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-lime-400">
              <Bike className="h-5 w-5 text-zinc-950" />
            </span>
            <div>
              <p className="font-display text-xl leading-none font-black text-white">
                Rota<span className="text-lime-400">Livre</span>
              </p>
              <p className="text-[11px] text-zinc-500">Hub do entregador • sem caixa-preta</p>
            </div>
          </div>

          {view === "home" && (
            <div className="slide-up">
              <h2 className="font-display text-[26px] leading-tight font-black text-white">
                Bora rodar do seu jeito?
              </h2>
              <p className="mt-1.5 text-sm text-zinc-400">
                Entre na sua conta ou cadastre-se como associado. Leva menos de 2 minutos.
              </p>

              <div className="mt-6 space-y-3">
                <button
                  onClick={() => setView("register")}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-lime-400 text-base font-black text-zinc-950 shadow-[0_12px_28px_rgba(163,230,53,0.3)] transition active:scale-[0.98]"
                >
                  <UserPlus className="h-5 w-5" /> QUERO SER UM ASSOCIADO
                </button>
                <button
                  onClick={() => setView("login")}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/4 text-base font-extrabold text-white transition active:scale-[0.98]"
                >
                  <LogIn className="h-5 w-5 text-lime-300" /> JÁ TENHO CONTA — ENTRAR
                </button>
              </div>

              <div className="mt-6 rounded-3xl border border-white/8 bg-[#101319] p-4">
                <p className="text-xs font-bold tracking-widest text-zinc-500 uppercase">Só quer conhecer?</p>
                <p className="mt-1 text-sm text-zinc-400">
                  Explore a praça com a conta de demonstração do Rafael “Fumaça”, com histórico real de 90 dias.
                </p>
                <button
                  onClick={doDemo}
                  disabled={busy}
                  className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white/8 text-sm font-extrabold text-white transition active:scale-[0.98] disabled:opacity-50"
                >
                  {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Eye className="h-5 w-5 text-lime-300" />}
                  ACESSAR DEMONSTRAÇÃO
                </button>
              </div>
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
              <p className="mt-1 text-sm text-zinc-400">Use o e-mail do seu cadastro de associado.</p>
              <div className="mt-5 space-y-3.5">
                <Field label="E-mail cadastrado" icon={<Mail className="h-3.5 w-3.5" />}>
                  <input
                    className={inputCls}
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && doLogin()}
                    placeholder="voce@email.com"
                    inputMode="email"
                  />
                </Field>
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
              <Back
                onClick={() => (step > 0 ? setStep(step - 1) : setView("home"))}
                label={step > 0 ? "Voltar etapa" : "Voltar"}
              />
              <h2 className="font-display text-2xl font-black text-white">Cadastro de associado</h2>
              <p className="mt-1 text-sm text-zinc-400">Grátis, sem fidelidade e sem taxa escondida.</p>

              {/* Progresso */}
              <div className="mt-5 flex items-center gap-2">
                {["Seus dados", "Moto e CNH", "Endereço e raio"].map((label, i) => (
                  <div key={label} className="flex flex-1 items-center gap-2">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${
                        i < step ? "bg-lime-400 text-zinc-950" : i === step ? "bg-lime-400/20 text-lime-300 ring-1 ring-lime-400" : "bg-zinc-800 text-zinc-500"
                      }`}
                    >
                      {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
                    </span>
                    <span className={`hidden text-[11px] font-bold sm:block ${i === step ? "text-white" : "text-zinc-500"}`}>{label}</span>
                    {i < 2 && <span className={`h-px flex-1 ${i < step ? "bg-lime-400/60" : "bg-zinc-800"}`} />}
                  </div>
                ))}
              </div>

              <div className="mt-6 space-y-3.5">
                {step === 0 && (
                  <>
                    <Field label="Nome completo" icon={<User className="h-3.5 w-3.5" />} error={errors.name}>
                      <input className={`${inputCls} ${errors.name ? errCls : ""}`} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: Carlos Silva" />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Apelido de guerra">
                        <input className={inputCls} value={form.nickname} onChange={(e) => set("nickname", e.target.value)} placeholder="Ex.: Relâmpago" />
                      </Field>
                      <Field label="Nascimento" icon={<CalendarDays className="h-3.5 w-3.5" />}>
                        <input type="date" className={inputCls} value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} />
                      </Field>
                    </div>
                    <Field label="E-mail" icon={<Mail className="h-3.5 w-3.5" />} error={errors.email}>
                      <input className={`${inputCls} ${errors.email ? errCls : ""}`} value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="voce@email.com" inputMode="email" />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Celular (WhatsApp)" icon={<Phone className="h-3.5 w-3.5" />} error={errors.phone}>
                        <input className={`${inputCls} ${errors.phone ? errCls : ""}`} value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(11) 90000-0000" inputMode="tel" />
                      </Field>
                      <Field label="CPF" error={errors.cpf}>
                        <input className={`${inputCls} ${errors.cpf ? errCls : ""}`} value={form.cpf} onChange={(e) => set("cpf", e.target.value)} placeholder="000.000.000-00" inputMode="numeric" />
                      </Field>
                    </div>
                    <Field label="URL da foto (opcional)">
                      <input className={inputCls} value={form.photoUrl} onChange={(e) => set("photoUrl", e.target.value)} placeholder="https://…" />
                    </Field>
                  </>
                )}

                {step === 1 && (
                  <>
                    <Field label="Modelo da moto" icon={<Bike className="h-3.5 w-3.5" />} error={errors.vehicleModel}>
                      <input className={`${inputCls} ${errors.vehicleModel ? errCls : ""}`} value={form.vehicleModel} onChange={(e) => set("vehicleModel", e.target.value)} placeholder="Ex.: Honda CG 160 Titan" />
                    </Field>
                    <div className="grid grid-cols-3 gap-3">
                      <Field label="Placa" error={errors.vehiclePlate}>
                        <input className={`${inputCls} uppercase ${errors.vehiclePlate ? errCls : ""}`} value={form.vehiclePlate} onChange={(e) => set("vehiclePlate", e.target.value.toUpperCase())} placeholder="ABC1D23" maxLength={8} />
                      </Field>
                      <Field label="Ano">
                        <input className={inputCls} value={form.vehicleYear} onChange={(e) => set("vehicleYear", e.target.value)} placeholder="2022" inputMode="numeric" maxLength={4} />
                      </Field>
                      <Field label="Cor">
                        <input className={inputCls} value={form.vehicleColor} onChange={(e) => set("vehicleColor", e.target.value)} placeholder="Preta" />
                      </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Número da CNH" icon={<IdCard className="h-3.5 w-3.5" />} error={errors.cnhNumber}>
                        <input className={`${inputCls} ${errors.cnhNumber ? errCls : ""}`} value={form.cnhNumber} onChange={(e) => set("cnhNumber", e.target.value)} inputMode="numeric" />
                      </Field>
                      <Field label="Categoria">
                        <select className={inputCls} value={form.cnhCategory} onChange={(e) => set("cnhCategory", e.target.value)}>
                          <option value="A">A — Motos</option>
                          <option value="AB">AB — Motos e carros</option>
                          <option value="AC">AC</option>
                          <option value="AD">AD</option>
                          <option value="AE">AE</option>
                        </select>
                      </Field>
                    </div>
                    <Field label="Validade da CNH" icon={<CreditCard className="h-3.5 w-3.5" />}>
                      <input type="date" className={inputCls} value={form.cnhExpiry} onChange={(e) => set("cnhExpiry", e.target.value)} />
                    </Field>
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500">
                      <BadgeCheck className="h-3.5 w-3.5 text-emerald-400" /> Categoria A/AB com EAR é necessária para rodar como associado.
                    </p>
                  </>
                )}

                {step === 2 && (
                  <>
                    <Field label="CEP" icon={<MapPin className="h-3.5 w-3.5" />} error={errors.cep} hint="Preenchemos o endereço automaticamente">
                      <div className="relative">
                        <input
                          className={`${inputCls} pr-11 ${errors.cep ? errCls : ""}`}
                          value={form.cep}
                          onChange={(e) => set("cep", maskCep(e.target.value))}
                          onBlur={(e) => lookupCep(e.target.value)}
                          placeholder="00000-000"
                          inputMode="numeric"
                        />
                        {cepLoading && <LoaderCircle className="absolute top-1/2 right-4 h-5 w-5 -translate-y-1/2 animate-spin text-lime-400" />}
                      </div>
                    </Field>
                    <div className="grid grid-cols-[1fr_96px] gap-3">
                      <Field label="Rua / Avenida" error={errors.street}>
                        <input className={`${inputCls} ${errors.street ? errCls : ""}`} value={form.street} onChange={(e) => set("street", e.target.value)} />
                      </Field>
                      <Field label="Número" error={errors.number}>
                        <input className={`${inputCls} ${errors.number ? errCls : ""}`} value={form.number} onChange={(e) => set("number", e.target.value)} inputMode="numeric" />
                      </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Bairro" error={errors.neighborhood}>
                        <input className={`${inputCls} ${errors.neighborhood ? errCls : ""}`} value={form.neighborhood} onChange={(e) => set("neighborhood", e.target.value)} />
                      </Field>
                      <div className="grid grid-cols-[1fr_72px] gap-3">
                        <Field label="Cidade" error={errors.city}>
                          <input className={`${inputCls} ${errors.city ? errCls : ""}`} value={form.city} onChange={(e) => set("city", e.target.value)} />
                        </Field>
                        <Field label="UF">
                          <input className={`${inputCls} uppercase`} value={form.state} onChange={(e) => set("state", e.target.value.toUpperCase())} maxLength={2} />
                        </Field>
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <label className="text-xs font-bold tracking-wide text-zinc-400 uppercase">Raio de atuação</label>
                        <span className="rounded-full bg-lime-400/12 px-2.5 py-1 text-xs font-extrabold text-lime-300">{form.workRadiusKm} km</span>
                      </div>
                      <input type="range" min={2} max={20} step={1} value={form.workRadiusKm} onChange={(e) => set("workRadiusKm", parseInt(e.target.value))} className="rl-range w-full" />
                    </div>
                    <Field label="Meta diária de ganhos (R$)">
                      <input type="number" min={50} step={10} className={inputCls} value={form.dailyGoal} onChange={(e) => set("dailyGoal", parseFloat(e.target.value) || 0)} />
                    </Field>
                    <p className="flex items-start gap-1.5 text-[11px] leading-snug text-zinc-500">
                      <Home className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Seu endereço de cadastro define sua base no mapa e o canal regional do rádio.
                    </p>
                  </>
                )}
              </div>

              <ErrorBox msg={serverError} />

              {step < 2 ? (
                <button
                  onClick={() => validateStep() && setStep(step + 1)}
                  className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-lime-400 text-base font-black text-zinc-950 transition active:scale-[0.98]"
                >
                  CONTINUAR <ArrowRight className="h-5 w-5" />
                </button>
              ) : (
                <button
                  onClick={submitRegister}
                  disabled={busy}
                  className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-lime-400 text-base font-black text-zinc-950 shadow-[0_12px_28px_rgba(163,230,53,0.3)] transition active:scale-[0.98] disabled:opacity-60"
                >
                  {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <BadgeCheck className="h-5 w-5" />}
                  CRIAR MINHA CONTA E RODAR
                </button>
              )}
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
