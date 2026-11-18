import {
  pgTable,
  serial,
  text,
  integer,
  doublePrecision,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Entregadores (courier principal + parceiros da rede)                */
/* ------------------------------------------------------------------ */
export const couriers = pgTable("couriers", {
  id: serial("id").primaryKey(),
  isMain: boolean("is_main").notNull().default(false),
  name: text("name").notNull(),
  nickname: text("nickname").notNull().default(""),
  email: text("email").notNull().default(""),
  phone: text("phone").notNull().default(""),
  cpf: text("cpf").notNull().default(""),
  birthDate: text("birth_date").notNull().default(""),
  photoUrl: text("photo_url").notNull().default(""),
  // online | pausa | em_entrega | offline
  status: text("status").notNull().default("online"),
  // Moto
  vehicleModel: text("vehicle_model").notNull().default(""),
  vehiclePlate: text("vehicle_plate").notNull().default(""),
  vehicleYear: text("vehicle_year").notNull().default(""),
  vehicleColor: text("vehicle_color").notNull().default(""),
  // CNH
  cnhNumber: text("cnh_number").notNull().default(""),
  cnhCategory: text("cnh_category").notNull().default("AB"),
  cnhExpiry: text("cnh_expiry").notNull().default(""),
  // Endereço completo de cadastro
  cep: text("cep").notNull().default(""),
  street: text("street").notNull().default(""),
  number: text("number").notNull().default(""),
  neighborhood: text("neighborhood").notNull().default(""),
  city: text("city").notNull().default(""),
  state: text("state").notNull().default(""),
  // Preferências operacionais
  workRadiusKm: integer("work_radius_km").notNull().default(8),
  dailyGoal: doublePrecision("daily_goal").notNull().default(250),
  baseLat: doublePrecision("base_lat").notNull().default(-23.6461),
  baseLng: doublePrecision("base_lng").notNull().default(-46.7678),
  rating: doublePrecision("rating").notNull().default(4.9),
  totalDeliveries: integer("total_deliveries").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Pedidos / corridas                                                  */
/* ------------------------------------------------------------------ */
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  code: text("code").notNull(),
  clientName: text("client_name").notNull(),
  establishment: text("establishment").notNull(),
  establishmentType: text("establishment_type").notNull().default("Restaurante"),
  pickupAddress: text("pickup_address").notNull(),
  pickupNeighborhood: text("pickup_neighborhood").notNull(),
  pickupLat: doublePrecision("pickup_lat").notNull(),
  pickupLng: doublePrecision("pickup_lng").notNull(),
  deliveryAddress: text("delivery_address").notNull(),
  deliveryNeighborhood: text("delivery_neighborhood").notNull(),
  deliveryLat: doublePrecision("delivery_lat").notNull(),
  deliveryLng: doublePrecision("delivery_lng").notNull(),
  distanceKm: doublePrecision("distance_km").notNull(),
  // Valor líquido garantido ao entregador (já com taxa transparente deduzida)
  valueNet: doublePrecision("value_net").notNull(),
  etaMinutes: integer("eta_minutes").notNull().default(25),
  itemsCount: integer("items_count").notNull().default(1),
  paymentMethod: text("payment_method").notNull().default("Pix"),
  // available | accepted | picked_up | delivered | expired | dismissed
  status: text("status").notNull().default("available"),
  courierId: integer("courier_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  acceptedAt: timestamp("accepted_at"),
  pickedUpAt: timestamp("picked_up_at"),
  deliveredAt: timestamp("delivered_at"),
});

/* ------------------------------------------------------------------ */
/* Transações financeiras (base dos relatórios)                        */
/* ------------------------------------------------------------------ */
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  courierId: integer("courier_id").notNull(),
  orderId: integer("order_id"),
  // entrega | gorjeta | bonus
  type: text("type").notNull().default("entrega"),
  description: text("description").notNull().default(""),
  amountGross: doublePrecision("amount_gross").notNull().default(0),
  feeAmount: doublePrecision("fee_amount").notNull().default(0),
  amountNet: doublePrecision("amount_net").notNull().default(0),
  km: doublePrecision("km").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Mensagens do rádio / chat regional e alertas geolocalizados         */
/* ------------------------------------------------------------------ */
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  courierId: integer("courier_id").notNull(),
  channel: text("channel").notNull().default("Zona Sul"),
  // texto | audio | alerta
  kind: text("kind").notNull().default("texto"),
  // blitz | alagamento | risco | restaurante | sos (quando kind=alerta)
  alertType: text("alert_type"),
  content: text("content").notNull().default(""),
  audioDurationSec: integer("audio_duration_sec"),
  neighborhood: text("neighborhood").notNull().default(""),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
