import type { CrudBuilderOptionsType, CrudBuilderPermissionsType } from './types';
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
export declare const normalizeCrudConfig: (params: CrudBuilderOptionsType) => NormalizedCrudConfigType;
export {};
//# sourceMappingURL=crudConfig.d.ts.map