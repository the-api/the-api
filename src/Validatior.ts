import type {
  AdditionalMessageType,
  AppContext,
  CrudBuilderOptionsType,
  CrudValidationOptions,
  DbColumnInfo,
  ValidationErrorItem,
  ValidationFieldSchema,
  ValidationSchema,
  ValidationSection,
} from './types';
import { normalizeCrudConfig } from './crudConfig';

const DEFAULT_READONLY_FIELDS = [
  'id',
  'timeCreated',
  'timeUpdated',
  'timeDeleted',
  'isDeleted',
];

const DEFAULT_VALIDATION_ERROR = {
  code: 22,
  status: 400,
  description: 'Validation error',
};

type CrudValidationAction = 'getAll' | 'getOne' | 'post' | 'patch' | 'delete';

type CrudValidationSchema = {
  params?: ValidationSchema;
  query?: ValidationSchema;
  headers?: ValidationSchema;
  body?: {
    post?: ValidationSchema;
    patch?: ValidationSchema;
  };
};

type ResolvedSection = ValidationSection | null | undefined;

type ResolvedCrudValidation = {
  disabledAll: boolean;
  params?: ResolvedSection;
  query?: ResolvedSection;
  headers?: ResolvedSection;
  body?: {
    post?: ResolvedSection;
    patch?: ResolvedSection;
  };
};

type ResolvedRuntimeSection = {
  schema?: ValidationSchema;
  errors?: ValidationErrorItem[];
  externalValidator?: unknown;
};

const toPlainObject = (input: unknown): Record<string, unknown> | null =>
  input && typeof input === 'object' && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : null;

const isPlainObject = (input: unknown): input is Record<string, unknown> =>
  !!toPlainObject(input);

const isEmptyPlainObject = (input: unknown): boolean =>
  isPlainObject(input) && Object.keys(input).length === 0;

const isValidationResolver = (section: unknown): section is Exclude<ValidationSection, ValidationSchema> =>
  typeof section === 'function';

const withSectionPrefix = (
  section: string,
  issues: ValidationErrorItem[],
): ValidationErrorItem[] => issues.map((issue) => {
  if (issue.field.startsWith(`${section}.`) || issue.field === section) {
    return issue;
  }
  return { ...issue, field: `${section}.${issue.field}` };
});

const toExpected = (rule: ValidationFieldSchema): Record<string, unknown> => {
  const expected: Record<string, unknown> = {};

  if (typeof rule.type !== 'undefined') expected.type = rule.type;
  if (rule.required === true) expected.required = true;
  if (typeof rule.min === 'number') expected.min = rule.min;
  if (typeof rule.max === 'number') expected.max = rule.max;
  if (Array.isArray(rule.enum)) expected.enum = rule.enum;
  if (rule.items) expected.items = toExpected(rule.items);
  if (rule.properties) {
    expected.properties = Object.entries(rule.properties).reduce(
      (acc: Record<string, unknown>, [key, value]) => {
        acc[key] = toExpected(value);
        return acc;
      },
      {},
    );
  }

  return expected;
};

const formatValueForMessage = (value: unknown): string => {
  if (typeof value === 'string') return `'${value}'`;
  if (value === null || typeof value === 'undefined') return 'null';
  if (value instanceof Date) return `'${value.toISOString()}'`;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const makeIssue = (
  field: string,
  message: string,
  expected: Record<string, unknown>,
  value: unknown,
): ValidationErrorItem => ({
  field,
  message,
  expected,
  value: value ?? null,
});

const isMissingValue = (value: unknown): boolean =>
  typeof value === 'undefined' || value === null || value === '';

const canBeNumber = (value: unknown): { ok: boolean; num?: number } => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { ok: true, num: value };
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const num = Number(value);
    if (Number.isFinite(num)) {
      return { ok: true, num };
    }
  }
  return { ok: false };
};

const canBeBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return true;
  if (typeof value !== 'string') return false;
  return ['true', 'false', '1', '0'].includes(value.toLowerCase());
};

