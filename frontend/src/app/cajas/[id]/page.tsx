"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { useData } from "@/components/DataProvider";
import { ActividadList, CajaFlags, EstadoHerramientaBadge } from "@/components/domain";
import { Sparkline } from "@/components/Sparkline";
import { Badge, Card, Empty, Estado, Icon, PageHeader, td, th } from "@/components/ui";
import { accesosDe, actividad, controladorDe, fmtDia, fmtFecha, hace, lecturasDe } from "@/lib/derive";

export default function CajaDetalle() {
  const { id } = useParams<{ id: string }>();
  const { data, ix, inv } = useData();
  const caja = ix.caja.get(Number(id));
  const feed = useMemo(() => actividad(data, ix).filter((a) => a.cajaID === Number(id)), [data, ix, id]);

  if (!caja) {
    return (
      <>
        <PageHeader title="Caja no encontrada" />
        <Link href="/cajas" className="text-brand-600 hover:underline">Volver a cajas</Link>
      </>
    );
  }

  const ctrl = controladorDe(data, caja.cajaID);
  const sensores = data.sensores.filter((s) => s.controladorID === ctrl?.controladorID);
  const actuadores = data.actuadores.filter((a) => a.controladorID === ctrl?.controladorID);
  const contenido = inv.filter((h) => h.cajaID === caja.cajaID);
  const accesos = accesosDe(data, (a) => a.cajaID === caja.cajaID).slice(0, 10);
  const permisos = data.permisos.filter((p) => p.cajaID === caja.cajaID);
  const ultimaAccion = (actuadorID: number) =>
    data.eventosActuadores.filter((e) => e.actuadorID === actuadorID).sort((a, b) => Date.parse(b.fechaYHora) - Date.parse(a.fechaYHora))[0];

  return (
    <>
      <Link href="/cajas" className="mb-3 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <Icon name="back" className="h-4 w-4" /> Cajas
      </Link>
      <PageHeader title={caja.nombreDeCaja} subtitle={`${caja.localizacionAproximada ?? "Sin ubicación"} · ${ix.equipo.get(caja.equipoID)?.nombreDeEquipo ?? "Sin equipo"}`}>
        <CajaFlags caja={caja} />
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title={`Contenido (${contenido.filter((h) => h.dentro).length} en caja)`} flush>
            {contenido.length === 0 ? <Empty>El lector no ha registrado herramientas en esta caja.</Empty> : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-canvas"><tr><th className={th}>Herramienta</th><th className={th}>Categoría</th><th className={th}>Estado</th><th className={th}>Último movimiento</th></tr></thead>
                  <tbody className="divide-y divide-line">
                    {contenido.map((h) => (
                      <tr key={h.etiqueta.epc}>
                        <td className={td}>
                          <Link href={`/herramientas?epc=${h.etiqueta.epc}`} className="font-medium text-brand-600 hover:underline">{h.objeto?.nombreDeObjeto ?? "Objeto desconocido"}</Link>
                          <p className="text-xs text-ink-muted">{h.objeto?.fabricante} · EPC …{h.etiqueta.epc.slice(-4)}</p>
                        </td>
                        <td className={td}>{h.objeto?.categoria ?? "—"}</td>
                        <td className={td}>
                          <EstadoHerramientaBadge h={h} />
                          {h.custodio?.usuario && <p className="mt-1 text-xs text-ink-muted">Con {h.custodio.usuario.nombreDeUsuario}</p>}
                        </td>
                        <td className={`${td} text-ink-muted`}>{h.ultimo ? hace(h.ultimo.fechaYHora) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Intentos de acceso" flush>
            {accesos.length === 0 ? <Empty>Sin intentos de acceso.</Empty> : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-canvas"><tr><th className={th}>Fecha</th><th className={th}>Usuario</th><th className={th}>Resultado</th><th className={th}>Motivo</th></tr></thead>
                  <tbody className="divide-y divide-line">
                    {accesos.map((a) => (
                      <tr key={a.accesoID}>
                        <td className={`${td} whitespace-nowrap text-ink-muted`}>{fmtFecha(a.fechaYHora)}</td>
                        <td className={td}>{ix.usuarioDeTarjeta(a.tarjetaID)?.nombreDeUsuario ?? <span className="font-mono text-xs">{a.codigoLeido}</span>}</td>
                        <td className={td}><Badge tono={a.resultado === "autorizado" ? "ok" : "bad"}>{a.resultado === "autorizado" ? "Autorizado" : "Denegado"}</Badge></td>
                        <td className={`${td} text-ink-muted`}>{a.motivo ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Actividad de la caja" flush>
            <ActividadList items={feed.slice(0, 15)} ix={ix} showCaja={false} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Controlador">
            {ctrl ? (
              <dl className="grid grid-cols-2 gap-y-2 text-sm">
                <dt className="text-ink-muted">Nombre</dt><dd>{ctrl.nombreControlador}</dd>
                <dt className="text-ink-muted">Modelo</dt><dd>{ctrl.modelo}</dd>
                <dt className="text-ink-muted">Identificador</dt><dd className="font-mono text-xs">{ctrl.identificador ?? "—"}</dd>
                <dt className="text-ink-muted">Estatus</dt><dd><Estado activo={ctrl.estatus} si="En línea" /></dd>
                <dt className="text-ink-muted">Registrada</dt><dd>{fmtDia(caja.fechaDeCreacion)}</dd>
              </dl>
            ) : <p className="text-sm text-ink-muted">Sin controlador asignado.</p>}
          </Card>

          <Card title="Sensores" flush>
            {sensores.length === 0 ? <Empty>Sin sensores.</Empty> : (
              <ul className="divide-y divide-line">
                {sensores.map((s) => {
                  const lecturas = lecturasDe(data, s.sensorID);
                  const ultima = lecturas.at(-1);
                  const serie = lecturas.filter((l) => l.valorNumerico != null).map((l) => ({ fecha: l.fechaYHora, valor: l.valorNumerico! }));
                  return (
                    <li key={s.sensorID} className="px-5 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{s.nombreSensor}</p>
                          <p className="text-xs text-ink-muted">{s.tipoSensor} · {s.modelo}</p>
                        </div>
                        <Estado activo={s.estatus} />
                      </div>
                      {ultima && (
                        <p className="mt-2 text-sm">
                          <span className="font-semibold">{ultima.valorNumerico ?? ultima.valorTexto}</span>{" "}
                          <span className="text-ink-muted">{ultima.unidad}{ultima.valorNumerico != null && ultima.valorTexto ? ` · ${ultima.valorTexto}` : ""} · {hace(ultima.fechaYHora)}</span>
                        </p>
                      )}
                      {serie.length > 1 && (
                        <div className="mt-2">
                          <Sparkline points={serie} unidad={ultima?.unidad ?? null} label={s.nombreSensor} />
                          <p className="text-xs text-ink-muted">Últimas {serie.length} lecturas</p>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title="Actuadores" flush>
            {actuadores.length === 0 ? <Empty>Sin actuadores.</Empty> : (
              <ul className="divide-y divide-line">
                {actuadores.map((a) => {
                  const ev = ultimaAccion(a.actuadorID);
                  return (
                    <li key={a.actuadorID} className="flex items-start justify-between gap-2 px-5 py-3">
                      <div>
                        <p className="text-sm font-medium">{a.nombreActuador}</p>
                        <p className="text-xs text-ink-muted">{a.tipoActuador} · {a.modelo}</p>
                        {ev && <p className="mt-1 text-xs text-ink-muted">Última acción: {ev.accion}, {hace(ev.fechaYHora)}</p>}
                      </div>
                      <Estado activo={a.estatus} />
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title="Permisos de acceso" flush>
            {permisos.length === 0 ? <Empty>Nadie tiene permiso asignado.</Empty> : (
              <ul className="divide-y divide-line">
                {permisos.map((p) => (
                  <li key={p.idUsuario} className="flex items-center justify-between px-5 py-3 text-sm">
                    <span>{ix.usuario.get(p.idUsuario)?.nombreDeUsuario ?? `Usuario ${p.idUsuario}`}</span>
                    <Badge tono={p.tienePermiso ? "ok" : "bad"}>{p.tienePermiso ? "Permitido" : "Revocado"}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
