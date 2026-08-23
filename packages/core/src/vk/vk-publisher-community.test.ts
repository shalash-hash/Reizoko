import { describe, expect, it } from 'vitest';

import { VkPublisher } from './vk-publisher.js';
import { FakeVkTransport } from './fake-vk-transport.js';
import { buildSecretRef, serializeVkPublicationTargetMetadata } from '@reizoko/shared';

describe('VkPublisher community credential', () => {
  it('uses community token secret for community_wall target', async () => {
    const transport = new FakeVkTransport();
    const connectionId = 'conn-community';
    const secretRef = buildSecretRef(connectionId, 'community_token');
    transport.registerCommunityToken('token-community', 2001, ['wall']);
    await transport.storeSecret(secretRef, 'token-community');

    const publisher = new VkPublisher(transport);
    const result = await publisher.publish({
      publication: {
        id: 'pub-1',
        platformId: 'vk',
        socialAccountId: 'acc-1',
        preparedSnapshot: {
          transformedContent: { text: 'Hello', images: [] },
          validationIssues: [],
        },
      } as any,
      account: {
        id: 'acc-1',
        platformId: 'vk',
        connectionId,
        platformMetadataJson: serializeVkPublicationTargetMetadata({
          targetType: 'community_wall',
          ownerId: -2001,
          communityId: 2001,
          postAsGroup: true,
          credentialKind: 'community_token',
          capabilities: {
            canPublishText: true,
            canUploadPhotos: false,
            canPublishPhotos: false,
            canPublishAsCommunity: true,
            photoUploadVia: 'none',
          },
        }),
      } as any,
      connection: {
        id: connectionId,
        platformId: 'vk',
        method: 'manual_secret',
        state: 'connected',
        secretRef,
      } as any,
      mediaPaths: {},
    });

    expect(result.success).toBe(true);
  });
});
