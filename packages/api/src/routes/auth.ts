import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { authMiddleware } from '../middleware';

const router = Router();
const authCtrl = new AuthController();

router.post('/login', authCtrl.login.bind(authCtrl));
router.post('/select-condominio', authMiddleware, authCtrl.selectCondominio.bind(authCtrl));
router.get('/me', authMiddleware, authCtrl.me.bind(authCtrl));

export default router;
