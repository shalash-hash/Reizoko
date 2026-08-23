import { describeVkCommunityPermissions } from '@reizoko/core';
import './vk-community-permissions.css';

interface VkCommunityPermissionsRowProps {
  permissions: string[];
  title?: string;
  compact?: boolean;
}

export function VkCommunityPermissionsRow({
  permissions,
  title = 'Права доступа',
  compact = false,
}: VkCommunityPermissionsRowProps) {
  const items = describeVkCommunityPermissions(permissions);

  return (
    <div
      className={`vk-community-permissions${compact ? ' vk-community-permissions--compact' : ''}`}
      data-testid="vk-community-permissions"
    >
      <p className="vk-community-permissions__title">{title}</p>
      <div className="vk-community-permissions__row" role="list">
        {items.map((item) => (
          <span
            key={item.key}
            role="listitem"
            className={`vk-community-permissions__chip vk-community-permissions__chip--${
              item.granted ? 'granted' : 'missing'
            }`}
            data-testid={`vk-community-permission-${item.key}`}
            data-granted={item.granted ? 'true' : 'false'}
          >
            <span className="vk-community-permissions__mark" aria-hidden>
              {item.granted ? '✓' : '·'}
            </span>
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
