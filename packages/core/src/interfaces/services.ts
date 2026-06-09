import { ICuentaCorrientePropiedad, IPagoReportado } from '../domain';

export interface ITenantResolved {
  idCondominio: number;
  slug: string;
  nombre: string;
}

export enum HostType {
  PUBLIC = 'public',
  GLOBAL_APP = 'global',
  TENANT = 'tenant',
  UNKNOWN = 'unknown',
}

export interface HostClassification {
  type: HostType;
  slug: string | null;
}

export interface ITenantResolutionService {
  classifyHost(host: string): HostClassification;
  resolveFromHost(host: string): Promise<ITenantResolved | null>;
  resolveFromSlug(slug: string): Promise<ITenantResolved | null>;
  setCurrentTenant(idCondominio: number): void;
  getCurrentTenant(): ITenantResolved | null;
  getCurrentTenantId(): number;
  preloadCache(): Promise<void>;
  invalidateCache(slug?: string): void;
  getCacheStats(): { size: number; entries: string[] };
}

export interface ReciboCalculationInput {
  idPropiedad: number;
  alicuota: number;
  gastoComunTotal: number;
  gastosNoComunes: number;
  saldoAnteriorPendiente: number;
}

export interface ReciboCalculationResult {
  montoGastoComun: number;
  montoGastoNoComun: number;
  montoFondoReserva: number;
  saldoAnteriorPendiente: number;
  totalAPagar: number;
}

export interface IReciboService {
  calculateRecibo(input: ReciboCalculationInput): ReciboCalculationResult;
  emitirRecibosPeriodo(idCondominio: number, periodo: string, fechaVencimiento: Date): Promise<void>;
}

export interface ILedgerService {
  registrarReciboEmitido(
    idCondominio: number,
    idPropiedad: number,
    idRecibo: number,
    descripcion: string,
    monto: number,
  ): Promise<void>;

  registrarPagoAplicado(
    idCondominio: number,
    idPropiedad: number,
    idPago: number,
    descripcion: string,
    monto: number,
  ): Promise<void>;

  registrarNotaCredito(
    idCondominio: number,
    idPropiedad: number,
    idReferencia: number,
    descripcion: string,
    monto: number,
  ): Promise<void>;

  registrarNotaDebito(
    idCondominio: number,
    idPropiedad: number,
    idReferencia: number,
    descripcion: string,
    monto: number,
  ): Promise<void>;

  getSaldoActual(idCondominio: number, idPropiedad: number): Promise<number>;
  getHistorial(idCondominio: number, idPropiedad: number): Promise<ICuentaCorrientePropiedad[]>;
}

export interface PagoVerificationInput {
  idCondominio: number;
  idPago: number;
  estatus: number;
  idUsuarioVerifica: number;
  motivoRechazo?: string;
}

export interface ReportarPagoInput {
  idCondominio: number;
  idPropiedad: number;
  idUsuarioReporta: number;
  monto: number;
  fechaTransferencia: Date;
  referenciaBancaria: string;
  idBancoDestino: number;
  formaPago: number;
  comprobanteUrl?: string;
  observaciones?: string;
}

export interface IPagoService {
  reportarPago(data: ReportarPagoInput): Promise<number>;
  verificarPago(input: PagoVerificationInput): Promise<void>;
  getBandejaVerificacion(idCondominio: number): Promise<IPagoReportado[]>;
}

export interface AuthTokenPayload {
  idUsuario: number;
  email: string;
  idCondominio: number | null;
  rol: number | null;
}

export interface UserCondominioOption {
  idCondominio: number;
  nombreCondominio: string;
  slug: string;
  rol: number;
  nombreRol: string;
}
