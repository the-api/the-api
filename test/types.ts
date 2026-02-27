import type { IncomingHttpHeaders } from 'http';
import type { Hono } from 'hono';

export type { MethodType } from '../src/types';

type bodyType = string | number | boolean | HttpPostBodyType;

export type HttpPostBodyType = {
  [key: string]: bodyType | bodyType[];
};

export type TestLibParamsType = {
  app: Hono;
  headers?: IncomingHttpHeaders;
};

export type { Hono };
