"use client";

import Link from "next/link";
import { useState } from "react";
import { useData } from "@/components/DataProvider";
import { CajaLink } from "@/components/domain";
import { Avatar, Badge, Card, Empty, Estado, PageHeader, SearchInput, td, th } from "@/components/ui";
import { accesosDe, fmtDia, fmtFecha, hace } from "@/lib/derive";
import type { Usuario } from "@/lib/types";

export default function Usuarios() {
  const { data } = useData();
  const [q, setQ] = useState("");
  const [selId, setSelId] = useState<number | null>(data.usuarios[0]?.idUsuario ?? null);
  const lista = data.usuarios.filter((u) => u.nombreDeUsuario.toLowerCase().includes(q.trim().toLowerCase()));
  const sel = data.usuarios.find((u) => u.idUsuario === selId);

  return (
    <>
      <PageHeader title="Usuarios" subtitle="Personas registradas, sus tarjetas, permisos y herramientas a su cargo." />
      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <Card flush>
          <div className="border-b border-line p-3">
            <SearchInput value={q} onChange={setQ} label="Buscar usuario" placeholder="Buscar usuario…" className="" />
          </div>
          {lista.length === 0 ? <Empty>Sin coincidencias.</Empty> : (
            <ul className="divide-y divide-line">
              {lista.map((u) => (
                <li key={u.idUsuario}>
                  <button
                    onClick={() => setSelId(u.idUsuario)}
                    aria-pressed={u.idUsuario === selId}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left ${u.idUsuario === selId ? "bg-brand-50" : "hover:bg-canvas"}`}
                  >
                    <Avatar nombre={u.nombreDeUsuario} foto={u.fotoDePerfil} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{u.nombreDeUsuario}</span>
                      <span className="block truncate text-xs text-ink-muted">{u.descripcion ?? "—"}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        {sel ? <Detalle u={sel} /> : <Card><Empty>Selecciona un usuario.</Empty></Card>}
      </div>
    </>
  );
}

function Detalle({ u }: { u: Usuario }) {
  const { data, ix, inv } = useData();
  const tarjetas = data.rfid.filter((r) => r.idUsuario === u.idUsuario);
  const ids = new Set(tarjetas.map((t) => t.tarjetaID));
  const equipos = data.equipos.filter((e) => e.idUsuario === u.idUsuario);
  const permisos = data.permisos.filter((p) => p.idUsuario === u.idUsuario);
  const aCargo = inv.filter((h) => h.dentro === false && h.custodio?.usuario?.idUsuario === u.idUsuario);
  const accesos = accesosDe(data, (a) => a.tarjetaID != null && ids.has(a.tarjetaID)).slice(0, 8);

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center gap-4">
          <Avatar nombre={u.nombreDeUsuario} foto={u.fotoDePerfil} />
          <div>
            <h2 className="text-lg font-semibold">{u.nombreDeUsuario}</h2>
            <p className="text-sm text-ink-muted">
              {u.descripcion ?? "Sin descripción"} · Registrado {fmtDia(u.fechaDeCreacion)}
              {equipos.length > 0 && <> · Responsable de {equipos.map((e) => e.nombreDeEquipo).join(", ")}</>}
            </p>
          </div>
        </div>
      </Card>

      <Card title={`Herramientas a su cargo (${aCargo.length})`} flush>
        {aCargo.length === 0 ? <Empty>No tiene herramientas fuera de las cajas.</Empty> : (
          <ul className="divide-y divide-line">
            {aCargo.map((h) => (
              <li key={h.etiqueta.epc} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <Link href={`/herramientas?epc=${h.etiqueta.epc}`} className="font-medium text-brand-600 hover:underline">{h.objeto?.nombreDeObjeto}</Link>
                <span className="text-ink-muted">de <CajaLink id={h.cajaID} ix={ix} /> · {h.ultimo && hace(h.ultimo.fechaYHora)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Tarjetas RFID" flush>
          {tarjetas.length === 0 ? <Empty>Sin tarjetas asignadas.</Empty> : (
            <ul className="divide-y divide-line">
              {tarjetas.map((t) => (
                <li key={t.tarjetaID} className="flex items-center justify-between px-5 py-3">
                  <span className="font-mono text-sm">{t.tarjetaID}</span>
                  <Estado activo={t.estatus} si="Activa" no="Inactiva" />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Permisos por caja" flush>
          {permisos.length === 0 ? <Empty>Sin permisos asignados.</Empty> : (
            <ul className="divide-y divide-line">
              {permisos.map((p) => (
                <li key={p.cajaID} className="flex items-center justify-between px-5 py-3 text-sm">
                  <CajaLink id={p.cajaID} ix={ix} />
                  <Badge tono={p.tienePermiso ? "ok" : "bad"}>{p.tienePermiso ? "Permitido" : "Revocado"}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Accesos recientes" flush>
        {accesos.length === 0 ? <Empty>Sin intentos de acceso.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-canvas"><tr><th className={th}>Fecha</th><th className={th}>Caja</th><th className={th}>Resultado</th><th className={th}>Motivo</th></tr></thead>
              <tbody className="divide-y divide-line">
                {accesos.map((a) => (
                  <tr key={a.accesoID}>
                    <td className={`${td} whitespace-nowrap text-ink-muted`}>{fmtFecha(a.fechaYHora)}</td>
                    <td className={td}><CajaLink id={a.cajaID} ix={ix} /></td>
                    <td className={td}><Badge tono={a.resultado === "autorizado" ? "ok" : "bad"}>{a.resultado === "autorizado" ? "Autorizado" : "Denegado"}</Badge></td>
                    <td className={`${td} text-ink-muted`}>{a.motivo ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
