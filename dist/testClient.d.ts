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
export type TestClientUserType = {
    userId: number;
    roles?: string[];
    token?: string;
};
export type TestClientUsersType = Record<string, TestClientUserType>;
export type TestClientTokensType = Record<string, string>;
export type TestClientRolesConfigType = Record<string, string[]>;
export type TestClientOptionsType = {
    migrationDirs?: string[];
    crudParams?: CrudBuilderOptionsType[];
    roles?: Roles | TestClientRolesConfigType;
    routings?: RoutingsInputType;
    newRoutings?: (router: Routings) => void;
    beforeInit?: (theAPI: TheAPI) => void | Promise<void>;
    theApiOptions?: Omit<TheApiOptionsType, 'routings' | 'roles' | 'migrationDirs'>;
};
export type TestClientResultType = {
    client: TestClient;
    theAPI: TheAPI;
    DateTime: typeof DateTime;
    tokens: TestClientTokensType;
    users: TestClientUsersType;
    db: Knex;
};
export declare class TestClient {
    private readonly app;
    private readonly headers?;
    private readonly vars;
    readonly db: Knex;
    readonly tokens: TestClientTokensType;
    readonly users: TestClientUsersType;
    /**
     * Конструктор принимает всё необходимое — объект сразу готов к работе,
     * никакого отложенного init().
     */
    constructor(app: Hono<any>, db: Knex, headers?: IncomingHttpHeaders);
    deleteTables(): Promise<void>;
    truncateTables(tables: string[] | string): Promise<void>;
    request(method: MethodType, requestPath: string, body?: HttpPostBodyType, token?: string): Promise<any>;
    get(p: string, token?: string): Promise<any>;
    post(p: string, json: HttpPostBodyType, token?: string): Promise<any>;
    postForm(p: string, form: HttpPostBodyType, token?: string): Promise<any>;
    postFormRequest(p: string, obj: Record<string, unknown>, token?: string): Promise<Response>;
    private appendFormValue;
    patch(p: string, json: HttpPostBodyType, token?: string): Promise<any>;
    delete(p: string, token?: string): Promise<any>;
    generateGWT(params: Record<string, unknown>, expiresIn?: string): string;
    storeValue(key: string, value: unknown): void;
    getValue(key: string): unknown;
    readFile(relativePath: string, type?: string): Promise<File>;
}
export declare function createRoutings(options?: {
    migrationDirs?: string[];
}): Routings;
/**
 * Главная точка входа для тестов.
 *
 * - Создаёт свежий TheAPI + TestClient на каждый вызов (без singleton)
 * - Автоматически вызывает theAPI.init()
 * - Автоматически регистрирует afterAll для очистки
 */
export declare function testClient(options?: TestClientOptionsType): Promise<TestClientResultType>;
export {};
//# sourceMappingURL=testClient.d.ts.map