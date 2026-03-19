import { DateTime } from 'luxon';
import Roles from 'the-api-roles';
import { Routings } from 'the-api-routings';
import { TheAPI } from './TheApi';
import type { Knex } from 'knex';
import type { IncomingHttpHeaders } from 'http';
import type { Hono } from 'hono';
import type { CrudBuilderOptionsType } from 'the-api-routings';
import type { MethodType, RoutingsInputType, TheApiOptionsType } from './types';
type BodyType = string | number | boolean | HttpPostBodyType;
export type HttpPostBodyType = {
    [key: string]: BodyType | BodyType[];
};
export type TestClientInitType = {
    app: Hono<any>;
    headers?: IncomingHttpHeaders;
};
export type TestClientUserType = {
    id: number;
    userId?: number;
    roles?: string[];
    token?: string;
};
export type TestClientUsersType = Record<string, TestClientUserType>;
export type TestClientTokensType = Record<string, string>;
export type TestClientRolesConfigType = Record<string, string[]>;
export type TestClientOptionsType = {
    migrationDirs?: string[];
    routingOptions?: {
        migrationDirs?: string[];
    };
    crudParams?: CrudBuilderOptionsType[];
    roles?: Roles | TestClientRolesConfigType;
    routings?: RoutingsInputType;
    newRoutings?: (router: Routings) => void;
    theApiOptions?: Omit<TheApiOptionsType, 'routings' | 'roles' | 'migrationDirs'>;
};
export declare function createRoutings(options?: {
    migrationDirs?: string[];
}): Routings;
export declare class TestClient {
    private app;
    private headers?;
    private vars;
    db: Knex;
    tokens: TestClientTokensType;
    users: TestClientUsersType;
    constructor(options?: TestClientInitType);
    init({ app, headers }: TestClientInitType): Promise<void>;
    deleteTables(): Promise<void>;
    truncateTables(tables: string[] | string): Promise<void>;
    getClient(options: TheApiOptionsType): Promise<Hono<import("./types").AppEnv, import("hono/types").BlankSchema, "/">>;
    request(method: MethodType, requestPath: string, body?: HttpPostBodyType, token?: string): Promise<any>;
    get(pathName: string, token?: string): Promise<any>;
    post(pathName: string, json: HttpPostBodyType, token?: string): Promise<any>;
    postForm(pathName: string, form: HttpPostBodyType, token?: string): Promise<any>;
    postFormRequest(pathName: string, obj: Record<string, unknown>, token?: string): Promise<Response>;
    private appendFormValue;
    patch(pathName: string, json: HttpPostBodyType, token?: string): Promise<any>;
    delete(pathName: string, token?: string): Promise<any>;
    generateGWT(params: Record<string, unknown>, expiresIn?: string): string;
    storeValue(key: string, value: unknown): void;
    getValue(key: string): unknown;
    readFile(filePath: string): Promise<File>;
}
type TestClientResultType = {
    client: TestClient;
    theAPI: TheAPI;
    DateTime: typeof DateTime;
    tokens: TestClientTokensType;
    users: TestClientUsersType;
    db: Knex;
};
export declare function getTestClient(options?: TestClientInitType): Promise<TestClient>;
export declare function testClient(options?: TestClientOptionsType): Promise<TestClientResultType>;
export {};
//# sourceMappingURL=testClient.d.ts.map