import { injectable, inject } from 'tsyringe';
import type { PoolConnection } from 'mysql2/promise';
import {
  IPagoService,
  ReportarPagoInput,
  AprobarPagoInput,
  RechazarPagoInput,
  IPagoReportadoRepository,
  IReciboMensualRepository,
  ILedgerService,
  IUsuarioRepository,
  ICuentaCorrienteRepository,
  IPagoReportado,
  EstatusVerificacion,
  EstatusPago,
  Rol,
} from '@abitia/core';
import { MySQLConnection } from '@abitia/data';

const ER_DUP_ENTRY = 1062;

@injectable()
export class PagoService implements IPagoService {
  constructor(
    @inject('IPagoReportadoRepository') private pagoRepo: IPagoReportadoRepository,
    @inject('IReciboMensualRepository') private reciboRepo: IReciboMensualRepository,
    @inject('ILedgerService') private ledgerService: ILedgerService,
    @inject('ICuentaCorrienteRepository') private ledgerRepo: ICuentaCorrienteRepository,
    @inject('IUsuarioRepository') private usuarioRepo: IUsuarioRepository,
    @inject(MySQLConnection) private mysqlConnection: MySQLConnection,
  ) {}

  // ==========================================================================
  // 1. REPORTAR PAGO (PROPIETARIO) — NO altera el Ledger
  //    Captura error de unicidad MariaDB para Referencia_Bancaria + IdCondominio
  // ==========================================================================
  async reportarPago(data: ReportarPagoInput): Promise<number> {
    const pagoData: Omit<IPagoReportado, 'IdPago' | 'Fecha_Reporte'> = {
      IdCondominio: data.idCondominio,
      IdPropiedad: data.idPropiedad,
      IdUsuario_Reporta: data.idUsuarioReporta,
      Monto: data.monto,
      Fecha_Transferencia: data.fechaTransferencia,
      Referencia_Bancaria: data.referenciaBancaria,
      IdBanco_Destino: data.idBancoDestino,
      Forma_Pago: data.formaPago,
      Comprobante_Url: data.comprobanteUrl || null,
      Observaciones_User: data.observaciones || null,
      Estatus_Verificacion: EstatusVerificacion.Pendiente,
      Fecha_Verificacion: null,
      IdUsuario_Verifica: null,
      Motivo_Rechazo: null,
    };

    try {
      return await this.pagoRepo.create(pagoData);
    } catch (err: unknown) {
      if (this.isDuplicateEntryError(err)) {
        throw new Error(
          `La referencia bancaria "${data.referenciaBancaria}" ya fue reportada en este condominio. ` +
          'No se permiten duplicados.',
        );
      }
      throw err;
    }
  }

  // ==========================================================================
  // 2. APROBAR PAGO (ADMINISTRADOR) — TRANSACCIÓN ATÓMICA MariaDB
  //    a) Actualiza Pago_Reportado a Estatus = 1 y sella auditoría
  //    b) Inserta movimiento Tipo 2 (Pago Aplicado) en el Ledger
  //    Si el Ledger falla → ROLLBACK completo
  // ==========================================================================
  async aprobarPago(input: AprobarPagoInput): Promise<void> {
    await this.validarRolAdministrador(input.idCondominio, input.idUsuarioVerifica);

    const pago = await this.pagoRepo.findById(input.idCondominio, input.idPago);
    if (!pago) throw new Error('Pago no encontrado');

    if (pago.Estatus_Verificacion !== EstatusVerificacion.Pendiente) {
      const estadoActual = pago.Estatus_Verificacion === EstatusVerificacion.Aprobado
        ? 'aprobado' : 'rechazado';
      throw new Error(`Este pago ya fue ${estadoActual}. Solo los pagos pendientes pueden ser verificados.`);
    }

    const pool = typeof this.mysqlConnection.getPoolSafe === 'function'
      ? this.mysqlConnection.getPoolSafe()
      : null;

    if (pool) {
      const connection = await this.mysqlConnection.getConnection();

      try {
        await connection.beginTransaction();

        // a) Actualizar Pago_Reportado → Estatus = 1, fecha y usuario verificador
        await connection.execute(
          'UPDATE PagoReportado SET Estatus_Verificacion = ?, IdUsuario_Verifica = ?, ' +
          'Motivo_Rechazo = NULL, Fecha_Verificacion = NOW() WHERE IdPago = ? AND IdCondominio = ?',
          [EstatusVerificacion.Aprobado, input.idUsuarioVerifica, input.idPago, input.idCondominio],
        );

        // b) Insertar movimiento Tipo 2 (Pago Aplicado) en Cuenta_Corriente_Propiedad
        await this.ledgerService.registrarPagoAplicado(
          pago.IdCondominio,
          pago.IdPropiedad,
          pago.IdPago,
          `Pago aprobado Ref: ${pago.Referencia_Bancaria}`,
          pago.Monto,
          connection,
        );

        await connection.commit();
      } catch (err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }
    } else {
      // Modo Local-First
      await this.pagoRepo.verificar(
        input.idCondominio,
        input.idPago,
        EstatusVerificacion.Aprobado,
        input.idUsuarioVerifica,
      );

      await this.ledgerService.registrarPagoAplicado(
        pago.IdCondominio,
        pago.IdPropiedad,
        pago.IdPago,
        `Pago aprobado Ref: ${pago.Referencia_Bancaria}`,
        pago.Monto,
      );
    }

    // Conciliación de recibos (fuera de la transacción — los recibos se compensan
    // de forma idempotente y no comprometen la integridad contable del Ledger)
    const recibosPendientes = await this.reciboRepo.findPendientesByPropiedad(
      pago.IdCondominio,
      pago.IdPropiedad,
    );

    let montoRestante = pago.Monto;

    for (const recibo of recibosPendientes) {
      if (montoRestante <= 0) break;

      const totalRecibo = Number(recibo.Total_A_Pagar);
      if (montoRestante >= totalRecibo) {
        await this.reciboRepo.updateEstatus(
          pago.IdCondominio,
          recibo.IdRecibo,
          EstatusPago.Pagado,
        );
        montoRestante = Number((montoRestante - totalRecibo).toFixed(2));
      } else {
        await this.reciboRepo.updateEstatus(
          pago.IdCondominio,
          recibo.IdRecibo,
          EstatusPago.Parcial,
        );
        montoRestante = 0;
      }
    }
  }

