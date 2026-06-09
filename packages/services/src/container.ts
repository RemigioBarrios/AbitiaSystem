import { container } from 'tsyringe';
import { TenantResolutionService } from './tenant/TenantResolutionService';
import { ReciboService } from './recibo/ReciboService';
import { LedgerService } from './ledger/LedgerService';
import { PagoService } from './pago/PagoService';

export function configureServicesContainer(): void {
  container.register('ITenantResolutionService', { useClass: TenantResolutionService });
  container.register('IReciboService', { useClass: ReciboService });
  container.register('ILedgerService', { useClass: LedgerService });
  container.register('IPagoService', { useClass: PagoService });
}

export { TenantResolutionService, ReciboService, LedgerService, PagoService };
