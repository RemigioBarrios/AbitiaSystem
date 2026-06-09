import { injectable, inject } from 'tsyringe';
import { IGastoCondominio, IGastoCondominioRepository } from '@abitia/core';
import { LocalStore } from './LocalStore';

@injectable()
export class LocalGastoCondominioRepository implements IGastoCondominioRepository {
  constructor(@inject(LocalStore) private store: LocalStore) {}

  async findAllByPeriod(idCondominio: number, periodo: string): Promise<IGastoCondominio[]> {
    const result: IGastoCondominio[] = [];
    for (const g of this.store.gastos.values()) {
      if (g.IdCondominio === idCondominio && g.Periodo_MesAnio === periodo) {
        result.push(g);
      }
    }
    return result;
  }

  async findById(idCondominio: number, id: number): Promise<IGastoCondominio | null> {
    const gasto = this.store.gastos.get(id);
    if (gasto && gasto.IdCondominio !== idCondominio) return null;
    return gasto ?? null;
  }

  async create(data: Omit<IGastoCondominio, 'IdGasto'>): Promise<number> {
    const id = this.store.nextIds.gasto++;
    const gasto: IGastoCondominio = {
      ...data,
      IdGasto: id,
    };
    this.store.gastos.set(id, gasto);
    return id;
  }

  async sumGastoComunByPeriod(idCondominio: number, periodo: string): Promise<number> {
    let sum = 0;
    for (const g of this.store.gastos.values()) {
      if (g.IdCondominio === idCondominio && g.Periodo_MesAnio === periodo && g.Tipo_Gasto === 1) {
        sum += g.Monto;
      }
    }
    return sum;
  }
}
