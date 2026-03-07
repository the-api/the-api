import type { AdditionalMessageType } from './types';
export declare const toAdditionalArray: (input: unknown) => AdditionalMessageType[];
export declare const parseErrorMessage: (message: string) => {
    name: string;
    additionalText: string;
};
export declare const getErrorNameAndAdditional: (err: Error | {
    message: string;
    additional?: unknown;
}) => {
    name: string;
    additional: AdditionalMessageType[];
};
//# sourceMappingURL=errorHelpers.d.ts.map