const canBeDate = (value: unknown): boolean => {
  if (value instanceof Date) return !Number.isNaN(value.getTime());

  if (typeof value === 'string' && value.toUpperCase() === 'NOW()') return true;

  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return !Number.isNaN(d.getTime());
  }
  return false;
};

const normalizeTypeList = (rule: ValidationFieldSchema): string[] => {
  if (Array.isArray(rule.type)) return rule.type;
  if (typeof rule.type === 'string') return [rule.type];
  if (Array.isArray(rule.enum)) return ['enum'];
  if (rule.items) return ['array'];
  if (rule.properties) return ['object'];
  return [];
};

const validateByType = (
  value: unknown,
  rule: ValidationFieldSchema,
  type: string,
  field: string,
): ValidationErrorItem[] => {
  const expected = toExpected({ ...rule, type: type as ValidationFieldSchema['type'] });

  if (type === 'string') {
    if (typeof value === 'string') return [];
    return [makeIssue(field, `Expected a string, but received ${formatValueForMessage(value)}`, expected, value)];
  }

  if (type === 'number') {
    const parsed = canBeNumber(value);
    if (!parsed.ok) {
      if (typeof rule.min === 'number' && typeof rule.max === 'number') {
        return [makeIssue(
          field,
          `Expected a number between ${rule.min} and ${rule.max}, but received ${formatValueForMessage(value)}`,
          expected,
          value,
        )];
      }
      return [makeIssue(field, `Expected a number, but received ${formatValueForMessage(value)}`, expected, value)];
    }

    const num = parsed.num as number;
    if (typeof rule.min === 'number' && num < rule.min) {
      return [makeIssue(
        field,
        `Expected a number greater than or equal to ${rule.min}, but received ${formatValueForMessage(value)}`,
        expected,
        value,
      )];
    }
    if (typeof rule.max === 'number' && num > rule.max) {
      return [makeIssue(
        field,
        `Expected a number less than or equal to ${rule.max}, but received ${formatValueForMessage(value)}`,
        expected,
        value,
      )];
    }
    return [];
  }

  if (type === 'boolean') {
    if (canBeBoolean(value)) return [];
    return [makeIssue(field, `Expected a boolean, but received ${formatValueForMessage(value)}`, expected, value)];
  }

  if (type === 'date') {
    if (canBeDate(value)) return [];
    return [makeIssue(field, `Expected a date, but received ${formatValueForMessage(value)}`, expected, value)];
  }

  if (type === 'enum') {
    const enumValues = Array.isArray(rule.enum) ? rule.enum : [];
    const isAllowed = enumValues.some((item) => item === value || String(item) === String(value));
    if (isAllowed) return [];
    return [makeIssue(
      field,
      `Expected one of [${enumValues.join(', ')}], but received ${formatValueForMessage(value)}`,
      expected,
      value,
    )];
  }

  if (type === 'array') {
    if (!Array.isArray(value)) {
      return [makeIssue(field, `Expected an array, but received ${formatValueForMessage(value)}`, expected, value)];
    }

    if (!rule.items) return [];

    const errors: ValidationErrorItem[] = [];
    for (let i = 0; i < value.length; i += 1) {
      errors.push(...validateValue(value[i], rule.items, `${field}[${i}]`));
    }
    return errors;
  }

  if (type === 'object') {
    if (!isPlainObject(value)) {
      return [makeIssue(field, `Expected an object, but received ${formatValueForMessage(value)}`, expected, value)];
    }

    if (!rule.properties) return [];

    const errors: ValidationErrorItem[] = [];
    for (const [key, nestedRule] of Object.entries(rule.properties)) {
      errors.push(
        ...validateValue(
          (value as Record<string, unknown>)[key],
          nestedRule,
          `${field}.${key}`,
        ),
      );
    }
    return errors;
  }

  return [];
};

