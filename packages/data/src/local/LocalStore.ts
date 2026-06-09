import { injectable } from 'tsyringe';
import { ICondominio, IUsuario, IUsuarioCondominioRol, IPropiedad, IGastoCondominio, IReciboMensual, IPagoReportado, ICuentaCorrientePropiedad } from '@abitia/core';

@injectable()
export class LocalStore {
  condominios: Map<number, ICondominio> = new Map();
  usuarios: Map<number, IUsuario> = new Map();
  roles: Map<string, IUsuarioCondominioRol> = new Map();
  propiedades: Map<number, IPropiedad> = new Map();
  gastos: Map<number, IGastoCondominio> = new Map();
  recibos: Map<number, IReciboMensual> = new Map();
  pagos: Map<number, IPagoReportado> = new Map();
  ledger: Map<number, ICuentaCorrientePropiedad> = new Map();

  nextIds = {
    condominio: 1,
    usuario: 1,
    propiedad: 1,
    gasto: 1,
    recibo: 1,
    pago: 1,
    movimiento: 1,
  };

  reset(): void {
    this.condominios.clear();
    this.usuarios.clear();
    this.roles.clear();
    this.propiedades.clear();
    this.gastos.clear();
    this.recibos.clear();
    this.pagos.clear();
    this.ledger.clear();
    this.nextIds = {
      condominio: 1,
      usuario: 1,
      propiedad: 1,
      gasto: 1,
      recibo: 1,
      pago: 1,
      movimiento: 1,
    };
  }
}
