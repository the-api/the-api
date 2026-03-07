import type { AppContext, CrudBuilderOptionsType, ValidationSchema } from './types';
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
export declare const buildCrudValidationSchemaFromTable: (c: AppContext, params: CrudBuilderOptionsType) => CrudValidationSchema;
export declare const createCrudValidationMiddleware: (params: CrudBuilderOptionsType) => (action: CrudValidationAction) => (c: AppContext, next: () => Promise<void>) => Promise<void>;
export {};
//# sourceMappingURL=Validatior.d.ts.map