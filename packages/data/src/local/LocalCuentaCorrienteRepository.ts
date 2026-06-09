import { injectable, inject } from 'tsyringe';
import { ICuentaCorrientePropiedad, ICuentaCorrienteRepository } from '@abitia/core';
import { LocalStore } from './LocalStore';

@injectable()
export class LocalCuentaCorrienteRepository implements ICuentaCorrienteRepository {
  constructor(@inject(LocalStore) private store: LocalStore) {}

  async findByPropiedad(
    idCondominio: number,
    idPropiedad: number
  ): Promise<ICuentaCorrientePropiedad[]> {
    const result: ICuentaCorrientePropiedad[] = [];
    for (const m of this.store.ledger.values()) {
      if (m.IdCondominio === idCondominio && m.IdPropiedad === idPropiedad) {
        result.push(m);
      }
    }
    return result;
  }

  async getSaldoActual(idCondominio: number, idPropiedad: number): Promise<number> {
    let lastEntry: ICuentaCorrientePropiedad | null = null;
    for (const m of this.store.ledger.values()) {
      if (m.IdCondominio === idCondominio && m.IdPropiedad === idPropiedad) {
        if (!lastEntry || m.Fecha_Movimiento > lastEntry.Fecha_Movimiento) {
          lastEntry = m;
        }
      }
    }
    return lastEntry?.Saldo_Resultante ?? 0;
  }

  async create(data: Omit<ICuentaCorrientePropiedad, 'IdMovimiento'>): Promise<number> {
    const id = this.store.nextIds.movimiento++;
    const movimiento: ICuentaCorrientePropiedad = {
      ...data,
      IdMovimiento: id,
    };
    this.store.ledger.set(id, movimiento);
    return id;
  }
}
