import type { ConsultaIA, Data } from "./types";
import { demoData } from "./mock";

// Each table is one GET endpoint. /api/* is proxied to BACKEND_URL (next.config.ts),
// which reads the Aiven MySQL database. Keep this map in sync with the backend.
export const ENDPOINTS: Record<keyof Data, string> = {
  objetos: "objetos",
  usuarios: "usuarios",
  equipos: "equipos",
  cajas: "cajas",
  rfid: "rfid",
  controladores: "controladores",
  sensores: "sensores",
  actuadores: "actuadores",
  etiquetas: "etiquetas-herramienta",
  permisos: "permisos-acceso",
  lecturas: "lecturas-sensores",
  eventosInventario: "eventos-inventario",
  accesos: "accesos",
  eventosActuadores: "eventos-actuadores",
  historial: "historial",
  consultasIA: "consultas-ia",
};

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`/api/${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

export type Source = "live" | "demo";

// All-or-nothing: mixing live rows with demo rows would show joins that don't exist.
export async function loadAll(): Promise<{ data: Data; source: Source; error?: string }> {
  const keys = Object.keys(ENDPOINTS) as (keyof Data)[];
  try {
    const rows = await Promise.all(keys.map((k) => getJSON<unknown[]>(ENDPOINTS[k])));
    const data = Object.fromEntries(keys.map((k, i) => [k, rows[i]])) as Data;
    return { data, source: "live" };
  } catch (e) {
    return { data: demoData(), source: "demo", error: e instanceof Error ? e.message : String(e) };
  }
}

export async function askAI(pregunta: string): Promise<ConsultaIA> {
  const res = await fetch(`/api/${ENDPOINTS.consultasIA}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pregunta }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
