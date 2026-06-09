import { Request, Response, NextFunction } from 'express';
import { MySQLConnection } from '@abitia/data';
import type { RowDataPacket } from 'mysql2';

declare global {
  namespace Express {
    interface Request {
      tenantId?: number;
      idCondominio?: number;
      hostType?: 'public' | 'global' | 'tenant' | 'unknown';
      idUsuario?: number;
    }
  }
}

const TENANT_CACHE = new Map<string, number>();

function classifyHost(host: string): { type: 'public' | 'global' | 'tenant' | 'unknown'; slug: string | null } {
  const clean = host.replace(/:\d+$/, '').toLowerCase();

  if (clean === 'abitia.co' || clean === 'www.abitia.co') {
    return { type: 'public', slug: null };
  }

  if (clean === 'app.abitia.app' || clean === 'abitia.app') {
    return { type: 'global', slug: null };
  }

  if (clean.endsWith('.abitia.app')) {
    const slug = clean.slice(0, clean.length - 10);
    if (slug && slug !== 'app' && slug !== 'www') {
      return { type: 'tenant', slug };
    }
  }

  if (clean.endsWith('.localhost')) {
    const slug = clean.slice(0, clean.length - 10);
    if (slug) return { type: 'tenant', slug };
  }

  if (clean === 'localhost' || clean === '127.0.0.1') {
    return { type: 'global', slug: null };
  }

  return { type: 'unknown', slug: null };
}

export function multiTenantMiddleware(connection: MySQLConnection) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const host = req.headers.host || req.hostname || '';
      const { type, slug } = classifyHost(host);

      req.hostType = type;

      if (type === 'public' || type === 'global') {
        return next();
      }

      if (type === 'unknown') {
        res.status(400).json({
          error: 'Host no reconocido',
          hint: 'Use abitia.co, app.abitia.app, o [slug].abitia.app',
        });
        return;
      }

      if (!slug) {
        res.status(400).json({ error: 'Subdominio no especificado' });
        return;
      }

      let idCondominio = TENANT_CACHE.get(slug);

      if (idCondominio === undefined) {
        const [rows] = await connection.getPool().execute<RowDataPacket[]>(
          'SELECT IdCondominio FROM Condominio WHERE Subdominio_Slug = ? LIMIT 1',
          [slug],
        );

        if (rows.length === 0) {
          res.status(404).json({ error: 'Condominio no encontrado' });
          return;
        }

        idCondominio = Number(rows[0].IdCondominio);
        TENANT_CACHE.set(slug, idCondominio);
      }

      req.tenantId = idCondominio;
      req.idCondominio = idCondominio;
      next();
    } catch (err: unknown) {
      res.status(500).json({
        error: 'Error en resolucion multi-tenant',
        detail: err instanceof Error ? err.message : 'Error desconocido',
      });
    }
  };
}
