export enum Rol {
  SuperAdmin = 1,
  Administrador = 2,
  Propietario = 3,
  Inquilino = 4,
}

export enum EstatusUsuario {
  Inactivo = 0,
  Activo = 1,
}

export enum EstatusPropiedad {
  Inactivo = 0,
  Activo = 1,
}

export enum TipoGasto {
  Comun = 1,
  NoComun = 2,
}

export enum EstatusPago {
  Pendiente = 0,
  Pagado = 1,
  Parcial = 2,
}

export enum FormaPago {
  Transferencia = 1,
  PagoMovil = 2,
  Efectivo = 3,
  Zelle = 4,
}

export enum EstatusVerificacion {
  Pendiente = 0,
  Aprobado = 1,
  Rechazado = 2,
}

export enum TipoMovimiento {
  ReciboEmitido = 1,
  PagoAplicado = 2,
  NotaCredito = 3,
  NotaDebito = 4,
}
