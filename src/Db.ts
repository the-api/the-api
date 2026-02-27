import { existsSync, statSync } from 'fs';
import { knex } from 'knex';
import { FsMigrations } from 'knex/lib/migrations/migrate/sources/fs-migrations';
import type { Knex } from 'knex';
import type { DbOptionsType, DbTablesType, DbColumnInfo } from './types';

const {
  DB_HOST: host,
  DB_PORT: port,
  DB_USER: user,
  DB_PASSWORD: password,
  DB_DATABASE: database,
  DB_SCHEMA: schema,
  DB_POOL_MIN: poolMin = '1',
  DB_POOL_MAX: poolMax,
  DB_WRITE_HOST: hostWrite,
  DB_WRITE_PORT: portWrite,
  DB_WRITE_USER: userWrite,
  DB_WRITE_PASSWORD: passwordWrite,
  DB_WRITE_DATABASE: databaseWrite,
  DB_WRITE_SCHEMA: schemaWrite,
  DB_WRITE_POOL_MIN: poolWriteMin = '1',
  DB_WRITE_POOL_MAX: poolWriteMax,
} = process.env;

export class Db {
  public db: Knex;
  public dbWrite: Knex;
  public dbTables: DbTablesType = {};
  private migrationDirs: string[];
  private intervalDbCheck?: Timer;

  constructor(options?: DbOptionsType) {
    const { migrationDirs = [] } = options || {};

    const connection = {
      host,
      user,
      password,
      database,
      port: Number(port),
      ...(schema && { schema }),
    };

    const connectionWrite = {
      host: hostWrite,
      user: userWrite,
      password: passwordWrite,
      database: databaseWrite,
      port: Number(portWrite),
      ...(schemaWrite && { schema: schemaWrite }),
    };

    const pool = poolMax ? { min: +poolMin, max: +poolMax } : undefined;
    const poolWrite = poolWriteMax
      ? { min: +poolWriteMin, max: +poolWriteMax }
      : undefined;

    const defaultDbOptions = {
      client: 'pg',
      useNullAsDefault: true,
    };

    this.db = knex({ connection, ...defaultDbOptions, ...(pool && { pool }) });

    this.dbWrite = hostWrite
      ? knex({
          connection: connectionWrite,
          ...defaultDbOptions,
          ...(poolWrite && { pool: poolWrite }),
        })
      : this.db;

    this.migrationDirs = ([] as string[])
      .concat(migrationDirs)
      .filter((dirPath) => {
        try {
          return existsSync(dirPath) && statSync(dirPath).isDirectory();
        } catch {
          return false;
        }
      });
  }

  async waitDb(): Promise<void> {
    return new Promise((resolve) => {
      this.intervalDbCheck = setInterval(
        () => this.checkDb().then(resolve),
        5000,
      );
      this.checkDb().then(resolve);
    });
  }

  async checkDb(): Promise<void> {
    try {
      await this.db.raw('select 1+1 as result');
      await this.dbWrite.raw('select 1+1 as result');
      clearInterval(this.intervalDbCheck);
      console.log('DB connected');

      const migrationSource = new FsMigrations(this.migrationDirs, false);
      await this.dbWrite.migrate.latest({ migrationSource });
      console.log('Migration done');

      const thresholdRaw = Number(
        process.env.DB_TRGM_SIMILARITY_THRESHOLD ?? 0.1,
      );
      const threshold = Number.isFinite(thresholdRaw) ? thresholdRaw : 0.1;
      await this.db.raw(`SET pg_trgm.similarity_threshold = ${threshold}`);
      await this.dbWrite.raw(`SET pg_trgm.similarity_threshold = ${threshold}`);

      this.dbTables = await this.introspectTables(this.dbWrite);
      console.log(`Tables found: ${Object.keys(this.dbTables)}`);
    } catch (err) {
      console.log('DB connection error:', err, 'waiting for 5 seconds...');
    }
  }

  async destroy(): Promise<void> {
    await this.db.destroy();
    if (this.dbWrite !== this.db) await this.dbWrite.destroy();
  }

  // -- private --

  private async introspectTables(db: Knex): Promise<DbTablesType> {
    const tablesQuery = `
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')`;

    const { rows: tables } = await db.raw(tablesQuery);

    const refsQuery = `
      SELECT
        tc.table_schema, tc.constraint_name,
        tc.table_name, kcu.column_name,
        ccu.table_schema AS foreign_table_schema,
        ccu.table_name   AS foreign_table_name,
        ccu.column_name  AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema    = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.table_schema    = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'`;

    const { rows: references } = await db.raw(refsQuery);

    const result: DbTablesType = {};

    await Promise.all(
      tables.map(
        async ({
          table_schema,
          table_name,
        }: {
          table_schema: string;
          table_name: string;
        }) => {
          const key = `${table_schema}.${table_name}`;
          const { rows: columns } = await db.raw(
            `SELECT * FROM information_schema.columns
             WHERE table_name = :table_name AND table_schema = :table_schema`,
            { table_name, table_schema },
          );

          result[key] = columns.reduce(
            (acc: Record<string, DbColumnInfo>, col: DbColumnInfo) => {
              acc[col.column_name] = {
                ...col,
                references: references.find(
                  (r: Record<string, string>) =>
                    r.table_name === table_name &&
                    r.column_name === col.column_name,
                ),
              };
              return acc;
            },
            {},
          );
        },
      ),
    );

    return result;
  }
}
