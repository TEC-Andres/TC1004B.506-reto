"use client";

import Link from "next/link";
import { useData } from "@/components/DataProvider";
import { CajaFlags } from "@/components/domain";
import { Card, Empty, PageHeader, td, th } from "@/components/ui";
import { controladorDe, resumenCaja } from "@/lib/derive";

export default function Cajas() {
  const { data, ix, inv } = useData();
  return (
    <>
      <PageHeader title="Cajas" subtitle="Cajas inteligentes registradas, su contenido y estado." />
      <Card flush>
        {data.cajas.length === 0 ? <Empty>No hay cajas registradas.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-canvas">
                <tr><th className={th}>Caja</th><th className={th}>Equipo</th><th className={th}>Contenido</th><th className={th}>Estado</th><th className={th}>Controlador</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.cajas.map((c) => {
                  const r = resumenCaja(c, inv);
                  const ctrl = controladorDe(data, c.cajaID);
                  return (
                    <tr key={c.cajaID} className="hover:bg-canvas/60">
                      <td className={td}>
                        <Link href={`/cajas/${c.cajaID}`} className="font-medium text-brand-600 hover:underline">{c.nombreDeCaja}</Link>
                        <p className="text-xs text-ink-muted">{c.localizacionAproximada ?? "Sin ubicación"}</p>
                      </td>
                      <td className={td}>{ix.equipo.get(c.equipoID)?.nombreDeEquipo ?? "—"}</td>
                      <td className={td}>{r.dentro} dentro · {r.fuera} fuera</td>
                      <td className={td}><CajaFlags caja={c} /></td>
                      <td className={td}>
                        {ctrl ? <>{ctrl.modelo}<p className="text-xs text-ink-muted">{ctrl.estatus ? "En línea" : "Inactivo"}</p></> : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
