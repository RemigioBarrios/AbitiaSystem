import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthTokenPayload } from '@abitia/core';

const JWT_SECRET = process.env.JWT_SECRET || 'abitia-dev-secret-change-in-production';

type JwtAuthPayload = AuthTokenPayload & {
  IdUsuario?: number;
};

declare global {
  namespace Express {
    interface Request {
      usuarioId?: number;
      idUsuario?: number;
    }
  }
}

function extractBearerToken(header?: string): string | null {
  if (!header || !header.startsWith('Bearer ')) {
    return null;
  }

  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    res.status(401).json({ error: 'Token de autorización requerido' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtAuthPayload;
    const usuarioId = decoded.IdUsuario ?? decoded.idUsuario;

    if (!usuarioId) {
      res.status(403).json({ error: 'Token inválido' });
      return;
    }

    req.usuarioId = usuarioId;
    req.idUsuario = usuarioId;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(403).json({ error: 'Token expirado' });
      return;
    }

    res.status(401).json({ error: 'Token inválido' });
  }
}

export function generateToken(payload: AuthTokenPayload): string {
  return jwt.sign(
    {
      ...payload,
      IdUsuario: payload.idUsuario,
    },
    JWT_SECRET,
    { expiresIn: '8h' },
  );
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
