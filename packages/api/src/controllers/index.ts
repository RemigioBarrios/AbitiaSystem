import { Request, Response } from 'express';
import { container } from 'tsyringe';
import {
  ICondominioRepository,
  IPropiedadRepository,
  IGastoCondominioRepository,
  IReciboMensualRepository,
  IPagoReportadoRepository,
  ICuentaCorrienteRepository,
  IUsuarioRepository,
  ILedgerService,
  IReciboService,
  IPagoService,
} from '@abitia/core';

function getTenantId(req: Request): number {
  if (!req.idCondominio) throw new Error('Tenant no resuelto');
  return req.idCondominio;
}

function getRepo<T>(token: string): T {
  return container.resolve<T>(token);
}

export class CondominioController {
  async getBySlug(req: Request, res: Response): Promise<void> {
    try {
      const slug = req.params.slug;
      const repo = getRepo<ICondominioRepository>('ICondominioRepository');
      const result = await repo.findBySlug(slug);
      if (!result) { res.status(404).json({ error: 'Condominio no encontrado' }); return; }
      res.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      res.status(500).json({ error: message });
    }
  }
}

export class PropiedadController {
  async listByCondominio(req: Request, res: Response): Promise<void> {
    try {
      const idCondominio = getTenantId(req);
      const repo = getRepo<IPropiedadRepository>('IPropiedadRepository');
      const result = await repo.findAllByCondominio(idCondominio);
      res.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      res.status(500).json({ error: message });
    }
  }
}

export class GastoController {
  async byPeriod(req: Request, res: Response): Promise<void> {
    try {
      const idCondominio = getTenantId(req);
      const periodo = req.params.periodo;
      const repo = getRepo<IGastoCondominioRepository>('IGastoCondominioRepository');
      const result = await repo.findAllByPeriod(idCondominio, periodo);
      res.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      res.status(500).json({ error: message });
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const idCondominio = getTenantId(req);
      const repo = getRepo<IGastoCondominioRepository>('IGastoCondominioRepository');
      const id = await repo.create({ ...req.body, IdCondominio: idCondominio });
      res.status(201).json({ id });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      res.status(500).json({ error: message });
    }
  }
}

export class ReciboController {
  async emitirPeriodo(req: Request, res: Response): Promise<void> {
    try {
      const idCondominio = getTenantId(req);
      const { periodo, fechaVencimiento } = req.body;
      const service = getRepo<IReciboService>('IReciboService');
      await service.emitirRecibosPeriodo(idCondominio, periodo, new Date(fechaVencimiento));
      res.status(201).json({ message: 'Recibos emitidos correctamente' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      res.status(500).json({ error: message });
    }
  }

  async pendientes(req: Request, res: Response): Promise<void> {
    try {
      const idCondominio = getTenantId(req);
      const idPropiedad = parseInt(req.params.idPropiedad);
      const repo = getRepo<IReciboMensualRepository>('IReciboMensualRepository');
      const result = await repo.findPendientesByPropiedad(idCondominio, idPropiedad);
      res.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      res.status(500).json({ error: message });
    }
  }
}

export class PagoController {
  async reportar(req: Request, res: Response): Promise<void> {
    try {
      const idCondominio = getTenantId(req);
      const idUsuario = req.idUsuario;
      if (!idUsuario) { res.status(401).json({ error: 'Usuario no autenticado' }); return; }

      const service = getRepo<IPagoService>('IPagoService');
      const idPago = await service.reportarPago({
        ...req.body,
        idCondominio,
        idUsuarioReporta: idUsuario,
        fechaTransferencia: new Date(req.body.fechaTransferencia),
      });
      res.status(201).json({ idPago });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';

      if (message.includes('ya fue reportada')) {
        res.status(409).json({ error: message });
      } else if (message.includes('obligatorio') || message.includes('requerido')) {
        res.status(400).json({ error: message });
      } else {
        res.status(500).json({ error: message });
      }
    }
  }

  async bandeja(req: Request, res: Response): Promise<void> {
    try {
      const idCondominio = getTenantId(req);
      const service = getRepo<IPagoService>('IPagoService');
      const result = await service.getBandejaVerificacion(idCondominio);
      res.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      res.status(500).json({ error: message });
    }
  }

  async aprobar(req: Request, res: Response): Promise<void> {
    try {
      const idCondominio = getTenantId(req);
      const idUsuario = req.idUsuario;
      if (!idUsuario) { res.status(401).json({ error: 'Usuario no autenticado' }); return; }

      const { idPago } = req.body;
      if (!idPago) { res.status(400).json({ error: 'idPago es requerido' }); return; }

      const service = getRepo<IPagoService>('IPagoService');
      await service.aprobarPago({
        idCondominio,
        idPago,
        idUsuarioVerifica: idUsuario,
      });

      res.json({ message: 'Pago aprobado correctamente' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';

      if (message.includes('Solo un Administrador') || message.includes('no pertenece')) {
        res.status(403).json({ error: message });
      } else if (message.includes('ya fue') || message.includes('idPago es requerido')) {
        res.status(400).json({ error: message });
      } else if (message.includes('no encontrado')) {
        res.status(404).json({ error: message });
      } else {
        res.status(500).json({ error: message });
      }
    }
  }

  async rechazar(req: Request, res: Response): Promise<void> {
    try {
      const idCondominio = getTenantId(req);
      const idUsuario = req.idUsuario;
      if (!idUsuario) { res.status(401).json({ error: 'Usuario no autenticado' }); return; }

      const { idPago, motivoRechazo } = req.body;
      if (!idPago) { res.status(400).json({ error: 'idPago es requerido' }); return; }
      if (!motivoRechazo || !motivoRechazo.trim()) {
        res.status(400).json({ error: 'motivoRechazo es obligatorio' }); return;
      }

      const service = getRepo<IPagoService>('IPagoService');
      await service.rechazarPago({
        idCondominio,
        idPago,
        idUsuarioVerifica: idUsuario,
        motivoRechazo,
      });

      res.json({ message: 'Pago rechazado correctamente' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';

      if (message.includes('Solo un Administrador') || message.includes('no pertenece')) {
        res.status(403).json({ error: message });
      } else if (message.includes('ya fue') || message.includes('obligatorio')) {
        res.status(400).json({ error: message });
      } else if (message.includes('no encontrado')) {
        res.status(404).json({ error: message });
      } else {
        res.status(500).json({ error: message });
      }
    }
  }
}

export class LedgerController {
  async historial(req: Request, res: Response): Promise<void> {
    try {
      const idCondominio = getTenantId(req);
      const idPropiedad = parseInt(req.params.idPropiedad);
      const repo = getRepo<ICuentaCorrienteRepository>('ICuentaCorrienteRepository');
      const result = await repo.findByPropiedad(idCondominio, idPropiedad);
      res.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      res.status(500).json({ error: message });
    }
  }

  async saldo(req: Request, res: Response): Promise<void> {
    try {
      const idCondominio = getTenantId(req);
      const idPropiedad = parseInt(req.params.idPropiedad);
      const repo = getRepo<ICuentaCorrienteRepository>('ICuentaCorrienteRepository');
      const saldo = await repo.getSaldoActual(idCondominio, idPropiedad);
      res.json({ saldo });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      res.status(500).json({ error: message });
    }
  }
}
