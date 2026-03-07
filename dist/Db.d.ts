import type { Knex } from 'knex';
import type { DbOptionsType, DbTablesType } from './types';
export declare class Db {
    db: Knex;
    dbWrite: Knex;
    dbTables: DbTablesType;
    private migrationDirs;
    private intervalDbCheck?;
    constructor(options?: DbOptionsType);
    waitDb(): Promise<void>;
    checkDb(): Promise<void>;
    destroy(): Promise<void>;
    private introspectTables;
    private parseSimpleCheckConstraint;
}
//# sourceMappingURL=Db.d.ts.map