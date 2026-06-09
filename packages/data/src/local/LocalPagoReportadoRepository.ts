import { injectable, inject } from 'tsyringe';
import { IPagoReportado, IPagoReportadoRepository } from '@abitia/core';
import { LocalStore } from './LocalStore';

@injectable()
export class LocalPagoReportadoRepository implements IPagoReportadoRepository {
  constructor(@inject(LocalStore) private store: LocalStore) {}

  async findById(idCondominio: number, id: number): Promise<IPagoReportado | null> {
    const pago = this.store.pagos.get(id);
    if (pago && pago.IdCondominio !== idCondominio) return null;
    return pago ?? null;
  }

  async findPendientesVerificar(idCondominio: number): Promise<IPagoReportado[]> {
    const result: IPagoReportado[] = [];
    for (const p of this.store.pagos.values()) {
      if (p.IdCondominio === idCondominio && p.Estatus_Verificacion === 0) {
        result.push(p);
      }
    }
    return result;
  }

  async findByReferencia(idCondominio: number, referencia: string): Promise<IPagoReportado | null> {
    for (const p of this.store.pagos.values()) {
      if (p.IdCondominio === idCondominio && p.Referencia_Bancaria === referencia) {
        return p;
      }
    }
    return null;
  }

  async create(data: Omit<IPagoReportado, 'IdPago' | 'Fecha_Reporte'>): Promise<number> {
    const id = this.store.nextIds.pago++;
    const now = new Date();
    const pago: IPagoReportado = {
      ...data,
      IdPago: id,
      Fecha_Reporte: now,
    };
    this.store.pagos.set(id, pago);
    return id;
  }

  async verificar(
    idCondominio: number,
    idPago: number,
    estatus: number,
    idUsuarioVerifica: number,
    motivoRechazo?: string
  ): Promise<void> {
    const existing = this.store.pagos.get(idPago);
    if (existing && existing.IdCondominio === idCondominio) {
      existing.Estatus_Verificacion = estatus;
      existing.Fecha_Verificacion = new Date();
      existing.IdUsuario_Verifica = idUsuarioVerifica;
      if (motivoRechazo !== undefined) {
        existing.Motivo_Rechazo = motivoRechazo;
      }
    }
  }
}
