import 'reflect-metadata';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { configureDataContainer, DataMode, MySQLConnection } from '@abitia/data';
import { configureServicesContainer } from '@abitia/services';
import { container } from 'tsyringe';
import {
  hstsMiddleware,
  multiTenantMiddleware,
} from './middleware';
import publicRoutes from './routes/public';
import authRoutes from './routes/auth';
import tenantRoutes from './routes/index';

configureDataContainer(DataMode.Local);
configureServicesContainer();

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());

// ============================================================================
// 1. HSTS + CLASIFICACION Y RESOLUCION DE HOST (todas las peticiones)
// ============================================================================
app.use(hstsMiddleware);

const mysqlConnection = container.resolve(MySQLConnection);
app.use(multiTenantMiddleware(mysqlConnection));

// ============================================================================
// 2. ROUTERS POR DOMINIO
// ============================================================================

const publicRouter = express.Router();
publicRouter.use('/', publicRoutes);

const globalAppRouter = express.Router();
globalAppRouter.use('/api/auth', authRoutes);

const tenantAppRouter = express.Router();
tenantAppRouter.use('/api/auth', authRoutes);
tenantAppRouter.use('/api', tenantRoutes);

// ============================================================================
// 3. DESPACHO POR TIPO DE HOST
// ============================================================================
app.use((req: Request, res: Response, next: NextFunction) => {
  switch (req.hostType) {
    case 'public':
      return publicRouter(req, res, next);
    case 'global':
      return globalAppRouter(req, res, next);
    case 'tenant':
      return tenantAppRouter(req, res, next);
    default:
      res.status(400).json({
        error: 'Host no reconocido',
        hint: 'Use abitia.co, app.abitia.app, o [slug].abitia.app',
      });
  }
});

// Health check global
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'abitia-api',
    version: '0.1.0',
    hostType: _req.hostType || 'unknown',
  });
});

app.listen(PORT, () => {
  const mode = process.env.NODE_ENV === 'production' ? 'PROD' : 'DEV';
  console.log(`[Abitia API] Puerto ${PORT} | Modo: ${mode} | Persistencia: Local-First`);
  console.log(`[Abitia]  abitia.co        -> Landing publico`);
  console.log(`[Abitia]  app.abitia.app   -> Login global unificado`);
  console.log(`[Abitia]  [slug].abitia.app -> Tenant multi-condominio`);
});

export default app;
