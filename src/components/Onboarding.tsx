"use client";

import { useState } from "react";
import {
  BellRing, ChevronLeft, ChevronRight, Download, LayoutDashboard, Map, Radio,
  ShieldCheck, User, Wallet,
} from "lucide-react";

/** Passo a passo mostrado no primeiro acesso (e reaberto pelo Perfil) */
const STEPS = [
  {
    icon: ShieldCheck,
    color: "bg-lime-400 text-zinc-950",
    title: "Bem-vindo ao RotaLivre!",
    text: "A rede dos entregadores de Corumbá e Ladário. Em 1 minuto você conhece tudo o que tem aqui dentro.",
    tips: ["Sua conta é só sua: entra com e-mail e senha", "Você pode rever este guia no Perfil"],
  },
  {
    icon: LayoutDashboard,
    color: "bg-emerald-400 text-zinc-950",
    title: "Início: as corridas",
    text: "Aqui aparecem as corridas da praça, com o valor que você recebe já descontado e a distância.",
    tips: ["Toque em ACEITAR CORRIDA para pegar", "Organize por maior valor, melhor R$/km ou mais perto", "O saldo do dia fica no topo"],
  },
  {
    icon: Map,
    color: "bg-sky-400 text-zinc-950",
    title: "Mapa: sua rota",
    text: "Mostra você pelo GPS, a loja da coleta, o cliente e a rota pelas ruas. As lojas com pedido aparecem como ícones.",
    tips: ["Libere a localização quando o celular pedir", "Abra a rota no Google Maps ou no Waze", "☀️/🌙 troca o mapa claro e escuro", "⚠ Alertar avisa blitz, alagamento ou SOS"],
  },
  {
    icon: Radio,
    color: "bg-amber-400 text-zinc-950",
    title: "Rádio: fale com a rede",
    text: "Um chat como o WhatsApp, só com os motoboys perto de você (15 km) ou da sua cidade.",
    tips: ["🎤 Toque para gravar áudio e toque de novo para enviar", "📷 Mande foto ou selfie (fica 2 horas)", "Mensagens ficam 24 horas e depois somem"],
  },
  {
    icon: BellRing,
    color: "bg-lime-400 text-zinc-950",
    title: "Avisos de corrida",
    text: "Toque no sino 🔔 no topo e ligue os avisos: o celular avisa quando surgir corrida perto de você, mesmo com o app fechado.",
    tips: ["Só recebe quem está Online", "Use o Google Chrome para os avisos funcionarem"],
  },
  {
    icon: Wallet,
    color: "bg-emerald-400 text-zinc-950",
    title: "Relatórios: seus ganhos",
    text: "Acompanhe quanto ganhou por dia, 15 dias, mês ou trimestre, com km rodados, taxa paga e melhores horários.",
    tips: ["Exporte em PDF ou planilha", "Taxa transparente: você vê tudo o que foi descontado"],
  },
  {
    icon: User,
    color: "bg-violet-400 text-zinc-950",
    title: "Perfil",
    text: "Seus dados, moto, CNH e endereço. Toque na foto para colocar a sua (câmera ou galeria).",
    tips: ["Defina sua meta do dia e o raio de atuação", "Botão Sair desconecta este aparelho"],
  },
  {
    icon: Download,
    color: "bg-lime-400 text-zinc-950",
    title: "Instale o app",
    text: "Instale o RotaLivre na tela do celular: abre em tela cheia, como um aplicativo, e recebe os avisos de corrida.",
    tips: ["Android: menu ⋮ → Instalar app", "iPhone: Safari → Compartilhar → Adicionar à Tela de Início"],
  },
];

export default function Onboarding({ name, onClose }: { name: string; onClose: () => void }) {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;
  const Icon = step.icon;

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center">
      <div
        className="slide-up w-full max-w-[440px] rounded-t-3xl border border-white/10 bg-[#0d1015] p-6 sm:rounded-3xl"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-widest text-zinc-500 uppercase">
            {i + 1} de {STEPS.length}
          </span>
          {!last && (
            <button onClick={onClose} className="text-xs font-bold text-zinc-400">
              Pular
            </button>
          )}
        </div>

        <div key={i} className="slide-up mt-4">
          <span className={`flex h-14 w-14 items-center justify-center rounded-2xl ${step.color}`}>
            <Icon className="h-7 w-7" />
          </span>
          <h2 className="mt-4 font-display text-2xl leading-tight font-black text-white">
            {i === 0 ? `Olá, ${name}!` : step.title}
          </h2>
          {i === 0 && <p className="text-sm font-bold text-lime-300">{step.title}</p>}
          <p className="mt-2 text-[15px] leading-snug text-zinc-300">{step.text}</p>
          <ul className="mt-4 space-y-2">
            {step.tips.map((t) => (
              <li key={t} className="flex gap-2 text-[13px] leading-snug text-zinc-400">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-lime-400" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        {/* Bolinhas de progresso */}
        <div className="mt-6 flex justify-center gap-1.5">
          {STEPS.map((_, k) => (
            <button
              key={k}
              onClick={() => setI(k)}
              className={`h-1.5 rounded-full transition-all ${k === i ? "w-6 bg-lime-400" : "w-1.5 bg-white/20"}`}
              aria-label={`Passo ${k + 1}`}
            />
          ))}
        </div>

        <div className="mt-5 flex gap-2">
          {i > 0 && (
            <button
              onClick={() => setI(i - 1)}
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/6 text-zinc-300"
              aria-label="Voltar"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          <button
            onClick={() => (last ? onClose() : setI(i + 1))}
            className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-lime-400 text-sm font-black text-zinc-950 active:scale-[0.98]"
          >
            {last ? "COMEÇAR A RODAR" : "PRÓXIMO"} {!last && <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Marca de "já viu o tutorial" por conta, neste aparelho */
export function onboardingSeen(courierId: number) {
  try {
    return localStorage.getItem(`rl_onboarded_${courierId}`) === "1";
  } catch {
    return true;
  }
}

export function markOnboardingSeen(courierId: number) {
  try {
    localStorage.setItem(`rl_onboarded_${courierId}`, "1");
  } catch { /* ignore */ }
}
