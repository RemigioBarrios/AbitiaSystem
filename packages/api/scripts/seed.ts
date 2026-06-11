import 'reflect-metadata';
import { container } from 'tsyringe';
//import { configureDataContainer, DataMode, LocalStore } from '@abitia/data';
import { configureDataContainer, DataMode } from '@abitia/data';
import { configureServicesContainer } from '@abitia/services';
import {
  ICondominioRepository,
  IPropiedadRepository,
  IGastoCondominioRepository,
  IPagoReportadoRepository,
  IReciboMensualRepository,
  IUsuarioRepository,
  ILedgerService,
  IReciboService,
  Rol,
  FormaPago,
  EstatusVerificacion,
} from '@abitia/core';
import { generateTenantToken } from '../src/middleware';
import dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';

// Cargar variables de entorno del archivo .env
dotenv.config({ path: path.join(__dirname, '../../../.env') });
dotenv.config();

// 1. Interruptor dinámico basado en el entorno (Igual que en server.ts)
const dbMode = (process.env.NODE_ENV === 'production' || process.env.DB_HOST) ? DataMode.MySQL : DataMode.Local;

configureDataContainer(dbMode);
configureServicesContainer();

const cRepo = container.resolve<ICondominioRepository>('ICondominioRepository');
const uRepo = container.resolve<IUsuarioRepository>('IUsuarioRepository');
const pRepo = container.resolve<IPropiedadRepository>('IPropiedadRepository');
const gRepo = container.resolve<IGastoCondominioRepository>('IGastoCondominioRepository');
const pagoRepo = container.resolve<IPagoReportadoRepository>('IPagoReportadoRepository');
const reciboService = container.resolve<IReciboService>('IReciboService');

