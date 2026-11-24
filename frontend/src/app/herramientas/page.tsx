"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useData } from "@/components/DataProvider";
import { CajaLink, EstadoHerramientaBadge } from "@/components/domain";
import { Card, Empty, PageHeader, SearchInput, Select, td, th } from "@/components/ui";
import { eventosDeEpc, fmtDia, fmtFecha, hace, type EstadoHerramienta } from "@/lib/derive";

export default function Page() {
  return <Suspense><Herramientas /></Suspense>;
}

const ESTADOS: [string, string][] = [["todas", "Todos los estados"], ["dentro", "En caja"], ["fuera", "Fuera"], ["sin", "Sin lecturas"]];

function Herramientas() {
  const params = useSearchParams();
  const { data, ix, inv } = useData();
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState(params.get("estado") ?? "todas");
  const [caja, setCaja] = useState("todas");
  const [epc, setEpc] = useState(params.get("epc"));

  const needle = q.trim().toLowerCase();
  const rows = inv.filter((h) => {
    const o = h.objeto;
    const text = `${o?.nombreDeObjeto} ${o?.categoria} ${o?.fabricante} ${h.etiqueta.epc}`.toLowerCase();
    if (needle && !text.includes(needle)) return false;
    if (estado === "dentro" && h.dentro !== true) return false;
    if (estado === "fuera" && h.dentro !== false) return false;
    if (estado === "sin" && h.dentro !== null) return false;
    if (caja !== "todas" && String(h.cajaID) !== caja) return false;
    return true;
  });
  const sel = inv.find((h) => h.etiqueta.epc === epc) ?? null;

  return (
    <>
      <PageHeader title="Herramientas" subtitle="Catálogo de objetos con etiqueta RFID UHF y dónde está cada uno.">
        <div className="flex flex-wrap gap-2">
          <SearchInput value={q} onChange={setQ} label="Buscar herramienta" placeholder="Buscar herramienta, marca o EPC…" />
          <Select value={estado} onChange={setEstado} label="Filtrar por estado" options={ESTADOS} />
          <Select value={caja} onChange={setCaja} label="Filtrar por caja"
            options={[["todas", "Todas las cajas"], ...data.cajas.map((c): [string, string] => [String(c.cajaID), c.nombreDeCaja])]} />
        </div>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card flush className={sel ? "lg:col-span-2" : "lg:col-span-3"}>
          {rows.length === 0 ? <Empty>No se encontraron herramientas con esos filtros.</Empty> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-canvas">
                  <tr><th className={th}>Herramienta</th><th className={th}>Categoría</th><th className={th}>Estado</th><th className={th}>Caja</th><th className={th}>Último movimiento</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((h) => {
                    const active = h.etiqueta.epc === epc;
                    return (
                      <tr key={h.etiqueta.epc} className={active ? "bg-brand-50" : "hover:bg-canvas/60"}>
                        <td className={td}>
                          <button onClick={() => setEpc(active ? null : h.etiqueta.epc)} aria-pressed={active} className="text-left font-medium text-brand-600 hover:underline">
                            {h.objeto?.nombreDeObjeto ?? "Objeto desconocido"}
                          </button>
                          <p className="text-xs text-ink-muted">{h.objeto?.fabricante} · EPC …{h.etiqueta.epc.slice(-4)}</p>
                        </td>
                        <td className={td}>{h.objeto?.categoria ?? "—"}</td>
                        <td className={td}><EstadoHerramientaBadge h={h} /></td>
                        <td className={td}><CajaLink id={h.cajaID} ix={ix} /></td>
                        <td className={`${td} text-ink-muted`}>{h.ultimo ? hace(h.ultimo.fechaYHora) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        {sel && <Detalle h={sel} onClose={() => setEpc(null)} />}
      </div>
    </>
  );
}

function Detalle({ h, onClose }: { h: EstadoHerramienta; onClose: () => void }) {
  const { data, ix } = useData();
  const eventos = eventosDeEpc(data, h.etiqueta.epc);
  const verbo = { deteccion: "Detectada", entrada: "Entrada", salida: "Salida" } as const;
  return (
    <Card title={h.objeto?.nombreDeObjeto ?? "Objeto desconocido"} action={<button onClick={onClose} className="text-sm text-ink-muted hover:text-ink">Cerrar</button>}>
      <div className="mb-4"><EstadoHerramientaBadge h={h} /></div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-ink-muted">Fabricante</dt><dd>{h.objeto?.fabricante ?? "—"}</dd>
        <dt className="text-ink-muted">Categoría</dt><dd>{h.objeto?.categoria ?? "—"}</dd>
        <dt className="text-ink-muted">Caja</dt><dd><CajaLink id={h.cajaID} ix={ix} /></dd>
        {h.dentro === false && (
          <>
            <dt className="text-ink-muted">Retirada por</dt>
            <dd>
              {h.custodio?.usuario?.nombreDeUsuario ?? "Desconocido"}
              {h.custodio && <p className="text-xs text-ink-muted">Según el acceso de {fmtFecha(h.custodio.acceso.fechaYHora)}</p>}
            </dd>
          </>
        )}
        <dt className="text-ink-muted">EPC</dt><dd className="break-all font-mono text-xs">{h.etiqueta.epc}</dd>
        <dt className="text-ink-muted">Etiqueta</dt><dd>{h.etiqueta.estatus ? "Activa" : "Inactiva"} · desde {fmtDia(h.etiqueta.fechaDeRegistro)}</dd>
      </dl>
      {h.objeto?.descripcion && <p className="mt-4 text-sm text-ink-muted">{h.objeto.descripcion}</p>}

      <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-ink-muted">Historial de movimientos</h3>
      {eventos.length === 0 ? <p className="text-sm text-ink-muted">Sin lecturas del lector UHF.</p> : (
        <ol className="space-y-2 border-l-2 border-line pl-4">
          {eventos.map((e) => (
            <li key={e.eventoInventarioID} className="text-sm">
              <span className="font-medium">{verbo[e.tipoEvento]}</span>{" "}
              <span className="text-ink-muted">· {ix.caja.get(ix.cajaDeSensor(e.sensorID) ?? -1)?.nombreDeCaja ?? "—"} · {fmtFecha(e.fechaYHora)}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
