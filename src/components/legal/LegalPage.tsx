import type { ReactNode } from "react";

export default function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="min-h-dvh bg-[#07090c] px-5 py-8 text-zinc-300">
      <div className="mx-auto max-w-[680px]">
        <a href="/" className="text-sm font-bold text-lime-300">← Voltar ao RotaLivre</a>
        <h1 className="mt-4 font-display text-3xl font-black text-white">{title}</h1>
        <p className="mt-1 text-xs text-zinc-500">Última atualização: {updated}</p>
        <div className="legal mt-6 space-y-4 text-[14px] leading-relaxed [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-white [&_li]:ml-5 [&_li]:list-disc">
          {children}
        </div>
      </div>
    </main>
  );
}
