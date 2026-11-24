// Run: npm test   (node --test, Node >= 23 strips the TypeScript types)
import { test } from "node:test";
import assert from "node:assert/strict";
import { actividad, indexes, inventario } from "./derive.ts";
import { demoData } from "./mock.ts";

const d = demoData(Date.parse("2026-01-01T12:00:00Z"));
const ix = indexes(d);
const inv = inventario(d, ix);
const byEpc = (n: number) => inv.find((h) => h.etiqueta.epc.endsWith(`A00${n}`))!;

test("tool that left is outside and attributed to the last authorized opener", () => {
  const taladro = byEpc(1);
  assert.equal(taladro.dentro, false);
  assert.equal(taladro.cajaID, 1);
  assert.equal(taladro.custodio?.usuario?.nombreDeUsuario, "Carlos Ruiz");
});

test("tool that left and came back is inside with no custodian", () => {
  const h = byEpc(6);
  assert.equal(h.dentro, true);
  assert.equal(h.custodio, null);
});

test("detection counts as inside", () => {
  assert.equal(byEpc(4).dentro, true);
  assert.equal(byEpc(4).cajaID, 3);
});

test("access user is resolved through RFID, unknown card stays null", () => {
  assert.equal(ix.usuarioDeTarjeta("B2C3D4E5")?.nombreDeUsuario, "Ana Gómez");
  assert.equal(ix.usuarioDeTarjeta(null), null);
});

test("activity feed is newest first and includes every log table", () => {
  const feed = actividad(d, ix);
  const times = feed.map((f) => Date.parse(f.fecha));
  assert.deepEqual(times, [...times].sort((a, b) => b - a));
  assert.deepEqual(new Set(feed.map((f) => f.tipo)), new Set(["acceso", "inventario", "actuador", "historial"]));
  assert.ok(feed.some((f) => f.titulo.includes("etiqueta desconocida")));
});
