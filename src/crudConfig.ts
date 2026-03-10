import type {
  CrudBuilderOptionsType,
  CrudBuilderPermissionsType,
} from './types';

const DEFAULT_READONLY_FIELDS = [
  'id',
  'timeCreated',
  'timeUpdated',
  'timeDeleted',
  'isDeleted',
];

const unique = (values: string[] = []): string[] => Array.from(new Set(values));
const hasOwn = (obj: unknown, key: string): boolean =>
  !!obj && typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, key);

const toArray = (values: unknown): string[] => Array.isArray(values)
  ? values.filter((item): item is string => typeof item === 'string')
  : [];

const toMap = (values: unknown): Record<string, string[]> => {
  if (!values || typeof values !== 'object' || Array.isArray(values)) return {};

  return Object.entries(values as Record<string, unknown>).reduce((acc, [key, raw]) => {
    const arr = toArray(raw);
    if (arr.length) acc[key] = arr;
    return acc;
  }, {} as Record<string, string[]>);
};

type InternalCrudPermissionsType = CrudBuilderPermissionsType & {
  fields?: {
    viewable?: Record<string, string[]>;
    editable?: Record<string, string[]>;
  };
};

export type NormalizedCrudConfigType = Omit<CrudBuilderOptionsType, 'permissions'> & {
  hiddenFields?: string[];
  readOnlyFields?: string[];
  permissions?: InternalCrudPermissionsType;
};

const buildPermissions = (
  permissions: CrudBuilderPermissionsType | undefined,
  viewable: Record<string, string[]>,
  editable: Record<string, string[]>,
): InternalCrudPermissionsType | undefined => {
  const next: InternalCrudPermissionsType = { ...(permissions || {}) };
  const fields: NonNullable<InternalCrudPermissionsType['fields']> = {};

  if (Object.keys(viewable).length) fields.viewable = viewable;
  if (Object.keys(editable).length) fields.editable = editable;

  if (Object.keys(fields).length) next.fields = fields;
  else delete next.fields;

  return Object.keys(next).length ? next : undefined;
};

export const normalizeCrudConfig = (params: CrudBuilderOptionsType): NormalizedCrudConfigType => {
  const fieldRules = params.fieldRules || {};
  const hasFieldRuleHidden = hasOwn(fieldRules, 'hidden');
  const hasFieldRuleReadOnly = hasOwn(fieldRules, 'readOnly');

  const hidden = hasFieldRuleHidden
    ? toArray(fieldRules.hidden)
    : [];

  const readOnly = hasFieldRuleReadOnly
    ? toArray(fieldRules.readOnly)
    : undefined;

  const visibleFor = toMap(fieldRules.visibleFor);
  const editableFor = toMap(fieldRules.editableFor);

  const next: NormalizedCrudConfigType = { ...params };

  if (hasFieldRuleHidden) next.hiddenFields = hidden;
  else delete next.hiddenFields;

  if (Array.isArray(readOnly)) {
    next.readOnlyFields = unique([...readOnly, ...hidden]);
  } else if (hidden.length) {
    next.readOnlyFields = unique([...DEFAULT_READONLY_FIELDS, ...hidden]);
  } else {
    delete next.readOnlyFields;
  }

  next.permissions = buildPermissions(
    params.permissions,
    visibleFor,
    editableFor,
  );

  return next;
};
