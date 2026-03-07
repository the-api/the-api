import { CrudBuilder, Routings as ExternalRoutings } from 'the-api-routings';
import type { MethodsType } from 'the-api-routings';
import type { CrudBuilderOptionsType } from './types';
import { createCrudValidationMiddleware } from './Validatior';

export class Routings extends ExternalRoutings {
  override crud(params: CrudBuilderOptionsType): void {
    const { prefix, table, permissions } = params;
    const p = `/${prefix || table}`.replace(/^\/+/, '/');

    const validate = createCrudValidationMiddleware(params);

    this.get(`${p}`, validate('getAll') as never, async (c) => {
      const cb = new CrudBuilder(params as never);
      await cb.get(c as never);
    });

    this.post(`${p}`, validate('post') as never, async (c) => {
      const cb = new CrudBuilder(params as never);
      await cb.add(c as never);
    });

    this.get(`${p}/:id`, validate('getOne') as never, async (c) => {
      const cb = new CrudBuilder(params as never);
      await cb.getById(c as never);
    });

    this.patch(`${p}/:id`, validate('patch') as never, async (c) => {
      const cb = new CrudBuilder(params as never);
      await cb.update(c as never);
    });

    this.delete(`${p}/:id`, validate('delete') as never, async (c) => {
      const cb = new CrudBuilder(params as never);
      await cb.delete(c as never);
    });

    if (permissions?.protectedMethods) {
      const register = (path: string, method: string): void => {
        const key = `${method} ${path}`;
        if (!this.routesPermissions[key]) this.routesPermissions[key] = [];
        this.routesPermissions[key].push(`${p.replace(/^\//, '')}.${method.toLowerCase()}`);
      };

      const methods: MethodsType[] = permissions.protectedMethods[0] === '*'
        ? ['GET', 'POST', 'PATCH', 'DELETE']
        : (permissions.protectedMethods as MethodsType[]);

      for (const method of methods) {
        if (method === 'POST' || method === 'GET') register(p, method);
        if (method !== 'POST') register(`${p}/:id`, method);
      }
    }
  }
}
