import { injectable, inject } from 'tsyringe';
import { IUsuario, IUsuarioCondominioRol, IUsuarioRepository } from '@abitia/core';
import { MySQLConnection } from './connection';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

@injectable()
export class MySQLUsuarioRepository implements IUsuarioRepository {
  constructor(@inject(MySQLConnection) private connection: MySQLConnection) {}

  async findById(id: number): Promise<IUsuario | null> {
    const [rows] = await this.connection.getPool().execute<RowDataPacket[]>(
      'SELECT * FROM Usuario WHERE IdUsuario = ?',
      [id],
    );
    return rows[0] ? this.mapUsuarioRow(rows[0]) : null;
  }

  async findByEmail(email: string): Promise<IUsuario | null> {
    const [rows] = await this.connection.getPool().execute<RowDataPacket[]>(
      'SELECT * FROM Usuario WHERE Email = ?',
      [email],
    );
    return rows[0] ? this.mapUsuarioRow(rows[0]) : null;
  }

  async create(data: Omit<IUsuario, 'IdUsuario' | 'Fecha_Registro'>): Promise<number> {
    const fields = Object.keys(data);
    const values = Object.values(data);
    const placeholders = fields.map(() => '?').join(', ');
    const columns = fields.map((f) => f).join(', ');

    const [result] = await this.connection.getPool().execute<ResultSetHeader>(
      `INSERT INTO Usuario (${columns}) VALUES (${placeholders})`,
      values,
    );
    return result.insertId;
  }

  async update(id: number, data: Partial<IUsuario>): Promise<void> {
    const entries = Object.entries(data).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return;

    const setClauses = entries.map(([k]) => `${k} = ?`).join(', ');
    const values = entries.map(([, v]) => v);

    await this.connection.getPool().execute(
      `UPDATE Usuario SET ${setClauses} WHERE IdUsuario = ?`,
      [...values, id],
    );
  }

  async assignRole(idCondominio: number, idUsuario: number, rol: number): Promise<void> {
    await this.connection.getPool().execute(
      'INSERT INTO UsuarioCondominioRol (IdCondominio, IdUsuario, Rol) VALUES (?, ?, ?) ' +
        'ON DUPLICATE KEY UPDATE Rol = VALUES(Rol)',
      [idCondominio, idUsuario, rol],
    );
  }

  async getRolesByUsuario(idUsuario: number): Promise<IUsuarioCondominioRol[]> {
    const [rows] = await this.connection.getPool().execute<RowDataPacket[]>(
      'SELECT * FROM UsuarioCondominioRol WHERE IdUsuario = ?',
      [idUsuario],
    );
    return rows.map((r) => this.mapRolRow(r));
  }

  async getRolesByCondominio(idCondominio: number): Promise<IUsuarioCondominioRol[]> {
    const [rows] = await this.connection.getPool().execute<RowDataPacket[]>(
      'SELECT * FROM UsuarioCondominioRol WHERE IdCondominio = ?',
      [idCondominio],
    );
    return rows.map((r) => this.mapRolRow(r));
  }

  private mapUsuarioRow(row: RowDataPacket): IUsuario {
    return {
      IdUsuario: row.IdUsuario,
      Nombre: row.Nombre,
      Apellido: row.Apellido,
      Email: row.Email,
      Password_Hash: row.Password_Hash,
      Telefono: row.Telefono,
      Estatus: row.Estatus,
      Fecha_Registro: row.Fecha_Registro,
    };
  }

  private mapRolRow(row: RowDataPacket): IUsuarioCondominioRol {
    return {
      IdUsuario: row.IdUsuario,
      IdCondominio: row.IdCondominio,
      Rol: row.Rol,
    };
  }


}
