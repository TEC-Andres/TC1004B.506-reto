// Pure functions that turn raw table rows into what the screens show.
// No React here, so this file can be tested with `node --test`.
import type {
  Acceso, Caja, Controlador, Data, EtiquetaHerramienta, EventoInventario, Objeto, Usuario,
} from "./types";

const t = (iso: string) => Date.parse(iso);
const newestFirst = <T,>(get: (x: T) => string) => (a: T, b: T) => t(get(b)) - t(get(a));

export function indexes(d: Data) {
  const map = <T, K>(rows: T[], key: (r: T) => K) => new Map(rows.map((r) => [key(r), r]));
  const controlador = map(d.controladores, (c) => c.controladorID);
  const sensor = map(d.sensores, (s) => s.sensorID);
  const actuador = map(d.actuadores, (a) => a.actuadorID);
  const rfid = map(d.rfid, (r) => r.tarjetaID);
  const usuario = map(d.usuarios, (u) => u.idUsuario);
  return {
    objeto: map(d.objetos, (o) => o.objetoID),
    usuario,
    equipo: map(d.equipos, (e) => e.equipoID),
    caja: map(d.cajas, (c) => c.cajaID),
    etiqueta: map(d.etiquetas, (e) => e.epc),
    controlador,
    sensor,
    actuador,
    cajaDeSensor: (id: number) => controlador.get(sensor.get(id)?.controladorID ?? -1)?.cajaID ?? null,
    cajaDeActuador: (id: number) => controlador.get(actuador.get(id)?.controladorID ?? -1)?.cajaID ?? null,
    // Accesos -> RFID -> Usuario (the access row does not store the user twice).
    usuarioDeTarjeta: (tarjetaID: string | null): Usuario | null =>
      tarjetaID ? usuario.get(rfid.get(tarjetaID)?.idUsuario ?? -1) ?? null : null,
  };
}
export type Ix = ReturnType<typeof indexes>;

// A tool is attributed to the last authorized opening of that box shortly before it left.
const CUSTODIO_VENTANA_MS = 15 * 60_000;

export type EstadoHerramienta = {
  etiqueta: EtiquetaHerramienta;
  objeto: Objeto | null;
  ultimo: EventoInventario | null;
  cajaID: number | null; // box where it was last read
  dentro: boolean | null; // null = never read by any box
  custodio: { usuario: Usuario | null; acceso: Acceso } | null;
};

export function inventario(d: Data, ix: Ix): EstadoHerramienta[] {
  const ultimoPorEpc = new Map<string, EventoInventario>();
  for (const ev of d.eventosInventario) {
    const prev = ultimoPorEpc.get(ev.epcLeido);
    if (!prev || t(ev.fechaYHora) > t(prev.fechaYHora)) ultimoPorEpc.set(ev.epcLeido, ev);
  }
  return d.etiquetas.map((etiqueta) => {
    const ultimo = ultimoPorEpc.get(etiqueta.epc) ?? null;
    const cajaID = ultimo ? ix.cajaDeSensor(ultimo.sensorID) : null;
    const dentro = ultimo ? ultimo.tipoEvento !== "salida" : null;
    let custodio: EstadoHerramienta["custodio"] = null;
    if (ultimo && !dentro) {
      const salida = t(ultimo.fechaYHora);
      const acceso = d.accesos
        .filter((a) => a.cajaID === cajaID && a.resultado === "autorizado")
        .filter((a) => t(a.fechaYHora) <= salida && salida - t(a.fechaYHora) <= CUSTODIO_VENTANA_MS)
        .sort(newestFirst((a) => a.fechaYHora))[0];
      if (acceso) custodio = { acceso, usuario: ix.usuarioDeTarjeta(acceso.tarjetaID) };
    }
    return { etiqueta, objeto: ix.objeto.get(etiqueta.objetoID) ?? null, ultimo, cajaID, dentro, custodio };
  });
}

export function eventosDeEpc(d: Data, epc: string) {
  return d.eventosInventario.filter((e) => e.epcLeido === epc).sort(newestFirst((e) => e.fechaYHora));
}

