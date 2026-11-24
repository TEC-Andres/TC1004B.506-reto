"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useData } from "@/components/DataProvider";
import { ActividadList, CajaFlags, CajaLink } from "@/components/domain";
import { Card, Empty, PageHeader, Stat, td, th } from "@/components/ui";
import { actividad, enUltimas, hace, resumenCaja } from "@/lib/derive";

export default function Resumen() {
  const { data, ix, inv } = useData();
  const feed = useMemo(() => actividad(data, ix), [data, ix]);

  const dentro = inv.filter((h) => h.dentro).length;
  const fuera = inv.filter((h) => h.dentro === false);
  const denegados = data.accesos.filter((a) => a.resultado === "denegado" && enUltimas(a.fechaYHora, 24)).length;
  const alarmas = data.cajas.filter((c) => c.estaActivaProtocoloDeAlarma);

  return (
    <>
      <PageHeader title="Resumen" subtitle="Estado actual de las cajas y herramientas ToolNest." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Cajas" value={data.cajas.length} hint={`${data.cajas.filter((c) => c.estaBloqueada).length} bloqueadas`} />
        <Stat label="Herramientas en caja" value={dentro} hint={`de ${inv.length} etiquetas registradas`} tono="ok" />
        <Stat label="Herramientas fuera" value={fuera.length} tono={fuera.length ? "warn" : "ok"} hint="Retiradas de su caja" />
        <Stat label="Accesos denegados" value={denegados} tono={denegados ? "bad" : "ok"} hint="Últimas 24 h" />
      </div>

      {alarmas.length > 0 && (
        <div role="alert" className="mt-6 rounded-card border border-bad/30 bg-bad-bg px-5 py-3 text-sm text-bad">
          <strong>Alarma activa en:</strong>{" "}
          {alarmas.map((c, i) => (
            <span key={c.cajaID}>{i > 0 && ", "}<Link className="underline" href={`/cajas/${c.cajaID}`}>{c.nombreDeCaja}</Link></span>
          ))}
        </div>
      )}

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-ink-muted">Cajas</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.cajas.map((c) => {
          const r = resumenCaja(c, inv);
          return (
            <Link key={c.cajaID} href={`/cajas/${c.cajaID}`} className="block rounded-card border border-line bg-surface p-5 shadow-card transition hover:border-brand-500">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-ink">{c.nombreDeCaja}</h3>
                  <p className="text-xs text-ink-muted">{c.localizacionAproximada ?? "Sin ubicación"}</p>
                </div>
                <span className="text-xs text-ink-muted">{ix.equipo.get(c.equipoID)?.nombreDeEquipo}</span>
              </div>
              <div className="mt-4 flex gap-6 text-sm">
                <p><span className="text-2xl font-semibold text-ink">{r.dentro}</span> <span className="text-ink-muted">dentro</span></p>
                <p><span className="text-2xl font-semibold text-ink">{r.fuera}</span> <span className="text-ink-muted">fuera</span></p>
              </div>
              <div className="mt-4"><CajaFlags caja={c} /></div>
            </Link>
          );
        })}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card title="Herramientas fuera de su caja" flush action={<Link href="/herramientas?estado=fuera" className="text-sm text-brand-600 hover:underline">Ver todas</Link>}>
          {fuera.length === 0 ? <Empty>Todas las herramientas están en su caja.</Empty> : (
            <div className="overflow-x-auto"><table className="w-full">
              <thead className="bg-canvas"><tr><th className={th}>Herramienta</th><th className={th}>Retirada por</th><th className={th}>Caja</th></tr></thead>
              <tbody className="divide-y divide-line">
                {fuera.map((h) => (
                  <tr key={h.etiqueta.epc}>
                    <td className={td}>
                      <Link href={`/herramientas?epc=${h.etiqueta.epc}`} className="font-medium text-brand-600 hover:underline">{h.objeto?.nombreDeObjeto ?? h.etiqueta.epc}</Link>
                      <p className="text-xs text-ink-muted">{h.ultimo && hace(h.ultimo.fechaYHora)}</p>
                    </td>
                    <td className={td}>{h.custodio?.usuario?.nombreDeUsuario ?? <span className="text-ink-muted">Desconocido</span>}</td>
                    <td className={td}><CajaLink id={h.cajaID} ix={ix} /></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </Card>
        <Card title="Actividad reciente" flush action={<Link href="/actividad" className="text-sm text-brand-600 hover:underline">Ver todo</Link>}>
          <ActividadList items={feed.slice(0, 8)} ix={ix} />
        </Card>
      </div>
    </>
  );
}
