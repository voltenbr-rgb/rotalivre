import ClientLocation from "@/components/ClientLocation";

export const metadata = { title: "Enviar minha localização — RotaLivre" };

export default async function Localizacao({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ClientLocation token={token} />;
}
