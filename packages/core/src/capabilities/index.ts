import {
  AppCapabilities,
  CAPABILITY_INFO,
  STAGE1_CAPABILITIES,
  isCapabilityEnabled,
} from '@reizoko/shared';

export { STAGE1_CAPABILITIES, CAPABILITY_INFO, isCapabilityEnabled };
export type { AppCapabilities };

export function getDisabledReason(key: keyof AppCapabilities): string {
  const info = CAPABILITY_INFO[key];
  return `Запланировано — появится на Stage ${info.plannedStage}. ${info.description}`;
}
