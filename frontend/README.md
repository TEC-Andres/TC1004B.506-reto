# ToolNest — frontend

Dashboard (Next.js 16 + Tailwind 4) for the ToolNest smart boxes: what is inside each box,
who opened it, sensor readings and the AI assistant.

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # derive.ts tests (node --test, Node >= 23)
npm run lint
```

Without a backend the app shows **demo data** (`src/lib/mock.ts`) and a yellow banner.

## Pages

| Route | Shows |
| --- | --- |
| `/` | KPIs, box cards, tools outside their box, latest activity |
| `/cajas`, `/cajas/[id]` | Boxes; per box: contents, access attempts, controller, sensors (with trend), actuators, permissions |
| `/herramientas` | Tool catalog with search/filters; detail with movement history and who took it |
| `/usuarios` | Users with RFID cards, box permissions, tools in their custody, recent accesses |
| `/actividad` | Accesos + EventosInventario + EventosActuadores + Historial in one filterable feed |
| `/asistente` | ConsultasIA history and a question box |

## Code map

- `src/lib/types.ts` — one type per database table, same column names.
- `src/lib/api.ts` — endpoint per table; loads all of them at once.
- `src/lib/derive.ts` — pure logic: box of a sensor, tool state, custodian, activity feed.
- `src/components/DataProvider.tsx` — fetches every 30 s, exposes `useData()`.
- `src/components/ui.tsx` — Card, Badge, Stat, inputs, icons. Colors come from tokens in `src/app/globals.css`.

## Backend contract

`/api/*` is proxied to `BACKEND_URL` (default `http://localhost:3001`, see `next.config.ts`).
Each table is a `GET` that returns a JSON array of rows using the column names in `types.ts`:

| Endpoint | Table |
| --- | --- |
| `GET /objetos` | Objeto |
| `GET /usuarios` | Usuario — **never include `hashContrasena`** |
| `GET /equipos` | Equipo |
| `GET /cajas` | Caja |
| `GET /rfid` | RFID |
| `GET /controladores` | Controladores |
| `GET /sensores` | Sensores |
| `GET /actuadores` | Actuadores |
| `GET /etiquetas-herramienta` | EtiquetasHerramienta |
| `GET /permisos-acceso` | PermisosAcceso |
| `GET /lecturas-sensores` | LecturasSensores |
| `GET /eventos-inventario` | EventosInventario |
| `GET /accesos` | Accesos |
| `GET /eventos-actuadores` | EventosActuadores |
| `GET /historial` | Historial |
| `GET /consultas-ia` | ConsultasIA |
| `POST /consultas-ia` `{ "pregunta": string }` | returns the saved ConsultaIA row |

Value conventions:
- Dates as ISO 8601 strings.
- `estatus`, `estaBloqueada`, `tieneLucesEncendidas`, `estaActivaProtocoloDeAlarma`, `tienePermiso` as JSON booleans (MySQL `TINYINT` → `true/false`).
- `EventosInventario.tipoEvento`: `"deteccion" | "entrada" | "salida"`.
- `Accesos.resultado`: `"autorizado" | "denegado"`.

If any endpoint fails the whole app falls back to demo data, so mixed live/demo rows never appear.

"Retirada por" is inferred: the last authorized access to the same box up to 15 minutes before the
tool's `salida` event (`CUSTODIO_VENTANA_MS` in `derive.ts`). The schema does not store it directly.
