/* ------------------------------------------------------------------ */
/* Domínio compartilhado: geografia, geração de pedidos e simulação    */
/* ------------------------------------------------------------------ */

export const FEE_RATE = 0.05; // Taxa transparente RotaLivre: 5% fixo, sem caixa-preta
export const MAIN_BASE = { lat: -23.6461, lng: -46.7678 }; // Campo Limpo, SP

export const CHANNELS = ["Zona Sul", "Centro", "Zona Leste", "Zona Oeste", "Zona Norte"];

export const NEIGHBORHOODS = [
  { name: "Campo Limpo", lat: -23.6461, lng: -46.7678, channel: "Zona Sul" },
  { name: "Capão Redondo", lat: -23.6594, lng: -46.7686, channel: "Zona Sul" },
  { name: "Vila Andrade", lat: -23.6265, lng: -46.7295, channel: "Zona Sul" },
  { name: "Morumbi", lat: -23.6003, lng: -46.7204, channel: "Zona Sul" },
  { name: "Santo Amaro", lat: -23.6399, lng: -46.7128, channel: "Zona Sul" },
  { name: "Interlagos", lat: -23.6775, lng: -46.6997, channel: "Zona Sul" },
  { name: "Jardim Ângela", lat: -23.7057, lng: -46.7697, channel: "Zona Sul" },
  { name: "Socorro", lat: -23.6788, lng: -46.7074, channel: "Zona Sul" },
  { name: "Chácara Sto. Antônio", lat: -23.6319, lng: -46.7089, channel: "Zona Sul" },
  { name: "Itaim Bibi", lat: -23.5831, lng: -46.6847, channel: "Zona Sul" },
];

const STREETS = [
  "Rua das Acácias", "Av. Giovanni Gronchi", "Rua do Oratório", "Av. Carlos Caldeira Filho",
  "Rua Professor Leitão da Cunha", "Av. das Nações Unidas", "Rua José Maria Whitaker",
  "Av. Washington Luís", "Rua Barão de Jundiaí", "Rua das Palmeiras", "Av. Interlagos",
  "Rua Padre José de Anchieta", "Av. Engenheiro George Corbisier", "Rua Vergueiro",
  "Rua dos Três Irmãos", "Av. Santo Amaro", "Rua Amador Bueno", "Rua das Figueiras",
];

export const ESTABLISHMENTS = [
  { name: "Burger da Vila", type: "Lanchonete" },
  { name: "Pizzaria Forno Alto", type: "Pizzaria" },
  { name: "Sushi Yama", type: "Japonês" },
  { name: "Sabor Caseiro", type: "Marmitas" },
  { name: "Açaí da Praça", type: "Sobremesas" },
  { name: "Farmácia Vida+", type: "Farmácia" },
  { name: "Mercado Bom Preço", type: "Mercado" },
  { name: "Padaria Pão Dourado", type: "Padaria" },
  { name: "Esfiha Express", type: "Árabe" },
  { name: "Boi na Brasa", type: "Churrasco" },
  { name: "Cantina Nonna Mia", type: "Italiano" },
  { name: "Fit & Fresh Saladas", type: "Saudável" },
];

export const CLIENT_NAMES = [
  "Mariana Costa", "João Pedro Almeida", "Fernanda Lima", "Carlos Eduardo",
  "Beatriz Rocha", "Lucas Ferreira", "Ana Paula Mendes", "Rodrigo Santos",
  "Juliana Castro", "Felipe Nogueira", "Camila Duarte", "Thiago Ribeiro",
  "Patrícia Gomes", "Rafael Teixeira", "Larissa Barbosa", "Bruno Carvalho",
];

export const PARTNERS_SEED = [
  { name: "Diego Moura", nickname: "Relâmpago", lat: -23.6382, lng: -46.7521, status: "online" },
  { name: "André Pinto", nickname: "Falcão", lat: -23.6523, lng: -46.7398, status: "online" },
  { name: "Bruno Sales", nickname: "Trovão", lat: -23.6211, lng: -46.7602, status: "em_entrega" },
  { name: "Marcos Reis", nickname: "Ligeirinho", lat: -23.6648, lng: -46.7812, status: "online" },
  { name: "Paulo Vieira", nickname: "Noturno", lat: -23.6335, lng: -46.7195, status: "online" },
  { name: "Tiago Melo", nickname: "Pistão", lat: -23.6719, lng: -46.7305, status: "pausa" },
  { name: "Caio Freitas", nickname: "Turbo", lat: -23.6098, lng: -46.7456, status: "em_entrega" },
];

