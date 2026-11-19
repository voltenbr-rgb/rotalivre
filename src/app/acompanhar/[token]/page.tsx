import TrackView from "@/components/TrackView";

export const metadata = { title: "Acompanhe seu pedido — RotaLivre" };

export default async function Acompanhar({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <TrackView token={token} />;
}
