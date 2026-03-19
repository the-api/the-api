import { Hono } from 'hono';
import { serve } from "@hono/node-server";
import { matchedRoutes } from 'hono/route';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import { resolve } from 'path';
import { Routings } from 'the-api-routings';
import type { MethodsType } from 'the-api-routings';
import { Db } from './Db';
import { beginRoute, endRoute } from './middlewares/default';
import { relationsRoute } from './middlewares/relations';
import type { Next, MiddlewareHandler } from 'hono';
import type { Server } from 'bun';
import type Roles from 'the-api-roles';
import type { Routings as RoutingsType } from 'the-api-routings';
import type {
  AppEnv,
  AppContext,
  TheApiOptionsType,
  RoutingsInputType,
  EmailTemplatesType,
  RoutesErrorsType,
  RoutesErrorType,
} from './types';
import { getErrorNameAndAdditional } from './errorHelpers';

const {
  PORT = '7788',
  DB_HOST: dbHost,
  DB_WRITE_HOST: dbHostWrite,
} = process.env;

const CRUD_METHODS: MethodsType[] = ['GET', 'POST', 'PATCH', 'DELETE'];

type CrudPermissionMeta = {
  path: string;
  permissionPrefix: string;
  methodsConfigured: boolean;
  tableName: string;
};

type RoutingsWithCrudMeta = RoutingsType & {
  crudPermissionsMeta?: CrudPermissionMeta[];
};

type CrudOwnerLookupRoute = {
  tableName: string;
  idParamName: string;
};

type RoutesPermissionsMap = Record<string, string[]>;

export class TheAPI {
  app: Hono<AppEnv>;
  db: Db | null = null;
  roles?: Roles;
  private errors: RoutesErrorsType = {};
  private routings: RoutingsInputType = [];
  private port: number;
  private migrationDirs: string[] = [
    resolve(`${import.meta.dir}/../src/migrations`),
  ];
  emailTemplates: Record<string, EmailTemplatesType> = {};

  constructor(options?: TheApiOptionsType) {
    const { routings, roles, emailTemplates, port, migrationDirs } =
      options || {};

    this.app = new Hono<AppEnv>({ router: new RegExpRouter() });
    if (roles) {
      roles.init();
      this.roles = roles;
    }
    if (emailTemplates) this.emailTemplates = emailTemplates;
    this.routings = routings || [];
    this.port = port || +PORT;
    if (migrationDirs) this.migrationDirs = migrationDirs;
  }

  async init(): Promise<void> {
    this.collectErrorsAndTemplates();
    this.registerGlobalMiddleware();

    if (dbHost || dbHostWrite) {
      for (const { migrationDirs } of this.getFlatRoutings()) {
        if (Array.isArray(migrationDirs)) {
          this.migrationDirs = this.migrationDirs.concat(migrationDirs);
        }
      }
      this.db = new Db({ migrationDirs: this.migrationDirs });
      await this.db.waitDb();
      this.registerDbMiddleware(this.db);
    }

    this.registerRoutes();
  }

