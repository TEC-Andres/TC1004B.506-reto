// ToolNest-specific pieces reused across pages.
import Link from "next/link";
import type { Actividad, EstadoHerramienta, Ix } from "@/lib/derive";
import { fmtFecha, hace } from "@/lib/derive";
import type { Caja } from "@/lib/types";
import { Badge, Empty, Icon } from "./ui";

export function CajaFlags({ caja }: { caja: Caja }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge tono={caja.estaBloqueada ? "ok" : "warn"}>
        <Icon name={caja.estaBloqueada ? "lock" : "unlock"} className="h-3.5 w-3.5" />
        {caja.estaBloqueada ? "Bloqueada" : "Abierta"}
      </Badge>
      <Badge tono="neutral">
        <Icon name="light" className="h-3.5 w-3.5" />
        {caja.tieneLucesEncendidas ? "Luces encendidas" : "Luces apagadas"}
      </Badge>
      {caja.estaActivaProtocoloDeAlarma && (
        <Badge tono="bad">
          <Icon name="bell" className="h-3.5 w-3.5" />
          Alarma activa
        </Badge>
      )}
    </div>
  );
}

export function CajaLink({ id, ix }: { id: number | null; ix: Ix }) {
  const caja = id == null ? null : ix.caja.get(id);
  if (!caja) return <span className="text-ink-muted">—</span>;
  return <Link href={`/cajas/${caja.cajaID}`} className="font-medium text-brand-600 hover:underline">{caja.nombreDeCaja}</Link>;
}

export function EstadoHerramientaBadge({ h }: { h: EstadoHerramienta }) {
  if (h.dentro == null) return <Badge>Sin lecturas</Badge>;
  return h.dentro ? <Badge tono="ok">En caja</Badge> : <Badge tono="warn">Fuera</Badge>;
}

const tipoLabel = { acceso: "Acceso", inventario: "Inventario", actuador: "Actuador", historial: "Cambio" } as const;
const dot = { ok: "bg-ok", warn: "bg-warn", bad: "bg-bad", neutral: "bg-ink-faint" } as const;

export function ActividadList({ items, ix, showCaja = true }: { items: Actividad[]; ix: Ix; showCaja?: boolean }) {
  if (items.length === 0) return <Empty>Sin actividad registrada.</Empty>;
  return (
    <ul className="divide-y divide-line">
      {items.map((a) => (
        <li key={a.key} className="flex gap-3 px-5 py-3">
          <span aria-hidden className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${dot[a.tono]}`} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">{a.titulo}</p>
            <p className="mt-0.5 text-xs text-ink-muted">
              {tipoLabel[a.tipo]}
              {showCaja && a.cajaID != null && <> · <CajaLink id={a.cajaID} ix={ix} /></>}
              {a.detalle && <> · {a.detalle}</>}
            </p>
          </div>
          <time dateTime={a.fecha} title={fmtFecha(a.fecha)} className="shrink-0 text-xs text-ink-muted">
            {hace(a.fecha)}
          </time>
        </li>
      ))}
    </ul>
  );
}
