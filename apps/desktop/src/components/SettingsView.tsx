import { Monitor, Moon, Sun, Sparkles } from 'lucide-react';
import { Badge, useTheme, type ThemeMode } from '@reizoko/ui';
import './settings-view.css';

const THEME_OPTIONS: Array<{
  id: ThemeMode;
  label: string;
  icon: typeof Sun;
  description: string;
  previewClass: string;
}> = [
  {
    id: 'system',
    label: 'Системная',
    icon: Monitor,
    description: 'Следовать настройкам Windows',
    previewClass: 'theme-preview--system',
  },
  {
    id: 'light',
    label: 'Светлая',
    icon: Sun,
    description: 'Тёплая светлая рабочая тема',
    previewClass: 'theme-preview--light',
  },
  {
    id: 'dark',
    label: 'Тёмная',
    icon: Moon,
    description: 'Комфортная работа вечером',
    previewClass: 'theme-preview--dark',
  },
];

export function SettingsView() {
  const { mode, setMode } = useTheme();

  return (
    <div className="settings-view">
      <header className="settings-view__hero">
        <Sparkles size={20} strokeWidth={1.75} aria-hidden />
        <div>
          <h1>Настройки</h1>
          <p>Внешний вид и информация о приложении</p>
        </div>
        <Badge variant="default">Stage 1</Badge>
      </header>

      <section className="settings-panel">
        <h2>Внешний вид</h2>
        <p className="settings-panel__desc">Тема применяется мгновенно ко всему интерфейсу</p>

        <div className="theme-grid" role="radiogroup" aria-label="Тема приложения">
          {THEME_OPTIONS.map((option) => {
            const Icon = option.icon;
            const selected = mode === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`theme-card ${selected ? 'theme-card--selected' : ''}`}
                onClick={() => setMode(option.id)}
              >
                <div className={`theme-card__preview ${option.previewClass}`}>
                  <div className="theme-card__preview-sidebar" />
                  <div className="theme-card__preview-main">
                    <div className="theme-card__preview-tab" />
                    <div className="theme-card__preview-canvas" />
                  </div>
                </div>
                <div className="theme-card__info">
                  <Icon size={16} strokeWidth={1.75} aria-hidden />
                  <span className="theme-card__label">{option.label}</span>
                  <span className="theme-card__description">{option.description}</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="settings-panel settings-panel--about">
        <h2>О приложении</h2>
        <div className="about-card">
          <div className="about-card__logo">R</div>
          <div>
            <strong>Reizoko</strong>
            <p>Единый центр создания и публикации контента</p>
            <p className="muted">Stage 1 — Local Desktop · v0.1.0</p>
          </div>
        </div>
      </section>
    </div>
  );
}
