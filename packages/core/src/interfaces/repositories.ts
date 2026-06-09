import {
  ICondominio,
  IUsuario,
  IUsuarioCondominioRol,
  IPropiedad,
  IGastoCondominio,
  IReciboMensual,
  IPagoReportado,
  ICuentaCorrientePropiedad,
} from '../domain';

export interface ICondominioRepository {
  findBySlug(slug: string): Promise<ICondominio | null>;
  findById(id: number): Promise<ICondominio | null>;
  findAll(): Promise<ICondominio[]>;
  create(data: Omit<ICondominio, 'IdCondominio' | 'Fecha_Creacion'>): Promise<number>;
  update(id: number, data: Partial<ICondominio>): Promise<void>;
}

export interface IUsuarioRepository {
  findById(id: number): Promise<IUsuario | null>;
  findByEmail(email: string): Promise<IUsuario | null>;
  create(data: Omit<IUsuario, 'IdUsuario' | 'Fecha_Registro'>): Promise<number>;
  update(id: number, data: Partial<IUsuario>): Promise<void>;
  assignRole(idCondominio: number, idUsuario: number, rol: number): Promise<void>;
  getRolesByUsuario(idUsuario: number): Promise<IUsuarioCondominioRol[]>;
  getRolesByCondominio(idCondominio: number): Promise<IUsuarioCondominioRol[]>;
}

export interface IPropiedadRepository {
  findById(idCondominio: number, idPropiedad: number): Promise<IPropiedad | null>;
  findAllByCondominio(idCondominio: number): Promise<IPropiedad[]>;
  findByPropietario(idCondominio: number, idPropietario: number): Promise<IPropiedad[]>;
  create(data: Omit<IPropiedad, 'IdPropiedad'>): Promise<number>;
  update(idCondominio: number, id: number, data: Partial<IPropiedad>): Promise<void>;
}

export interface IGastoCondominioRepository {
  findAllByPeriod(idCondominio: number, periodo: string): Promise<IGastoCondominio[]>;
  findById(idCondominio: number, id: number): Promise<IGastoCondominio | null>;
  create(data: Omit<IGastoCondominio, 'IdGasto'>): Promise<number>;
  sumGastoComunByPeriod(idCondominio: number, periodo: string): Promise<number>;
}

export interface IReciboMensualRepository {
  findById(idCondominio: number, id: number): Promise<IReciboMensual | null>;
  findPendientesByPropiedad(idCondominio: number, idPropiedad: number): Promise<IReciboMensual[]>;
  findAllByPeriod(idCondominio: number, periodo: string): Promise<IReciboMensual[]>;
  getSaldoPendiente(idCondominio: number, idPropiedad: number): Promise<number>;
  createBatch(recibos: Omit<IReciboMensual, 'IdRecibo'>[]): Promise<void>;
  updateEstatus(idCondominio: number, idRecibo: number, estatus: number): Promise<void>;
}

export interface IPagoReportadoRepository {
  findById(idCondominio: number, id: number): Promise<IPagoReportado | null>;
  findPendientesVerificar(idCondominio: number): Promise<IPagoReportado[]>;
  findByReferencia(idCondominio: number, referencia: string): Promise<IPagoReportado | null>;
  create(data: Omit<IPagoReportado, 'IdPago' | 'Fecha_Reporte'>): Promise<number>;
  verificar(idCondominio: number, idPago: number, estatus: number, idUsuarioVerifica: number, motivoRechazo?: string): Promise<void>;
}

export interface ICuentaCorrienteRepository {
  findByPropiedad(idCondominio: number, idPropiedad: number): Promise<ICuentaCorrientePropiedad[]>;
  getSaldoActual(idCondominio: number, idPropiedad: number): Promise<number>;
  create(data: Omit<ICuentaCorrientePropiedad, 'IdMovimiento'>, connection?: unknown): Promise<number>;
}
