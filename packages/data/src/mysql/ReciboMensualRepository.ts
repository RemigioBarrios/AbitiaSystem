import { injectable, inject } from 'tsyringe';
import { IReciboMensual, IReciboMensualRepository } from '@abitia/core';
import { MySQLConnection } from './connection';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

@injectable()
export class MySQLReciboMensualRepository implements IReciboMensualRepository {
  constructor(@inject(MySQLConnection) private connection: MySQLConnection) {}

  async findById(idCondominio: number, id: number): Promise<IReciboMensual | null> {
    const [rows] = await this.connection.getPool().execute<RowDataPacket[]>(
      'SELECT r.* FROM ReciboMensual r ' +
        'INNER JOIN Propiedad p ON r.IdPropiedad = p.IdPropiedad ' +
        'WHERE p.IdCondominio = ? AND r.IdRecibo = ?',
      [idCondominio, id],
    );
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async findPendientesByPropiedad(idCondominio: number, idPropiedad: number): Promise<IReciboMensual[]> {
    const [rows] = await this.connection.getPool().execute<RowDataPacket[]>(
      'SELECT r.* FROM ReciboMensual r ' +
        'INNER JOIN Propiedad p ON r.IdPropiedad = p.IdPropiedad ' +
        'WHERE p.IdCondominio = ? AND r.IdPropiedad = ? AND r.Estatus_Pago <> 1 ' +
        'ORDER BY r.Periodicidad_MesAnio ASC',
      [idCondominio, idPropiedad],
    );
    return rows.map((r) => this.mapRow(r));
  }

  async findAllByPeriod(idCondominio: number, periodo: string): Promise<IReciboMensual[]> {
    const [rows] = await this.connection.getPool().execute<RowDataPacket[]>(
      'SELECT r.* FROM ReciboMensual r ' +
        'INNER JOIN Propiedad p ON r.IdPropiedad = p.IdPropiedad ' +
        'WHERE p.IdCondominio = ? AND r.Periodicidad_MesAnio = ?',
      [idCondominio, periodo],
    );
    return rows.map((r) => this.mapRow(r));
  }

  async getSaldoPendiente(idCondominio: number, idPropiedad: number): Promise<number> {
    const [rows] = await this.connection.getPool().execute<RowDataPacket[]>(
      'SELECT COALESCE(SUM(r.Total_A_Pagar), 0) AS saldo FROM ReciboMensual r ' +
        'INNER JOIN Propiedad p ON r.IdPropiedad = p.IdPropiedad ' +
        'WHERE p.IdCondominio = ? AND r.IdPropiedad = ? AND r.Estatus_Pago <> 1',
      [idCondominio, idPropiedad],
    );
    return Number(rows[0].saldo);
  }

  async createBatch(recibos: Omit<IReciboMensual, 'IdRecibo'>[]): Promise<void> {
    if (recibos.length === 0) return;

    const fields = [
      'IdPropiedad',
      'Periodicidad_MesAnio',
      'Fecha_Emision',
      'Fecha_Vencimiento',
      'Monto_Gasto_Comun',
      'Monto_Gasto_NoComun',
      'Monto_Fondo_Reserva',
      'Saldo_Anterior_Pendiente',
      'Total_A_Pagar',
      'Estatus_Pago',
    ];

    const placeholders = recibos.map(() => `(${fields.map(() => '?').join(', ')})`).join(', ');
    const values = recibos.flatMap((r) => [
      r.IdPropiedad,
      r.Periodicidad_MesAnio,
      r.Fecha_Emision,
      r.Fecha_Vencimiento,
      r.Monto_Gasto_Comun,
      r.Monto_Gasto_NoComun,
      r.Monto_Fondo_Reserva,
      r.Saldo_Anterior_Pendiente,
      r.Total_A_Pagar,
      r.Estatus_Pago,
    ]);

    await this.connection.getPool().execute(
      `INSERT INTO ReciboMensual (${fields.join(', ')}) VALUES ${placeholders}`,
      values,
    );
  }

  async updateEstatus(idCondominio: number, idRecibo: number, estatus: number): Promise<void> {
    await this.connection.getPool().execute(
      'UPDATE ReciboMensual r ' +
        'INNER JOIN Propiedad p ON r.IdPropiedad = p.IdPropiedad ' +
        'SET r.Estatus_Pago = ? ' +
        'WHERE p.IdCondominio = ? AND r.IdRecibo = ?',
      [estatus, idCondominio, idRecibo],
    );
  }

  private mapRow(row: RowDataPacket): IReciboMensual {
    return {
      IdRecibo: row.IdRecibo,
      IdPropiedad: row.IdPropiedad,
      Periodicidad_MesAnio: row.Periodicidad_MesAnio,
      Fecha_Emision: row.Fecha_Emision,
      Fecha_Vencimiento: row.Fecha_Vencimiento,
      Monto_Gasto_Comun: Number(row.Monto_Gasto_Comun),
      Monto_Gasto_NoComun: Number(row.Monto_Gasto_NoComun),
      Monto_Fondo_Reserva: Number(row.Monto_Fondo_Reserva),
      Saldo_Anterior_Pendiente: Number(row.Saldo_Anterior_Pendiente),
      Total_A_Pagar: Number(row.Total_A_Pagar),
      Estatus_Pago: row.Estatus_Pago,
    };
  }
}
