export interface ICondominio {
  IdCondominio: number;
  Nombre: string;
  Rif_IdFiscal: string;
  Direccion: string;
  Subdominio_Slug: string;
  Porcentaje_Fondo_Reserva: number;
  Configuracion_JSON: Record<string, unknown> | null;
  Fecha_Creacion: Date;
}

export interface IUsuario {
  IdUsuario: number;
  Nombre: string;
  Apellido: string;
  Email: string;
  Password_Hash: string;
  Telefono: string | null;
  Estatus: number;
  Fecha_Registro: Date;
}

export interface IUsuarioCondominioRol {
  IdUsuario: number;
  IdCondominio: number;
  Rol: number;
}

export interface IPropiedad {
  IdPropiedad: number;
  IdCondominio: number;
  Codigo_Nro: string;
  Alicuota: number;
  IdPropietario_Actual: number;
  Estatus: number;
}

export interface IGastoCondominio {
  IdGasto: number;
  IdCondominio: number;
  Periodo_MesAnio: string;
  Descripcion: string;
  Monto: number;
  Tipo_Gasto: number;
  Fecha_Gasto: Date;
}

export interface IReciboMensual {
  IdRecibo: number;
  IdPropiedad: number;
  Periodicidad_MesAnio: string;
  Fecha_Emision: Date;
  Fecha_Vencimiento: Date;
  Monto_Gasto_Comun: number;
  Monto_Gasto_NoComun: number;
  Monto_Fondo_Reserva: number;
  Saldo_Anterior_Pendiente: number;
  Total_A_Pagar: number;
  Estatus_Pago: number;
}

export interface IPagoReportado {
  IdPago: number;
  IdCondominio: number;
  IdPropiedad: number;
  IdUsuario_Reporta: number;
  Fecha_Reporte: Date;
  Monto: number;
  Fecha_Transferencia: Date;
  Referencia_Bancaria: string;
  IdBanco_Destino: number;
  Forma_Pago: number;
  Comprobante_Url: string | null;
  Observaciones_User: string | null;
  Estatus_Verificacion: number;
  Fecha_Verificacion: Date | null;
  IdUsuario_Verifica: number | null;
  Motivo_Rechazo: string | null;
}

export interface ICuentaCorrientePropiedad {
  IdMovimiento: number;
  IdCondominio: number;
  IdPropiedad: number;
  Fecha_Movimiento: Date;
  Tipo_Movimiento: number;
  IdReferencia_Origen: number;
  Descripcion: string;
  Monto: number;
  Saldo_Resultante: number;
}
