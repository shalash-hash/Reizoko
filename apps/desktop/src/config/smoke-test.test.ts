import { describe, expect, it } from 'vitest';
import { satisfiesBackgroundWindowContract } from './smoke-test.js';

describe('satisfiesBackgroundWindowContract', () => {
  it('accepts hidden background window without focus', () => {
    expect(
      satisfiesBackgroundWindowContract({
        backgroundLaunch: true,
        isFocused: false,
        isVisible: false,
        isMinimized: false,
      }),
    ).toBe(true);
  });

  it('accepts minimized window without focus', () => {
    expect(
      satisfiesBackgroundWindowContract({
        backgroundLaunch: true,
        isFocused: false,
        isVisible: true,
        isMinimized: true,
      }),
    ).toBe(true);
  });

  it('rejects visible foreground window', () => {
    expect(
      satisfiesBackgroundWindowContract({
        backgroundLaunch: true,
        isFocused: false,
        isVisible: true,
        isMinimized: false,
      }),
    ).toBe(false);
  });

  it('rejects focused window', () => {
    expect(
      satisfiesBackgroundWindowContract({
        backgroundLaunch: true,
        isFocused: true,
        isVisible: false,
        isMinimized: false,
      }),
    ).toBe(false);
  });
});
