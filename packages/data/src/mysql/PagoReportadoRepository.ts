import { injectable, inject } from 'tsyringe';
import { IPagoReportado, IPagoReportadoRepository } from '@abitia/core';
import { MySQLConnection } from './connection';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

@injectable()
export class MySQLPagoReportadoRepository implements IPagoReportadoRepository {
  constructor(@inject(MySQLConnection) private connection: MySQLConnection) {}

  async findById(idCondominio: number, id: number): Promise<IPagoReportado | null> {
    const [rows] = await this.connection.getPool().execute<RowDataPacket[]>(
      'SELECT * FROM PagoReportado WHERE IdPago = ? AND IdCondominio = ?',
      [id, idCondominio],
    );
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async findPendientesVerificar(idCondominio: number): Promise<IPagoReportado[]> {
    const [rows] = await this.connection.getPool().execute<RowDataPacket[]>(
      'SELECT * FROM PagoReportado WHERE IdCondominio = ? AND Estatus_Verificacion = 0 ' +
        'ORDER BY Fecha_Reporte DESC',
      [idCondominio],
    );
    return rows.map((r) => this.mapRow(r));
  }

  async findByReferencia(idCondominio: number, referencia: string): Promise<IPagoReportado | null> {
    const [rows] = await this.connection.getPool().execute<RowDataPacket[]>(
      'SELECT * FROM PagoReportado WHERE IdCondominio = ? AND Referencia_Bancaria = ?',
      [idCondominio, referencia],
    );
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async create(data: Omit<IPagoReportado, 'IdPago' | 'Fecha_Reporte'>): Promise<number> {
    const fields = Object.keys(data);
    const values = Object.values(data);
    const placeholders = fields.map(() => '?').join(', ');
    const columns = fields.map((f) => f).join(', ');

    const [result] = await this.connection.getPool().execute<ResultSetHeader>(
      `INSERT INTO PagoReportado (${columns}) VALUES (${placeholders})`,
      values,
    );
    return result.insertId;
  }

  async verificar(
    idCondominio: number,
    idPago: number,
    estatus: number,
    idUsuarioVerifica: number,
    motivoRechazo?: string,
  ): Promise<void> {
    await this.connection.getPool().execute(
      'UPDATE PagoReportado SET Estatus_Verificacion = ?, IdUsuario_Verifica = ?, ' +
        'Motivo_Rechazo = ?, Fecha_Verificacion = NOW() WHERE IdPago = ? AND IdCondominio = ?',
      [estatus, idUsuarioVerifica, motivoRechazo ?? null, idPago, idCondominio],
    );
  }

  private mapRow(row: RowDataPacket): IPagoReportado {
    return {
      IdPago: row.IdPago,
      IdCondominio: row.IdCondominio,
      IdPropiedad: row.IdPropiedad,
      IdUsuario_Reporta: row.IdUsuario_Reporta,
      Fecha_Reporte: row.Fecha_Reporte,
      Monto: Number(row.Monto),
      Fecha_Transferencia: row.Fecha_Transferencia,
      Referencia_Bancaria: row.Referencia_Bancaria,
      IdBanco_Destino: row.IdBanco_Destino,
      Forma_Pago: row.Forma_Pago,
      Comprobante_Url: row.Comprobante_Url,
      Observaciones_User: row.Observaciones_User,
      Estatus_Verificacion: row.Estatus_Verificacion,
      Fecha_Verificacion: row.Fecha_Verificacion,
      IdUsuario_Verifica: row.IdUsuario_Verifica,
      Motivo_Rechazo: row.Motivo_Rechazo,
    };
  }


}