async function seed() {
  // 2. Control de persistencia: Solo reseteamos la memoria si estamos en modo Local
  if (dbMode === DataMode.Local) {
    // Importación dinámica en caliente, igual que en tu server.ts
    const { LocalStore } = require('@abitia/data');
    const store: any = container.resolve(LocalStore);
    store.reset();
    console.log('[SEED] Modo Local detectado. Memoria RAM reseteada.');
  } else {
    console.log('[SEED] Modo Producción detectado. Inyectando directamente en MariaDB...');
    const { MySQLConnection } = require('@abitia/data');
    const mysqlConnection = container.resolve(MySQLConnection);
    await mysqlConnection.connect({
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'abitia_db',
    });
    console.log('[SEED] Conectado a MariaDB/MySQL.');

    const pool = mysqlConnection.getPoolSafe();
    if (pool) {
      await pool.execute('SET FOREIGN_KEY_CHECKS = 0');
      await pool.execute('TRUNCATE TABLE CuentaCorrientePropiedad');
      await pool.execute('TRUNCATE TABLE PagoReportado');
      await pool.execute('TRUNCATE TABLE ReciboMensual');
      await pool.execute('TRUNCATE TABLE GastoCondominio');
      await pool.execute('TRUNCATE TABLE Propiedad');
      await pool.execute('TRUNCATE TABLE UsuarioCondominioRol');
      await pool.execute('TRUNCATE TABLE Usuario');
      await pool.execute('TRUNCATE TABLE Condominio');
      await pool.execute('SET FOREIGN_KEY_CHECKS = 1');
      console.log('[SEED] Base de datos MariaDB/MySQL vaciada con éxito.');
    }
  }

  console.log('[SEED] Creando condominio Casa-10...');
  const idCondo = await cRepo.create({
    Nombre: 'Residencias Casa-10',
    Rif_IdFiscal: 'J-12345678-9',
    Direccion: 'Av. Principal, Casa-10',
    Subdominio_Slug: 'casa10',
    Porcentaje_Fondo_Reserva: 5.00,
    Configuracion_JSON: null,
  });
  console.log('  idCondominio = ' + idCondo);

  console.log('[SEED] Creando usuario Admin...');
  const idAdmin = await uRepo.create({
    Nombre: 'Admin',
    Apellido: 'Principal',
    Email: 'admin@casa10.com',
    Password_Hash: bcrypt.hashSync('admin123', 10), // En producción real esto debería pasar por un hash como bcrypt
    Telefono: null,
    Estatus: 1,
  });
  await uRepo.assignRole(idCondo, idAdmin, Rol.Administrador);
  const adminToken = generateTenantToken(idAdmin, 'admin@casa10.com', idCondo, Rol.Administrador);
  console.log('  idAdmin = ' + idAdmin + ' | rol = Administrador(2)');

  console.log('[SEED] Creando usuario Propietario...');
  const idOwner = await uRepo.create({
    Nombre: 'María',
    Apellido: 'González',
    Email: 'owner@casa10.com',
    Password_Hash: bcrypt.hashSync('owner123', 10),
    Telefono: '+58 412 1234567',
    Estatus: 1,
  });
  await uRepo.assignRole(idCondo, idOwner, Rol.Propietario);
  console.log('  idOwner = ' + idOwner + ' | rol = Propietario(3)');

  console.log('[SEED] Creando propiedad Casa-10 (Alicuota 10%)...');
  const idProp = await pRepo.create({
    IdCondominio: idCondo,
    Codigo_Nro: 'Casa-10',
    Alicuota: 0.10,
    IdPropietario_Actual: idOwner,
    Estatus: 1,
  });
  console.log('  idPropiedad = ' + idProp);

  console.log('[SEED] Creando gasto común ($1500) para 2025-06...');
  await gRepo.create({
    IdCondominio: idCondo,
    Periodo_MesAnio: '2025-06',
    Descripcion: 'Mantenimiento general junio',
    Monto: 1500.00,
    Tipo_Gasto: 1,
    Fecha_Gasto: new Date('2025-06-01'),
  });
  console.log('  Gasto creado');

  console.log('[SEED] Emitiendo recibos del periodo 2025-06...');
  await reciboService.emitirRecibosPeriodo(idCondo, '2025-06', new Date('2025-07-15'));
  console.log('  Recibos emitidos');

  console.log('[SEED] Reportando 3 pagos pendientes (para la bandeja)...');
  const pagos = [
    { monto: 100, ref: 'REF-001-20250610', fecha: '2025-06-10', comp: 'https://ejemplo.com/c1.pdf' },
    { monto: 200, ref: 'REF-002-20250611', fecha: '2025-06-11', comp: null },
    { monto: 150, ref: 'REF-003-20250612', fecha: '2025-06-12', comp: 'https://ejemplo.com/c3.pdf' },
  ];
  for (const p of pagos) {
    const id = await pagoRepo.create({
      IdCondominio: idCondo,
      IdPropiedad: idProp,
      IdUsuario_Reporta: idOwner,
      Monto: p.monto,
      Fecha_Transferencia: new Date(p.fecha),
      Referencia_Bancaria: p.ref,
      IdBanco_Destino: 1,
      Forma_Pago: FormaPago.Transferencia,
      Comprobante_Url: p.comp,
      Observaciones_User: 'Pago reportado por app',
      Estatus_Verificacion: EstatusVerificacion.Pendiente,
      Fecha_Verificacion: null,
      IdUsuario_Verifica: null,
      Motivo_Rechazo: null,
    });
    console.log('  Pago #' + id + ' — Ref: ' + p.ref + ' Monto: $' + p.monto);
  }

  console.log('\n=== SEED COMPLETO ===');
  console.log('Admin token: ' + adminToken);
  console.log('Email Admin: admin@casa10.com');
  console.log('Password:    admin123');
  console.log('Subdominio:  casa10');
  console.log('URL:         http://casa10.localhost:5173/bandeja-pagos.html\n');
}

seed().catch((err) => {
  console.error('[SEED ERROR]', err);
  process.exit(1);
});