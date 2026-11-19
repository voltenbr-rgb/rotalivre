export type CourierStatus = "online" | "pausa" | "em_entrega" | "offline";

export interface Courier {
  id: number;
  name: string;
  nickname: string;
  email: string;
  phone: string;
  cpf: string;
  birthDate: string;
  photoUrl: string;
  status: CourierStatus;
  vehicleModel: string;
  vehiclePlate: string;
  vehicleYear: string;
  vehicleColor: string;
  cnhNumber: string;
  cnhCategory: string;
  cnhExpiry: string;
  cep: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  workRadiusKm: number;
  dailyGoal: number;
  baseLat: number;
  baseLng: number;
  rating: number;
  totalDeliveries: number;
  vehicleType?: VehicleType;
  lastLat?: number | null;
  lastLng?: number | null;
  lastSeenAt?: string | null;
}

export interface Order {
  id: number;
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
  ratePerKm: number;
  etaMinutes: number;
  itemsCount: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
  storeId?: number | null;
  acceptedVehicles?: string;
  clientPhone?: string;
  notes?: string;
  /** Pedido de loja: o entregador precisa do código do cliente para fechar */
  needsCode?: boolean;
}

export type VehicleType = "moto" | "bicicleta" | "scooter" | "carro";

export interface Store {
  id: number;
  email: string;
  name: string;
  category: string;
  phone: string;
  address: string;
  neighborhood: string;
  city: string;
  lat: number | null;
  lng: number | null;
}

export interface StoreOrder extends Order {
  deliveryCode: string | null;
  deliveryCodeAttempts: number;
  courierName: string | null;
  courierNickname: string | null;
  courierPhone: string | null;
  courierVehicle: string | null;
  courierPos: { lat: number; lng: number; seenAt: string | null } | null;
  publicToken: string | null;
  waitingMinutes: number;
  acceptedAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
}

export interface DashboardData {
  todayNet: number;
  todayGross: number;
  deliveriesToday: number;
  kmToday: number;
  hourlyAverage: number;
  goal: number;
  goalPercent: number;
  activeOrder: Order | null;
  onlinePartners: number;
  hoursOnline: number;
}

export interface Partner {
  id: number;
  name: string;
  nickname: string;
  status: string;
  lat: number;
  lng: number;
  distanceKm: number;
  rating: number;
  /** true = posição vinda do GPS real nos últimos minutos */
  live?: boolean;
}

export type AlertType = "blitz" | "alagamento" | "risco" | "restaurante" | "sos";

export interface ChatMessage {
  id: number;
  courierId: number;
  senderName: string;
  senderNickname: string;
  isMe: boolean;
  channel: string;
  kind: "texto" | "audio" | "alerta" | "foto";
  alertType: AlertType | null;
  content: string;
  audioDurationSec: number | null;
  neighborhood: string;
  createdAt: string;
  senderPhoto?: string | null;
  /** Áudio salvo no servidor (24 h) */
  audioUrl?: string | null;
  /** Foto salva no servidor (5 h); null = expirou */
  photoUrl?: string | null;
  /** Distância de quem enviou (aba "Perto de mim") */
  distanceKm?: number | null;
}

export interface ReportData {
  period: number;
  totals: {
    net: number;
    gross: number;
    fees: number;
    deliveries: number;
    km: number;
    avgTicket: number;
    dailyAverage: number;
    tips: number;
  };
  series: { label: string; net: number; deliveries: number; km: number }[];
  hourly?: { hour: string; net: number; deliveries: number }[];
  peakHour: string | null;
  weekCompare: { first: number; second: number; deltaPercent: number } | null;
  bestWeekdays: { day: string; avg: number }[] | null;
  projection: number | null;
  growthPercent: number | null;
  bestDay: { label: string; net: number } | null;
}
