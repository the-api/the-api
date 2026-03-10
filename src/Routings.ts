import { CrudBuilder, Routings as ExternalRoutings } from 'the-api-routings';
import type { MethodsType } from 'the-api-routings';
import type { CrudBuilderOptionsType } from './types';
import { createCrudValidationMiddleware } from './Validatior';
import { normalizeCrudConfig } from './crudConfig';
import type { AppContext } from './types';

type CrudPermissionMeta = {
  path: string;
  permissionPrefix: string;
  methodsConfigured: boolean;
};

export class Routings extends ExternalRoutings {
  crudPermissionsMeta: CrudPermissionMeta[] = [];

  override crud(params: CrudBuilderOptionsType): void {
    const normalizedParams = normalizeCrudConfig(params);
    const { prefix, table, permissions } = normalizedParams;
    const p = `/${prefix || table}`.replace(/^\/+/, '/');
    const permissionPrefix = p.replace(/^\//, '');
    const methodsConfigured = Array.isArray(permissions?.methods);
    const hasExplicitOwnerPermissions = !!normalizedParams.permissions?.owner?.length;

    const validate = createCrudValidationMiddleware(normalizedParams);
    const createCrudBuilder = (c: AppContext): CrudBuilder => {
      const cb = new CrudBuilder(normalizedParams as never);
      if (hasExplicitOwnerPermissions) return cb;

      const roles = c.var.roles;
      if (!roles || typeof roles.getPermissions !== 'function') return cb;

      const ownerPermissions = roles.getPermissions(['owner']);
      if (!ownerPermissions || typeof ownerPermissions !== 'object') return cb;

      (cb as unknown as { ownerPermissions: Record<string, boolean> }).ownerPermissions = ownerPermissions;
      return cb;
    };

    this.get(`${p}`, validate('getAll') as never, async (c) => {
      const cb = createCrudBuilder(c as AppContext);
      await cb.get(c as never);
    });

    this.post(`${p}`, validate('post') as never, async (c) => {
      const cb = createCrudBuilder(c as AppContext);
      await cb.add(c as never);
    });

    this.get(`${p}/:id`, validate('getOne') as never, async (c) => {
      const cb = createCrudBuilder(c as AppContext);
      await cb.getById(c as never);
    });

    this.patch(`${p}/:id`, validate('patch') as never, async (c) => {
      const cb = createCrudBuilder(c as AppContext);
      await cb.update(c as never);
    });

    this.delete(`${p}/:id`, validate('delete') as never, async (c) => {
      const cb = createCrudBuilder(c as AppContext);
      await cb.delete(c as never);
    });

    this.crudPermissionsMeta.push({
      path: p,
      permissionPrefix,
      methodsConfigured,
    });

    if (permissions?.methods?.length) {
      const register = (path: string, method: string): void => {
        const key = `${method} ${path}`;
        if (!this.routesPermissions[key]) this.routesPermissions[key] = [];
        this.routesPermissions[key].push(`${permissionPrefix}.${method.toLowerCase()}`);
      };

      const methods: MethodsType[] = permissions.methods[0] === '*'
        ? ['GET', 'POST', 'PATCH', 'DELETE']
        : (permissions.methods as MethodsType[]);

      for (const method of methods) {
        if (method === 'POST' || method === 'GET') register(p, method);
        if (method !== 'POST') register(`${p}/:id`, method);
      }
    }
  }
}
