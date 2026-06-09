import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { ITenantResolutionService, HostType } from '@abitia/core';

declare global {
  namespace Express {
    interface Request {
      idCondominio?: number;
      tenantSlug?: string;
      tenantNombre?: string;
      idUsuario?: number;
      hostType?: HostType;
      isPublicHost?: boolean;
      isGlobalAppHost?: boolean;
      isTenantHost?: boolean;
    }
  }
}

export function hostClassifierMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const host = req.headers.host || req.hostname || '';
  const tenantService = container.resolve<ITenantResolutionService>('ITenantResolutionService');
  const classification = tenantService.classifyHost(host);

  req.hostType = classification.type;
  req.isPublicHost = classification.type === HostType.PUBLIC;
  req.isGlobalAppHost = classification.type === HostType.GLOBAL_APP;
  req.isTenantHost = classification.type === HostType.TENANT;

  next();
}

export function tenantResolutionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.isPublicHost) {
    next();
    return;
  }

  if (req.isGlobalAppHost) {
    next();
    return;
  }

  if (!req.isTenantHost) {
    res.status(400).json({ error: 'Host no reconocido' });
    return;
  }

  const host = req.headers.host || req.hostname || '';
  const tenantService = container.resolve<ITenantResolutionService>('ITenantResolutionService');

  tenantService.resolveFromHost(host)
    .then((resolved) => {
      if (!resolved) {
        res.status(404).json({ error: 'Condominio no encontrado para el subdominio especificado' });
        return;
      }

      req.idCondominio = resolved.idCondominio;
      req.tenantSlug = resolved.slug;
      req.tenantNombre = resolved.nombre;
      next();
    })
    .catch((err) => {
      res.status(500).json({
        error: 'Error resolviendo inquilino',
        detail: err instanceof Error ? err.message : 'Error desconocido',
      });
    });
}
