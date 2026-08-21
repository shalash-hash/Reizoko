import { useEffect } from 'react';
import type { PlatformAdapter } from '@reizoko/platform-sdk';
import { Badge, Button, IconButton } from '@reizoko/ui';
import { Check, X } from 'lucide-react';
import { PlatformIcon } from './PlatformIcon';
import './platform-picker.css';

interface PlatformPickerProps {
  platforms: PlatformAdapter[];
  openPlatformIds: string[];
  onSelect: (platformId: string) => void;
  onClose: () => void;
}

export function PlatformPicker({ platforms, openPlatformIds, onSelect, onClose }: PlatformPickerProps) {
  const available = platforms.filter((p) => p.available);
  const planned = platforms.filter((p) => !p.available);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="platform-picker-overlay" onClick={onClose} role="presentation">
      <div
        className="platform-picker"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Выбор площадки"
      >
        <header className="platform-picker__header">
          <div className="platform-picker__header-text">
            <h3>Добавить площадку</h3>
            <p>Выберите preview — контент обновится в реальном времени</p>
          </div>
          <IconButton label="Закрыть" size="sm" onClick={onClose}>
            <X size={18} strokeWidth={2} aria-hidden />
          </IconButton>
        </header>

        {available.length > 0 && (
          <section className="platform-picker__section">
            <h4>Доступно</h4>
            <div className="platform-picker__grid">
              {available.map((platform) => {
                const isOpen = openPlatformIds.includes(platform.id);
                return (
                  <button
                    key={platform.id}
                    type="button"
                    className={`platform-picker__card platform-picker__card--available ${
                      isOpen ? 'platform-picker__card--open' : ''
                    }`}
                    onClick={() => onSelect(platform.id)}
                  >
                    <PlatformIcon platformId={platform.id} size={32} />
                    <span className="platform-picker__name">{platform.name}</span>
                    {isOpen ? (
                      <span className="platform-picker__status platform-picker__status--open">
                        <Check size={12} strokeWidth={2.5} aria-hidden />
                        Подключено
                      </span>
                    ) : (
                      <span className="platform-picker__status">Открыть preview</span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {planned.length > 0 && (
          <section className="platform-picker__section">
            <h4>Скоро</h4>
            <div className="platform-picker__grid">
              {planned.map((platform) => (
                <div
                  key={platform.id}
                  className="platform-picker__card platform-picker__card--planned"
                  title={platform.plannedMessage}
                >
                  <PlatformIcon platformId={platform.id} size={32} muted />
                  <span className="platform-picker__name">{platform.name}</span>
                  <Badge variant="planned">скоро</Badge>
                </div>
              ))}
            </div>
          </section>
        )}

        <footer className="platform-picker__footer">
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" onClick={onClose}>
            Готово
          </Button>
        </footer>
      </div>
    </div>
  );
}