export function lecturasDe(d: Data, sensorID: number) {
  return d.lecturas
    .filter((l) => l.sensorID === sensorID)
    .sort((a, b) => t(a.fechaYHora) - t(b.fechaYHora));
}

export function controladorDe(d: Data, cajaID: number): Controlador | null {
  return d.controladores.find((c) => c.cajaID === cajaID) ?? null;
}

export function accesosDe(d: Data, filtro: (a: Acceso) => boolean) {
  return d.accesos.filter(filtro).sort(newestFirst((a) => a.fechaYHora));
}

export type Tono = "ok" | "warn" | "bad" | "neutral";
export type TipoActividad = "acceso" | "inventario" | "actuador" | "historial";
export type Actividad = {
  key: string;
  tipo: TipoActividad;
  fecha: string;
  cajaID: number | null;
  titulo: string;
  detalle: string | null;
  tono: Tono;
};

// Merges the four log tables into a single newest-first feed.
export function actividad(d: Data, ix: Ix): Actividad[] {
  const items: Actividad[] = [];
  for (const a of d.accesos) {
    const u = ix.usuarioDeTarjeta(a.tarjetaID);
    const ok = a.resultado === "autorizado";
    items.push({
      key: `a${a.accesoID}`, tipo: "acceso", fecha: a.fechaYHora, cajaID: a.cajaID,
      titulo: `${ok ? "Acceso autorizado" : "Acceso denegado"}: ${u?.nombreDeUsuario ?? `tarjeta ${a.codigoLeido}`}`,
      detalle: a.motivo, tono: ok ? "ok" : "bad",
    });
  }
  for (const e of d.eventosInventario) {
    const nombre = ix.objeto.get(ix.etiqueta.get(e.epcLeido)?.objetoID ?? -1)?.nombreDeObjeto;
    const verbo = { deteccion: "Detectada", entrada: "Entró", salida: "Salió" }[e.tipoEvento];
    items.push({
      key: `i${e.eventoInventarioID}`, tipo: "inventario", fecha: e.fechaYHora, cajaID: ix.cajaDeSensor(e.sensorID),
      titulo: `${verbo}: ${nombre ?? "etiqueta desconocida"}`, detalle: `EPC ${e.epcLeido}`,
      tono: e.tipoEvento === "salida" ? "warn" : nombre ? "neutral" : "bad",
    });
  }
  for (const e of d.eventosActuadores) {
    const act = ix.actuador.get(e.actuadorID);
    items.push({
      key: `x${e.eventoActuadorID}`, tipo: "actuador", fecha: e.fechaYHora, cajaID: ix.cajaDeActuador(e.actuadorID),
      titulo: `${act?.nombreActuador ?? "Actuador"}: ${e.accion}`, detalle: e.detalle,
      tono: /alarma/i.test(e.accion) ? "bad" : "neutral",
    });
  }
  for (const h of d.historial) {
    items.push({
      key: `h${h.historialID}`, tipo: "historial", fecha: h.fechaYHoraDeCambio, cajaID: h.cajaID,
      titulo: h.registroDeCambio, detalle: `por ${h.autor}`, tono: "neutral",
    });
  }
  return items.sort(newestFirst((x) => x.fecha));
}

export function resumenCaja(caja: Caja, inv: EstadoHerramienta[]) {
  const aqui = inv.filter((h) => h.cajaID === caja.cajaID);
  return { dentro: aqui.filter((h) => h.dentro).length, fuera: aqui.filter((h) => h.dentro === false).length };
}

export function enUltimas(iso: string, horas: number, ahora = Date.now()) {
  return ahora - t(iso) <= horas * 3_600_000;
}

const fechaFmt = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" });
const soloFecha = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" });
export const fmtFecha = (iso: string) => fechaFmt.format(new Date(iso));
export const fmtDia = (iso: string) => soloFecha.format(new Date(iso));

export function hace(iso: string, ahora = Date.now()) {
  const min = Math.round((ahora - t(iso)) / 60_000);
  if (min < 1) return "justo ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}