const validateValue = (
  value: unknown,
  rule: ValidationFieldSchema,
  field: string,
): ValidationErrorItem[] => {
  if (isMissingValue(value)) {
    if (rule.required === true) {
      return [makeIssue(
        field,
        'This field is required but was not provided',
        toExpected(rule),
        value,
      )];
    }
    return [];
  }

  let processed = value;
  if (typeof rule.preprocess === 'function') {
    try {
      processed = rule.preprocess(value);
    } catch (err) {
      return [makeIssue(
        field,
        `Failed to preprocess value: ${err instanceof Error ? err.message : String(err)}`,
        toExpected(rule),
        value,
      )];
    }
  }

  const types = normalizeTypeList(rule);
  if (!types.length) return [];

  if (types.length === 1) {
    return validateByType(processed, rule, types[0] as string, field);
  }

  let bestErrors: ValidationErrorItem[] = [];
  for (const t of types) {
    const errs = validateByType(processed, rule, t as string, field);
    if (!errs.length) return [];
    if (!bestErrors.length) bestErrors = errs;
  }

  if (bestErrors.length) return bestErrors;

  return [makeIssue(
    field,
    `Expected one of types [${types.join(', ')}], but received ${formatValueForMessage(processed)}`,
    toExpected(rule),
    processed,
  )];
};

const validateDataBySchema = (
  data: Record<string, unknown>,
  schema: ValidationSchema,
  section: string,
): ValidationErrorItem[] => {
  const errors: ValidationErrorItem[] = [];
  for (const [field, rule] of Object.entries(schema)) {
    errors.push(...validateValue(data[field], rule, `${section}.${field}`));
  }
  return errors;
};

const parseJsonArray = (value: unknown): unknown => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return value;
  const parsed = JSON.parse(value);
  return Array.isArray(parsed) ? parsed : value;
};

const splitCsv = (value: unknown): unknown => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return value;
  return value.split(',').map((item) => item.trim()).filter(Boolean);
};

const splitSortFields = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim().replace(/^-/, ''))
      .filter(Boolean);
  }
  if (typeof value !== 'string') return value;
  return value
    .split(',')
    .map((item) => item.trim().replace(/^-/, ''))
    .filter(Boolean);
};

const isNumericDbType = (dataType: string): boolean => {
  const dt = dataType.toLowerCase();
  return [
    'integer',
    'int',
    'smallint',
    'bigint',
    'numeric',
    'decimal',
    'real',
    'double precision',
    'float',
    'serial',
    'bigserial',
  ].some((name) => dt.includes(name));
};

const isBooleanDbType = (dataType: string): boolean => dataType.toLowerCase().includes('bool');

const isDateDbType = (dataType: string): boolean => {
  const dt = dataType.toLowerCase();
  return dt.includes('date') || dt.includes('timestamp') || dt.includes('time');
};

const isJsonDbType = (dataType: string): boolean => {
  const dt = dataType.toLowerCase();
  return dt.includes('json');
};

const getColumnValidationRule = (
  column: DbColumnInfo,
  options?: { required?: boolean },
): ValidationFieldSchema => {
  const required = options?.required === true;
  const enumValues = (column.enum_values || column.check_enum) as unknown[] | undefined;

  if (Array.isArray(enumValues) && enumValues.length) {
    return {
      type: 'enum',
      enum: enumValues,
      ...(required && { required: true }),
    };
  }

  const dataType = String(column.data_type || '').toLowerCase();

  if (isNumericDbType(dataType)) {
    return {
      type: 'number',
      ...(typeof column.check_min === 'number' && { min: column.check_min }),
      ...(typeof column.check_max === 'number' && { max: column.check_max }),
      ...(required && { required: true }),
    };
  }

  if (isBooleanDbType(dataType)) {
    return { type: 'boolean', ...(required && { required: true }) };
  }

  if (isDateDbType(dataType)) {
    return { type: 'date', ...(required && { required: true }) };
  }

  if (isJsonDbType(dataType)) {
    return { type: ['object', 'array'], ...(required && { required: true }) };
  }

  return { type: 'string', ...(required && { required: true }) };
};

