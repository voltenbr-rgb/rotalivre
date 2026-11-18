/* ------------------------------------------------------------------ */
/* Base geográfica do Brasil: capitais e principais cidades            */
/* ------------------------------------------------------------------ */

export interface BrazilCity {
  name: string;
  uf: string;
  lat: number;
  lng: number;
  capital?: boolean;
}

export const BRAZIL_CAPITALS: BrazilCity[] = [
  { name: "Rio Branco", uf: "AC", lat: -9.9754, lng: -67.8249, capital: true },
  { name: "Maceió", uf: "AL", lat: -9.6658, lng: -35.7353, capital: true },
  { name: "Macapá", uf: "AP", lat: 0.0349, lng: -51.0694, capital: true },
  { name: "Manaus", uf: "AM", lat: -3.119, lng: -60.0217, capital: true },
  { name: "Salvador", uf: "BA", lat: -12.9714, lng: -38.5014, capital: true },
  { name: "Fortaleza", uf: "CE", lat: -3.7319, lng: -38.5267, capital: true },
  { name: "Brasília", uf: "DF", lat: -15.7939, lng: -47.8828, capital: true },
  { name: "Vitória", uf: "ES", lat: -20.3155, lng: -40.3128, capital: true },
  { name: "Goiânia", uf: "GO", lat: -16.6869, lng: -49.2648, capital: true },
  { name: "São Luís", uf: "MA", lat: -2.5307, lng: -44.3068, capital: true },
  { name: "Cuiabá", uf: "MT", lat: -15.6014, lng: -56.0979, capital: true },
  { name: "Campo Grande", uf: "MS", lat: -20.4697, lng: -54.6201, capital: true },
  { name: "Belo Horizonte", uf: "MG", lat: -19.9167, lng: -43.9345, capital: true },
  { name: "Belém", uf: "PA", lat: -1.4558, lng: -48.5044, capital: true },
  { name: "João Pessoa", uf: "PB", lat: -7.1195, lng: -34.845, capital: true },
  { name: "Curitiba", uf: "PR", lat: -25.4284, lng: -49.2733, capital: true },
  { name: "Recife", uf: "PE", lat: -8.0476, lng: -34.877, capital: true },
  { name: "Teresina", uf: "PI", lat: -5.0919, lng: -42.8034, capital: true },
  { name: "Rio de Janeiro", uf: "RJ", lat: -22.9068, lng: -43.1729, capital: true },
  { name: "Natal", uf: "RN", lat: -5.7945, lng: -35.211, capital: true },
  { name: "Porto Alegre", uf: "RS", lat: -30.0346, lng: -51.2177, capital: true },
  { name: "Porto Velho", uf: "RO", lat: -8.7608, lng: -63.8999, capital: true },
  { name: "Boa Vista", uf: "RR", lat: 2.8235, lng: -60.6758, capital: true },
  { name: "Florianópolis", uf: "SC", lat: -27.5954, lng: -48.548, capital: true },
  { name: "São Paulo", uf: "SP", lat: -23.5505, lng: -46.6333, capital: true },
  { name: "Aracaju", uf: "SE", lat: -10.9472, lng: -37.0731, capital: true },
  { name: "Palmas", uf: "TO", lat: -10.2491, lng: -48.3243, capital: true },
];

