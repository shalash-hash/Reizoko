import { describe, expect, it } from 'vitest';
import { resolveMediaFileSize } from './media-file-size.js';

describe('resolveMediaFileSize', () => {
  it('prefers stat size when available', () => {
    expect(resolveMediaFileSize(2048, 1024)).toBe(2048);
  });

  it('falls back to byte length', () => {
    expect(resolveMediaFileSize(0, 1536)).toBe(1536);
  });

  it('returns 0 when size is unknown', () => {
    expect(resolveMediaFileSize(null, null)).toBe(0);
  });
});
