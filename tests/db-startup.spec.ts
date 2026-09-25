import { expect, test } from 'bun:test';
import { Db } from '../src/Db';

test('waitDb propagates migration failure instead of starting the API', async () => {
  const db = Object.create(Db.prototype) as Db;
  db.db = { raw: async () => ({}) } as never;
  db.dbWrite = { raw: async () => ({}) } as never;
  db.checkDb = async () => { throw new Error('migration failed'); };

  await expect(db.waitDb()).rejects.toThrow('migration failed');
});
