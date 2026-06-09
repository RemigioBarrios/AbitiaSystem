import { Router } from 'express';
import { authMiddleware } from '../middleware';
import {
  CondominioController,
  PropiedadController,
  GastoController,
  ReciboController,
  PagoController,
  LedgerController,
} from '../controllers';

const router = Router();

const condominioCtrl = new CondominioController();
const propiedadCtrl = new PropiedadController();
const gastoCtrl = new GastoController();
const reciboCtrl = new ReciboController();
const pagoCtrl = new PagoController();
const ledgerCtrl = new LedgerController();

router.get('/propiedades', authMiddleware, propiedadCtrl.listByCondominio.bind(propiedadCtrl));

router.get('/gastos/:periodo', authMiddleware, gastoCtrl.byPeriod.bind(gastoCtrl));
router.post('/gastos', authMiddleware, gastoCtrl.create.bind(gastoCtrl));

router.post('/recibos/emitir', authMiddleware, reciboCtrl.emitirPeriodo.bind(reciboCtrl));
router.get('/recibos/pendientes/:idPropiedad', authMiddleware, reciboCtrl.pendientes.bind(reciboCtrl));

router.post('/pagos/reportar', authMiddleware, pagoCtrl.reportar.bind(pagoCtrl));
router.get('/pagos/bandeja', authMiddleware, pagoCtrl.bandeja.bind(pagoCtrl));
router.post('/pagos/aprobar', authMiddleware, pagoCtrl.aprobar.bind(pagoCtrl));
router.post('/pagos/rechazar', authMiddleware, pagoCtrl.rechazar.bind(pagoCtrl));

router.get('/ledger/:idPropiedad', authMiddleware, ledgerCtrl.historial.bind(ledgerCtrl));
router.get('/ledger/:idPropiedad/saldo', authMiddleware, ledgerCtrl.saldo.bind(ledgerCtrl));

export default router;
