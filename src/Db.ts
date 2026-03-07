import { existsSync, statSync } from 'fs';
import knex from 'knex';
import { FsMigrations } from 'knex/lib/migrations/migrate/sources/fs-migrations.js';
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

    const primaryKeysQuery = `
      SELECT
        kcu.table_schema,
        kcu.table_name,
        kcu.column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'`;
    const { rows: primaryKeys } = await db.raw(primaryKeysQuery);

    const checkQuery = `
      SELECT
        n.nspname AS table_schema,
        cls.relname AS table_name,
        att.attname AS column_name,
        pg_get_constraintdef(con.oid) AS check_definition
      FROM pg_constraint con
      JOIN pg_class cls ON cls.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = cls.relnamespace
      JOIN unnest(con.conkey) AS ck(attnum) ON TRUE
      JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ck.attnum
      WHERE con.contype = 'c'
        AND n.nspname NOT IN ('pg_catalog', 'information_schema')`;
    const { rows: checks } = await db.raw(checkQuery);

    const enumQuery = `
      SELECT
        n.nspname AS table_schema,
        cls.relname AS table_name,
        att.attname AS column_name,
        array_agg(en.enumlabel ORDER BY en.enumsortorder) AS enum_values
      FROM pg_attribute att
      JOIN pg_class cls ON cls.oid = att.attrelid
      JOIN pg_namespace n ON n.oid = cls.relnamespace
      JOIN pg_type t ON t.oid = att.atttypid
      JOIN pg_enum en ON en.enumtypid = t.oid
      WHERE att.attnum > 0
        AND NOT att.attisdropped
        AND n.nspname NOT IN ('pg_catalog', 'information_schema')
      GROUP BY n.nspname, cls.relname, att.attname`;
    const { rows: enumRows } = await db.raw(enumQuery);

    const referencesMap = references.reduce(
      (acc: Record<string, Record<string, string>>, row: Record<string, string>) => {
        const key = `${row.table_schema}.${row.table_name}.${row.column_name}`;
        acc[key] = row;
        return acc;
      },
      {},
    );

    const primaryKeyMap = primaryKeys.reduce(
      (acc: Record<string, boolean>, row: Record<string, string>) => {
        acc[`${row.table_schema}.${row.table_name}.${row.column_name}`] = true;
        return acc;
      },
      {},
    );

    const checkMap = checks.reduce(
      (
        acc: Record<string, { min?: number; max?: number; enum?: unknown[] }>,
        row: Record<string, string>,
      ) => {
        const key = `${row.table_schema}.${row.table_name}.${row.column_name}`;
        const parsed = this.parseSimpleCheckConstraint(
          row.check_definition,
          row.column_name,
        );
        if (!parsed) return acc;

        const prev = acc[key] || {};
        acc[key] = {
          min: typeof parsed.min === 'number'
            ? (typeof prev.min === 'number' ? Math.max(prev.min, parsed.min) : parsed.min)
            : prev.min,
          max: typeof parsed.max === 'number'
            ? (typeof prev.max === 'number' ? Math.min(prev.max, parsed.max) : parsed.max)
            : prev.max,
          enum: parsed.enum
            ? Array.from(new Set([...(prev.enum || []), ...parsed.enum]))
            : prev.enum,
        };
        return acc;
      },
      {},
    );

    const enumMap = enumRows.reduce(
      (acc: Record<string, unknown[]>, row: Record<string, unknown>) => {
        const key = `${row.table_schema}.${row.table_name}.${row.column_name}`;
        const enumValues = Array.isArray(row.enum_values) ? row.enum_values : [];
        acc[key] = enumValues;
        return acc;
      },
      {},
    );

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
              const columnKey = `${table_schema}.${table_name}.${col.column_name}`;
              const checkData = checkMap[columnKey] || {};
              acc[col.column_name] = {
                ...col,
                references: referencesMap[columnKey],
                is_primary_key: !!primaryKeyMap[columnKey],
                ...(typeof checkData.min === 'number' && { check_min: checkData.min }),
                ...(typeof checkData.max === 'number' && { check_max: checkData.max }),
                ...(Array.isArray(checkData.enum) && checkData.enum.length && { check_enum: checkData.enum }),
                ...(Array.isArray(enumMap[columnKey]) && enumMap[columnKey].length && { enum_values: enumMap[columnKey] }),
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

  private parseSimpleCheckConstraint(
    definition: string | undefined,
    columnName: string,
  ): { min?: number; max?: number; enum?: unknown[] } | undefined {
    if (!definition) return;

    const normalized = definition
      .replace(/^CHECK\s*\(/i, '')
      .replace(/\)\s*$/, '')
      .replace(/::[a-zA-Z_][a-zA-Z0-9_ ]*/g, '');

    const escapedColumn = columnName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const column = `\"?${escapedColumn}\"?`;

    const minMatches = [
      ...normalized.matchAll(new RegExp(`${column}\\s*(?:>=|>)\\s*(-?\\d+(?:\\.\\d+)?)`, 'gi')),
      ...normalized.matchAll(new RegExp(`(-?\\d+(?:\\.\\d+)?)\\s*(?:<=|<)\\s*${column}`, 'gi')),
    ].map((m) => Number(m[1])).filter((n) => Number.isFinite(n));

    const maxMatches = [
      ...normalized.matchAll(new RegExp(`${column}\\s*(?:<=|<)\\s*(-?\\d+(?:\\.\\d+)?)`, 'gi')),
      ...normalized.matchAll(new RegExp(`(-?\\d+(?:\\.\\d+)?)\\s*(?:>=|>)\\s*${column}`, 'gi')),
    ].map((m) => Number(m[1])).filter((n) => Number.isFinite(n));

    const inMatches = [
      ...normalized.matchAll(new RegExp(`${column}\\s+IN\\s*\\(([^)]+)\\)`, 'gi')),
    ];
    const anyArrayMatches = [
      ...normalized.matchAll(new RegExp(`${column}\\s*=\\s*ANY\\s*\\(\\s*ARRAY\\s*\\[([^\\]]+)\\]`, 'gi')),
    ];

    const enumTokens = inMatches
      .concat(anyArrayMatches)
      .flatMap((match) => String(match[1] || '').split(','))
      .map((item) => item.trim())
      .map((item) => item.replace(/^'+|'+$/g, '').replace(/^\"+|\"+$/g, ''))
      .filter(Boolean)
      .map((item) => {
        const n = Number(item);
        return Number.isFinite(n) && `${n}` === item ? n : item;
      });

    const out: { min?: number; max?: number; enum?: unknown[] } = {};
    if (minMatches.length) out.min = Math.max(...minMatches);
    if (maxMatches.length) out.max = Math.min(...maxMatches);
    if (enumTokens.length) out.enum = Array.from(new Set(enumTokens));

    if (
      typeof out.min === 'undefined'
      && typeof out.max === 'undefined'
      && typeof out.enum === 'undefined'
    ) {
      return;
    }

    return out;
  }
}
