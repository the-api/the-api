import type {
  AppContext,
  FormBodyType,
  NormalizedQueryType,
  QueryParamValue,
  RequestBodyType,
} from './types';

const JSON_CONTENT_TYPE_RE =
  /^application\/(?:[\w!#$%&*.^`~-]+\+)?json(?:;|$)/i;
const FORM_CONTENT_TYPE_RE =
  /^(multipart\/form-data|application\/x-www-form-urlencoded)(?:;|$)/i;
const TEXT_CONTENT_TYPE_RE = /^text\/(?:.+)$/i;

const setSearchParamValue = (
  searchParams: URLSearchParams,
  key: string,
  value: QueryParamValue,
): void => {
  searchParams.delete(key);

  if (value == null) return;

  if (Array.isArray(value)) {
    for (const item of value) searchParams.append(key, String(item));
    return;
  }

  searchParams.set(key, String(value));
};

const hasRequestBody = (request: Request): boolean => {
  if (request.body) return true;

  const contentLength = request.headers.get('content-length');
  if (!contentLength) return false;

  const parsedLength = Number(contentLength);
  return Number.isFinite(parsedLength) && parsedLength > 0;
};

const pushFormValue = (
  body: FormBodyType,
  key: string,
  value: string | File,
): void => {
  const current = body[key];

  if (typeof current === 'undefined') {
    body[key] = key.endsWith('[]') ? [value] : value;
    return;
  }

  if (Array.isArray(current)) {
    current.push(value);
    return;
  }

  body[key] = [current, value];
};

const getDefaultBodyForType = (bodyType: RequestBodyType): unknown => {
  switch (bodyType) {
    case 'json':
    case 'form':
      return {};
    case 'text':
      return '';
    case 'arrayBuffer':
      return new ArrayBuffer(0);
    default:
      return undefined;
  }
};

const isBodyLimitError = (err: unknown): boolean =>
  err instanceof Error && err.name === 'BodyLimitError';

export const getNormalizedQuery = (c: AppContext): NormalizedQueryType => {
  const raw = c.req.queries();
  return Object.entries(raw).reduce(
    (acc: NormalizedQueryType, [key, values]) => {
      if (!Array.isArray(values) || !values.length) return acc;
      acc[key] = values.length === 1 ? values[0] : values;
      return acc;
    },
    {},
  );
};

export const appendQueryParams = (
  c: AppContext,
  params: Record<string, QueryParamValue>,
): NormalizedQueryType => {
  const url = new URL(c.req.url);

  for (const [key, value] of Object.entries(params)) {
    setSearchParamValue(url.searchParams, key, value);
  }

  c.req.raw = new Request(url.toString(), c.req.raw);
  return getNormalizedQuery(c);
};

export const formDataToBody = (formData: FormData): FormBodyType => {
  const body = Object.create(null) as FormBodyType;

  formData.forEach((value, key) => {
    pushFormValue(body, key, value);
  });

  return body;
};

export const getRequestBodyType = (request: Request): RequestBodyType => {
  if (!hasRequestBody(request)) return 'empty';

  const contentType = request.headers.get('content-type') || '';

  if (JSON_CONTENT_TYPE_RE.test(contentType)) return 'json';
  if (FORM_CONTENT_TYPE_RE.test(contentType)) return 'form';
  if (TEXT_CONTENT_TYPE_RE.test(contentType)) return 'text';
  return 'arrayBuffer';
};

export const parseRequestBody = async (
  c: AppContext,
): Promise<{ body: unknown; bodyType: RequestBodyType }> => {
  const bodyType = getRequestBodyType(c.req.raw);

  if (bodyType === 'empty') {
    return { body: undefined, bodyType };
  }

  try {
    switch (bodyType) {
      case 'json':
        return { body: await c.req.json(), bodyType };
      case 'form': {
        const formData = await c.req.formData();
        return { body: formDataToBody(formData), bodyType };
      }
      case 'text':
        return { body: await c.req.text(), bodyType };
      case 'arrayBuffer':
        return { body: await c.req.arrayBuffer(), bodyType };
      default:
        return { body: undefined, bodyType: 'empty' };
    }
  } catch (err) {
    if (isBodyLimitError(err)) throw err;

    const error = err instanceof Error ? err : new Error(String(err));
    c.var?.log?.('[body parse error]', {
      bodyType,
      contentType: c.req.raw.headers.get('content-type') || '',
      message: error.message,
    });

    return {
      body: getDefaultBodyForType(bodyType),
      bodyType,
    };
  }
};
