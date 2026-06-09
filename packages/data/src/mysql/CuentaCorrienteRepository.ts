import { injectable, inject } from 'tsyringe';
import { ICuentaCorrientePropiedad, ICuentaCorrienteRepository } from '@abitia/core';
import { MySQLConnection } from './connection';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';

@injectable()
export class MySQLCuentaCorrienteRepository implements ICuentaCorrienteRepository {
  constructor(@inject(MySQLConnection) private connection: MySQLConnection) {}

  async findByPropiedad(
    idCondominio: number,
    idPropiedad: number,
  ): Promise<ICuentaCorrientePropiedad[]> {
    const [rows] = await this.connection.getPool().execute<RowDataPacket[]>(
      'SELECT * FROM CuentaCorrientePropiedad ' +
        'WHERE IdCondominio = ? AND IdPropiedad = ? ' +
        'ORDER BY Fecha_Movimiento DESC, IdMovimiento DESC',
      [idCondominio, idPropiedad],
    );
    return rows.map((r) => this.mapRow(r));
  }

  async getSaldoActual(idCondominio: number, idPropiedad: number): Promise<number> {
    const [rows] = await this.connection.getPool().execute<RowDataPacket[]>(
      'SELECT Saldo_Resultante FROM CuentaCorrientePropiedad ' +
        'WHERE IdCondominio = ? AND IdPropiedad = ? ' +
        'ORDER BY Fecha_Movimiento DESC, IdMovimiento DESC LIMIT 1',
      [idCondominio, idPropiedad],
    );
    return rows[0] ? Number(rows[0].Saldo_Resultante) : 0;
  }

  async create(data: Omit<ICuentaCorrientePropiedad, 'IdMovimiento'>, connection?: PoolConnection): Promise<number> {
    const fields = Object.keys(data);
    const values = Object.values(data);
    const placeholders = fields.map(() => '?').join(', ');
    const columns = fields.map((f) => f).join(', ');
    const sql = `INSERT INTO CuentaCorrientePropiedad (${columns}) VALUES (${placeholders})`;

    let result: ResultSetHeader;
    if (connection) {
      [result] = await connection.execute<ResultSetHeader>(sql, values);
    } else {
      [result] = await this.connection.getPool().execute<ResultSetHeader>(sql, values);
    }
    return result.insertId;
  }

  private mapRow(row: RowDataPacket): ICuentaCorrientePropiedad {
    return {
      IdMovimiento: row.IdMovimiento,
      IdCondominio: row.IdCondominio,
      IdPropiedad: row.IdPropiedad,
      Fecha_Movimiento: row.Fecha_Movimiento,
      Tipo_Movimiento: row.Tipo_Movimiento,
      IdReferencia_Origen: row.IdReferencia_Origen,
      Descripcion: row.Descripcion,
      Monto: Number(row.Monto),
      Saldo_Resultante: Number(row.Saldo_Resultante),
    };
  }


}
