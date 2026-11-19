import { NextResponse } from "next/server";
import { getVapidKeys } from "@/lib/push";

export const dynamic = "force-dynamic";

/** Chave pública que o celular usa para se inscrever nas notificações */
export async function GET() {
  const keys = await getVapidKeys();
  return NextResponse.json({ publicKey: keys.publicKey });
}
