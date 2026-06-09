import { injectable, inject } from 'tsyringe';
import {
  ITenantResolutionService,
  ITenantResolved,
  HostType,
  HostClassification,
  ICondominioRepository,
} from '@abitia/core';

interface CacheEntry {
  data: ITenantResolved;
  loadedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos — Antigravity-safe

@injectable()
export class TenantResolutionService implements ITenantResolutionService {
  private currentTenant: ITenantResolved | null = null;
  private tenantCache: Map<string, CacheEntry> = new Map();

  constructor(
    @inject('ICondominioRepository') private condominioRepo: ICondominioRepository,
  ) {}

  classifyHost(host: string): HostClassification {
    const cleanHost = host.replace(/:[\d]+$/, '').toLowerCase();

    if (cleanHost === 'abitia.co' || cleanHost === 'www.abitia.co') {
      return { type: HostType.PUBLIC, slug: null };
    }

    if (cleanHost === 'app.abitia.app' || cleanHost === 'abitia.app') {
      return { type: HostType.GLOBAL_APP, slug: null };
    }

    // www.abitia.app → redirigir a app global
    if (cleanHost === 'www.abitia.app') {
      return { type: HostType.GLOBAL_APP, slug: null };
    }

    // [slug].abitia.app — excluye 'app' y 'www'
    const appMatch = cleanHost.match(/^([a-z0-9-]+)\.abitia\.app$/);
    if (appMatch && appMatch[1] !== 'app' && appMatch[1] !== 'www') {
      return { type: HostType.TENANT, slug: appMatch[1] };
    }

    // Localhost development: slug.localhost
    const localMatch = cleanHost.match(/^([a-z0-9-]+)\.localhost$/);
    if (localMatch) {
      return { type: HostType.TENANT, slug: localMatch[1] };
    }

    // Direct localhost — treat as global app for dev
    if (cleanHost === 'localhost' || cleanHost === '127.0.0.1') {
      return { type: HostType.GLOBAL_APP, slug: null };
    }

    return { type: HostType.UNKNOWN, slug: null };
  }

  async resolveFromHost(host: string): Promise<ITenantResolved | null> {
    const classification = this.classifyHost(host);
    if (classification.type !== HostType.TENANT || !classification.slug) {
      return null;
    }
    return this.resolveFromSlug(classification.slug);
  }

  async resolveFromSlug(slug: string): Promise<ITenantResolved | null> {
    const cached = this.tenantCache.get(slug);
    if (cached && (Date.now() - cached.loadedAt) < CACHE_TTL_MS) {
      this.currentTenant = cached.data;
      return cached.data;
    }

    const condominio = await this.condominioRepo.findBySlug(slug);
    if (!condominio) return null;

    const resolved: ITenantResolved = {
      idCondominio: condominio.IdCondominio,
      slug: condominio.Subdominio_Slug,
      nombre: condominio.Nombre,
    };

    this.tenantCache.set(slug, { data: resolved, loadedAt: Date.now() });
    this.currentTenant = resolved;
    return resolved;
  }

  setCurrentTenant(idCondominio: number): void {
    // Buscar en caché por ID
    for (const entry of this.tenantCache.values()) {
      if (entry.data.idCondominio === idCondominio) {
        this.currentTenant = entry.data;
        return;
      }
    }
    this.currentTenant = { idCondominio, slug: '', nombre: '' };
  }

  getCurrentTenant(): ITenantResolved | null {
    return this.currentTenant;
  }

  getCurrentTenantId(): number {
    if (!this.currentTenant) throw new Error('No tenant resolved for current request');
    return this.currentTenant.idCondominio;
  }

  async preloadCache(): Promise<void> {
    try {
      const condominios = await this.condominioRepo.findAll();
      const now = Date.now();
      for (const c of condominios) {
        this.tenantCache.set(c.Subdominio_Slug, {
          data: {
            idCondominio: c.IdCondominio,
            slug: c.Subdominio_Slug,
            nombre: c.Nombre,
          },
          loadedAt: now,
        });
      }
      console.log(`[Abitia] Tenant cache preloaded: ${condominios.length} condominios`);
    } catch (err) {
      console.warn('[Abitia] Tenant cache preload skipped (DB not available, running Local-First)');
    }
  }

  invalidateCache(slug?: string): void {
    if (slug) {
      this.tenantCache.delete(slug);
    } else {
      this.tenantCache.clear();
    }
  }

  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.tenantCache.size,
      entries: Array.from(this.tenantCache.keys()),
    };
  }
}
