export type ScheduleMode = 'natural' | 'exact';

export interface ScheduleConfig {
  mode: ScheduleMode;
  targetTime: string;
  timezone?: string;
}

export interface NaturalTimeOptions {
  avoidFiveMinuteIntervals: boolean;
  maxOffsetMinutes: number;
}

export const DEFAULT_NATURAL_TIME_OPTIONS: NaturalTimeOptions = {
  avoidFiveMinuteIntervals: true,
  maxOffsetMinutes: 15,
};

/**
 * Applies natural time jitter to avoid mechanical-looking scheduled posts.
 * Stage 1: model only — actual scheduling happens in Stage 3.
 */
export function applyNaturalTimeOffset(
  targetTime: Date,
  options: NaturalTimeOptions = DEFAULT_NATURAL_TIME_OPTIONS,
): Date {
  const result = new Date(targetTime);
  const minutes = result.getMinutes();

  if (options.avoidFiveMinuteIntervals && minutes % 5 === 0) {
    const offsets = [-3, 3, 7, -7, 12, -12, 17, -2, 8];
    const offset = offsets[Math.floor(Math.random() * offsets.length)] ?? 3;
    result.setMinutes(minutes + offset);
  }

  return result;
}

export function resolveScheduledTime(config: ScheduleConfig): Date {
  const target = new Date(config.targetTime);
  if (config.mode === 'exact') {
    return target;
  }
  return applyNaturalTimeOffset(target);
}
