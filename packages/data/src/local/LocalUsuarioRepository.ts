import { injectable, inject } from 'tsyringe';
import { IUsuario, IUsuarioCondominioRol, IUsuarioRepository } from '@abitia/core';
import { LocalStore } from './LocalStore';

@injectable()
export class LocalUsuarioRepository implements IUsuarioRepository {
  constructor(@inject(LocalStore) private store: LocalStore) {}

  async findById(id: number): Promise<IUsuario | null> {
    return this.store.usuarios.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<IUsuario | null> {
    for (const u of this.store.usuarios.values()) {
      if (u.Email === email) return u;
    }
    return null;
  }

  async create(data: Omit<IUsuario, 'IdUsuario' | 'Fecha_Registro'>): Promise<number> {
    const id = this.store.nextIds.usuario++;
    const now = new Date();
    const usuario: IUsuario = {
      ...data,
      IdUsuario: id,
      Fecha_Registro: now,
    };
    this.store.usuarios.set(id, usuario);
    return id;
  }

  async update(id: number, data: Partial<IUsuario>): Promise<void> {
    const existing = this.store.usuarios.get(id);
    if (existing) {
      Object.assign(existing, data);
    }
  }

  async assignRole(idCondominio: number, idUsuario: number, rol: number): Promise<void> {
    const key = `${idUsuario}_${idCondominio}`;
    const role: IUsuarioCondominioRol = { IdUsuario: idUsuario, IdCondominio: idCondominio, Rol: rol };
    this.store.roles.set(key, role);
  }

  async getRolesByUsuario(idUsuario: number): Promise<IUsuarioCondominioRol[]> {
    const result: IUsuarioCondominioRol[] = [];
    for (const r of this.store.roles.values()) {
      if (r.IdUsuario === idUsuario) result.push(r);
    }
    return result;
  }

  async getRolesByCondominio(idCondominio: number): Promise<IUsuarioCondominioRol[]> {
    const result: IUsuarioCondominioRol[] = [];
    for (const r of this.store.roles.values()) {
      if (r.IdCondominio === idCondominio) result.push(r);
    }
    return result;
  }
}