const withArrayAlternative = (rule: ValidationFieldSchema): ValidationFieldSchema => {
  const { preprocess, ...cleanRule } = rule;

  if (Array.isArray(cleanRule.type)) {
    if (cleanRule.type.includes('array')) return cleanRule;
    return {
      ...cleanRule,
      type: [...cleanRule.type, 'array'],
      items: cleanRule.items || { ...cleanRule, required: false },
    };
  }

  if (cleanRule.type === 'array') return cleanRule;

  if (!cleanRule.type && Array.isArray(cleanRule.enum)) {
    return {
      ...cleanRule,
      type: ['enum', 'array'],
      items: { type: 'enum', enum: cleanRule.enum },
    };
  }

  return {
    ...cleanRule,
    type: [cleanRule.type || 'string', 'array'],
    items: cleanRule.items || { ...cleanRule, required: false },
  };
};

const resolveTableColumns = (
  c: AppContext,
  params: CrudBuilderOptionsType,
): Record<string, DbColumnInfo> => {
  const schema = params.schema || 'public';
  const key = `${schema}.${params.table}`;
  const envRecord = c.env as Record<string, unknown>;
  const fromContext = (c.var?.dbTables || envRecord.dbTables || {}) as Record<string, Record<string, DbColumnInfo>>;

  if (fromContext[key]) return fromContext[key] || {};

  const fromParams = params.dbTables as unknown;
  if (fromParams && typeof fromParams === 'object') {
    const asRecord = fromParams as Record<string, unknown>;
    if (asRecord[key] && typeof asRecord[key] === 'object') {
      return asRecord[key] as Record<string, DbColumnInfo>;
    }

    const values = Object.values(asRecord);
    if (values.length && values.every((item) => isPlainObject(item) && 'data_type' in item)) {
      return asRecord as unknown as Record<string, DbColumnInfo>;
    }
  }

  return {};
};

const buildPatchFromPost = (post?: ValidationSchema): ValidationSchema | undefined => {
  if (!post) return;

  return Object.entries(post).reduce((acc: ValidationSchema, [key, value]) => {
    const rule: ValidationFieldSchema = { ...value };
    delete rule.required;

    if (rule.properties) {
      rule.properties = Object.entries(rule.properties).reduce(
        (nestedAcc: Record<string, ValidationFieldSchema>, [nestedKey, nestedRule]) => {
          const nr = { ...nestedRule };
          delete nr.required;
          nestedAcc[nestedKey] = nr;
          return nestedAcc;
        },
        {},
      );
    }

    acc[key] = rule;
    return acc;
  }, {});
};