  // ==========================================================================
  // 3. RECHAZAR PAGO (ADMINISTRADOR) — NO interactúa con el Ledger
  //    Motivo_Rechazo obligatorio. Sin transacción (operación simple).
  // ==========================================================================
  async rechazarPago(input: RechazarPagoInput): Promise<void> {
    await this.validarRolAdministrador(input.idCondominio, input.idUsuarioVerifica);

    if (!input.motivoRechazo || input.motivoRechazo.trim().length === 0) {
      throw new Error('Motivo de rechazo es obligatorio al rechazar un pago.');
    }

    const pago = await this.pagoRepo.findById(input.idCondominio, input.idPago);
    if (!pago) throw new Error('Pago no encontrado');

    if (pago.Estatus_Verificacion !== EstatusVerificacion.Pendiente) {
      const estadoActual = pago.Estatus_Verificacion === EstatusVerificacion.Aprobado
        ? 'aprobado' : 'rechazado';
      throw new Error(`Este pago ya fue ${estadoActual}. Solo los pagos pendientes pueden ser verificados.`);
    }

    await this.pagoRepo.verificar(
      input.idCondominio,
      input.idPago,
      EstatusVerificacion.Rechazado,
      input.idUsuarioVerifica,
      input.motivoRechazo,
    );
  }

  // ==========================================================================
  // 4. BANDEJA DE VERIFICACIÓN — Alta densidad para el panel del administrador
  // ==========================================================================
  async getBandejaVerificacion(idCondominio: number): Promise<IPagoReportado[]> {
    return this.pagoRepo.findPendientesVerificar(idCondominio);
  }

  // ==========================================================================
  // VALIDACIÓN PRIVADA: Solo Administrador (Rol 1 o 2)
  // ==========================================================================
  private async validarRolAdministrador(
    idCondominio: number,
    idUsuario: number,
  ): Promise<void> {
    const roles = await this.usuarioRepo.getRolesByUsuario(idUsuario);
    const rolEnCondominio = roles.find((r) => r.IdCondominio === idCondominio);

    if (!rolEnCondominio) {
      throw new Error('El usuario no pertenece a este condominio.');
    }

    if (rolEnCondominio.Rol !== Rol.SuperAdmin && rolEnCondominio.Rol !== Rol.Administrador) {
      throw new Error('Solo un Administrador o SuperAdmin puede verificar pagos.');
    }
  }

  // ==========================================================================
  // DETECCIÓN DE ERROR DE UNICIDAD MariaDB (ER_DUP_ENTRY = 1062)
  // ==========================================================================
  private isDuplicateEntryError(err: unknown): boolean {
    if (typeof err === 'object' && err !== null) {
      const mysqlErr = err as Record<string, unknown>;
      if (mysqlErr.errno === ER_DUP_ENTRY || mysqlErr.code === 'ER_DUP_ENTRY') {
        return true;
      }
    }
    return false;
  }
}
