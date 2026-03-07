import { expect, test, describe } from 'bun:test';
import { getTestClient } from '../lib';
import { Routings, TheAPI } from '../../src';

const router = new Routings({ migrationDirs: ['./test/migrations'] });

router.crud({ table: 'testNews' });
router.crud({
  table: 'testNews',
  prefix: 'testUsersObject',
  validation: {
    body: {
      post: {
        timePublished: { type: 'string' },
        name: { type: 'string', required: true },
      },
      patch: {
        timePublished: { type: 'string' },
        name: { type: 'string' },
      },
    }
  }
});

// ...