export const buildCrudValidationSchemaFromTable = (
  c: AppContext,
  params: CrudBuilderOptionsType,
): CrudValidationSchema => {
  const normalizedParams = normalizeCrudConfig(params);
  const columns = resolveTableColumns(c, normalizedParams);
  const columnEntries = Object.entries(columns);
  const columnNames = columnEntries.map(([name]) => name);
  const joinSelectableNames = [
    ...(normalizedParams.join || []),
    ...(normalizedParams.joinOnDemand || []),
  ]
    .flatMap((item) => [item.table, item.alias])
    .filter((name): name is string => typeof name === 'string' && !!name);
  const joinFieldNames = [
    ...joinSelectableNames,
  ];
  const selectableFieldNames = Array.from(new Set([...columnNames, ...joinFieldNames, '-relations']));

  const primaryKey = columnEntries.find(([, col]) => col.is_primary_key)?.[0]
    || (columns.id ? 'id' : columnNames[0]);

  const readOnly = normalizedParams.readOnlyFields || DEFAULT_READONLY_FIELDS;

  const paramsSchema: ValidationSchema = {};
  if (primaryKey && columns[primaryKey]) {
    paramsSchema[primaryKey] = {
      ...getColumnValidationRule(columns[primaryKey]),
      required: true,
    };
  }

  const querySchema: ValidationSchema = {
    _sort: {
      type: 'array',
      preprocess: splitSortFields,
      items: {
        type: 'enum',
        enum: [...columnNames, 'random()'],
      },
    },
    _limit: { type: 'number' },
    _page: { type: 'number' },
    _skip: { type: 'number' },
    _after: { type: ['string', 'number', 'date'] },
    _unlimited: { type: 'boolean' },
    _fields: {
      type: 'array',
      preprocess: splitCsv,
      items: {
        type: 'enum',
        enum: selectableFieldNames,
      },
    },
    _join: {
      type: 'array',
      preprocess: splitCsv,
      items: {
        type: 'enum',
        enum: Array.from(new Set(
          (normalizedParams.joinOnDemand || [])
            .flatMap((item) => [item.table, item.alias])
            .filter((name): name is string => typeof name === 'string' && !!name),
        )),
      },
    },
    _lang: { type: 'string' },
    _search: { type: 'string' },
  };

  for (const [name, column] of columnEntries) {
    const rule = getColumnValidationRule(column);
    querySchema[name] = withArrayAlternative(rule);

    if ((rule.type === 'string') || (Array.isArray(rule.type) && rule.type.includes('string'))) {
      querySchema[`${name}~`] = { type: 'string' };
    }

    if (column.is_nullable === 'YES') {
      querySchema[`_null_${name}`] = { type: 'boolean' };
      querySchema[`_not_null_${name}`] = { type: 'boolean' };
    }

    if (rule.type !== 'boolean') {
      querySchema[`_from_${name}`] = rule;
      querySchema[`_to_${name}`] = rule;
      querySchema[`_in_${name}`] = {
        type: 'array',
        preprocess: parseJsonArray,
        items: { ...rule, required: false },
      };
      querySchema[`_not_in_${name}`] = {
        type: 'array',
        preprocess: parseJsonArray,
        items: { ...rule, required: false },
      };
    }

    querySchema[`${name}!`] = withArrayAlternative(rule);
  }

  const bodyPost: ValidationSchema = {};
  for (const [name, column] of columnEntries) {
    if (readOnly.includes(name)) continue;

    const required = column.is_nullable === 'NO'
      && (column.column_default === null || typeof column.column_default === 'undefined');

    bodyPost[name] = getColumnValidationRule(column, { required });
  }

  const bodyPatch = buildPatchFromPost(bodyPost);

  return {
    params: paramsSchema,
    query: querySchema,
    headers: {
      authorization: { type: 'string' },
    },
    body: {
      post: bodyPost,
      patch: bodyPatch,
    },
  };
};

const mergeValidationSection = (
  generated?: ValidationSchema,
  custom?: ValidationSection,
): ResolvedSection => {
  if (typeof custom === 'undefined') return generated;
  if (isEmptyPlainObject(custom)) return null;
  if (isValidationResolver(custom)) return custom;

  return {
    ...(generated || {}),
    ...(custom || {}),
  } as ValidationSchema;
};

const mergeValidationConfig = (
  generated: CrudValidationSchema,
  custom?: CrudValidationOptions,
): ResolvedCrudValidation => {
  if (typeof custom === 'undefined') {
    return {
      disabledAll: false,
      params: generated.params,
      query: generated.query,
      headers: generated.headers,
      body: generated.body,
    };
  }

  if (isEmptyPlainObject(custom)) {
    return { disabledAll: true };
  }

  const mergedPost = mergeValidationSection(generated.body?.post, custom.body?.post);
  let mergedPatch = mergeValidationSection(generated.body?.patch, custom.body?.patch);

  if (typeof custom.body?.patch === 'undefined' && isPlainObject(mergedPost)) {
    mergedPatch = buildPatchFromPost(mergedPost as ValidationSchema);
  }

  if (isEmptyPlainObject(custom.body)) {
    return {
      disabledAll: false,
      params: mergeValidationSection(generated.params, custom.params),
      query: mergeValidationSection(generated.query, custom.query),
      headers: mergeValidationSection(generated.headers, custom.headers),
      body: {
        post: null,
        patch: null,
      },
    };
  }

  return {
    disabledAll: false,
    params: mergeValidationSection(generated.params, custom.params),
    query: mergeValidationSection(generated.query, custom.query),
    headers: mergeValidationSection(generated.headers, custom.headers),
    body: {
      post: mergedPost,
      patch: mergedPatch,
    },
  };
};

