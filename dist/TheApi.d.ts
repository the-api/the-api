import { Hono } from 'hono';
import { Db } from './Db';
import type { Server } from 'bun';
import type { Roles } from 'the-api-roles';
import type { Routings as RoutingsType } from 'the-api-routings';
import type { AppEnv, TheApiOptionsType, EmailTemplatesType } from './types';
export declare class TheAPI {
    app: Hono<AppEnv>;
    db: Db | null;
    roles?: Roles;
    private errors;
    private routings;
    private port;
    private migrationDirs;
    emailTemplates: Record<string, EmailTemplatesType>;
    constructor(options?: TheApiOptionsType);
    init(): Promise<void>;
    up(): Promise<import("@hono/node-server").ServerType>;
    upBun(): Promise<{
        fetch: (req: Request, server: Server<any>) => Response | Promise<Response>;
        port: number;
    }>;
    addRoutings(routings: RoutingsType | RoutingsType[]): void;
    private collectErrorsAndTemplates;
    private registerGlobalMiddleware;
    private registerDbMiddleware;
    private inferCrudMethodsFromRoles;
    private addCrudRoutePermissions;
    private registerRoutes;
}
//# sourceMappingURL=TheApi.d.ts.map