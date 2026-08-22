import { describe, expect, it, vi } from 'vitest';
import { SocialAccountService } from './social-account-service.js';

describe('SocialAccountService validation', () => {
  const repository = {
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    setActive: vi.fn(),
    listAll: vi.fn(),
    listByPlatform: vi.fn(),
    getById: vi.fn(),
    isReferencedByPublications: vi.fn(),
  };

  const service = new SocialAccountService(repository, (platformId) => platformId === 'instagram');

  it('rejects unknown platforms with a readable error', async () => {
    await expect(
      service.createAccount({ platformId: 'unknown', displayName: 'Brand' }),
    ).rejects.toThrow('Площадка «unknown» не найдена');
  });

  it('rejects empty display names', async () => {
    await expect(
      service.createAccount({ platformId: 'instagram', displayName: '   ' }),
    ).rejects.toThrow('Название профиля не может быть пустым');
  });
});
