import 'reflect-metadata';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { configureDataContainer, DataMode } from '@abitia/data';
import { configureServicesContainer } from '@abitia/services';
import { container } from 'tsyringe';
import { ITenantResolutionService, HostType } from '@abitia/core';
import {
  hstsMiddleware,
  hostClassifierMiddleware,
  tenantResolutionMiddleware,
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
// 1. HSTS + CLASIFICACIÓN DE HOST (todas las peticiones)
// ============================================================================
app.use(hstsMiddleware);
app.use(hostClassifierMiddleware);

// ============================================================================
// 2. ROUTERS POR DOMINIO
// ============================================================================

// --- Router público: abitia.co / www.abitia.co ---
// Cero persistencia de negocio. Solo contenido estático/marketing.
const publicRouter = express.Router();
publicRouter.use('/', publicRoutes);

// --- Router app global: app.abitia.app ---
// Login unificado. Lee Usuario y Usuario_Condominio_Rol.
const globalAppRouter = express.Router();
globalAppRouter.use('/api/auth', authRoutes);

// --- Router tenant: [slug].abitia.app ---
// Resuelve IdCondominio, inyecta en req, expone rutas operativas + auth.
const tenantAppRouter = express.Router();
tenantAppRouter.use(tenantResolutionMiddleware);
tenantAppRouter.use('/api/auth', authRoutes);
tenantAppRouter.use('/api', tenantRoutes);

// ============================================================================
// 3. DESPACHO POR TIPO DE HOST
// ============================================================================
app.use((req: Request, res: Response, next: NextFunction) => {
  switch (req.hostType) {
    case HostType.PUBLIC:
      return publicRouter(req, res, next);
    case HostType.GLOBAL_APP:
      return globalAppRouter(req, res, next);
    case HostType.TENANT:
      return tenantAppRouter(req, res, next);
    default:
      res.status(400).json({
        error: 'Host no reconocido',
        hint: 'Use abitia.co, app.abitia.app, o [slug].abitia.app',
      });
  }
});

// Health check global (alcanzable desde cualquier dominio)
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'abitia-api',
    version: '0.1.0',
    hostType: _req.hostType || 'unknown',
  });
});

// ============================================================================
// 4. PRE-CARGA DE CACHÉ DE TENANTS (async, non-blocking)
// ============================================================================
const tenantService = container.resolve<ITenantResolutionService>('ITenantResolutionService');
tenantService.preloadCache().then(() => {
  const stats = tenantService.getCacheStats();
  console.log(`[Abitia] Tenant cache: ${stats.size} slugs pre-cargados → ${stats.entries.join(', ') || '(vacío)'}`);
});

app.listen(PORT, () => {
  const mode = process.env.NODE_ENV === 'production' ? 'PROD' : 'DEV';
  console.log(`[Abitia API] Puerto ${PORT} | Modo: ${mode} | Persistencia: Local-First`);
  console.log(`[Abitia]  abitia.co        → Landing público`);
  console.log(`[Abitia]  app.abitia.app   → Login global unificado`);
  console.log(`[Abitia]  [slug].abitia.app → Tenant multi-condominio`);
});

export default app;
