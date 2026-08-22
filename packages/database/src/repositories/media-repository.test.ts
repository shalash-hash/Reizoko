import { describe, expect, it } from 'vitest';
import { bootstrapDatabase } from '../bootstrap.js';
import { MemoryDatabaseClient } from '../test/memory-database-client.js';

async function createTestDb() {
  const client = new MemoryDatabaseClient();
  const db = await bootstrapDatabase(client);
  return { client, db };
}

describe('SqliteMediaRepository', () => {
  it('persists media file size', async () => {
    const { client, db } = await createTestDb();
    const created = await db.media.create({
      id: 'media-1',
      filename: 'photo.png',
      mimeType: 'image/png',
      size: 4096,
      localPath: 'C:/AppData/com.reizoko.app/media/media-1-photo.png',
    });

    expect(created.size).toBe(4096);
    expect((await db.media.getById('media-1'))?.size).toBe(4096);
    client.close();
  });
});