export const AMBIENT_TEXTS = [
  "Alguém mais rodando pela Vila Andrade agora? Movimento tá bom por aqui",
  "Forno Alto tá saindo rápido hoje, 5 min no máximo",
  "Trânsito pesado na Giovanni Gronchi sentido centro, desvia pela interior",
  "Acabei de fazer 3 seguidas no Morumbi, região rendendo bem",
  "Alguém com capa de chuva sobrando pra vender? A minha rasgou",
  "Pico do jantar promete hoje, sexta-feira já sabe né",
  "Cuidado no semáforo da Carlos Caldeira, radar novo instalado",
  "Farmácia Vida+ tá pagando bem nas entregas rápidas",
  "Quem tá perto do Capão? Preciso de ajuda pra trocar um pneu daqui a pouco",
  "Boa praça hoje, fiz minha meta antes das 20h",
];

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

const rnd = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const jitter = (v: number, amt: number) => v + rnd(-amt, amt);

export function orderCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `#${s}`;
}

export type GeneratedOrder = {
  code: string;
  clientName: string;
  establishment: string;
  establishmentType: string;
  pickupAddress: string;
  pickupNeighborhood: string;
  pickupLat: number;
  pickupLng: number;
  deliveryAddress: string;
  deliveryNeighborhood: string;
  deliveryLat: number;
  deliveryLng: number;
  distanceKm: number;
  valueNet: number;
  etaMinutes: number;
  itemsCount: number;
  paymentMethod: string;
};

/** Nomes de bairro comuns em quase toda cidade brasileira (demo fora de SP) */
const GENERIC_NEIGHBORHOODS = [
  "Centro", "Vila Nova", "Jardim América", "Santa Fé", "Jardim Paulista", "Vila Jardim",
  "São Francisco", "Jardim dos Estados", "Vila Planalto", "Jardim Bela Vista",
];

/** Centro "longe de SP" = mais de 60 km da base de demonstração */
export function isFarFromDemoBase(center: { lat: number; lng: number }) {
  return haversineKm(center.lat, center.lng, MAIN_BASE.lat, MAIN_BASE.lng) > 60;
}

/**
 * Gera um pedido de demonstração. Com `center` (posição real do GPS),
 * o mapa de bairros de SP é transladado para perto do entregador.
 */
export function generateOrder(center?: { lat: number; lng: number }): GeneratedOrder {
  const pickupN = pick(NEIGHBORHOODS.slice(0, 8));
  let deliveryN = pick(NEIGHBORHOODS);
  if (deliveryN.name === pickupN.name) deliveryN = pick(NEIGHBORHOODS);

  const dLat = center ? center.lat - MAIN_BASE.lat : 0;
  const dLng = center ? center.lng - MAIN_BASE.lng : 0;
  const generic = !!center && isFarFromDemoBase(center);
  const nameOf = (n: (typeof NEIGHBORHOODS)[number]) =>
    generic ? GENERIC_NEIGHBORHOODS[NEIGHBORHOODS.indexOf(n) % GENERIC_NEIGHBORHOODS.length] : n.name;

  const pickupLat = jitter(pickupN.lat + dLat, 0.012);
  const pickupLng = jitter(pickupN.lng + dLng, 0.012);
  const deliveryLat = jitter(deliveryN.lat + dLat, 0.014);
  const deliveryLng = jitter(deliveryN.lng + dLng, 0.014);

  const straight = haversineKm(pickupLat, pickupLng, deliveryLat, deliveryLng);
  const distanceKm = Math.max(1.2, Math.round(straight * 1.32 * 10) / 10);
  // Tarifa aberta e previsível: base R$ 5,50 + R$ 2,30/km (sem taxa surpresa)
  const raw = 5.5 + distanceKm * 2.3 + rnd(0, 2.5);
  const valueNet = Math.round(raw * 2) / 2;
  const est = pick(ESTABLISHMENTS);

  return {
    code: orderCode(),
    clientName: pick(CLIENT_NAMES),
    establishment: est.name,
    establishmentType: est.type,
    pickupAddress: `${pick(STREETS)}, ${Math.floor(rnd(40, 1800))}`,
    pickupNeighborhood: nameOf(pickupN),
    pickupLat,
    pickupLng,
    deliveryAddress: `${pick(STREETS)}, ${Math.floor(rnd(40, 1800))}`,
    deliveryNeighborhood: nameOf(deliveryN),
    deliveryLat,
    deliveryLng,
    distanceKm,
    valueNet,
    etaMinutes: Math.round(12 + distanceKm * 3.4 + rnd(0, 6)),
    itemsCount: Math.floor(rnd(1, 5)),
    paymentMethod: pick(["Pix", "Cartão", "Pix", "Dinheiro", "Pix"]),
  };
}

export function grossFromNet(net: number) {
  const gross = net / (1 - FEE_RATE);
  return { gross: Math.round(gross * 100) / 100, fee: Math.round((gross - net) * 100) / 100 };
}

export { rnd, pick };
