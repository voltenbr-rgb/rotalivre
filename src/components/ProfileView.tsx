"use client";

import { useRef, useState } from "react";
import {
  BadgeCheck, Bike, Camera, CalendarDays, CreditCard, House, IdCard, LoaderCircle,
  LogOut, Mail, MapPin, Phone, Save, Settings2, Star, User,
} from "lucide-react";
import type { Courier } from "@/lib/types";
import { fmtNum, initialsOf } from "@/lib/format";
import { apiFetch } from "@/lib/session";
import { InstallButton } from "./InstallApp";
import { ChangePassword } from "./ForgotPassword";

interface Props {
  courier: Courier;
  onSaved: (c: Courier) => void;
  onLogout: () => void;
  onOpenTutorial?: () => void;
  notify: (msg: string, tone?: "ok" | "warn" | "sos") => void;
}

const inputCls =
  "h-13 w-full rounded-2xl border border-white/10 bg-white/4 px-4 py-3.5 text-[15px] text-white placeholder-zinc-600 outline-none transition focus:border-lime-400/60";
const errCls = "border-red-500/60";

export default function ProfileView({ courier, onSaved, onLogout, notify, onOpenTutorial }: Props) {
  const [form, setForm] = useState({ ...courier });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepOk, setCepOk] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  /** Reduz a foto no próprio celular (quadrado 320 px, JPEG) e salva no banco */
  const onPickPhoto = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      notify("Escolha uma imagem (foto)", "warn");
      return;
    }
    setPhotoBusy(true);
    try {
      const dataUrl = await squareJpeg(file, 320, 0.82);
      const res = await apiFetch("/api/courier", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrl: dataUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForm((f) => ({ ...f, photoUrl: data.courier.photoUrl }));
      onSaved(data.courier);
      notify("Foto de perfil atualizada!");
    } catch {
      notify("Não foi possível salvar a foto. Tente outra imagem.", "warn");
    } finally {
      setPhotoBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const set = (k: keyof Courier, v: string | number) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  const maskCep = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 8);
    return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
  };

  const lookupCep = async (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepLoading(true);
    setCepOk(false);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (data.erro) {
        setErrors((e) => ({ ...e, cep: "CEP não encontrado" }));
        return;
      }
      setForm((f) => ({
        ...f,
        street: data.logradouro || f.street,
        neighborhood: data.bairro || f.neighborhood,
        city: data.localidade || f.city,
        state: data.uf || f.state,
      }));
      setCepOk(true);
      notify("Endereço localizado pelo CEP");
    } catch {
      setErrors((e) => ({ ...e, cep: "Não foi possível consultar o CEP" }));
    } finally {
      setCepLoading(false);
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (form.name.trim().length < 3) e.name = "Informe seu nome completo";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "E-mail inválido";
    if (form.phone.replace(/\D/g, "").length < 10) e.phone = "Telefone com DDD obrigatório";
    if (form.cpf.replace(/\D/g, "").length !== 11) e.cpf = "CPF deve ter 11 dígitos";
    const plate = form.vehiclePlate.replace("-", "").toUpperCase();
    if (!(/^[A-Z]{3}\d{4}$/.test(plate) || /^[A-Z]{3}\d[A-Z]\d{2}$/.test(plate))) e.vehiclePlate = "Placa inválida (AAA-0000 ou AAA0A00)";
    if (form.cnhNumber.replace(/\D/g, "").length < 9) e.cnhNumber = "Número da CNH inválido";
    if (form.cep.replace(/\D/g, "").length !== 8) e.cep = "CEP deve ter 8 dígitos";
    if (!form.street.trim()) e.street = "Informe a rua";
    if (!form.number.trim()) e.number = "Informe o número";
    if (!form.neighborhood.trim()) e.neighborhood = "Informe o bairro";
    if (!form.city.trim()) e.city = "Informe a cidade";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) {
      notify("Verifique os campos destacados", "warn");
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch("/api/courier", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, vehiclePlate: form.vehiclePlate.toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error ?? "Falha ao salvar. Tente de novo.", "warn");
        return;
      }
      onSaved(data.courier);
      notify("Perfil atualizado! Seus dados estão seguros.");
      if (navigator.vibrate) navigator.vibrate(40);
    } catch {
      notify("Falha ao salvar. Tente de novo.", "warn");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[520px] space-y-5 px-4 pt-4 pb-2 lg:max-w-4xl lg:px-6">
      {/* Cartão de identidade */}
      <section className="flex items-center gap-4 rounded-3xl border border-white/8 bg-[#101319] p-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={photoBusy}
          className="relative shrink-0"
          aria-label="Trocar foto de perfil"
        >
          {form.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.photoUrl} alt={form.name} className="h-20 w-20 rounded-3xl object-cover ring-2 ring-lime-400/60" />
          ) : (
            <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-lime-500 font-display text-2xl font-black text-zinc-950 ring-2 ring-lime-400/60">
              {initialsOf(form.name || "?")}
            </span>
          )}
          <span className="absolute -right-1.5 -bottom-1.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#101319] bg-lime-400 text-zinc-950">
            {photoBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onPickPhoto(e.target.files?.[0])}
        />
        <div className="min-w-0">
          <p className="truncate font-display text-lg leading-tight font-extrabold text-white">
            {form.name.split(" ")[0]} “{form.nickname}”
          </p>
          <p className="flex items-center gap-1 text-xs font-bold text-amber-300">
            <Star className="h-3.5 w-3.5 fill-amber-300" /> {form.rating.toFixed(1)} • {fmtNum(form.totalDeliveries ?? 0)} entregas concluídas
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-zinc-400">
            <Bike className="h-3.5 w-3.5" /> {form.vehicleModel} • {form.vehiclePlate}
          </p>
          <p className="flex items-center gap-1 text-xs text-zinc-500">
            <MapPin className="h-3.5 w-3.5" /> {form.neighborhood}, {form.city}/{form.state}
          </p>
        </div>
      </section>

      <p className="-mt-2 text-center text-[11px] text-zinc-500">Toque na foto para trocar (câmera ou galeria)</p>

      {/* Dados pessoais */}
      <Section icon={<User className="h-4 w-4 text-lime-400" />} title="Dados pessoais">
        <Field label="Nome completo" error={errors.name}>
          <input className={`${inputCls} ${errors.name ? errCls : ""}`} value={form.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Apelido de guerra">
            <input className={inputCls} value={form.nickname} onChange={(e) => set("nickname", e.target.value)} />
          </Field>
          <Field label="Data de nascimento" icon={<CalendarDays className="h-3.5 w-3.5" />}>
            <input type="date" className={inputCls} value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} />
          </Field>
        </div>
        <Field label="E-mail" icon={<Mail className="h-3.5 w-3.5" />} error={errors.email}>
          <input className={`${inputCls} ${errors.email ? errCls : ""}`} value={form.email} onChange={(e) => set("email", e.target.value)} inputMode="email" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Celular (WhatsApp)" icon={<Phone className="h-3.5 w-3.5" />} error={errors.phone}>
            <input className={`${inputCls} ${errors.phone ? errCls : ""}`} value={form.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" />
          </Field>
          <Field label="CPF" error={errors.cpf}>
            <input className={`${inputCls} ${errors.cpf ? errCls : ""}`} value={form.cpf} onChange={(e) => set("cpf", e.target.value)} inputMode="numeric" />
          </Field>
        </div>
      </Section>

      {/* Moto */}
      <Section icon={<Bike className="h-4 w-4 text-lime-400" />} title="Dados da moto">
        <Field label="Modelo">
          <input className={inputCls} value={form.vehicleModel} onChange={(e) => set("vehicleModel", e.target.value)} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Placa" error={errors.vehiclePlate}>
            <input className={`${inputCls} uppercase ${errors.vehiclePlate ? errCls : ""}`} value={form.vehiclePlate} onChange={(e) => set("vehiclePlate", e.target.value.toUpperCase())} maxLength={8} />
          </Field>
          <Field label="Ano">
            <input className={inputCls} value={form.vehicleYear} onChange={(e) => set("vehicleYear", e.target.value)} inputMode="numeric" maxLength={4} />
          </Field>
          <Field label="Cor">
            <input className={inputCls} value={form.vehicleColor} onChange={(e) => set("vehicleColor", e.target.value)} />
          </Field>
        </div>
      </Section>

      {/* CNH */}
      <Section icon={<IdCard className="h-4 w-4 text-lime-400" />} title="CNH — habilitação">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Número da CNH" error={errors.cnhNumber}>
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
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300">
          <BadgeCheck className="h-3.5 w-3.5" /> EAR (Exerce Atividade Remunerada) verificado
        </p>
      </Section>

      {/* Endereço completo */}
      <Section icon={<House className="h-4 w-4 text-lime-400" />} title="Endereço de cadastro">
        <Field label="CEP" error={errors.cep} hint={cepOk ? "Endereço preenchido automaticamente" : "Preenchimento automático pelo CEP"}>
          <div className="relative">
            <input
              className={`${inputCls} pr-11 ${errors.cep ? errCls : ""}`}
              value={form.cep}
              onChange={(e) => set("cep", maskCep(e.target.value))}
              onBlur={(e) => lookupCep(e.target.value)}
              inputMode="numeric"
              placeholder="00000-000"
            />
            {cepLoading ? (
              <LoaderCircle className="absolute top-1/2 right-4 h-5 w-5 -translate-y-1/2 animate-spin text-lime-400" />
            ) : cepOk ? (
              <BadgeCheck className="absolute top-1/2 right-4 h-5 w-5 -translate-y-1/2 text-emerald-400" />
            ) : null}
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
          <div className="grid grid-cols-[1fr_76px] gap-3">
            <Field label="Cidade" error={errors.city}>
              <input className={`${inputCls} ${errors.city ? errCls : ""}`} value={form.city} onChange={(e) => set("city", e.target.value)} />
            </Field>
            <Field label="UF">
              <input className={`${inputCls} uppercase`} value={form.state} onChange={(e) => set("state", e.target.value.toUpperCase())} maxLength={2} />
            </Field>
          </div>
        </div>
      </Section>

      {/* Preferências */}
      <Section icon={<Settings2 className="h-4 w-4 text-lime-400" />} title="Preferências de operação">
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-bold tracking-wide text-zinc-400 uppercase">Raio de atuação</label>
            <span className="rounded-full bg-lime-400/12 px-2.5 py-1 text-xs font-extrabold text-lime-300">{form.workRadiusKm} km</span>
          </div>
          <input
            type="range"
            min={2}
            max={20}
            step={1}
            value={form.workRadiusKm}
            onChange={(e) => set("workRadiusKm", parseInt(e.target.value))}
            className="rl-range w-full"
          />
          <p className="mt-1 text-[11px] text-zinc-500">Você só recebe pedidos dentro deste raio a partir da sua base.</p>
        </div>
        <Field label="Meta diária de ganhos (R$)">
          <input
            type="number"
            min={50}
            step={10}
            className={inputCls}
            value={form.dailyGoal}
            onChange={(e) => set("dailyGoal", parseFloat(e.target.value) || 0)}
          />
        </Field>
      </Section>

      <button
        onClick={save}
        disabled={saving}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-lime-400 text-base font-black tracking-wide text-zinc-950 shadow-[0_10px_26px_rgba(163,230,53,0.3)] transition active:scale-[0.98] disabled:opacity-60"
      >
        {saving ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
        SALVAR PERFIL
      </button>
      <p className="text-center text-[11px] text-zinc-600">
        Seus dados ficam visíveis só para você. Nada de caixa-preta — nem com os seus dados.
      </p>

      {/* App no telefone + conta */}
      <section className="space-y-3 rounded-3xl border border-white/8 bg-[#101319] p-4">
        <p className="text-sm font-bold text-white">RotaLivre em todos os seus aparelhos</p>
        <p className="text-[13px] leading-snug text-zinc-400">
          Instale no telefone para rodar em tela cheia e entre com o mesmo e-mail no notebook para
          conferir relatórios e extratos na tela grande.
        </p>
        <InstallButton className="h-12 w-full text-sm" />
        <ChangePassword endpoint="/api/auth" notify={notify} />
        {onOpenTutorial && (
          <button
            onClick={onOpenTutorial}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 text-sm font-bold text-zinc-200 transition active:scale-[0.98]"
          >
            <BadgeCheck className="h-4.5 w-4.5 text-lime-400" /> VER O GUIA DO APP
          </button>
        )}
        <button
          onClick={onLogout}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-red-500/25 bg-red-500/8 text-sm font-extrabold text-red-300 transition active:scale-[0.98]"
        >
          <LogOut className="h-4.5 w-4.5" /> SAIR DA CONTA
        </button>
        <p className="text-center text-[11px] text-zinc-600">Logado como {courier.email}</p>
      </section>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3.5 rounded-3xl border border-white/8 bg-[#101319] p-4">
      <h3 className="flex items-center gap-2 font-display text-[15px] font-extrabold text-white">{icon} {title}</h3>
      {children}
    </section>
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

/** Corta a imagem no centro em quadrado e reduz para `size` px (JPEG) */
async function squareJpeg(file: File, size: number, quality: number): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}
