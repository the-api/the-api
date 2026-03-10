import { Routings as ExternalRoutings } from 'the-api-routings';
import type { CrudBuilderOptionsType as ExternalCrudBuilderOptionsType } from 'the-api-routings';
type CrudPermissionMeta = {
    path: string;
    permissionPrefix: string;
    methodsConfigured: boolean;
};
export declare class Routings extends ExternalRoutings {
    crudPermissionsMeta: CrudPermissionMeta[];
    crud(params: ExternalCrudBuilderOptionsType): void;
}
export {};
//# sourceMappingURL=Routings.d.ts.map