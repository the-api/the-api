import type { Context } from 'hono';
type OnError = (c: Context) => Response | Promise<Response>;
type BodyLimitOptions = {
    maxSize: number;
    onError?: OnError;
};
export declare const bodyLimit: (options: BodyLimitOptions) => import("hono").MiddlewareHandler;
export {};
//# sourceMappingURL=bodyLimit.d.ts.map