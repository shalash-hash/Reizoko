import { describe, expect, it } from 'vitest';
import { createBlock } from './content-service.js';

describe('createBlock', () => {
  it('creates supported block types', () => {
    expect(createBlock('text', 0, { text: 'hello' }).type).toBe('text');
    expect(createBlock('heading', 1, { text: 'Title' }).type).toBe('heading');
    expect(createBlock('image', 2, { mediaId: 'media-1' }).type).toBe('image');
  });

  it('throws a planned-stage error for unsupported block types', () => {
    expect(() => createBlock('video', 0)).toThrow(/planned for a future stage/);
    expect(() => createBlock('poll', 0)).toThrow(/planned for a future stage/);
  });
});
