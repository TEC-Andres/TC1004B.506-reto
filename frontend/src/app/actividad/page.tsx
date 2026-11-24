"use client";

import { useMemo, useState } from "react";
import { useData } from "@/components/DataProvider";
import { ActividadList } from "@/components/domain";
import { Card, PageHeader, SearchInput, Select } from "@/components/ui";
import { actividad } from "@/lib/derive";

const TIPOS: [string, string][] = [
  ["todas", "Todo"], ["acceso", "Accesos"], ["inventario", "Inventario"], ["actuador", "Actuadores"], ["historial", "Cambios"],
];
const PAGINA = 50;

export default function Actividad() {
  const { data, ix } = useData();
  const feed = useMemo(() => actividad(data, ix), [data, ix]);
  const [tipo, setTipo] = useState("todas");
  const [caja, setCaja] = useState("todas");
  const [q, setQ] = useState("");
  const [n, setN] = useState(PAGINA);

  const needle = q.trim().toLowerCase();
  const rows = feed.filter((a) =>
    (tipo === "todas" || a.tipo === tipo) &&
    (caja === "todas" || String(a.cajaID) === caja) &&
    (!needle || `${a.titulo} ${a.detalle}`.toLowerCase().includes(needle)),
  );

  return (
    <>
      <PageHeader title="Actividad" subtitle="Accesos, movimientos de inventario, acciones de actuadores e historial de cambios.">
        <div className="flex flex-wrap gap-2">
          <SearchInput value={q} onChange={setQ} label="Buscar en actividad" placeholder="Buscar…" />
          <Select value={tipo} onChange={setTipo} label="Tipo de evento" options={TIPOS} />
          <Select value={caja} onChange={setCaja} label="Caja"
            options={[["todas", "Todas las cajas"], ...data.cajas.map((c): [string, string] => [String(c.cajaID), c.nombreDeCaja])]} />
        </div>
      </PageHeader>
      <Card flush title={`${rows.length} eventos`}>
        <ActividadList items={rows.slice(0, n)} ix={ix} />
        {rows.length > n && (
          <div className="border-t border-line p-3 text-center">
            <button onClick={() => setN(n + PAGINA)} className="text-sm font-medium text-brand-600 hover:underline">Mostrar más</button>
          </div>
        )}
      </Card>
    </>
  );
}
