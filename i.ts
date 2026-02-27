import { Hono } from "hono"
import { createMiddleware } from "hono/factory";

type Bindings = {
    MY_KV: (a: string) => string;
}

type Bindings2 = {
    MY_KV2: (b: number) => number;
}

const app = new Hono();

const echoMiddleware = createMiddleware<{ Bindings: Bindings }>(async (c, next) => {
    c.env.MY_KV = (a) => `${a}+1`;
    await next()
})

const echoMiddleware2 = createMiddleware<{ Bindings: Bindings2 }>(async (c, next) => {
    c.env.MY_KV2 = (a) => a+1;
    await next()
})

app.all(echoMiddleware, echoMiddleware2, (c) => {
    c.env.MY_KV2(1);
    return c.text(c.env.MY_KV('1'));
})

app.get('/', (c, next) => {
    c.env.MY_KV(1);
    next();
})