import { expect, test } from 'bun:test';
import { Files } from '../src/Files';

test('file storage rejects paths that escape its folder', async () => {
  const files = new Files({ folder: '/tmp/the-api-files-security-test' });
  const file = new File(['data'], 'safe.txt');

  await expect(files.upload(file, '../outside')).rejects.toThrow('FILES_INVALID_FILE');
  await expect(files.upload(new File(['data'], '../outside.txt'), 'uploads'))
    .rejects.toThrow('FILES_INVALID_FILE');
  await expect(files.delete('../outside.txt')).rejects.toThrow('FILES_INVALID_FILE');
});