  async up() {
    const { port } = await this.upBun();
    console.log(`Server is running on port ${port}`);
    return serve({
      fetch: (req) =>
        this.app.fetch(req, { ip: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') }),
      port,
    });
  }

  async upBun() {
    await this.init();
    return {
      fetch: (req: Request, server: Server<any>) =>
        this.app.fetch(req, { ip: server.requestIP(req) }),
      port: this.port,
    };
  }

  async destroy(): Promise<void> {
    if (this.db) {
      await this.db.destroy();
      this.db = null;
    }
  }

  addRoutings(routings: RoutingsType | RoutingsInputType): void {
    this.routings = this.routings.concat(routings);
  }

  // -- private --

  private collectErrorsAndTemplates(): void {
    const flatRoutings = this.getFlatRoutings();
    const all = [
      beginRoute,
      relationsRoute,
      ...flatRoutings,
      endRoute,
    ];

    for (const { routesErrors, routesEmailTemplates } of all) {
      this.errors = { ...this.errors, ...routesErrors };
      this.emailTemplates = {
        ...this.emailTemplates,
        ...routesEmailTemplates,
      };
    }
  }

  private getFlatRoutings(): RoutingsType[] {
    return this.routings.flat() as RoutingsType[];
  }

  private registerGlobalMiddleware(): void {
    // Safety net for uncaught errors
    this.app.onError(async (err, c: AppContext) => {
      console.error('Unhandled error:', err);
      const error = err instanceof Error ? err : new Error(String(err));

      try {
        const errorHandler = c.var?.error || c.get('error');
        if (typeof errorHandler === 'function') {
          errorHandler(error);
        } else {
          const message = error.message;
          let { name, additional } = getErrorNameAndAdditional(error);
          const isHttpException =
            typeof err === 'object' &&
            err !== null &&
            'status' in err &&
            typeof (err as Record<string, unknown>).status === 'number' &&
            'getResponse' in err &&
            typeof (err as { getResponse?: unknown }).getResponse === 'function';

          const getErr = c.var?.getErrorByMessage || c.get('getErrorByMessage');
          let errObj =
            typeof getErr === 'function' ? getErr(name) : undefined;

          if (!errObj && isHttpException) {
            const response = await (err as { getResponse: () => Response }).getResponse();
            const responseText = await response.text();

            c.set('result', {
              error: true,
              name: responseText || message || `HTTP ${response.status}`,
              additional,
              status: response.status,
              code: 0,
            });
            c.status(response.status as any);
          } else if (!errObj && typeof getErr === 'function') {
            errObj = getErr('DEFAULT');
            name = message;
            additional = [];
          }

          if (errObj) {
            c.set('result', { ...errObj, name, additional, error: true });
            if (errObj.status) c.status(errObj.status as any);
          }
        }
      } catch {
        c.set('result', {
          error: true,
          message: error.message,
          status: 500,
          code: 0,
          additional: [],
        });
        c.status(500);
      }

      const result = c.var?.result ?? {
        error: true,
        message: error.message,
        status: 500,
        code: 0,
        additional: [],
      };
      const status =
        typeof result === 'object' &&
        result !== null &&
        'status' in (result as Record<string, unknown>) &&
        typeof (result as Record<string, unknown>).status === 'number'
          ? ((result as Record<string, unknown>).status as number)
          : c.res.status || 500;
      const hasErrorField =
        typeof result === 'object' &&
        result !== null &&
        'error' in (result as Record<string, unknown>);

      return c.json(
        {
          result,
          relations: c.var?.relations,
          meta: c.var?.meta,
          error: hasErrorField
            ? (result as Record<string, unknown>).error
            : true,
          serverTime: new Date().toISOString(),
          logId: c.var?.logId,
        },
        status as any,
      );
    });

    // Inject error lookup + template lookup + roles
    this.app.all('*', async (c: AppContext, n: Next) => {
      c.set(
        'getErrorByMessage',
        (message: string): RoutesErrorType | undefined =>
          this.errors[message],
      );
      c.set(
        'getTemplateByName',
        (name: string): EmailTemplatesType =>
          this.emailTemplates[name] || {},
      );
      if (this.roles) c.set('roles', this.roles);

      await n();
    });
  }

  private registerDbMiddleware(db: Db): void {
    this.app.all('*', async (c: AppContext, n: Next) => {
      c.set('db', db.db);
      c.set('dbWrite', db.dbWrite);
      c.set('dbTables', db.dbTables);
      await n();
    });
  }

  private inferCrudMethodsFromRoles(permissionPrefix: string): MethodsType[] {
    if (!this.roles) return [];

    const mapping = this.roles.rolePermissionMapping;
    if (!mapping || typeof mapping !== 'object') return [];

    const result = new Set<MethodsType>();

    for (const permissionMap of Object.values(mapping)) {
      if (!permissionMap || typeof permissionMap !== 'object') continue;

      for (const permission of Object.keys(permissionMap)) {
        const [prefix, action, ...rest] = permission.split('.');
        if (rest.length || !prefix || !action) continue;
        if (prefix !== permissionPrefix) continue;

        const method = action.toUpperCase();
        if (method === '*') {
          for (const crudMethod of CRUD_METHODS) result.add(crudMethod);
          continue;
        }

        if (CRUD_METHODS.includes(method as MethodsType)) {
          result.add(method as MethodsType);
        }
      }
    }

    return CRUD_METHODS.filter((method) => result.has(method));
  }

  private addCrudRoutePermissions(
    routesPermissions: RoutesPermissionsMap,
    { path, permissionPrefix }: CrudPermissionMeta,
    methods: MethodsType[],
  ): void {
    const register = (routePath: string, method: MethodsType): void => {
      const key = `${method} ${routePath}`;
      const permission = `${permissionPrefix}.${method.toLowerCase()}`;

      if (!routesPermissions[key]) routesPermissions[key] = [];
      if (!routesPermissions[key].includes(permission)) {
        routesPermissions[key].push(permission);
      }
    };

    for (const method of methods) {
      if (method === 'POST' || method === 'GET') register(path, method);
      if (method !== 'POST') register(`${path}/:id`, method);
    }
  }

  private hasOwnerPermission(permission: string): boolean {
    const roles = this.roles;
    const ownerPermissions = roles?.rolePermissionMapping?.owner;
    if (!roles || !ownerPermissions) return false;

    return roles.checkWildcardPermissions({
      key: permission,
      permissions: ownerPermissions,
    });
  }

  private addCrudOwnerLookupRoutes(
    ownerLookupRoutes: Record<string, CrudOwnerLookupRoute>,
    { path, permissionPrefix, tableName }: CrudPermissionMeta,
    methods: MethodsType[],
  ): void {
    for (const method of methods) {
      if (method !== 'PATCH' && method !== 'DELETE') continue;

      const permission = `${permissionPrefix}.${method.toLowerCase()}`;
      if (!this.hasOwnerPermission(permission)) continue;

      ownerLookupRoutes[`${method} ${path}/:id`] = {
        tableName,
        idParamName: 'id',
      };
    }
  }

  private addConfiguredCrudOwnerLookupRoutes(
    ownerLookupRoutes: Record<string, CrudOwnerLookupRoute>,
    routesPermissions: RoutesPermissionsMap,
    meta: CrudPermissionMeta,
  ): void {
    for (const method of ['PATCH', 'DELETE'] as MethodsType[]) {
      const key = `${method} ${meta.path}/:id`;
      if (!routesPermissions[key]) continue;

      const permission = `${meta.permissionPrefix}.${method.toLowerCase()}`;
      if (!this.hasOwnerPermission(permission)) continue;

      ownerLookupRoutes[key] = {
        tableName: meta.tableName,
        idParamName: 'id',
      };
    }
  }

  private getMatchedEndpoints(c: AppContext): string[] {
    return matchedRoutes(c)
      .map((item) => item.path)
      .filter((path) => path !== '/*')
      .map((path) => `${c.req.method || 'GET'} ${path}`);
  }

  private async preloadCrudObjectToCheck(
    c: AppContext,
    ownerLookupRoutes: Record<string, CrudOwnerLookupRoute>,
  ): Promise<void> {
    const endpoint = this.getMatchedEndpoints(c).find((item) => ownerLookupRoutes[item]);
    if (!endpoint) return;

    const db = c.var.db as unknown as ((tableName: string) => {
      where: (query: Record<string, unknown>) => {
        first: () => Promise<Record<string, unknown> | undefined>;
      };
    });
    if (typeof db !== 'function') return;

    const { tableName, idParamName } = ownerLookupRoutes[endpoint] as CrudOwnerLookupRoute;
    const id = c.req.param(idParamName);
    if (id === undefined) return;

    c.set('objectToCheck', await db(tableName).where({ id }).first());
  }

  private checkRoutePermissions(c: AppContext): void {
    const roles = this.roles;
    if (!roles) return;

    const permissions = this.getMatchedEndpoints(c).map(
      (endpoint) => roles.routePermissions[endpoint],
    );

    roles.checkAccess({
      permissions,
      user: c.var?.user,
      objectToCheck: c.var?.objectToCheck,
    });
  }

  private registerRoutes(): void {
    const ownerLookupRoutes: Record<string, CrudOwnerLookupRoute> = {};
    const rolesRoute = new Routings();
    if (this.roles) {
      rolesRoute.use('*', async (c: AppContext, next: Next) => {
        await this.preloadCrudObjectToCheck(c, ownerLookupRoutes);
        this.checkRoutePermissions(c);
        await next();
      });
      this.roles.routePermissions = {};
    }

    const app = this.app as any;

    const routesArr = [
      beginRoute,
      rolesRoute,
      relationsRoute,
      ...this.getFlatRoutings(),
      endRoute,
    ];

    for (const routing of routesArr as RoutingsWithCrudMeta[]) {
      if (this.roles && Array.isArray(routing.crudPermissionsMeta)) {
        for (const meta of routing.crudPermissionsMeta) {
          if (meta.methodsConfigured) {
            this.addConfiguredCrudOwnerLookupRoutes(
              ownerLookupRoutes,
              routing.routesPermissions,
              meta,
            );
            continue;
          }

          const methods = this.inferCrudMethodsFromRoles(meta.permissionPrefix);
          this.addCrudRoutePermissions(routing.routesPermissions, meta, methods);
          this.addCrudOwnerLookupRoutes(ownerLookupRoutes, meta, methods);
        }
      }

      const { routes, routesPermissions } = routing;
      this.roles?.addRoutePermissions(routesPermissions);

      for (const route of routes) {
        if (route.method) {
          switch (route.method) {
            case 'GET':
              app.get(route.path, ...route.handlers);
              break;
            case 'POST':
              app.post(route.path, ...route.handlers);
              break;
            case 'PATCH':
              app.patch(route.path, ...route.handlers);
              break;
            case 'DELETE':
              app.delete(route.path, ...route.handlers);
              break;
            case 'OPTIONS':
              app.options(route.path, ...route.handlers);
              break;
            default:
              app.all(
                route.path,
                ...(route.handlers as unknown as MiddlewareHandler[]),
              );
          }
        } else {
          app.all(
            route.path,
            ...(route.handlers as unknown as MiddlewareHandler[]),
          );
        }
      }
    }
  }
}
