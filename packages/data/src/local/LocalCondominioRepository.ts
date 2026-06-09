import { injectable, inject } from 'tsyringe';
import { ICondominio, ICondominioRepository } from '@abitia/core';
import { LocalStore } from './LocalStore';

@injectable()
export class LocalCondominioRepository implements ICondominioRepository {
  constructor(@inject(LocalStore) private store: LocalStore) {}

  async findBySlug(slug: string): Promise<ICondominio | null> {
    for (const c of this.store.condominios.values()) {
      if (c.Subdominio_Slug === slug) return c;
    }
    return null;
  }

  async findById(id: number): Promise<ICondominio | null> {
    return this.store.condominios.get(id) ?? null;
  }

  async findAll(): Promise<ICondominio[]> {
    return Array.from(this.store.condominios.values());
  }

  async create(data: Omit<ICondominio, 'IdCondominio' | 'Fecha_Creacion'>): Promise<number> {
    const id = this.store.nextIds.condominio++;
    const now = new Date();
    const condominio: ICondominio = {
      ...data,
      IdCondominio: id,
      Fecha_Creacion: now,
    };
    this.store.condominios.set(id, condominio);
    return id;
  }

  async update(id: number, data: Partial<ICondominio>): Promise<void> {
    const existing = this.store.condominios.get(id);
    if (existing) {
      Object.assign(existing, data);
    }
  }
}
