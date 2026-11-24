import { fmtFecha } from "@/lib/derive";

// Single-series trend line. Hover a column to see its exact value (native tooltip).
export function Sparkline({ points, unidad, label }: { points: { fecha: string; valor: number }[]; unidad: string | null; label: string }) {
  if (points.length < 2) return null;
  const W = 300, H = 56, P = 4;
  const vals = points.map((p) => p.valor);
  const min = Math.min(...vals), max = Math.max(...vals);
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => H - P - ((v - min) / (max - min || 1)) * (H - 2 * P);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`).join("");
  const colW = W / points.length;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-14 w-full" role="img" aria-label={`${label}: mínimo ${min}, máximo ${max} ${unidad ?? ""}`}>
      <line x1={0} x2={W} y1={H - P} y2={H - P} stroke="var(--color-line)" vectorEffect="non-scaling-stroke" />
      <path d={d} fill="none" stroke="var(--color-brand-600)" strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {points.map((p, i) => (
        <rect key={i} x={x(i) - colW / 2} y={0} width={colW} height={H} fill="transparent" className="hover:fill-brand-500/10">
          <title>{`${p.valor} ${unidad ?? ""} · ${fmtFecha(p.fecha)}`}</title>
        </rect>
      ))}
    </svg>
  );
}
