import { DatabaseClient } from './client/database-client.js';
import { runMigrations } from './migrations/index.js';
import { SqliteContentRepository } from './repositories/content-repository.impl.js';
import { SqliteWorkspaceRepository } from './repositories/workspace-repository.js';
import { SqliteSettingsRepository } from './repositories/settings-repository.js';
import { SqliteMediaRepository } from './repositories/media-repository.js';
import { SqlitePublicationBatchRepository } from './repositories/publication-batch-repository.js';
import { SqlitePublicationRepository } from './repositories/publication-repository.js';
import { SqliteSocialAccountRepository } from './repositories/social-account-repository.js';

export interface DatabaseContext {
  client: DatabaseClient;
  content: SqliteContentRepository;
  workspace: SqliteWorkspaceRepository;
  settings: SqliteSettingsRepository;
  media: SqliteMediaRepository;
  publicationBatches: SqlitePublicationBatchRepository;
  publications: SqlitePublicationRepository;
  socialAccounts: SqliteSocialAccountRepository;
}

export async function bootstrapDatabase(client: DatabaseClient): Promise<DatabaseContext> {
  await runMigrations(client);

  return {
    client,
    content: new SqliteContentRepository(client),
    workspace: new SqliteWorkspaceRepository(client),
    settings: new SqliteSettingsRepository(client),
    media: new SqliteMediaRepository(client),
    publicationBatches: new SqlitePublicationBatchRepository(client),
    publications: new SqlitePublicationRepository(client),
    socialAccounts: new SqliteSocialAccountRepository(client),
  };
}
