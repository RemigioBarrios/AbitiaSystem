import { injectable, inject } from 'tsyringe';
import { IPropiedad, IPropiedadRepository } from '@abitia/core';
import { MySQLConnection } from './connection';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

@injectable()
export class MySQLPropiedadRepository implements IPropiedadRepository {
  constructor(@inject(MySQLConnection) private connection: MySQLConnection) {}

  async findById(idCondominio: number, idPropiedad: number): Promise<IPropiedad | null> {
    const [rows] = await this.connection.getPool().execute<RowDataPacket[]>(
      'SELECT * FROM Propiedad WHERE IdPropiedad = ? AND IdCondominio = ?',
      [idPropiedad, idCondominio],
    );
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async findAllByCondominio(idCondominio: number): Promise<IPropiedad[]> {
    const [rows] = await this.connection.getPool().execute<RowDataPacket[]>(
      'SELECT * FROM Propiedad WHERE IdCondominio = ?',
      [idCondominio],
    );
    return rows.map((r) => this.mapRow(r));
  }

  async findByPropietario(idCondominio: number, idPropietario: number): Promise<IPropiedad[]> {
    const [rows] = await this.connection.getPool().execute<RowDataPacket[]>(
      'SELECT * FROM Propiedad WHERE IdCondominio = ? AND IdPropietario_Actual = ?',
      [idCondominio, idPropietario],
    );
    return rows.map((r) => this.mapRow(r));
  }

  async create(data: Omit<IPropiedad, 'IdPropiedad'>): Promise<number> {
    const fields = Object.keys(data);
    const values = Object.values(data);
    const placeholders = fields.map(() => '?').join(', ');
    const columns = fields.map((f) => f).join(', ');

    const [result] = await this.connection.getPool().execute<ResultSetHeader>(
      `INSERT INTO Propiedad (${columns}) VALUES (${placeholders})`,
      values,
    );
    return result.insertId;
  }

  async update(idCondominio: number, id: number, data: Partial<IPropiedad>): Promise<void> {
    const entries = Object.entries(data).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return;

    const setClauses = entries.map(([k]) => `${k} = ?`).join(', ');
    const values = entries.map(([, v]) => v);

    await this.connection.getPool().execute(
      `UPDATE Propiedad SET ${setClauses} WHERE IdPropiedad = ? AND IdCondominio = ?`,
      [...values, id, idCondominio],
    );
  }

  private mapRow(row: RowDataPacket): IPropiedad {
    return {
      IdPropiedad: row.IdPropiedad,
      IdCondominio: row.IdCondominio,
      Codigo_Nro: row.Codigo_Nro,
      Alicuota: Number(row.Alicuota),
      IdPropietario_Actual: row.IdPropietario_Actual,
      Estatus: row.Estatus,
    };
  }


}
