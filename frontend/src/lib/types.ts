// One type per table of the ToolNest relational model. Field names match the
// database columns so the backend can return rows as-is (SELECT * FROM ...).
// Dates are ISO strings; flags/estatus are booleans (true = activo).

export type Objeto = {
  objetoID: number;
  nombreDeObjeto: string;
  categoria: string;
  fabricante: string;
  descripcion: string | null;
};

// hashContrasena is intentionally absent: the backend must never send it.
export type Usuario = {
  idUsuario: number;
  nombreDeUsuario: string;
  fechaDeCreacion: string;
  fotoDePerfil: string | null;
  descripcion: string | null;
  sexo: string | null;
};

export type Equipo = {
  equipoID: number;
  nombreDeEquipo: string;
  fechaDeCreacion: string;
  idUsuario: number;
  fotoDeEquipo: string | null;
  descripcion: string | null;
};

export type Caja = {
  cajaID: number;
  nombreDeCaja: string;
  fechaDeCreacion: string;
  localizacionAproximada: string | null;
  estaBloqueada: boolean;
  tieneLucesEncendidas: boolean;
  estaActivaProtocoloDeAlarma: boolean;
  equipoID: number;
};

export type RFID = {
  tarjetaID: string;
  idUsuario: number;
  estatus: boolean;
};

export type Controlador = {
  controladorID: number;
  cajaID: number;
  nombreControlador: string;
  modelo: string;
  identificador: string | null;
  estatus: boolean;
};

export type Sensor = {
  sensorID: number;
  controladorID: number;
  nombreSensor: string;
  tipoSensor: string;
  modelo: string;
  descripcion: string | null;
  estatus: boolean;
};

export type Actuador = {
  actuadorID: number;
  controladorID: number;
  nombreActuador: string;
  tipoActuador: string;
  modelo: string;
  descripcion: string | null;
  estatus: boolean;
};

export type EtiquetaHerramienta = {
  epc: string;
  objetoID: number;
  fechaDeRegistro: string;
  estatus: boolean;
};

export type PermisoAcceso = {
  idUsuario: number;
  cajaID: number;
  tienePermiso: boolean;
  fechaDeAsignacion: string;
};

export type LecturaSensor = {
  lecturaID: number;
  sensorID: number;
  valorNumerico: number | null;
  valorTexto: string | null;
  unidad: string | null;
  fechaYHora: string;
};

export type EventoInventario = {
  eventoInventarioID: number;
  sensorID: number;
  epcLeido: string;
  tipoEvento: "deteccion" | "entrada" | "salida";
  fechaYHora: string;
};

export type Acceso = {
  accesoID: number;
  cajaID: number;
  tarjetaID: string | null;
  codigoLeido: string;
  resultado: "autorizado" | "denegado";
  motivo: string | null;
  fechaYHora: string;
};

export type EventoActuador = {
  eventoActuadorID: number;
  actuadorID: number;
  accion: string;
  detalle: string | null;
  fechaYHora: string;
};

export type Historial = {
  historialID: number;
  autor: string;
  registroDeCambio: string;
  cajaID: number | null;
  idUsuario: number | null;
  fechaYHoraDeCambio: string;
};

export type ConsultaIA = {
  consultaID: number;
  idUsuario: number;
  pregunta: string;
  respuesta: string;
  fechaDeConsulta: string;
};

export type Data = {
  objetos: Objeto[];
  usuarios: Usuario[];
  equipos: Equipo[];
  cajas: Caja[];
  rfid: RFID[];
  controladores: Controlador[];
  sensores: Sensor[];
  actuadores: Actuador[];
  etiquetas: EtiquetaHerramienta[];
  permisos: PermisoAcceso[];
  lecturas: LecturaSensor[];
  eventosInventario: EventoInventario[];
  accesos: Acceso[];
  eventosActuadores: EventoActuador[];
  historial: Historial[];
  consultasIA: ConsultaIA[];
};
