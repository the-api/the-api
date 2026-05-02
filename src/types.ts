import type { Context, MiddlewareHandler, Handler } from 'hono';
import type { SocketAddress } from 'bun';
import type { Knex } from 'knex';
import type { H } from 'hono/types';
import type { Routings } from 'the-api-routings';
import type Roles from 'the-api-roles';
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
export type AdditionalMessageType = {
  message: string;
  [key: string]: unknown;
};

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
  fullPath: string;
  path: string;
  name: string;
  size: number;
  bucket?: string;
  originalName?: string;
  sizes?: Record<string, UploadImageSizeResultType>;
};

export type UploadImageSizeResultType = {
  path: string;
  width: number;
  height: number;
  size: number;
};

export type FilesImageSizeType = {
  name: string;
  width: number;
  height: number;
};

export type FilesOptions = {
  folder?: string;
  imageSizes?: string | FilesImageSizeType[];
  minio?: {
    bucketName?: string;
    endPoint?: string;
    port?: number;
    useSSL?: boolean;
    accessKey?: string;
    secretKey?: string;
  };
};

export type GetBodyFilesOptionsType = {
  fields?: string[];
  imagesOnly?: boolean;
};

export type UploadManyOptionsType = {
  imagesOnly?: boolean;
};

export type UploadBodyOptionsType = GetBodyFilesOptionsType;

// ------------------------------------------
// Database
// ------------------------------------------

export type DbColumnInfo = {
  column_name: string;
  data_type: string;
  is_nullable: 'YES' | 'NO';
  table_schema: string;
  table_name: string;
  column_default?: string | null;
  udt_name?: string;
  is_primary_key?: boolean;
  check_min?: number;
  check_max?: number;
  check_enum?: unknown[];
  enum_values?: unknown[];
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

export type QueryParamValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Array<string | number | boolean>;

export type NormalizedQueryValue = string | string[];
export type NormalizedQueryType = Record<string, NormalizedQueryValue>;

export type FormBodyValue =
  | string
  | File
  | Array<string | File>;

export type FormBodyType = Record<string, FormBodyValue>;

export type RequestBodyType = 'empty' | 'json' | 'form' | 'text' | 'arrayBuffer';

export type AppVariables = {
  // -- core (set by default middleware) --
  log: (...args: unknown[]) => void;
  error: (err: Error | { message: string }) => void;
  getErrorByMessage: (message: string) => RoutesErrorType | undefined;
  getTemplateByName: (name: string) => EmailTemplatesType;
  appendQueryParams: (params: Record<string, QueryParamValue>) => void;

  // -- request state --
  body: unknown;
  bodyType: RequestBodyType;
  query: NormalizedQueryType;
  result: unknown;
  meta: Record<string, unknown>;
  relations: Record<string, unknown>;
  relationsData: Record<string, unknown>;
  logId: string;
  user: Record<string, unknown>;
  objectToCheck?: Record<string, unknown>;

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

export type RoutingsInputItemType = Routings | Routings[];
export type RoutingsInputType = RoutingsInputItemType[];

export type TheApiOptionsType = {
  routings: RoutingsInputType;
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
  methods?: (MethodType | '*')[];
  owner?: string[];
};

export type CrudBuilderFieldRulesType = {
  hidden?: string[];
  readOnly?: string[];
  visibleFor?: Record<string, string[]>;
  editableFor?: Record<string, string[]>;
};

export type ValidationType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'enum'
  | 'array'
  | 'object';

export type ValidationFieldType = ValidationType | ValidationType[];

export type ValidationFieldSchema = {
  type?: ValidationFieldType;
  required?: boolean;
  enum?: unknown[];
  min?: number;
  max?: number;
  preprocess?: (value: unknown) => unknown;
  items?: ValidationFieldSchema;
  properties?: Record<string, ValidationFieldSchema>;
  [key: string]: unknown;
};

export type ValidationSchema = Record<string, ValidationFieldSchema>;

export type ValidationErrorItem = {
  field: string;
  message: string;
  expected?: Record<string, unknown>;
  value: unknown;
};

export type ValidationResolverResult =
  | ValidationSchema
  | ValidationErrorItem[]
  | { errors?: ValidationErrorItem[] }
  | null
  | undefined
  | unknown;

export type ValidationResolver = (
  c: AppContext,
  next: () => Promise<void>,
) => Promise<ValidationResolverResult> | ValidationResolverResult;

export type ValidationSection = ValidationSchema | ValidationResolver;

export type CrudValidationOptions = {
  params?: ValidationSection;
  query?: ValidationSection;
  headers?: ValidationSection;
  body?: {
    post?: ValidationSection;
    patch?: ValidationSection;
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
  fieldRules?: CrudBuilderFieldRulesType;
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
  validation?: CrudValidationOptions;
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
