import 'reflect-metadata';
import { container, Lifecycle } from 'tsyringe';
import { LocalStore } from './local/LocalStore';
import { MySQLConnection } from './mysql/connection';

import { LocalCondominioRepository } from './local/LocalCondominioRepository';
import { LocalUsuarioRepository } from './local/LocalUsuarioRepository';
import { LocalPropiedadRepository } from './local/LocalPropiedadRepository';
import { LocalGastoCondominioRepository } from './local/LocalGastoCondominioRepository';
import { LocalReciboMensualRepository } from './local/LocalReciboMensualRepository';
import { LocalPagoReportadoRepository } from './local/LocalPagoReportadoRepository';
import { LocalCuentaCorrienteRepository } from './local/LocalCuentaCorrienteRepository';

import { MySQLCondominioRepository } from './mysql/CondominioRepository';
import { MySQLUsuarioRepository } from './mysql/UsuarioRepository';
import { MySQLPropiedadRepository } from './mysql/PropiedadRepository';
import { MySQLGastoCondominioRepository } from './mysql/GastoCondominioRepository';
import { MySQLReciboMensualRepository } from './mysql/ReciboMensualRepository';
import { MySQLPagoReportadoRepository } from './mysql/PagoReportadoRepository';
import { MySQLCuentaCorrienteRepository } from './mysql/CuentaCorrienteRepository';

import {
  ICondominioRepository,
  IUsuarioRepository,
  IPropiedadRepository,
  IGastoCondominioRepository,
  IReciboMensualRepository,
  IPagoReportadoRepository,
  ICuentaCorrienteRepository,
} from '@abitia/core';

export enum DataMode {
  MySQL = 'mysql',
  Local = 'local',
}

function registerRepositories(mode: DataMode): void {
  if (mode === DataMode.MySQL) {
    container.register<ICondominioRepository>('ICondominioRepository', { useClass: MySQLCondominioRepository });
    container.register<IUsuarioRepository>('IUsuarioRepository', { useClass: MySQLUsuarioRepository });
    container.register<IPropiedadRepository>('IPropiedadRepository', { useClass: MySQLPropiedadRepository });
    container.register<IGastoCondominioRepository>('IGastoCondominioRepository', { useClass: MySQLGastoCondominioRepository });
    container.register<IReciboMensualRepository>('IReciboMensualRepository', { useClass: MySQLReciboMensualRepository });
    container.register<IPagoReportadoRepository>('IPagoReportadoRepository', { useClass: MySQLPagoReportadoRepository });
    container.register<ICuentaCorrienteRepository>('ICuentaCorrienteRepository', { useClass: MySQLCuentaCorrienteRepository });
  } else {
    container.register<ICondominioRepository>('ICondominioRepository', { useClass: LocalCondominioRepository });
    container.register<IUsuarioRepository>('IUsuarioRepository', { useClass: LocalUsuarioRepository });
    container.register<IPropiedadRepository>('IPropiedadRepository', { useClass: LocalPropiedadRepository });
    container.register<IGastoCondominioRepository>('IGastoCondominioRepository', { useClass: LocalGastoCondominioRepository });
    container.register<IReciboMensualRepository>('IReciboMensualRepository', { useClass: LocalReciboMensualRepository });
    container.register<IPagoReportadoRepository>('IPagoReportadoRepository', { useClass: LocalPagoReportadoRepository });
    container.register<ICuentaCorrienteRepository>('ICuentaCorrienteRepository', { useClass: LocalCuentaCorrienteRepository });
  }
}

export function configureDataContainer(mode: DataMode = DataMode.Local): void {
  container.register(LocalStore, { useClass: LocalStore }, { lifecycle: Lifecycle.Singleton });
  container.register(MySQLConnection, { useClass: MySQLConnection }, { lifecycle: Lifecycle.Singleton });

  container.registerInstance('DataMode', mode);
  registerRepositories(mode);
}

export { container };