const mapExternalIssues = (issues: unknown[], section: string): ValidationErrorItem[] => {
  return issues.map((issue) => {
    const record = (issue || {}) as Record<string, unknown>;
    const pathArr = Array.isArray(record.path) ? record.path : [];
    const path = pathArr.map((part) => String(part)).join('.');
    const message = typeof record.message === 'string'
      ? record.message
      : 'Validation failed';

    const expected = isPlainObject(record.expected)
      ? (record.expected as Record<string, unknown>)
      : { type: 'external' };

    const value =
      typeof record.input !== 'undefined'
        ? record.input
        : typeof record.received !== 'undefined'
          ? record.received
          : null;

    return {
      field: path ? `${section}.${path}` : section,
      message,
      expected,
      value,
    };
  });
};

const runExternalValidator = async (
  validator: unknown,
  value: unknown,
  section: string,
): Promise<ValidationErrorItem[]> => {
  const v = validator as Record<string, unknown>;

  if (v && typeof v.safeParse === 'function') {
    const result = await (v.safeParse as (input: unknown) => Promise<unknown> | unknown)(value);
    const r = result as Record<string, unknown>;
    if (r?.success === true) return [];
    const issues = ((r?.error as Record<string, unknown>)?.issues || []) as unknown[];
    return mapExternalIssues(issues, section);
  }

  if (v && typeof v.parse === 'function') {
    try {
      await (v.parse as (input: unknown) => Promise<unknown> | unknown)(value);
      return [];
    } catch (err) {
      const issues = ((err as Record<string, unknown>)?.issues || []) as unknown[];
      if (issues.length) return mapExternalIssues(issues, section);
      return [{
        field: section,
        message: err instanceof Error ? err.message : 'Validation failed',
        expected: { type: 'external' },
        value,
      }];
    }
  }

  if (v && typeof v.validate === 'function') {
    try {
      const result = await (v.validate as (input: unknown) => Promise<unknown> | unknown)(value);
      if (result === true || typeof result === 'undefined') return [];

      if (Array.isArray(result)) {
        return withSectionPrefix(section, result as ValidationErrorItem[]);
      }

      if (isPlainObject(result) && Array.isArray(result.errors)) {
        return withSectionPrefix(section, result.errors as ValidationErrorItem[]);
      }

      if (result === false) {
        return [{
          field: section,
          message: 'Validation failed',
          expected: { type: 'external' },
          value,
        }];
      }

      return [];
    } catch (err) {
      return [{
        field: section,
        message: err instanceof Error ? err.message : 'Validation failed',
        expected: { type: 'external' },
        value,
      }];
    }
  }

  return [];
};

const resolveRuntimeSection = async (
  section: ResolvedSection,
  c: AppContext,
  sectionName: string,
): Promise<ResolvedRuntimeSection> => {
  if (!section) return {};

  if (isValidationResolver(section)) {
    const resolved = await section(c, async () => {});

    if (!resolved) return {};

    if (Array.isArray(resolved)) {
      return { errors: withSectionPrefix(sectionName, resolved as ValidationErrorItem[]) };
    }

    if (isPlainObject(resolved) && Array.isArray((resolved as { errors?: unknown[] }).errors)) {
      return {
        errors: withSectionPrefix(
          sectionName,
          ((resolved as { errors?: ValidationErrorItem[] }).errors || []),
        ),
      };
    }

    if (
      isPlainObject(resolved)
      && (
        typeof (resolved as Record<string, unknown>).safeParse === 'function'
        || typeof (resolved as Record<string, unknown>).parse === 'function'
        || typeof (resolved as Record<string, unknown>).validate === 'function'
      )
    ) {
      return { externalValidator: resolved };
    }

    if (isPlainObject(resolved)) {
      return { schema: resolved as ValidationSchema };
    }

    return {};
  }

  return { schema: section as ValidationSchema };
};

