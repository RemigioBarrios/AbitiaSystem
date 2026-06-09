import { injectable, inject } from 'tsyringe';
import { ICondominio, ICondominioRepository } from '@abitia/core';
import { MySQLConnection } from './connection';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

@injectable()
export class MySQLCondominioRepository implements ICondominioRepository {
  constructor(@inject(MySQLConnection) private connection: MySQLConnection) {}

  async findBySlug(slug: string): Promise<ICondominio | null> {
    const [rows] = await this.connection.getPool().execute<RowDataPacket[]>(
      'SELECT * FROM Condominio WHERE Subdominio_Slug = ?',
      [slug],
    );
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async findById(id: number): Promise<ICondominio | null> {
    const [rows] = await this.connection.getPool().execute<RowDataPacket[]>(
      'SELECT * FROM Condominio WHERE IdCondominio = ?',
      [id],
    );
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async findAll(): Promise<ICondominio[]> {
    const [rows] = await this.connection.getPool().execute<RowDataPacket[]>(
      'SELECT * FROM Condominio',
    );
    return rows.map((r) => this.mapRow(r));
  }

  async create(data: Omit<ICondominio, 'IdCondominio' | 'Fecha_Creacion'>): Promise<number> {
    const fields = Object.keys(data);
    const values = Object.values(data);
    const placeholders = fields.map(() => '?').join(', ');
    const columns = fields.map((f) => f).join(', ');

    const [result] = await this.connection.getPool().execute<ResultSetHeader>(
      `INSERT INTO Condominio (${columns}) VALUES (${placeholders})`,
      values,
    );
    return result.insertId;
  }

  async update(id: number, data: Partial<ICondominio>): Promise<void> {
    const entries = Object.entries(data).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return;

    const setClauses = entries.map(([k]) => `${k} = ?`).join(', ');
    const values = entries.map(([, v]) => v);

    await this.connection.getPool().execute(
      `UPDATE Condominio SET ${setClauses} WHERE IdCondominio = ?`,
      [...values, id],
    );
  }

  private mapRow(row: RowDataPacket): ICondominio {
    return {
      IdCondominio: row.IdCondominio,
      Nombre: row.Nombre,
      Rif_IdFiscal: row.Rif_IdFiscal,
      Direccion: row.Direccion,
      Subdominio_Slug: row.Subdominio_Slug,
      Porcentaje_Fondo_Reserva: Number(row.Porcentaje_Fondo_Reserva),
      Configuracion_JSON: row.Configuracion_JSON
        ? (typeof row.Configuracion_JSON === 'string'
            ? JSON.parse(row.Configuracion_JSON)
            : row.Configuracion_JSON)
        : null,
      Fecha_Creacion: row.Fecha_Creacion,
    };
  }


}
