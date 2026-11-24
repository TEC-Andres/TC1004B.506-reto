"use client";

import { useState } from "react";
import { useData } from "@/components/DataProvider";
import { Avatar, Card, Empty, PageHeader } from "@/components/ui";
import { askAI } from "@/lib/api";
import { fmtFecha } from "@/lib/derive";
import type { ConsultaIA } from "@/lib/types";

const SUGERENCIAS = [
  "¿Qué herramientas están fuera de su caja?",
  "¿Quién abrió la Caja Taller A hoy?",
  "¿Hubo accesos denegados en las últimas 24 horas?",
];

export default function Asistente() {
  const { data, ix, source, refresh } = useData();
  const [nuevas, setNuevas] = useState<ConsultaIA[]>([]);
  const [pregunta, setPregunta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Drop local answers once the refreshed table already contains them.
  const guardadas = new Set(data.consultasIA.map((c) => c.consultaID));
  const consultas = [...data.consultasIA, ...nuevas.filter((c) => !guardadas.has(c.consultaID))]
    .sort((a, b) => Date.parse(a.fechaDeConsulta) - Date.parse(b.fechaDeConsulta));

  async function enviar(texto: string) {
    const p = texto.trim();
    if (!p || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      if (source === "demo") throw new Error("el backend no está disponible (modo demostración)");
      const r = await askAI(p);
      setNuevas((n) => [...n, r]);
      setPregunta("");
      refresh();
    } catch (e) {
      setError(`No se pudo enviar la pregunta: ${e instanceof Error ? e.message : e}`);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <PageHeader title="Asistente IA" subtitle="Pregunta en lenguaje natural sobre las cajas, herramientas y accesos." />
      <Card flush>
        {consultas.length === 0 ? <Empty>Aún no hay consultas. Escribe una pregunta abajo.</Empty> : (
          <ul className="max-h-[60vh] space-y-5 overflow-y-auto p-5">
            {consultas.map((c) => {
              const autor = ix.usuario.get(c.idUsuario)?.nombreDeUsuario ?? "Usuario";
              return (
                <li key={c.consultaID} className="space-y-2">
                  <div className="flex items-start gap-3">
                    <Avatar nombre={autor} />
                    <div>
                      <p className="text-xs text-ink-muted">{autor} · {fmtFecha(c.fechaDeConsulta)}</p>
                      <p className="mt-0.5 text-sm font-medium">{c.pregunta}</p>
                    </div>
                  </div>
                  <div className="ml-12 whitespace-pre-line rounded-card border border-line bg-canvas px-4 py-3 text-sm">{c.respuesta}</div>
                </li>
              );
            })}
          </ul>
        )}
        <form onSubmit={(e) => { e.preventDefault(); enviar(pregunta); }} className="border-t border-line p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {SUGERENCIAS.map((s) => (
              <button key={s} type="button" onClick={() => setPregunta(s)} className="rounded-full border border-line px-3 py-1 text-xs text-ink-muted hover:border-brand-500 hover:text-ink">
                {s}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <label htmlFor="pregunta" className="sr-only">Pregunta</label>
            <input
              id="pregunta"
              value={pregunta}
              onChange={(e) => setPregunta(e.target.value)}
              maxLength={500}
              placeholder="Escribe tu pregunta…"
              className="h-10 flex-1 rounded-card border border-line px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            <button type="submit" disabled={enviando || !pregunta.trim()} className="h-10 rounded-card bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
              {enviando ? "Enviando…" : "Preguntar"}
            </button>
          </div>
          {error && <p role="alert" className="mt-2 text-sm text-bad">{error}</p>}
        </form>
      </Card>
    </>
  );
}