const getQueryData = (c: AppContext): Record<string, unknown> => {
  const raw = c.req.queries();
  return Object.entries(raw).reduce((acc: Record<string, unknown>, [key, values]) => {
    if (!Array.isArray(values) || !values.length) {
      acc[key] = undefined;
      return acc;
    }
    acc[key] = values.length === 1 ? values[0] : values;
    return acc;
  }, {});
};

const getHeaderData = (c: AppContext): Record<string, unknown> => {
  const headers: Record<string, unknown> = {};
  c.req.raw.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  return headers;
};

const setValidationError = (
  c: AppContext,
  issues: ValidationErrorItem[],
): void => {
  const getErr = c.get('getErrorByMessage');
  const errObj = getErr?.('VALIDATION_ERROR') || DEFAULT_VALIDATION_ERROR;

  c.status((errObj.status || 400) as never);
  c.set('result', {
    ...errObj,
    name: 'VALIDATION_ERROR',
    additional: issues as AdditionalMessageType[],
    error: true,
  });
};

const validateActionSections = async (
  c: AppContext,
  action: CrudValidationAction,
  merged: ResolvedCrudValidation,
): Promise<ValidationErrorItem[]> => {
  const errors: ValidationErrorItem[] = [];
  let bodyData: unknown;
  let bodyLoaded = false;

  const ensureBody = async (): Promise<Record<string, unknown>> => {
    if (bodyLoaded) {
      return (bodyData && typeof bodyData === 'object')
        ? (bodyData as Record<string, unknown>)
        : {};
    }

    bodyLoaded = true;

    try {
      bodyData = await c.req.json();
      if (!bodyData || typeof bodyData !== 'object') bodyData = {};
    } catch {
      bodyData = {};
    }

    return bodyData as Record<string, unknown>;
  };

  const run = async (
    sectionName: 'params' | 'query' | 'headers' | 'body',
    section: ResolvedSection,
    data: Record<string, unknown>,
  ) => {
    if (!section) return;

    const runtime = await resolveRuntimeSection(section, c, sectionName);

    if (runtime.errors?.length) {
      errors.push(...runtime.errors);
      return;
    }

    if (runtime.externalValidator) {
      errors.push(...await runExternalValidator(runtime.externalValidator, data, sectionName));
      return;
    }

    if (runtime.schema) {
      errors.push(...validateDataBySchema(data, runtime.schema, sectionName));
    }
  };

  if (action === 'getAll') {
    await run('query', merged.query, getQueryData(c));
    await run('headers', merged.headers, getHeaderData(c));
    return errors;
  }

  if (action === 'getOne') {
    await run('params', merged.params, c.req.param() as Record<string, unknown>);
    await run('query', merged.query, getQueryData(c));
    await run('headers', merged.headers, getHeaderData(c));
    return errors;
  }

  if (action === 'post') {
    await run('headers', merged.headers, getHeaderData(c));
    await run('body', merged.body?.post, await ensureBody());
    return errors;
  }

  if (action === 'patch') {
    await run('params', merged.params, c.req.param() as Record<string, unknown>);
    await run('headers', merged.headers, getHeaderData(c));
    await run('body', merged.body?.patch, await ensureBody());
    return errors;
  }

  await run('params', merged.params, c.req.param() as Record<string, unknown>);
  await run('headers', merged.headers, getHeaderData(c));
  return errors;
};

export const createCrudValidationMiddleware = (params: CrudBuilderOptionsType) => {
  return (action: CrudValidationAction) => async (c: AppContext, next: () => Promise<void>) => {
    const generated = buildCrudValidationSchemaFromTable(c, params);
    const merged = mergeValidationConfig(generated, params.validation);

    if (merged.disabledAll) {
      await next();
      return;
    }

    const issues = await validateActionSections(c, action, merged);
    if (issues.length) {
      setValidationError(c, issues);
      return;
    }

    await next();
  };
};