export const BRAZIL_CITIES: BrazilCity[] = [
  ...BRAZIL_CAPITALS,
  { name: "Campinas", uf: "SP", lat: -22.9099, lng: -47.0626 },
  { name: "Guarulhos", uf: "SP", lat: -23.4538, lng: -46.5333 },
  { name: "Santos", uf: "SP", lat: -23.9608, lng: -46.3336 },
  { name: "São Bernardo do Campo", uf: "SP", lat: -23.708, lng: -46.5512 },
  { name: "Ribeirão Preto", uf: "SP", lat: -21.1704, lng: -47.8103 },
  { name: "Sorocaba", uf: "SP", lat: -23.5015, lng: -47.5089 },
  { name: "São José dos Campos", uf: "SP", lat: -23.2237, lng: -45.9009 },
  { name: "Niterói", uf: "RJ", lat: -22.8833, lng: -43.1036 },
  { name: "Duque de Caxias", uf: "RJ", lat: -22.7856, lng: -43.3117 },
  { name: "Contagem", uf: "MG", lat: -19.9319, lng: -44.052 },
  { name: "Betim", uf: "MG", lat: -19.967, lng: -44.2008 },
  { name: "Uberlândia", uf: "MG", lat: -18.9146, lng: -48.2754 },
  { name: "Juiz de Fora", uf: "MG", lat: -21.7595, lng: -43.3398 },
  { name: "Governador Valadares", uf: "MG", lat: -18.8509, lng: -41.9489 },
  { name: "Londrina", uf: "PR", lat: -23.3045, lng: -51.1696 },
  { name: "Maringá", uf: "PR", lat: -23.4205, lng: -51.9331 },
  { name: "Ponta Grossa", uf: "PR", lat: -25.0994, lng: -50.1583 },
  { name: "Foz do Iguaçu", uf: "PR", lat: -25.547, lng: -54.5881 },
  { name: "Cascavel", uf: "PR", lat: -24.9555, lng: -53.4552 },
  { name: "Joinville", uf: "SC", lat: -26.3045, lng: -48.8487 },
  { name: "Blumenau", uf: "SC", lat: -26.9194, lng: -49.0661 },
  { name: "Caxias do Sul", uf: "RS", lat: -29.1634, lng: -51.1797 },
  { name: "Pelotas", uf: "RS", lat: -31.7654, lng: -52.3376 },
  { name: "Santa Maria", uf: "RS", lat: -29.6869, lng: -53.8149 },
  { name: "Feira de Santana", uf: "BA", lat: -12.2733, lng: -38.9608 },
  { name: "Vitória da Conquista", uf: "BA", lat: -14.8619, lng: -40.8447 },
  { name: "Campina Grande", uf: "PB", lat: -7.2307, lng: -35.8817 },
  { name: "Mossoró", uf: "RN", lat: -5.1878, lng: -37.3441 },
  { name: "Imperatriz", uf: "MA", lat: -5.5264, lng: -47.4917 },
  { name: "Marabá", uf: "PA", lat: -5.3811, lng: -49.1333 },
  { name: "Santarém", uf: "PA", lat: -2.4419, lng: -54.7079 },
  { name: "Anápolis", uf: "GO", lat: -16.3281, lng: -48.9534 },
  { name: "Sinop", uf: "MT", lat: -11.8604, lng: -55.5026 },
];

/** Limites aproximados do território brasileiro para enquadramento */
export const BRAZIL_BOUNDS: [[number, number], [number, number]] = [
  [-33.9, -74.1],
  [5.4, -28.6],
];

/* ------------------------- Regiões do Brasil ------------------------ */

export const REGION_BY_UF: Record<string, string> = {
  AC: "Norte", AM: "Norte", AP: "Norte", PA: "Norte", RO: "Norte", RR: "Norte", TO: "Norte",
  AL: "Nordeste", BA: "Nordeste", CE: "Nordeste", MA: "Nordeste", PB: "Nordeste",
  PE: "Nordeste", PI: "Nordeste", RN: "Nordeste", SE: "Nordeste",
  DF: "Centro-Oeste", GO: "Centro-Oeste", MT: "Centro-Oeste", MS: "Centro-Oeste",
  ES: "Sudeste", MG: "Sudeste", RJ: "Sudeste", SP: "Sudeste",
  PR: "Sul", RS: "Sul", SC: "Sul",
};

export const REGION_COLORS: Record<string, string> = {
  Norte: "#22c55e",
  Nordeste: "#eab308",
  "Centro-Oeste": "#f97316",
  Sudeste: "#38bdf8",
  Sul: "#14b8a6",
};

/** Rótulos das regiões para o mapa nacional */
export const REGION_LABELS: { region: string; label: string; lat: number; lng: number }[] = [
  { region: "Norte", label: "NORTE", lat: -5.4, lng: -63.2 },
  { region: "Nordeste", label: "NORDESTE", lat: -8.6, lng: -41.8 },
  { region: "Centro-Oeste", label: "CENTRO-OESTE", lat: -15.8, lng: -56.2 },
  { region: "Sudeste", label: "SUDESTE", lat: -20.8, lng: -44.2 },
  { region: "Sul", label: "SUL", lat: -27.6, lng: -52.4 },
];

export function searchCities(query: string, limit = 6): BrazilCity[] {
  const q = query
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  if (q.length < 2) return [];
  return BRAZIL_CITIES.filter((c) => {
    const name = c.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return name.includes(q) || c.uf.toLowerCase() === q;
  }).slice(0, limit);
}
