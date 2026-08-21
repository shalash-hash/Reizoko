export interface AppCapabilities {
  cloudSync: boolean;
  webAccess: boolean;
  serverScheduler: boolean;
  backgroundPublishing: boolean;
  recurringPublishing: boolean;
}

export const STAGE1_CAPABILITIES: AppCapabilities = {
  cloudSync: false,
  webAccess: false,
  serverScheduler: false,
  backgroundPublishing: false,
  recurringPublishing: false,
};

export interface CapabilityInfo {
  id: keyof AppCapabilities;
  label: string;
  description: string;
  plannedStage: 2 | 3;
}

export const CAPABILITY_INFO: Record<keyof AppCapabilities, CapabilityInfo> = {
  cloudSync: {
    id: 'cloudSync',
    label: 'Облачная синхронизация',
    description: 'Синхронизация контента между Desktop и Cloud',
    plannedStage: 2,
  },
  webAccess: {
    id: 'webAccess',
    label: 'Веб-доступ',
    description: 'Работа из браузера в поездке',
    plannedStage: 2,
  },
  serverScheduler: {
    id: 'serverScheduler',
    label: 'Серверный планировщик',
    description: 'Автоматическая публикация по расписанию',
    plannedStage: 3,
  },
  backgroundPublishing: {
    id: 'backgroundPublishing',
    label: 'Фоновая публикация',
    description: 'Публикация при выключенном компьютере',
    plannedStage: 3,
  },
  recurringPublishing: {
    id: 'recurringPublishing',
    label: 'Повторяющиеся публикации',
    description: 'Evergreen и сезонные публикации',
    plannedStage: 3,
  },
};

export function isCapabilityEnabled(
  capabilities: AppCapabilities,
  key: keyof AppCapabilities,
): boolean {
  return capabilities[key];
}
