import type { AppContext, FormBodyType, NormalizedQueryType, QueryParamValue, RequestBodyType } from './types';
export declare const getNormalizedQuery: (c: AppContext) => NormalizedQueryType;
export declare const appendQueryParams: (c: AppContext, params: Record<string, QueryParamValue>) => NormalizedQueryType;
export declare const formDataToBody: (formData: FormData) => FormBodyType;
export declare const getRequestBodyType: (request: Request) => RequestBodyType;
export declare const parseRequestBody: (c: AppContext) => Promise<{
    body: unknown;
    bodyType: RequestBodyType;
}>;
//# sourceMappingURL=requestState.d.ts.map