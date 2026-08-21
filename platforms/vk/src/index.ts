import { vkAdapter, VkPreview } from './VkAdapter.js';
import { registerPlatform } from '@reizoko/platform-sdk';

registerPlatform({ adapter: vkAdapter, Preview: VkPreview });

export { vkAdapter, VkPreview };
