import { Router } from 'express';
import { AuthController, type AuthPool } from '../controllers/authController';
import { authMiddleware } from '../middleware';

export function createAuthRoutes(pool?: AuthPool) {
  const router = Router();
  const authCtrl = new AuthController(pool);

  router.post('/login', authCtrl.login.bind(authCtrl));
  router.post('/select-condominio', authMiddleware, authCtrl.selectCondominio.bind(authCtrl));
  router.get('/me', authMiddleware, authCtrl.me.bind(authCtrl));

  return router;
}

export default createAuthRoutes;
