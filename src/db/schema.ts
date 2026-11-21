import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

/* Helpers para manter a mesma API do schema original (Postgres) no D1/SQLite */
const id = () => integer("id").primaryKey({ autoIncrement: true });
const bool = (name: string) => integer(name, { mode: "boolean" });
const ts = (name: string) => integer(name, { mode: "timestamp_ms" });
const now = () => new Date();

/* ------------------------------------------------------------------ */
/* Entregadores (courier principal + parceiros da rede)                */
/* ------------------------------------------------------------------ */
export const couriers = sqliteTable("couriers", {
  id: id(),
  isMain: bool("is_main").notNull().default(false),
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
  dailyGoal: real("daily_goal").notNull().default(250),
  baseLat: real("base_lat").notNull().default(-23.6461),
  baseLng: real("base_lng").notNull().default(-46.7678),
  rating: real("rating").notNull().default(4.9),
  totalDeliveries: integer("total_deliveries").notNull().default(0),
  // Corridas aceitas e depois desistidas (pesa na nota)
  cancelCount: integer("cancel_count").notNull().default(0),
  // Senha protegida (PBKDF2). Nunca sai do servidor.
  passwordHash: text("password_hash"),
  // moto | bicicleta | scooter | carro
  vehicleType: text("vehicle_type").notNull().default("moto"),
  // Bloqueado pelo painel master (não entra no app)
  blocked: bool("blocked").notNull().default(false),
  termsAcceptedAt: ts("terms_accepted_at"),
  // Última posição real (GPS do celular), atualizada pelo app durante o turno
  lastLat: real("last_lat"),
  lastLng: real("last_lng"),
  lastAccuracyM: real("last_accuracy_m"),
  lastHeading: real("last_heading"),
  lastSpeedKmh: real("last_speed_kmh"),
  lastSeenAt: ts("last_seen_at"),
  createdAt: ts("created_at").notNull().$defaultFn(now),
  updatedAt: ts("updated_at").notNull().$defaultFn(now),
});

/* ------------------------------------------------------------------ */
/* Pedidos / corridas                                                  */
/* ------------------------------------------------------------------ */
export const orders = sqliteTable("orders", {
  id: id(),
  code: text("code").notNull(),
  clientName: text("client_name").notNull(),
  establishment: text("establishment").notNull(),
  establishmentType: text("establishment_type").notNull().default("Restaurante"),
  pickupAddress: text("pickup_address").notNull(),
  pickupNeighborhood: text("pickup_neighborhood").notNull(),
  pickupLat: real("pickup_lat").notNull(),
  pickupLng: real("pickup_lng").notNull(),
  deliveryAddress: text("delivery_address").notNull(),
  deliveryNeighborhood: text("delivery_neighborhood").notNull(),
  deliveryLat: real("delivery_lat").notNull(),
  deliveryLng: real("delivery_lng").notNull(),
  distanceKm: real("distance_km").notNull(),
  // Valor líquido garantido ao entregador (já com taxa transparente deduzida)
  valueNet: real("value_net").notNull(),
  etaMinutes: integer("eta_minutes").notNull().default(25),
  itemsCount: integer("items_count").notNull().default(1),
  paymentMethod: text("payment_method").notNull().default("Pix"),
  // available | accepted | picked_up | delivered | expired | dismissed
  status: text("status").notNull().default("available"),
  courierId: integer("courier_id"),
  // Pedido lançado por uma loja cadastrada (null = pedido de teste/simulado)
  storeId: integer("store_id"),
  // Veículos aceitos: "todos" ou lista separada por vírgula (moto,bicicleta,scooter,carro)
  acceptedVehicles: text("accepted_vehicles").notNull().default("todos"),
  clientPhone: text("client_phone").notNull().default(""),
  // Código de 4 dígitos que só a loja e o cliente sabem; fecha a entrega
  deliveryCode: text("delivery_code"),
  deliveryCodeAttempts: integer("delivery_code_attempts").notNull().default(0),
  // Link público de acompanhamento para o cliente (/acompanhar/<token>)
  publicToken: text("public_token"),
  // Quando o pedido parado foi reavisado (raio maior)
  renotifiedAt: ts("renotified_at"),
  notes: text("notes").notNull().default(""),
  createdAt: ts("created_at").notNull().$defaultFn(now),
  acceptedAt: ts("accepted_at"),
  pickedUpAt: ts("picked_up_at"),
  deliveredAt: ts("delivered_at"),
});

/* ------------------------------------------------------------------ */
/* Transações financeiras (base dos relatórios)                        */
/* ------------------------------------------------------------------ */
export const transactions = sqliteTable("transactions", {
  id: id(),
  courierId: integer("courier_id").notNull(),
  orderId: integer("order_id"),
  // entrega | gorjeta | bonus
  type: text("type").notNull().default("entrega"),
  description: text("description").notNull().default(""),
  amountGross: real("amount_gross").notNull().default(0),
  feeAmount: real("fee_amount").notNull().default(0),
  amountNet: real("amount_net").notNull().default(0),
  km: real("km").notNull().default(0),
  createdAt: ts("created_at").notNull().$defaultFn(now),
});

