import { Hono } from 'hono';
import { Db } from './Db';
import type { Server } from 'bun';
import type Roles from 'the-api-roles';
import type { Routings as RoutingsType } from 'the-api-routings';
import type { AppEnv, TheApiOptionsType, RoutingsInputType, EmailTemplatesType } from './types';
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
    destroy(): Promise<void>;
    addRoutings(routings: RoutingsType | RoutingsInputType): void;
    private collectErrorsAndTemplates;
    private getFlatRoutings;
    private registerGlobalMiddleware;
    private registerDbMiddleware;
    private inferCrudMethodsFromRoles;
    private addCrudRoutePermissions;
    private hasOwnerPermission;
    private addCrudOwnerLookupRoutes;
    private addConfiguredCrudOwnerLookupRoutes;
    private getMatchedEndpoints;
    private preloadCrudObjectToCheck;
    private registerRoutes;
}
//# sourceMappingURL=TheApi.d.ts.map