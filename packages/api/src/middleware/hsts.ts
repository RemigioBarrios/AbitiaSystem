import { Request, Response, NextFunction } from 'express';

const HSTS_HEADER = 'max-age=31536000; includeSubDomains; preload';

export function hstsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const host = (req.hostname || req.headers.host || '').toLowerCase();

  if (host.endsWith('.abitia.app') || host === 'abitia.app') {
    if (!req.secure && req.protocol !== 'https') {
      res.redirect(301, `https://${host}${req.originalUrl}`);
      return;
    }
    res.setHeader('Strict-Transport-Security', HSTS_HEADER);
  }

  next();
}
