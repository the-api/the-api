import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import { resolve } from 'path';
import { Routings } from 'the-api-routings';
import { Db } from './Db';
import { beginRoute, endRoute } from './middlewares/default';
import { relationsRoute } from './middlewares/relations';
import type { Next, MiddlewareHandler } from 'hono';
import type { Server } from 'bun';
import type { Roles } from 'the-api-roles';
import type { Routings as RoutingsType } from 'the-api-routings';
import type {
  AppEnv,
  AppContext,
  TheApiOptionsType,
  EmailTemplatesType,
  RoutesErrorsType,
  RoutesErrorType,
} from './types';

const {
  PORT = '7788',
  DB_HOST: dbHost,
  DB_WRITE_HOST: dbHostWrite,
} = process.env;

export class TheAPI {
  app: Hono<AppEnv>;
  db: Db | null = null;
  roles?: Roles;
  private errors: RoutesErrorsType = {};
  private routings: RoutingsType[];
  private port: number;
  private migrationDirs: string[] = [
    resolve(`${import.meta.dir}/../src/migrations`),
  ];
  emailTemplates: Record<string, EmailTemplatesType> = {};

  constructor(options?: TheApiOptionsType) {
    const { routings, roles, emailTemplates, port, migrationDirs } =
      options || {};

    this.app = new Hono<AppEnv>({ router: new RegExpRouter() });
    this.roles = roles;
    if (emailTemplates) this.emailTemplates = emailTemplates;
    this.routings = routings || [];
    this.port = port || +PORT;
    if (migrationDirs) this.migrationDirs = migrationDirs;
  }

  async init(): Promise<void> {
    this.collectErrorsAndTemplates();
    this.registerGlobalMiddleware();

    if (dbHost || dbHostWrite) {
      for (const { migrationDirs } of this.routings) {
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
    await this.init();
    return {
      fetch: (req: Request, server: Server<any>) =>
        this.app.fetch(req, { ip: server.requestIP(req) }),
      port: this.port,
    };
  }

  addRoutings(routings: RoutingsType | RoutingsType[]): void {
    this.routings = this.routings.concat(routings);
  }

  // -- private --

  private collectErrorsAndTemplates(): void {
    const all = [
      beginRoute,
      relationsRoute,
      ...this.routings,
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

  private registerGlobalMiddleware(): void {
    // Safety net for uncaught errors
    this.app.onError((err, c: AppContext) => {
      console.error('Unhandled error:', err);
      const error = err instanceof Error ? err : new Error(String(err));

      try {
        const errorHandler = c.var?.error || c.get('error');
        if (typeof errorHandler === 'function') {
          errorHandler(error);
        } else {
          const message = error.message;
          const match = message.match(/^(\w+):?\s?(.*?)$/);
          let name = match?.[1] ?? message;
          let additional = match?.[2] ?? '';

          const getErr = c.var?.getErrorByMessage || c.get('getErrorByMessage');
          let errObj =
            typeof getErr === 'function' ? getErr(name) : undefined;

          if (!errObj && typeof getErr === 'function') {
            errObj = getErr('DEFAULT');
            name = message;
            additional = '';
          }

          c.set('result', { ...errObj, name, additional, error: true });
          if (errObj?.status) c.status(errObj.status as any);
        }
      } catch {
        c.set('result', {
          error: true,
          message: error.message,
          status: 500,
          code: 0,
        });
        c.status(500);
      }

      const result = c.var?.result ?? {
        error: true,
        message: error.message,
        status: 500,
        code: 0,
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

  private registerRoutes(): void {
    const rolesRoute = new Routings();
    if (this.roles) {
      rolesRoute.use('*', this.roles.rolesMiddleware);
      this.roles.routePermissions = {};
    }

    const app = this.app as any;

    const routesArr = [
      beginRoute,
      rolesRoute,
      relationsRoute,
      ...this.routings,
      endRoute,
    ];

    for (const { routes, routesPermissions } of routesArr) {
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
            case 'PUT':
              app.put(route.path, ...route.handlers);
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
