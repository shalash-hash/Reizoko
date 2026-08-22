import type { LucideIcon } from 'lucide-react';
import { Badge } from './Badge.js';
import './sidebar.css';

export interface SidebarItem {
  id: string;
  label: string;
  icon: LucideIcon;
  enabled: boolean;
  testId?: string;
  plannedMessage?: string;
  plannedStage?: 2 | 3;
}

interface SidebarProps {
  primaryItems: SidebarItem[];
  workPlannedItems?: SidebarItem[];
  plannedItems: SidebarItem[];
  footerItems?: SidebarItem[];
  activeId: string;
  collapsed?: boolean;
  onSelect: (id: string) => void;
}

export function Sidebar({
  primaryItems,
  workPlannedItems = [],
  plannedItems,
  footerItems = [],
  activeId,
  collapsed = false,
  onSelect,
}: SidebarProps) {
  return (
    <nav className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`} aria-label="Основная навигация">
      <div className="sidebar__main">
        <div className="sidebar__section">
          {!collapsed && <div className="sidebar__group-label">Работа</div>}
          {primaryItems.map((item) => (
            <SidebarButton
              key={item.id}
              item={item}
              active={activeId === item.id}
              collapsed={collapsed}
              onSelect={onSelect}
            />
          ))}
          {workPlannedItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className="sidebar__item sidebar__item--disabled"
              disabled
              title={item.plannedMessage}
            >
              <item.icon className="sidebar__icon" strokeWidth={1.75} aria-hidden />
              {!collapsed && (
                <>
                  <span className="sidebar__label">{item.label}</span>
                  <Badge variant="planned">скоро</Badge>
                </>
              )}
            </button>
          ))}
        </div>

        {plannedItems.length > 0 && (
          <div className="sidebar__section sidebar__section--planned">
            {!collapsed && <div className="sidebar__group-label">Скоро</div>}
            {plannedItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className="sidebar__item sidebar__item--disabled"
                disabled
                title={item.plannedMessage}
              >
                <item.icon className="sidebar__icon" strokeWidth={1.75} aria-hidden />
                {!collapsed && (
                  <>
                    <span className="sidebar__label">{item.label}</span>
                    <Badge variant="planned">скоро</Badge>
                  </>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {footerItems.length > 0 && (
        <div className="sidebar__footer">
          {footerItems.map((item) => (
            <SidebarButton
              key={item.id}
              item={item}
              active={activeId === item.id}
              collapsed={collapsed}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </nav>
  );
}

function SidebarButton({
  item,
  active,
  collapsed,
  onSelect,
}: {
  item: SidebarItem;
  active: boolean;
  collapsed: boolean;
  onSelect: (id: string) => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      className={`sidebar__item ${active ? 'sidebar__item--active' : ''}`}
      data-testid={item.testId}
      onClick={() => onSelect(item.id)}
      title={collapsed ? item.label : undefined}
    >
      <Icon className="sidebar__icon" strokeWidth={1.75} aria-hidden />
      {!collapsed && <span className="sidebar__label">{item.label}</span>}
      {active && !collapsed && <span className="sidebar__active-bar" aria-hidden />}
    </button>
  );
}
