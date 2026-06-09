import { injectable, inject } from 'tsyringe';
import { IReciboMensual, IReciboMensualRepository } from '@abitia/core';
import { LocalStore } from './LocalStore';

@injectable()
export class LocalReciboMensualRepository implements IReciboMensualRepository {
  constructor(@inject(LocalStore) private store: LocalStore) {}

  async findById(idCondominio: number, id: number): Promise<IReciboMensual | null> {
    const recibo = this.store.recibos.get(id);
    if (!recibo) return null;
    const propiedad = this.store.propiedades.get(recibo.IdPropiedad);
    if (!propiedad || propiedad.IdCondominio !== idCondominio) return null;
    return recibo;
  }

  async findPendientesByPropiedad(idCondominio: number, idPropiedad: number): Promise<IReciboMensual[]> {
    const propiedad = this.store.propiedades.get(idPropiedad);
    if (!propiedad || propiedad.IdCondominio !== idCondominio) return [];
    const result: IReciboMensual[] = [];
    for (const r of this.store.recibos.values()) {
      if (r.IdPropiedad === idPropiedad && r.Estatus_Pago !== 1) {
        result.push(r);
      }
    }
    return result;
  }

  async findAllByPeriod(idCondominio: number, periodo: string): Promise<IReciboMensual[]> {
    const result: IReciboMensual[] = [];
    for (const r of this.store.recibos.values()) {
      if (r.Periodicidad_MesAnio === periodo) {
        const propiedad = this.store.propiedades.get(r.IdPropiedad);
        if (propiedad && propiedad.IdCondominio === idCondominio) {
          result.push(r);
        }
      }
    }
    return result;
  }

  async getSaldoPendiente(idCondominio: number, idPropiedad: number): Promise<number> {
    const propiedad = this.store.propiedades.get(idPropiedad);
    if (!propiedad || propiedad.IdCondominio !== idCondominio) return 0;
    let sum = 0;
    for (const r of this.store.recibos.values()) {
      if (r.IdPropiedad === idPropiedad && r.Estatus_Pago !== 1) {
        sum += r.Total_A_Pagar;
      }
    }
    return sum;
  }

  async createBatch(recibos: Omit<IReciboMensual, 'IdRecibo'>[]): Promise<void> {
    for (const data of recibos) {
      const id = this.store.nextIds.recibo++;
      const recibo: IReciboMensual = {
        ...data,
        IdRecibo: id,
      };
      this.store.recibos.set(id, recibo);
    }
  }

  async updateEstatus(idCondominio: number, idRecibo: number, estatus: number): Promise<void> {
    const existing = this.store.recibos.get(idRecibo);
    if (!existing) return;
    const propiedad = this.store.propiedades.get(existing.IdPropiedad);
    if (!propiedad || propiedad.IdCondominio !== idCondominio) return;
    existing.Estatus_Pago = estatus;
  }
}
