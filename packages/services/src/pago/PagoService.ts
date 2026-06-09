import { injectable, inject } from 'tsyringe';
import {
  IPagoService,
  ReportarPagoInput,
  PagoVerificationInput,
  IPagoReportadoRepository,
  IReciboMensualRepository,
  ILedgerService,
  IUsuarioRepository,
  IPagoReportado,
  EstatusVerificacion,
  EstatusPago,
  Rol,
} from '@abitia/core';

@injectable()
export class PagoService implements IPagoService {
  constructor(
    @inject('IPagoReportadoRepository') private pagoRepo: IPagoReportadoRepository,
    @inject('IReciboMensualRepository') private reciboRepo: IReciboMensualRepository,
    @inject('ILedgerService') private ledgerService: ILedgerService,
    @inject('IUsuarioRepository') private usuarioRepo: IUsuarioRepository,
  ) {}

  // ==========================================================================
  // 1. REPORTE DE PROPIETARIO — NO altera el Ledger
  // ==========================================================================
  async reportarPago(data: ReportarPagoInput): Promise<number> {
    // Prevención de fraude: Referencia_Bancaria única por condominio
    const pagoExistente = await this.pagoRepo.findByReferencia(
      data.idCondominio,
      data.referenciaBancaria,
    );

    if (pagoExistente) {
      const estadoActual = pagoExistente.Estatus_Verificacion === EstatusVerificacion.Aprobado
        ? 'aprobado'
        : pagoExistente.Estatus_Verificacion === EstatusVerificacion.Rechazado
          ? 'rechazado'
          : 'pendiente de verificación';

      throw new Error(
        `La referencia bancaria "${data.referenciaBancaria}" ya fue reportada (estado: ${estadoActual}). ` +
        'No se permiten duplicados.',
      );
    }

    // Inserción con Estatus = 0 (Pendiente). El Ledger NO se toca aquí.
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

    return this.pagoRepo.create(pagoData);
  }

  // ==========================================================================
  // 2. VERIFICACIÓN (APROBAR / RECHAZAR) — Solo Administrador
  // ==========================================================================
  async verificarPago(input: PagoVerificationInput): Promise<void> {
    // Validar rol de administrador
    await this.validarRolAdministrador(input.idCondominio, input.idUsuarioVerifica);

    // Obtener el pago
    const pago = await this.pagoRepo.findById(input.idCondominio, input.idPago);
    if (!pago) throw new Error('Pago no encontrado');

    // Validar que solo pagos pendientes puedan ser verificados
    if (pago.Estatus_Verificacion !== EstatusVerificacion.Pendiente) {
      const estadoActual = pago.Estatus_Verificacion === EstatusVerificacion.Aprobado
        ? 'aprobado'
        : 'rechazado';
      throw new Error(`Este pago ya fue ${estadoActual}. Solo los pagos pendientes pueden ser verificados.`);
    }

    // Validar Motivo_Rechazo obligatorio al rechazar
    if (input.estatus === EstatusVerificacion.Rechazado) {
      if (!input.motivoRechazo || input.motivoRechazo.trim().length === 0) {
        throw new Error('Motivo de rechazo es obligatorio al rechazar un pago.');
      }
    }

    // Sellar auditoría: actualizar estatus, fecha, usuario verificador
    await this.pagoRepo.verificar(
      input.idCondominio,
      input.idPago,
      input.estatus,
      input.idUsuarioVerifica,
      input.motivoRechazo,
    );

    // ======================================================================
    // ACCIÓN: APROBAR → Disparar inserción atómica en Ledger + conciliar recibos
    // ======================================================================
    if (input.estatus === EstatusVerificacion.Aprobado) {
      // Inserción inmutable en Cuenta_Corriente_Propiedad (Tipo 2: Pago Aplicado)
      await this.ledgerService.registrarPagoAplicado(
        pago.IdCondominio,
        pago.IdPropiedad,
        pago.IdPago,
        `Pago aprobado Ref: ${pago.Referencia_Bancaria}`,
        pago.Monto,
      );

      // Conciliación de recibos: aplicar pago a los recibos pendientes más antiguos
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

    // ======================================================================
    // ACCIÓN: RECHAZAR → NO altera el Ledger. Propiedad intacta.
    // ======================================================================
    // (No se ejecuta ninguna acción adicional; el registro queda rechazado
    //  y el usuario puede volver a reportar con otra referencia.)
  }

  // ==========================================================================
  // 3. BANDEJA DE VERIFICACIÓN — Alta densidad para el panel del administrador
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
}
