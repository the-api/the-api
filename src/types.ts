import type { Context, MiddlewareHandler, Handler } from 'hono';
import type { SocketAddress } from 'bun';
import type { Knex } from 'knex';
import type { H } from 'hono/types';
import type { Routings, CrudBuilderOptionsType as ExternalCrudOpts } from 'the-api-routings';
import type { Roles } from 'the-api-roles';
import type { Files } from './Files';

export type { MiddlewareHandler, Handler };

// ------------------------------------------
// HTTP
// ------------------------------------------

export type MethodType = 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'OPTIONS';

export type MethodPathType = {
  method?: MethodType;
  path: string;
};

export type RoutesType = MethodPathType & {
  handlers: (Handler | MiddlewareHandler)[];
};

export type PushToRoutesParamsType = MethodPathType & {
  fnArr: H<any, any, {}, any>[];
};

// ------------------------------------------
// Errors
// ------------------------------------------

export type RoutesErrorType = {
  code: number;
  status: number;
  description?: string;
};

export type RoutesErrorsType = Record<string, RoutesErrorType>;

// ------------------------------------------
// Email
// ------------------------------------------

export type EmailTemplatesType = {
  subject?: string;
  text?: string;
  html?: string;
};

export type EmailParamsType = EmailTemplatesType & {
  to: string;
  template?: string;
  data?: Record<string, unknown>;
};

export type EmailConfig = {
  host?: string;
  port?: number | string;
  secure?: boolean;
  auth?: { user?: string; pass?: string };
  from?: string;
  tls?: { rejectUnauthorized?: boolean };
};

// ------------------------------------------
// Files
// ------------------------------------------

export type UploadResultType = {
  path: string;
  name: string;
  size: number;
  bucket?: string;
};

export type FilesOptions = {
  folder?: string;
  minio?: {
    bucketName?: string;
    endPoint?: string;
    port?: number;
    useSSL?: boolean;
    accessKey?: string;
    secretKey?: string;
  };
};

// ------------------------------------------
// Database
// ------------------------------------------

export type DbColumnInfo = {
  column_name: string;
  data_type: string;
  is_nullable: 'YES' | 'NO';
  table_schema: string;
  table_name: string;
  references?: {
    table_schema: string;
    constraint_name: string;
    table_name: string;
    column_name: string;
    foreign_table_schema: string;
    foreign_table_name: string;
    foreign_column_name: string;
  };
  [key: string]: unknown;
};

export type DbTablesType = Record<string, Record<string, DbColumnInfo>>;

export type DbOptionsType = {
  migrationDirs?: string[];
};

// ------------------------------------------
// Hono App - Environment
// ------------------------------------------

export type AppBindings = {
  ip: SocketAddress | null;
};

export type AppVariables = {
  // -- core (set by default middleware) --
  log: (...args: unknown[]) => void;
  error: (err: Error | { message: string }) => void;
  getErrorByMessage: (message: string) => RoutesErrorType | undefined;
  getTemplateByName: (name: string) => EmailTemplatesType;

  // -- request state --
  result: unknown;
  meta: Record<string, unknown>;
  relations: Record<string, unknown>;
  relationsData: Record<string, unknown>;
  logId: string;
  user: Record<string, unknown>;

  // -- database (set when DB configured) --
  db: Knex;
  dbWrite: Knex;
  dbTables: DbTablesType;

  // -- optional services (depend on middleware) --
  files: Files;
  roles: Roles;
  email: (params: EmailParamsType) => Promise<void>;
};

export type AppEnv = {
  Bindings: AppBindings;
  Variables: AppVariables;
};

export type AppContext = Context<AppEnv>;

// ------------------------------------------
// Config
// ------------------------------------------

export type TheApiOptionsType = {
  routings: Routings[];
  roles?: Roles;
  emailTemplates?: Record<string, EmailTemplatesType>;
  port?: number;
  migrationDirs?: string[];
};

export type RoutingsOptionsType = {
  migrationDirs?: string[];
};

// ------------------------------------------
// CRUD builder (re-export convenience)
// ------------------------------------------

export type stringRecordType = Record<string, string>;
export type fieldType = string | number | boolean;
export type fieldRecordType = Record<string, fieldType>;
export type whereParamsType = stringRecordType & { isDeleted?: boolean };

export type CrudBuilderJoinType = {
  table: string;
  schema?: string;
  alias?: string;
  as?: string;
  where?: string;
  whereBindings?: stringRecordType;
  defaultValue?: fieldType;
  fields?: string[];
  field?: string;
  orderBy?: string;
  limit?: number;
  leftJoin?: string | string[];
  byIndex?: number;
  permission?: string;
};

export type CrudBuilderPermissionsType = {
  protectedMethods?: (MethodType | '*')[];
  owner?: string[];
  fields?: {
    viewable?: Record<string, string[]>;
    editable?: Record<string, string[]>;
  };
};

export type CrudBuilderOptionsType = {
  c?: Context;
  table: string;
  prefix?: string;
  schema?: string;
  aliases?: stringRecordType;
  join?: CrudBuilderJoinType[];
  joinOnDemand?: CrudBuilderJoinType[];
  leftJoin?: string[];
  leftJoinDistinct?: string[];
  lang?: string;
  translate?: string[];
  searchFields?: string[];
  requiredFields?: string[];
  hiddenFields?: string[];
  readOnlyFields?: string[];
  showFieldsByPermission?: Record<string, string[]>;
  permissions?: CrudBuilderPermissionsType;
  defaultWhere?: fieldRecordType;
  defaultWhereRaw?: string;
  defaultSort?: string;
  sortRaw?: string;
  fieldsRaw?: unknown;
  includeDeleted?: boolean;
  deletedReplacements?: fieldRecordType;
  relations?: Record<string, CrudBuilderOptionsType>;
  relationIdName?: string;
  tokenRequired?: unknown;
  ownerRequired?: unknown;
  rootRequired?: unknown;
  access?: unknown;
  accessByStatuses?: unknown;
  dbTables?: DbTablesType;
  cache?: unknown;
  userIdFieldName?: string;
  additionalFields?: unknown;
  apiClientMethodNames?: unknown;
};

export type metaType = {
  total: number;
  limit?: number;
  skip?: number;
  page?: number;
  nextPage?: number;
  pages?: number;
  after?: string;
  nextAfter?: string;
  isFirstPage?: boolean;
  isLastPage?: boolean;
};

export type getResultType = {
  result: unknown[];
  meta: metaType;
  relations?: Record<string, unknown[]>;
  error?: boolean;
};
