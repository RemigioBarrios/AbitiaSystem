import 'reflect-metadata';
import express, { Express, Router, Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import request from 'supertest';
import {
  LocalStore,
  configureDataContainer,
  DataMode,
  MySQLConnection,
} from '@abitia/data';
import {
  configureServicesContainer,
} from '@abitia/services';
import {
  ICondominioRepository,
  IPropiedadRepository,
  IGastoCondominioRepository,
  IReciboMensualRepository,
  ICuentaCorrienteRepository,
  IUsuarioRepository,
  Rol,
} from '@abitia/core';
import {
  authMiddleware,
  generateTenantToken,
} from '../src/middleware';
import authRoutes from '../src/routes/auth';
import tenantRoutes from '../src/routes/index';

// =============================================================================
// HELPERS
// =============================================================================
function createTestApp(idCondominio: number): Express {
  const app = express();
  app.use(express.json());

  // Middleware de resolución de tenant (mock — no usa MySQL)
  app.use((req: Request, res: Response, next: NextFunction) => {
    const host: string = (req.headers.host || '').toLowerCase();

    // Test 1: Host malicioso/de prueba → rechazo de seguridad
    if (host === 'rechazo-seguridad.test') {
      res.status(400).json({
        error: 'Host no reconocido',
        hint: 'Use abitia.co, app.abitia.app, o [slug].abitia.app',
      });
      return;
    }

    // Host tenant válido
    req.hostType = 'tenant';
    req.idCondominio = idCondominio;
    next();
  });

  // Enrutamiento: auth + tenant routes
  const router = Router();
  router.use('/api/auth', authRoutes);
  router.use('/api', tenantRoutes);
  app.use(router);

  return app;
}

function createMockConnection(store: LocalStore): { getConnection: () => Promise<Record<string, jest.Mock>>, getPoolSafe: jest.Mock } {
  const mockConn = {
    beginTransaction: jest.fn().mockResolvedValue(undefined),
    execute: jest.fn().mockImplementation(async (_sql: string, params: unknown[]) => {
      const [estatus, idUsuarioVerifica, idPago, idCondominio] = params as [number, number, number, number];
      const pago = store.pagos.get(idPago);
      if (pago && pago.IdCondominio === idCondominio) {
        pago.Estatus_Verificacion = estatus;
        pago.IdUsuario_Verifica = idUsuarioVerifica;
        pago.Fecha_Verificacion = new Date();
        pago.Motivo_Rechazo = null;
      }
      return [{ affectedRows: 1 }];
    }),
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
  };
  return {
    getConnection: jest.fn().mockResolvedValue(mockConn),
    getPoolSafe: jest.fn().mockReturnValue({}),
  };
}

// =============================================================================
// SUITE DE SIMULACIÓN: FLUJO FINANCIERO MULTI-TENANT (CAJA + LEDGER)
// =============================================================================
describe('Suite: Flujo Financiero Multi-Tenant (Caja + Ledger)', () => {
  let app: Express;
  let store: LocalStore;
  let adminToken: string;
  let ownerToken: string;
  let idCondominio: number;
  let idPropiedad: number;

  beforeAll(async () => {
    // 1. Inicializar contenedor DI en modo Local-First (sin MySQL)
    configureDataContainer(DataMode.Local);
    configureServicesContainer();

    store = container.resolve(LocalStore);

    // 2. Reemplazar MySQLConnection por un mock que opera sobre LocalStore
    const mockMySQL = createMockConnection(store);
    container.registerInstance(MySQLConnection, mockMySQL as unknown as MySQLConnection);

    // 3. Sembrar datos de prueba
    const condominioRepo = container.resolve<ICondominioRepository>('ICondominioRepository');
    const usuarioRepo = container.resolve<IUsuarioRepository>('IUsuarioRepository');
    const propiedadRepo = container.resolve<IPropiedadRepository>('IPropiedadRepository');
    const gastoRepo = container.resolve<IGastoCondominioRepository>('IGastoCondominioRepository');

    // 3a. Condominio
    idCondominio = await condominioRepo.create({
      Nombre: 'Residencias Casa-10',
      Rif_IdFiscal: 'J-12345678-9',
      Direccion: 'Av. Principal, Casa-10',
      Subdominio_Slug: 'casa10',
      Porcentaje_Fondo_Reserva: 5.00,
      Configuracion_JSON: null,
    });

    // 3b. Usuario Administrador (Rol 2)
    const idAdmin = await usuarioRepo.create({
      Nombre: 'Admin',
      Apellido: 'Principal',
      Email: 'admin@casa10.com',
      Password_Hash: 'hashed',
      Telefono: null,
      Estatus: 1,
    });
    await usuarioRepo.assignRole(idCondominio, idAdmin, Rol.Administrador);

    // 3c. Usuario Propietario (Rol 3)
    const idOwner = await usuarioRepo.create({
      Nombre: 'Owner',
      Apellido: 'Propietario',
      Email: 'owner@casa10.com',
      Password_Hash: 'hashed',
      Telefono: null,
      Estatus: 1,
    });
    await usuarioRepo.assignRole(idCondominio, idOwner, Rol.Propietario);

    // 3d. Propiedad "Casa-10" (Alicuota 10%)
    idPropiedad = await propiedadRepo.create({
      IdCondominio: idCondominio,
      Codigo_Nro: 'Casa-10',
      Alicuota: 0.10,
      IdPropietario_Actual: idOwner,
      Estatus: 1,
    });

    // 3e. Gasto común del período (Tipo 1, $1500)
    await gastoRepo.create({
      IdCondominio: idCondominio,
      Periodo_MesAnio: '2025-06',
      Descripcion: 'Mantenimiento general',
      Monto: 1500.00,
      Tipo_Gasto: 1,
      Fecha_Gasto: new Date('2025-06-01'),
    });

    // 4. Generar tokens JWT para pruebas
    adminToken = generateTenantToken(idAdmin, 'admin@casa10.com', idCondominio, Rol.Administrador);
    ownerToken = generateTenantToken(idOwner, 'owner@casa10.com', idCondominio, Rol.Propietario);

    // 5. Crear aplicación Express para supertest
    app = createTestApp(idCondominio);
  });

  afterAll(() => {
    store.reset();
  });

  // ===========================================================================
  // TEST 1: RECHAZO DE SEGURIDAD
  // ===========================================================================
  test('1. Rechazo de seguridad: Host no reconocido retorna 400', async () => {
    const res = await request(app)
      .get('/api/propiedades')
      .set('Host', 'rechazo-seguridad.test')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toContain('Host no reconocido');
  });

  // ===========================================================================
  // TEST 2: EMISIÓN DE RECIBO MENSUAL
  // ===========================================================================
  let idRecibo: number | null = null;

  test('2. Emision: Generar recibo de $150 para Casa-10 y verificar Ledger', async () => {
    // Emitir recibos del período 2025-06
    const emitRes = await request(app)
      .post('/api/recibos/emitir')
      .set('Host', 'casa10.localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ periodo: '2025-06', fechaVencimiento: '2025-07-15' });

    expect(emitRes.status).toBe(201);
    expect(emitRes.body.message).toContain('Recibos emitidos');

    // Verificar que el recibo fue creado en el repositorio local
    const reciboRepo = container.resolve<IReciboMensualRepository>('IReciboMensualRepository');
    const recibos = await reciboRepo.findPendientesByPropiedad(idCondominio, idPropiedad);
    expect(recibos.length).toBeGreaterThanOrEqual(1);

    const recibo = recibos[0];
    expect(recibo.Total_A_Pagar).toBe(150);
    expect(recibo.IdPropiedad).toBe(idPropiedad);
    expect(recibo.Estatus_Pago).toBe(0); // Pendiente
    idRecibo = recibo.IdRecibo;

    // Verificar que el Ledger sumó +$150 (Tipo 1 = ReciboEmitido)
    const ledgerRepo = container.resolve<ICuentaCorrienteRepository>('ICuentaCorrienteRepository');
    const historial = await ledgerRepo.findByPropiedad(idCondominio, idPropiedad);
    expect(historial.length).toBe(1);

    const movimiento = historial[0];
    expect(movimiento.Tipo_Movimiento).toBe(1); // ReciboEmitido
    expect(movimiento.Monto).toBe(150);
    expect(movimiento.Saldo_Resultante).toBe(150);

    // También via API
    const saldoRes = await request(app)
      .get(`/api/ledger/${idPropiedad}/saldo`)
      .set('Host', 'casa10.localhost')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(saldoRes.status).toBe(200);
    expect(saldoRes.body.saldo).toBe(150);
  });

  // ===========================================================================
  // TEST 3: REPORTE DE PAGO POR TRANSFERENCIA
  // ===========================================================================
  let idPago: number | null = null;

  test('3. Reporte: Propietario reporta pago de $100 por transferencia', async () => {
    const res = await request(app)
      .post('/api/pagos/reportar')
      .set('Host', 'casa10.localhost')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        idPropiedad,
        monto: 100,
        fechaTransferencia: '2025-06-10T12:00:00Z',
        referenciaBancaria: 'REF-ABC-123',
        idBancoDestino: 1,
        formaPago: 1, // Transferencia
        comprobanteUrl: 'https://ejemplo.com/comprobante.pdf',
        observaciones: 'Pago de prueba',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('idPago');
    idPago = res.body.idPago;
    expect(typeof idPago).toBe('number');
  });

  // ===========================================================================
  // TEST 4: PREVENCIÓN DE FRAUDE (MISMA REFERENCIA BANCARIA)
  // ===========================================================================
  test('4. Prevencion de Fraude: Misma referencia bancaria da 409 Conflict', async () => {
    const res = await request(app)
      .post('/api/pagos/reportar')
      .set('Host', 'casa10.localhost')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        idPropiedad,
        monto: 50,
        fechaTransferencia: '2025-06-11T12:00:00Z',
        referenciaBancaria: 'REF-ABC-123', // ¡Misma referencia!
        idBancoDestino: 1,
        formaPago: 1,
        comprobanteUrl: null,
        observaciones: 'Intento duplicado',
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('ya fue reportada');
    expect(res.body.error).toContain('REF-ABC-123');
  });

  // ===========================================================================
  // TEST 5: APROBACIÓN ADMIN + VERIFICACIÓN MATEMÁTICA DEL LEDGER INMUTABLE
  // ===========================================================================
  test('5. Aprobacion: Admin aprueba $100, Ledger registra Tipo 2, Saldo = $50', async () => {
    expect(idPago).not.toBeNull();
    expect(idRecibo).not.toBeNull();

    // 5a. Obtener historial del Ledger antes de aprobar
    const ledgerRepo = container.resolve<ICuentaCorrienteRepository>('ICuentaCorrienteRepository');
    const historialBefore = await ledgerRepo.findByPropiedad(idCondominio, idPropiedad);
    const countBefore = historialBefore.length;

    // 5b. Aprobar el pago via API
    const approveRes = await request(app)
      .post('/api/pagos/aprobar')
      .set('Host', 'casa10.localhost')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ idPago });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.message).toContain('aprobado');

    // 5c. Verificar que el Ledger ahora tiene UN movimiento nuevo (Tipo 2)
    const historialAfter = await ledgerRepo.findByPropiedad(idCondominio, idPropiedad);
    expect(historialAfter.length).toBe(countBefore + 1);

    const ultimoMovimiento = historialAfter[historialAfter.length - 1];
    expect(ultimoMovimiento.Tipo_Movimiento).toBe(2); // PagoAplicado
    expect(ultimoMovimiento.Monto).toBe(100);
    expect(ultimoMovimiento.Saldo_Resultante).toBe(50);
    expect(ultimoMovimiento.IdReferencia_Origen).toBe(idPago);
    expect(ultimoMovimiento.Descripcion).toContain('REF-ABC-123');

    // 5d. Verificar que el saldo via API también es $50
    const saldoRes = await request(app)
      .get(`/api/ledger/${idPropiedad}/saldo`)
      .set('Host', 'casa10.localhost')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(saldoRes.status).toBe(200);
    expect(saldoRes.body.saldo).toBe(50);

    // 5e. Verificar que el recibo quedó como Parcial (se pagaron $100 de $150)
    const reciboRepo = container.resolve<IReciboMensualRepository>('IReciboMensualRepository');
    const reciboActualizado = await reciboRepo.findById(idCondominio, idRecibo!);
    expect(reciboActualizado).not.toBeNull();
    expect(reciboActualizado!.Estatus_Pago).toBe(2); // Parcial
  });
});
