import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthTokenPayload } from '@abitia/core';

const JWT_SECRET = process.env.JWT_SECRET || 'abitia-dev-secret-change-in-production';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token de autorización requerido' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
    req.idUsuario = decoded.idUsuario;

    // Si el token tiene idCondominio y la request es de tipo tenant,
    // validar que coincida con el subdominio
    if (decoded.idCondominio && req.idCondominio && decoded.idCondominio !== req.idCondominio) {
      res.status(403).json({ error: 'El token no corresponde al condominio actual' });
      return;
    }

    // Si la request es tenant y el token no tiene idCondominio vinculado al actual
    if (req.idCondominio && decoded.idCondominio && decoded.idCondominio !== req.idCondominio) {
      res.status(403).json({ error: 'Acceso no autorizado a este condominio' });
      return;
    }

    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

export function generateToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

export function generateGlobalToken(idUsuario: number, email: string): string {
  return generateToken({
    idUsuario,
    email,
    idCondominio: null,
    rol: null,
  });
}

export function generateTenantToken(
  idUsuario: number,
  email: string,
  idCondominio: number,
  rol: number,
): string {
  return generateToken({
    idUsuario,
    email,
    idCondominio,
    rol,
  });
}
