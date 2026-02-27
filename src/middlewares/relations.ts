import flattening from 'flattening';
import { Routings, CrudBuilder } from 'the-api-routings';
import type { CrudBuilderOptionsType, stringRecordType } from 'the-api-routings';
import type { Next } from 'hono';
import type { AppContext } from '../types';

const relationsMiddleware = async (c: AppContext, next: Next) => {
  await next();

  const result = c.var.result;
  const relationsData = c.var.relationsData as
    | Record<string, CrudBuilderOptionsType>
    | undefined;

  if (!relationsData || !result) return;

  const relations: Record<string, Record<string, unknown>> = {};

  const findRelations = async ([key, definition]: [
    string,
    CrudBuilderOptionsType,
  ]) => {
    const crud = new CrudBuilder(definition);

    const flatData: stringRecordType = flattening({ result, relations });
    const searchKey = new RegExp(`\\b${key}(\\.\\d+)?$`);
    const matchPath = ([path, val]: [string, string]) =>
      path.match(searchKey) && val;

    const ids = [
      ...new Set(
        Object.entries(flatData).map(matchPath).filter(Boolean),
      ),
    ] as string[];

    if (!ids.length) return;

    for (const item of Object.entries(relationsData as Record<string, CrudBuilderOptionsType>)) await findRelations(item);

    const idName = definition.relationIdName || 'id';
    const { result: data } = await crud.getRequestResult(c, {
      [idName]: ids,
    });

    if (!relations[key]) relations[key] = {};
    for (const d of data) {
      const idKey = d[idName];
      relations[key][idKey] = d;
    }
  };

  await Promise.all(
    Object.entries(relationsData).map(findRelations),
  );

  c.set('relations', relations);
};

const relationsRoute = new Routings();
relationsRoute.use('*', relationsMiddleware);

export { relationsRoute };
