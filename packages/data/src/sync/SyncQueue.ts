import { injectable, inject } from 'tsyringe';
import { LocalStore } from '../local/LocalStore';
import { ICondominio, IUsuario, IPropiedad, IGastoCondominio, IReciboMensual, IPagoReportado, ICuentaCorrientePropiedad } from '@abitia/core';

export enum SyncOperation {
  CREATE_CONDOMINIO = 'CREATE_CONDOMINIO',
  UPDATE_CONDOMINIO = 'UPDATE_CONDOMINIO',
  CREATE_USUARIO = 'CREATE_USUARIO',
  CREATE_PROPIEDAD = 'CREATE_PROPIEDAD',
  CREATE_GASTO = 'CREATE_GASTO',
  CREATE_RECIBO_BATCH = 'CREATE_RECIBO_BATCH',
  CREATE_PAGO = 'CREATE_PAGO',
  VERIFICAR_PAGO = 'VERIFICAR_PAGO',
  CREATE_MOVIMIENTO = 'CREATE_MOVIMIENTO',
}

export interface SyncQueueItem {
  id: number;
  operation: SyncOperation;
  payload: unknown;
  timestamp: Date;
  attempts: number;
}

@injectable()
export class SyncQueue {
  private queue: SyncQueueItem[] = [];
  private nextId = 1;
  private maxAttempts = 3;

  enqueue(operation: SyncOperation, payload: unknown): void {
    this.queue.push({
      id: this.nextId++,
      operation,
      payload,
      timestamp: new Date(),
      attempts: 0,
    });
  }

  peek(): SyncQueueItem[] {
    return [...this.queue];
  }

  dequeue(): SyncQueueItem | undefined {
    return this.queue.shift();
  }

  size(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
  }

  retry(item: SyncQueueItem): void {
    if (item.attempts < this.maxAttempts) {
      item.attempts++;
      this.queue.push(item);
    }
  }

  async flush(): Promise<void> {
    this.clear();
  }
}
