// Demo rows shown when the backend is unreachable. Times are relative to "now"
// so the dashboard always looks current. Delete once the backend is live, if you like.
import type { Data, EventoInventario, LecturaSensor } from "./types";

export function demoData(now = Date.now()): Data {
  const ago = (min: number) => new Date(now - min * 60_000).toISOString();
  const day = 1440;

  const cajas = [
    { cajaID: 1, nombreDeCaja: "Caja Taller A", localizacionAproximada: "Edificio 4, taller de manufactura", equipoID: 1, estaBloqueada: true, tieneLucesEncendidas: false, estaActivaProtocoloDeAlarma: false },
    { cajaID: 2, nombreDeCaja: "Caja Obra Norte", localizacionAproximada: "Obra Av. Eugenio Garza Sada", equipoID: 2, estaBloqueada: false, tieneLucesEncendidas: true, estaActivaProtocoloDeAlarma: false },
    { cajaID: 3, nombreDeCaja: "Caja Laboratorio IoT", localizacionAproximada: "Aulas 3, laboratorio 302", equipoID: 1, estaBloqueada: true, tieneLucesEncendidas: false, estaActivaProtocoloDeAlarma: true },
  ].map((c) => ({ ...c, fechaDeCreacion: ago(60 * day) }));

  // Each box: 1 controller, 4 sensors, 4 actuators. IDs follow the box number.
  const controladores = cajas.map((c) => ({
    controladorID: c.cajaID, cajaID: c.cajaID, nombreControlador: `Controlador ${c.nombreDeCaja}`,
    modelo: "NodeMCU ESP8266", identificador: `ESP-00${c.cajaID}`, estatus: true,
  }));
  const sensorTipos = [
    { tipoSensor: "fotoresistencia", modelo: "GL5528", nombreSensor: "Luz interior", descripcion: "Detecta si la tapa está abierta." },
    { tipoSensor: "RFID", modelo: "MFRC522", nombreSensor: "Lector de tarjetas", descripcion: "Identifica al usuario que abre la caja." },
    { tipoSensor: "RFID UHF", modelo: "YRM100", nombreSensor: "Lector de herramientas", descripcion: "Lee las etiquetas EPC de las herramientas." },
    { tipoSensor: "TCRT5000", modelo: "TCRT5000", nombreSensor: "Sensor de tapa", descripcion: "Sensor infrarrojo de cierre." },
  ];
  const sensores = cajas.flatMap((c) =>
    sensorTipos.map((s, i) => ({ ...s, sensorID: c.cajaID * 10 + i + 1, controladorID: c.cajaID, estatus: true })),
  );
  const actuadorTipos = [
    { tipoActuador: "servomotor", modelo: "SG90", nombreActuador: "Cerradura", descripcion: "Bloquea y desbloquea la tapa." },
    { tipoActuador: "LED RGB", modelo: "WS2812", nombreActuador: "Iluminación", descripcion: "Luz interior e indicador de estado." },
    { tipoActuador: "LCD", modelo: "LCD 16x2 I2C", nombreActuador: "Pantalla", descripcion: "Muestra mensajes al usuario." },
    { tipoActuador: "buzzer", modelo: "Buzzer activo 5V", nombreActuador: "Alarma", descripcion: "Suena si hay acceso no autorizado." },
  ];
  const actuadores = cajas.flatMap((c) =>
    actuadorTipos.map((a, i) => ({ ...a, actuadorID: c.cajaID * 10 + i + 1, controladorID: c.cajaID, estatus: !(c.cajaID === 2 && i === 2) })),
  );
  const rfidSensor = (caja: number) => caja * 10 + 3; // YRM100 of each box

  const usuarios = [
    { idUsuario: 1, nombreDeUsuario: "Carlos Ruiz", descripcion: "Técnico de mantenimiento", sexo: "M" },
    { idUsuario: 2, nombreDeUsuario: "Ana Gómez", descripcion: "Supervisora de obra", sexo: "F" },
    { idUsuario: 3, nombreDeUsuario: "Luis Vera", descripcion: "Electricista", sexo: "M" },
    { idUsuario: 4, nombreDeUsuario: "María Treviño", descripcion: "Gerente de proyecto", sexo: "F" },
  ].map((u) => ({ ...u, fechaDeCreacion: ago(50 * day + u.idUsuario * day), fotoDePerfil: null }));

  const equipos = [
    { equipoID: 1, nombreDeEquipo: "Mantenimiento", idUsuario: 4, descripcion: "Taller y laboratorio." },
    { equipoID: 2, nombreDeEquipo: "Obra Norte", idUsuario: 2, descripcion: "Cuadrilla de construcción." },
  ].map((e) => ({ ...e, fechaDeCreacion: ago(55 * day), fotoDeEquipo: null }));

  const rfid = [
    { tarjetaID: "A1B2C3D4", idUsuario: 1, estatus: true },
    { tarjetaID: "B2C3D4E5", idUsuario: 2, estatus: true },
    { tarjetaID: "C3D4E5F6", idUsuario: 3, estatus: true },
    { tarjetaID: "D4E5F6A7", idUsuario: 4, estatus: true },
    { tarjetaID: "E5F6A7B8", idUsuario: 3, estatus: false },
  ];

  const permisos = [
    [1, 1, true], [1, 3, true], [2, 2, true], [3, 1, true], [3, 2, true], [3, 3, false], [4, 1, true], [4, 2, true], [4, 3, true],
  ].map(([idUsuario, cajaID, tienePermiso]) => ({
    idUsuario: idUsuario as number, cajaID: cajaID as number, tienePermiso: tienePermiso as boolean, fechaDeAsignacion: ago(40 * day),
  }));

  const objetos = [
    { objetoID: 1, nombreDeObjeto: "Taladro percutor", categoria: "Eléctricas", fabricante: "DeWalt", descripcion: "20V, incluye 2 baterías." },
    { objetoID: 2, nombreDeObjeto: "Sierra circular", categoria: "Corte", fabricante: "Bosch", descripcion: "Disco de 7 1/4\"." },
    { objetoID: 3, nombreDeObjeto: "Multímetro", categoria: "Medición", fabricante: "Fluke", descripcion: "Modelo 87V." },
    { objetoID: 4, nombreDeObjeto: "Nivel láser", categoria: "Medición", fabricante: "Bosch", descripcion: "GLL 3-80." },
    { objetoID: 5, nombreDeObjeto: "Esmeril angular", categoria: "Corte", fabricante: "Makita", descripcion: "4 1/2\", 840 W." },
    { objetoID: 6, nombreDeObjeto: "Juego de desarmadores", categoria: "Manuales", fabricante: "Truper", descripcion: "12 piezas." },
    { objetoID: 7, nombreDeObjeto: "Cautín", categoria: "Electrónica", fabricante: "Weller", descripcion: "Estación de 60 W." },
  ];
  const etiquetas = [
    ["E2000017221101441890A001", 1], ["E2000017221101441890A002", 1], ["E2000017221101441890A003", 2],
    ["E2000017221101441890A004", 3], ["E2000017221101441890A005", 4], ["E2000017221101441890A006", 5],
    ["E2000017221101441890A007", 6], ["E2000017221101441890A008", 7], ["E2000017221101441890A009", 3],
  ].map(([epc, objetoID]) => ({ epc: epc as string, objetoID: objetoID as number, fechaDeRegistro: ago(30 * day), estatus: true }));
  const epc = (n: number) => `E2000017221101441890A00${n}`;

  // [minutesAgo, box, epc#, tipo]
  const inv: [number, number, number, EventoInventario["tipoEvento"]][] = [
    [3 * day, 1, 1, "entrada"], [3 * day, 1, 2, "entrada"], [3 * day, 2, 3, "entrada"], [3 * day, 3, 4, "entrada"],
    [3 * day, 2, 5, "entrada"], [3 * day, 2, 6, "entrada"], [3 * day, 1, 7, "entrada"], [3 * day, 3, 8, "entrada"],
    [3 * day, 3, 9, "entrada"],
    [200, 1, 1, "salida"], [180, 2, 6, "salida"], [150, 2, 6, "entrada"], [95, 2, 5, "salida"],
    [60, 3, 4, "deteccion"], [60, 3, 8, "deteccion"], [42, 3, 9, "salida"], [20, 1, 2, "deteccion"], [20, 1, 7, "deteccion"],
  ];
  const eventosInventario = inv.map(([m, caja, n, tipoEvento], i) => ({
    eventoInventarioID: i + 1, sensorID: rfidSensor(caja), epcLeido: epc(n), tipoEvento, fechaYHora: ago(m),
  }));
  eventosInventario.push({ eventoInventarioID: 99, sensorID: rfidSensor(2), epcLeido: "E200FFFF0000000000000BAD", tipoEvento: "deteccion", fechaYHora: ago(10) });

  // [minutesAgo, box, tarjeta|null, codigo, resultado, motivo]
  const acc: [number, number, string | null, string, "autorizado" | "denegado", string][] = [
    [203, 1, "A1B2C3D4", "A1B2C3D4", "autorizado", "Permiso vigente"],
    [183, 2, "C3D4E5F6", "C3D4E5F6", "autorizado", "Permiso vigente"],
    [152, 2, "C3D4E5F6", "C3D4E5F6", "autorizado", "Permiso vigente"],
    [97, 2, "B2C3D4E5", "B2C3D4E5", "autorizado", "Permiso vigente"],
    [70, 3, "C3D4E5F6", "C3D4E5F6", "denegado", "Sin permiso para esta caja"],
    [45, 3, "D4E5F6A7", "D4E5F6A7", "autorizado", "Permiso vigente"],
    [30, 1, "E5F6A7B8", "E5F6A7B8", "denegado", "Tarjeta inactiva"],
    [12, 3, null, "99887766", "denegado", "Tarjeta no registrada"],
  ];
  const accesos = acc.map(([m, cajaID, tarjetaID, codigoLeido, resultado, motivo], i) => ({
    accesoID: i + 1, cajaID, tarjetaID, codigoLeido, resultado, motivo, fechaYHora: ago(m),
  }));

  // [minutesAgo, actuadorID, accion, detalle]
  const actEv: [number, number, string, string | null][] = [
    [203, 11, "abrir", "Cerradura liberada"], [190, 11, "cerrar", null],
    [97, 21, "abrir", "Cerradura liberada"], [97, 22, "encender", "Luz interior"],
    [45, 31, "abrir", "Cerradura liberada"], [40, 31, "cerrar", null],
    [12, 34, "activar alarma", "3 intentos fallidos"], [12, 33, "mostrar mensaje", "ACCESO DENEGADO"],
  ];
  const eventosActuadores = actEv.map(([m, actuadorID, accion, detalle], i) => ({
    eventoActuadorID: i + 1, actuadorID, accion, detalle, fechaYHora: ago(m),
  }));

  // Photoresistor: one reading every 30 min for 12 h. Higher = more light (lid open).
  const lecturas: LecturaSensor[] = [];
  let id = 1;
  for (const c of cajas) {
    for (let k = 24; k >= 0; k--) {
      const abierta = (c.cajaID === 2 && k <= 3) || (c.cajaID === 1 && k === 7) || (c.cajaID === 3 && k === 1);
      const v = abierta ? 700 + ((k * 37) % 120) : 40 + ((k * 13 + c.cajaID * 7) % 35);
      lecturas.push({ lecturaID: id++, sensorID: c.cajaID * 10 + 1, valorNumerico: v, valorTexto: abierta ? "tapa abierta" : "tapa cerrada", unidad: "lux", fechaYHora: ago(k * 30) });
    }
    lecturas.push({ lecturaID: id++, sensorID: c.cajaID * 10 + 4, valorNumerico: null, valorTexto: c.estaBloqueada ? "cerrada" : "abierta", unidad: null, fechaYHora: ago(5) });
  }

  const historial = [
    { historialID: 1, autor: "María Treviño", registroDeCambio: "Se otorgó permiso a Luis Vera en Caja Obra Norte", cajaID: 2, idUsuario: 3, fechaYHoraDeCambio: ago(2 * day) },
    { historialID: 2, autor: "Sistema", registroDeCambio: "Tarjeta E5F6A7B8 marcada como inactiva", cajaID: null, idUsuario: 3, fechaYHoraDeCambio: ago(day) },
    { historialID: 3, autor: "Sistema", registroDeCambio: "Protocolo de alarma activado en Caja Laboratorio IoT", cajaID: 3, idUsuario: null, fechaYHoraDeCambio: ago(12) },
  ];

  const consultasIA = [
    { consultaID: 1, idUsuario: 4, pregunta: "¿Qué herramientas salieron hoy de la Caja Obra Norte?", respuesta: "Hoy salió el Nivel láser (Bosch), retirado por Ana Gómez. El Esmeril angular (Makita) salió y regresó media hora después.", fechaDeConsulta: ago(80) },
    { consultaID: 2, idUsuario: 4, pregunta: "¿Por qué se activó la alarma del laboratorio?", respuesta: "Se registraron intentos de acceso con una tarjeta no registrada (código 99887766) y el protocolo de alarma se activó.", fechaDeConsulta: ago(8) },
  ];

  return {
    objetos, usuarios, equipos, cajas, rfid, controladores, sensores, actuadores, etiquetas, permisos,
    lecturas, eventosInventario, accesos, eventosActuadores, historial, consultasIA,
  };
}
