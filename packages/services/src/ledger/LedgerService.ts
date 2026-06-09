import { injectable, inject } from 'tsyringe';
import {
  ILedgerService,
  ICuentaCorrienteRepository,
  ICuentaCorrientePropiedad,
  TipoMovimiento,
} from '@abitia/core';

const MOVIMIENTOS_QUE_SUMAN: ReadonlySet<number> = new Set([
  TipoMovimiento.ReciboEmitido,
  TipoMovimiento.NotaDebito,
]);

const MOVIMIENTOS_QUE_RESTAN: ReadonlySet<number> = new Set([
  TipoMovimiento.PagoAplicado,
  TipoMovimiento.NotaCredito,
]);

const TIPOS_VALIDOS: ReadonlySet<number> = new Set([
  ...MOVIMIENTOS_QUE_SUMAN,
  ...MOVIMIENTOS_QUE_RESTAN,
]);

@injectable()
export class LedgerService implements ILedgerService {
  constructor(
    @inject('ICuentaCorrienteRepository') private ledgerRepo: ICuentaCorrienteRepository,
  ) {}

  // ==========================================================================
  // PUNTO DE ENTRADA ÚNICO AL LEDGER — ÚNICO MÉTODO QUE TOCA LA TABLA
  // ==========================================================================
  private async insertarMovimiento(params: {
    idCondominio: number;
    idPropiedad: number;
    tipoMovimiento: number;
    idReferenciaOrigen: number;
    descripcion: string;
    monto: number;
  }): Promise<number> {
    if (!TIPOS_VALIDOS.has(params.tipoMovimiento)) {
      throw new Error(`TipoMovimiento inválido: ${params.tipoMovimiento}. Válidos: 1,2,3,4`);
    }

    if (params.monto < 0) {
      throw new Error('El monto debe ser un valor absoluto positivo');
    }

    // Paso 1: Lectura indexada del último Saldo_Resultante (DESC LIMIT 1)
    const saldoAnterior = await this.ledgerRepo.getSaldoActual(
      params.idCondominio,
      params.idPropiedad,
    );

    // Paso 2: Fórmula según tipo de movimiento
    let nuevoSaldo: number;

    if (MOVIMIENTOS_QUE_SUMAN.has(params.tipoMovimiento)) {
      nuevoSaldo = Number((saldoAnterior + params.monto).toFixed(2));
    } else {
      nuevoSaldo = Number((saldoAnterior - params.monto).toFixed(2));
    }

    // Paso 3: Inserción inmutable (solo INSERT, nunca UPDATE ni DELETE)
    return this.ledgerRepo.create({
      IdCondominio: params.idCondominio,
      IdPropiedad: params.idPropiedad,
      Fecha_Movimiento: new Date(),
      Tipo_Movimiento: params.tipoMovimiento,
      IdReferencia_Origen: params.idReferenciaOrigen,
      Descripcion: params.descripcion,
      Monto: params.monto,
      Saldo_Resultante: nuevoSaldo,
    });
  }

  // ==========================================================================
  // MÉTODOS PÚBLICOS — CONVENIENCIA, DELEGAN EN insertarMovimiento
  // ==========================================================================

  async registrarReciboEmitido(
    idCondominio: number,
    idPropiedad: number,
    idRecibo: number,
    descripcion: string,
    monto: number,
  ): Promise<void> {
    await this.insertarMovimiento({
      idCondominio,
      idPropiedad,
      tipoMovimiento: TipoMovimiento.ReciboEmitido,
      idReferenciaOrigen: idRecibo,
      descripcion,
      monto,
    });
  }

  async registrarPagoAplicado(
    idCondominio: number,
    idPropiedad: number,
    idPago: number,
    descripcion: string,
    monto: number,
  ): Promise<void> {
    await this.insertarMovimiento({
      idCondominio,
      idPropiedad,
      tipoMovimiento: TipoMovimiento.PagoAplicado,
      idReferenciaOrigen: idPago,
      descripcion,
      monto,
    });
  }

  async registrarNotaCredito(
    idCondominio: number,
    idPropiedad: number,
    idReferencia: number,
    descripcion: string,
    monto: number,
  ): Promise<void> {
    await this.insertarMovimiento({
      idCondominio,
      idPropiedad,
      tipoMovimiento: TipoMovimiento.NotaCredito,
      idReferenciaOrigen: idReferencia,
      descripcion: `[NC] ${descripcion}`,
      monto,
    });
  }

  async registrarNotaDebito(
    idCondominio: number,
    idPropiedad: number,
    idReferencia: number,
    descripcion: string,
    monto: number,
  ): Promise<void> {
    await this.insertarMovimiento({
      idCondominio,
      idPropiedad,
      tipoMovimiento: TipoMovimiento.NotaDebito,
      idReferenciaOrigen: idReferencia,
      descripcion: `[ND] ${descripcion}`,
      monto,
    });
  }

  // ==========================================================================
  // CONSULTAS — READ-ONLY
  // ==========================================================================

  async getSaldoActual(idCondominio: number, idPropiedad: number): Promise<number> {
    return this.ledgerRepo.getSaldoActual(idCondominio, idPropiedad);
  }

  async getHistorial(
    idCondominio: number,
    idPropiedad: number,
  ): Promise<ICuentaCorrientePropiedad[]> {
    return this.ledgerRepo.findByPropiedad(idCondominio, idPropiedad);
  }
}
