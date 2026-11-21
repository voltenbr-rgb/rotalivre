import type { LatLng } from "./geoparse";

/** Endereço aproximado do ponto (OpenStreetMap / Nominatim) */
export async function reverseGeocode(p: LatLng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&lat=${p.lat}&lon=${p.lng}`,
      { headers: { "User-Agent": "RotaLivre/1.0 (rotalivre.voltenbr.workers.dev)", "Accept-Language": "pt-BR" } },
    );
    if (!res.ok) return null;
    const d = (await res.json()) as { address?: Record<string, string> };
    const a = d.address ?? {};
    const street = a.road || a.pedestrian || a.footway || a.residential || "";
    const address = [street, a.house_number].filter(Boolean).join(", ");
    const neighborhood = a.suburb || a.neighbourhood || a.quarter || a.city_district || a.village || "";
    return { address, neighborhood, city: a.city || a.town || a.municipality || "" };
  } catch {
    return null;
  }
}

