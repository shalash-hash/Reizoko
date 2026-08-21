import { telegramAdapter, TelegramPreview } from './TelegramAdapter.js';
import { registerPlatform } from '@reizoko/platform-sdk';

registerPlatform({ adapter: telegramAdapter, Preview: TelegramPreview });

export { telegramAdapter, TelegramPreview };
