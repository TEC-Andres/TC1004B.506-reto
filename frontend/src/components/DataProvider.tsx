"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { loadAll, type Source } from "@/lib/api";
import { indexes, inventario, type EstadoHerramienta, type Ix } from "@/lib/derive";
import type { Data } from "@/lib/types";

const REFRESH_MS = 30_000;

type Ctx = {
  data: Data;
  ix: Ix;
  inv: EstadoHerramienta[];
  source: Source;
  error?: string;
  updatedAt: number;
  refreshing: boolean;
  refresh: () => void;
};

const DataContext = createContext<Ctx | null>(null);

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside <DataProvider>");
  return ctx;
}

// shortcut: loads every table on each refresh; fine for a few boxes, add per-page endpoints if tables grow large.
export function DataProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ data: Data; source: Source; error?: string; updatedAt: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const r = await loadAll();
    setState({ ...r, updatedAt: Date.now() });
    setRefreshing(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const value = useMemo(() => {
    if (!state) return null;
    const ix = indexes(state.data);
    return { ...state, ix, inv: inventario(state.data, ix), refreshing, refresh };
  }, [state, refreshing, refresh]);

  if (!value) {
    return (
      <div className="flex flex-1 items-center justify-center p-12 text-ink-muted" role="status">
        Cargando datos de ToolNest…
      </div>
    );
  }
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
