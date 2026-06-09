import { injectable, inject } from 'tsyringe';
import { IGastoCondominio, IGastoCondominioRepository } from '@abitia/core';
import { MySQLConnection } from './connection';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

@injectable()
export class MySQLGastoCondominioRepository implements IGastoCondominioRepository {
  constructor(@inject(MySQLConnection) private connection: MySQLConnection) {}

  async findAllByPeriod(idCondominio: number, periodo: string): Promise<IGastoCondominio[]> {
    const [rows] = await this.connection.getPool().execute<RowDataPacket[]>(
      'SELECT * FROM GastoCondominio WHERE IdCondominio = ? AND Periodo_MesAnio = ?',
      [idCondominio, periodo],
    );
    return rows.map((r) => this.mapRow(r));
  }

  async findById(idCondominio: number, id: number): Promise<IGastoCondominio | null> {
    const [rows] = await this.connection.getPool().execute<RowDataPacket[]>(
      'SELECT * FROM GastoCondominio WHERE IdGasto = ? AND IdCondominio = ?',
      [id, idCondominio],
    );
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async create(data: Omit<IGastoCondominio, 'IdGasto'>): Promise<number> {
    const fields = Object.keys(data);
    const values = Object.values(data);
    const placeholders = fields.map(() => '?').join(', ');
    const columns = fields.map((f) => f).join(', ');

    const [result] = await this.connection.getPool().execute<ResultSetHeader>(
      `INSERT INTO GastoCondominio (${columns}) VALUES (${placeholders})`,
      values,
    );
    return result.insertId;
  }

  async sumGastoComunByPeriod(idCondominio: number, periodo: string): Promise<number> {
    const [rows] = await this.connection.getPool().execute<RowDataPacket[]>(
      'SELECT COALESCE(SUM(Monto), 0) AS total FROM GastoCondominio ' +
        'WHERE IdCondominio = ? AND Periodo_MesAnio = ? AND Tipo_Gasto = 1',
      [idCondominio, periodo],
    );
    return Number(rows[0].total);
  }

  private mapRow(row: RowDataPacket): IGastoCondominio {
    return {
      IdGasto: row.IdGasto,
      IdCondominio: row.IdCondominio,
      Periodo_MesAnio: row.Periodo_MesAnio,
      Descripcion: row.Descripcion,
      Monto: Number(row.Monto),
      Tipo_Gasto: row.Tipo_Gasto,
      Fecha_Gasto: row.Fecha_Gasto,
    };
  }


}
