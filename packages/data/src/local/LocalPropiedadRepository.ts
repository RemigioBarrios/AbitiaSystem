import { injectable, inject } from 'tsyringe';
import { IPropiedad, IPropiedadRepository } from '@abitia/core';
import { LocalStore } from './LocalStore';

@injectable()
export class LocalPropiedadRepository implements IPropiedadRepository {
  constructor(@inject(LocalStore) private store: LocalStore) {}

  async findById(idCondominio: number, idPropiedad: number): Promise<IPropiedad | null> {
    const propiedad = this.store.propiedades.get(idPropiedad);
    if (propiedad && propiedad.IdCondominio !== idCondominio) return null;
    return propiedad ?? null;
  }

  async findAllByCondominio(idCondominio: number): Promise<IPropiedad[]> {
    const result: IPropiedad[] = [];
    for (const p of this.store.propiedades.values()) {
      if (p.IdCondominio === idCondominio) result.push(p);
    }
    return result;
  }

  async findByPropietario(idCondominio: number, idPropietario: number): Promise<IPropiedad[]> {
    const result: IPropiedad[] = [];
    for (const p of this.store.propiedades.values()) {
      if (p.IdCondominio === idCondominio && p.IdPropietario_Actual === idPropietario) result.push(p);
    }
    return result;
  }

  async create(data: Omit<IPropiedad, 'IdPropiedad'>): Promise<number> {
    const id = this.store.nextIds.propiedad++;
    const propiedad: IPropiedad = {
      ...data,
      IdPropiedad: id,
    };
    this.store.propiedades.set(id, propiedad);
    return id;
  }

  async update(idCondominio: number, id: number, data: Partial<IPropiedad>): Promise<void> {
    const existing = this.store.propiedades.get(id);
    if (existing && existing.IdCondominio === idCondominio) {
      Object.assign(existing, data);
    }
  }
}
