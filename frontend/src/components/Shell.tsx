"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { DataProvider, useData } from "./DataProvider";
import { Icon } from "./ui";
import { hace } from "@/lib/derive";

const NAV = [
  { href: "/", label: "Resumen", icon: "home" },
  { href: "/cajas", label: "Cajas", icon: "box" },
  { href: "/herramientas", label: "Herramientas", icon: "tool" },
  { href: "/usuarios", label: "Usuarios", icon: "users" },
  { href: "/actividad", label: "Actividad", icon: "list" },
  { href: "/asistente", label: "Asistente IA", icon: "chat" },
] as const;

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="flex min-h-screen">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-surface focus:p-3">
        Saltar al contenido
      </a>

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-60 bg-sidebar text-white transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <Link href="/" className="flex h-16 items-center gap-2 px-5 text-lg font-bold" onClick={() => setOpen(false)}>
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-500">
            <Icon name="box" className="h-5 w-5" />
          </span>
          ToolNest
        </Link>
        <nav aria-label="Principal" className="mt-2 px-3">
          <ul className="space-y-1">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(n.href) ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive(n.href) ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon name={n.icon} />
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      {open && <button aria-label="Cerrar menú" className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setOpen(false)} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <DataProvider>
          <TopBar onMenu={() => setOpen(true)} />
          <main id="contenido" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </DataProvider>
      </div>
    </div>
  );
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const { source, error, updatedAt, refresh, refreshing } = useData();
  return (
    <>
      <header className="flex h-16 items-center gap-3 border-b border-line bg-surface px-4 sm:px-6">
        <button onClick={onMenu} aria-label="Abrir menú" className="rounded-md p-2 text-ink-muted hover:bg-canvas md:hidden">
          <Icon name="menu" />
        </button>
        <span className="flex items-center gap-2 text-sm text-ink-muted">
          <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${source === "live" ? "bg-ok" : "bg-warn"}`} />
          {source === "live" ? "Conectado a la base de datos" : "Modo demostración"}
        </span>
        <span className="ml-auto hidden text-xs text-ink-muted sm:inline">Actualizado {hace(new Date(updatedAt).toISOString())}</span>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-60 max-sm:ml-auto"
        >
          <Icon name="refresh" className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Actualizar
        </button>
      </header>
      {source === "demo" && (
        <div role="status" className="border-b border-warn/20 bg-warn-bg px-4 py-2 text-sm text-warn sm:px-6">
          No se pudo contactar al backend ({error}). Se muestran datos de ejemplo.
        </div>
      )}
    </>
  );
}