/* ------------------------------------------------------------------ */
/* Mensagens do rádio / chat regional e alertas geolocalizados         */
/* ------------------------------------------------------------------ */
export const messages = sqliteTable("messages", {
  id: id(),
  courierId: integer("courier_id").notNull(),
  channel: text("channel").notNull().default("Geral"),
  // texto | audio | alerta
  kind: text("kind").notNull().default("texto"),
  // blitz | alagamento | risco | restaurante | sos (quando kind=alerta)
  alertType: text("alert_type"),
  content: text("content").notNull().default(""),
  audioDurationSec: integer("audio_duration_sec"),
  neighborhood: text("neighborhood").notNull().default(""),
  lat: real("lat"),
  lng: real("lng"),
  createdAt: ts("created_at").notNull().$defaultFn(now),
});

/* ------------------------------------------------------------------ */
/* Notificações push: um registro por aparelho que ligou o "sino"      */
/* ------------------------------------------------------------------ */
export const pushSubscriptions = sqliteTable("push_subscriptions", {
  id: id(),
  courierId: integer("courier_id").notNull(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  lastPushAt: ts("last_push_at"),
  createdAt: ts("created_at").notNull().$defaultFn(now),
});

/* ------------------------------------------------------------------ */
/* Configurações internas do app (ex.: chaves VAPID do push)           */
/* ------------------------------------------------------------------ */
export const appConfig = sqliteTable("app_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

/* ------------------------------------------------------------------ */
/* Sessões de login: cada aparelho conectado tem a sua chave própria.  */
/* Guardamos só o hash da chave (SHA-256), nunca a chave em si.        */
/* account_type prepara o terreno para os comércios ("store").         */
/* ------------------------------------------------------------------ */
export const sessions = sqliteTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  accountType: text("account_type").notNull().default("courier"),
  accountId: integer("account_id").notNull(),
  createdAt: ts("created_at").notNull().$defaultFn(now),
  expiresAt: ts("expires_at").notNull(),
});

/* ------------------------------------------------------------------ */
/* Áudio das mensagens do rádio (guardado só por 24 h, como o chat)    */
/* ------------------------------------------------------------------ */
export const messageAudio = sqliteTable("message_audio", {
  messageId: integer("message_id").primaryKey(),
  mime: text("mime").notNull(),
  dataB64: text("data_b64").notNull(),
});

/* ------------------------------------------------------------------ */
/* Fotos do rádio (guardadas só por 5 h; a mensagem fica até 24 h)     */
/* ------------------------------------------------------------------ */
export const messagePhoto = sqliteTable("message_photo", {
  messageId: integer("message_id").primaryKey(),
  mime: text("mime").notNull(),
  dataB64: text("data_b64").notNull(),
  createdAt: ts("created_at").notNull().$defaultFn(now),
});

/* ------------------------------------------------------------------ */
/* Lojas / comércios: conta própria (e-mail + senha), separada dos      */
/* entregadores. Lançam os pedidos que aparecem no feed da região.     */
/* ------------------------------------------------------------------ */
export const stores = sqliteTable("stores", {
  id: id(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull().default(""),
  category: text("category").notNull().default("Restaurante"),
  phone: text("phone").notNull().default(""),
  address: text("address").notNull().default(""),
  neighborhood: text("neighborhood").notNull().default(""),
  city: text("city").notNull().default(""),
  lat: real("lat"),
  lng: real("lng"),
  blocked: bool("blocked").notNull().default(false),
  termsAcceptedAt: ts("terms_accepted_at"),
  createdAt: ts("created_at").notNull().$defaultFn(now),
  updatedAt: ts("updated_at").notNull().$defaultFn(now),
});

/* ------------------------------------------------------------------ */
/* Proteção de login: 5 erros seguidos = espera de 10 minutos           */
/* key = "<tipo>:<email>" (courier, store ou admin)                     */
/* ------------------------------------------------------------------ */
export const loginGuard = sqliteTable("login_guard", {
  key: text("key").primaryKey(),
  fails: integer("fails").notNull().default(0),
  lockedUntil: ts("locked_until"),
});

/* ------------------------------------------------------------------ */
/* Pedidos de suporte (ex.: "esqueci minha senha"), vistos no master   */
/* ------------------------------------------------------------------ */
export const supportRequests = sqliteTable("support_requests", {
  id: id(),
  accountType: text("account_type").notNull(), // courier | store
  email: text("email").notNull(),
  contact: text("contact").notNull().default(""),
  message: text("message").notNull().default(""),
  kind: text("kind").notNull().default("senha"),
  status: text("status").notNull().default("aberto"), // aberto | resolvido
  createdAt: ts("created_at").notNull().$defaultFn(now),
  resolvedAt: ts("resolved_at"),
});

/* Desistências de corrida pelo entregador (contam na nota) */
export const orderCancellations = sqliteTable("order_cancellations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id").notNull(),
  courierId: integer("courier_id").notNull(),
  storeId: integer("store_id"),
  reason: text("reason").notNull().default(""),
  stage: text("stage").notNull().default("accepted"),
  createdAt: ts("created_at").notNull().$defaultFn(now),
});

/* Link "Estou aqui": o cliente manda a localização para a loja montar o pedido */
export const locationRequests = sqliteTable("location_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  token: text("token").notNull(),
  storeId: integer("store_id").notNull(),
  status: text("status").notNull().default("pendente"), // pendente | recebido
  lat: real("lat"),
  lng: real("lng"),
  accuracy: real("accuracy"),
  address: text("address").notNull().default(""),
  neighborhood: text("neighborhood").notNull().default(""),
  reference: text("reference").notNull().default(""),
  clientName: text("client_name").notNull().default(""),
  createdAt: ts("created_at").notNull().$defaultFn(now),
  receivedAt: ts("received_at"),
});
