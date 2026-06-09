import { Request, Response } from 'express';
import { container } from 'tsyringe';
import {
  IUsuarioRepository,
  ICondominioRepository,
  UserCondominioOption,
  Rol,
} from '@abitia/core';
import { generateGlobalToken, generateTenantToken } from '../middleware/auth';

const ROL_NAMES: Record<number, string> = {
  [Rol.SuperAdmin]: 'SuperAdmin',
  [Rol.Administrador]: 'Administrador',
  [Rol.Propietario]: 'Propietario',
  [Rol.Inquilino]: 'Inquilino',
};

function getRepo<T>(token: string): T {
  return container.resolve<T>(token);
}

export class AuthController {
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(400).json({ error: 'Email y contraseña requeridos' });
        return;
      }

      const usuarioRepo = getRepo<IUsuarioRepository>('IUsuarioRepository');
      const condominioRepo = getRepo<ICondominioRepository>('ICondominioRepository');
      const usuario = await usuarioRepo.findByEmail(email);

      if (!usuario || usuario.Estatus !== 1) {
        res.status(401).json({ error: 'Credenciales inválidas o usuario inactivo' });
        return;
      }

      // Fase Magra: comparación directa. Fase 2: bcrypt.compare
      if (usuario.Password_Hash !== password) {
        res.status(401).json({ error: 'Credenciales inválidas' });
        return;
      }

      const roles = await usuarioRepo.getRolesByUsuario(usuario.IdUsuario);

      if (roles.length === 0) {
        res.status(403).json({ error: 'El usuario no tiene condominios asignados' });
        return;
      }

      // Condominio único: token de tenant directo
      if (roles.length === 1) {
        const rol = roles[0];
        const condominio = await condominioRepo.findById(rol.IdCondominio);
        const token = generateTenantToken(
          usuario.IdUsuario,
          usuario.Email,
          rol.IdCondominio,
          rol.Rol,
        );

        res.json({
          token,
          idUsuario: usuario.IdUsuario,
          email: usuario.Email,
          nombre: `${usuario.Nombre} ${usuario.Apellido}`,
          singleCondominio: true,
          condominio: {
            idCondominio: rol.IdCondominio,
            slug: condominio?.Subdominio_Slug || '',
            nombreCondominio: condominio?.Nombre || '',
            rol: rol.Rol,
            nombreRol: ROL_NAMES[rol.Rol] || 'Desconocido',
          },
        });
        return;
      }

      // Múltiples condominios: token global + lista de opciones con slugs
      const token = generateGlobalToken(usuario.IdUsuario, usuario.Email);

      const opciones: UserCondominioOption[] = [];
      for (const r of roles) {
        const condominio = await condominioRepo.findById(r.IdCondominio);
        opciones.push({
          idCondominio: r.IdCondominio,
          nombreCondominio: condominio?.Nombre || `Condominio #${r.IdCondominio}`,
          slug: condominio?.Subdominio_Slug || '',
          rol: r.Rol,
          nombreRol: ROL_NAMES[r.Rol] || 'Desconocido',
        });
      }

      res.json({
        token,
        idUsuario: usuario.IdUsuario,
        email: usuario.Email,
        nombre: `${usuario.Nombre} ${usuario.Apellido}`,
        singleCondominio: false,
        condominios: opciones,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      res.status(500).json({ error: message });
    }
  }

  async selectCondominio(req: Request, res: Response): Promise<void> {
    try {
      const { idCondominio } = req.body;
      const idUsuario = req.idUsuario;

      if (!idUsuario) {
        res.status(401).json({ error: 'Usuario no autenticado' });
        return;
      }

      if (!idCondominio) {
        res.status(400).json({ error: 'idCondominio requerido' });
        return;
      }

      const usuarioRepo = getRepo<IUsuarioRepository>('IUsuarioRepository');
      const condominioRepo = getRepo<ICondominioRepository>('ICondominioRepository');

      const roles = await usuarioRepo.getRolesByUsuario(idUsuario);
      const rolAsignado = roles.find((r) => r.IdCondominio === idCondominio);

      if (!rolAsignado) {
        res.status(403).json({ error: 'El usuario no tiene acceso a este condominio' });
        return;
      }

      const usuario = await usuarioRepo.findById(idUsuario);
      if (!usuario) {
        res.status(404).json({ error: 'Usuario no encontrado' });
        return;
      }

      const condominio = await condominioRepo.findById(idCondominio);

      const token = generateTenantToken(
        idUsuario,
        usuario.Email,
        idCondominio,
        rolAsignado.Rol,
      );

      res.json({
        token,
        idCondominio,
        slug: condominio?.Subdominio_Slug || '',
        nombreCondominio: condominio?.Nombre || '',
        rol: rolAsignado.Rol,
        nombreRol: ROL_NAMES[rolAsignado.Rol] || 'Desconocido',
        redirectUrl: condominio
          ? `https://${condominio.Subdominio_Slug}.abitia.app`
          : null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      res.status(500).json({ error: message });
    }
  }

  async me(req: Request, res: Response): Promise<void> {
    try {
      const idUsuario = req.idUsuario;
      if (!idUsuario) {
        res.status(401).json({ error: 'No autenticado' });
        return;
      }

      const usuarioRepo = getRepo<IUsuarioRepository>('IUsuarioRepository');
      const usuario = await usuarioRepo.findById(idUsuario);

      if (!usuario) {
        res.status(404).json({ error: 'Usuario no encontrado' });
        return;
      }

      const roles = await usuarioRepo.getRolesByUsuario(idUsuario);

      res.json({
        idUsuario: usuario.IdUsuario,
        email: usuario.Email,
        nombre: `${usuario.Nombre} ${usuario.Apellido}`,
        telefono: usuario.Telefono,
        roles: roles.map((r) => ({
          idCondominio: r.IdCondominio,
          rol: r.Rol,
          nombreRol: ROL_NAMES[r.Rol] || 'Desconocido',
        })),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      res.status(500).json({ error: message });
    }
  }
}
