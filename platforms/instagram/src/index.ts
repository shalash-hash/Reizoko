import { instagramAdapter, InstagramPreview } from './InstagramAdapter.js';
import { registerPlatform } from '@reizoko/platform-sdk';

registerPlatform({ adapter: instagramAdapter, Preview: InstagramPreview });

export { instagramAdapter, InstagramPreview };
