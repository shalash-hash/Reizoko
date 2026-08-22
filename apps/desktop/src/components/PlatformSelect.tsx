import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { PlatformAdapter } from '@reizoko/platform-sdk';
import { ChevronDown } from 'lucide-react';
import { groupPlatformsByAvailability } from '../platforms/planned-catalog';
import { PlatformIcon } from './PlatformIcon';
import './platform-select.css';

interface PlatformSelectProps {
  platforms: PlatformAdapter[];
  value: string;
  disabled?: boolean;
  testId?: string;
  onChange: (platformId: string) => void;
}

function formatSelectedLabel(platform: PlatformAdapter): string {
  if (platform.available) {
    return platform.name;
  }
  return `${platform.name} · Скоро`;
}

export function PlatformSelect({
  platforms,
  value,
  disabled = false,
  testId = 'account-platform',
  onChange,
}: PlatformSelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const selectedPlatform = platforms.find((platform) => platform.id === value) ?? null;
  const { available, planned } = useMemo(() => groupPlatformsByAvailability(platforms), [platforms]);
  const options = useMemo(() => [...available, ...planned], [available, planned]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener('mousedown', onPointerDown);
    return () => window.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setActiveIndex(-1);
    }
  }, [open]);

  const selectPlatform = (platformId: string) => {
    onChange(platformId);
    setOpen(false);
  };

  const moveActiveIndex = (direction: 1 | -1) => {
    if (options.length === 0) {
      return;
    }
    setActiveIndex((current) => {
      const start = current < 0 ? (direction === 1 ? -1 : 0) : current;
      const next = (start + direction + options.length) % options.length;
      return next;
    });
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) {
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        const selectedIndex = options.findIndex((platform) => platform.id === value);
        setActiveIndex(selectedIndex >= 0 ? selectedIndex : event.key === 'ArrowDown' ? 0 : options.length - 1);
        return;
      }
      moveActiveIndex(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setOpen((current) => !current);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    }
  };

  const handleListboxKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveActiveIndex(1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveActiveIndex(-1);
      return;
    }
    if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      const platform = options[activeIndex];
      if (platform) {
        selectPlatform(platform.id);
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    }
  };

  const renderOption = (platform: PlatformAdapter, index: number) => {
    const selected = platform.id === value;
    const active = index === activeIndex;

    return (
      <button
        key={platform.id}
        type="button"
        role="option"
        aria-selected={selected}
        data-testid={`${testId}-option-${platform.id}`}
        className={[
          'platform-select__option',
          !platform.available ? 'platform-select__option--planned' : '',
          active ? 'platform-select__option--active' : '',
          selected ? 'platform-select__option--selected' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onMouseEnter={() => setActiveIndex(index)}
        onClick={() => selectPlatform(platform.id)}
      >
        <span className="platform-select__option-main">
          <PlatformIcon platformId={platform.id} size={18} muted={!platform.available} />
          <span className="platform-select__option-name">{platform.name}</span>
        </span>
        {!platform.available ? (
          <span className="platform-select__option-status">Preview пока недоступен</span>
        ) : null}
      </button>
    );
  };

  let optionIndex = 0;

  return (
    <div
      ref={rootRef}
      className={`platform-select ${disabled ? 'platform-select--disabled' : ''}`}
      data-testid={testId}
    >
      <button
        type="button"
        className="platform-select__trigger"
        data-testid={`${testId}-trigger`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        onClick={() => {
          if (!disabled) {
            setOpen((current) => !current);
          }
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="platform-select__trigger-content">
          {selectedPlatform ? (
            <>
              <PlatformIcon
                platformId={selectedPlatform.id}
                size={18}
                muted={!selectedPlatform.available}
              />
              <span
                className={
                  selectedPlatform.available
                    ? 'platform-select__trigger-label'
                    : 'platform-select__trigger-label platform-select__trigger-label--planned'
                }
              >
                {formatSelectedLabel(selectedPlatform)}
              </span>
            </>
          ) : (
            <span className="platform-select__trigger-placeholder">Выберите площадку</span>
          )}
        </span>
        {!disabled ? <ChevronDown size={16} strokeWidth={2} aria-hidden className="platform-select__chevron" /> : null}
      </button>

      {open && !disabled ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Площадка"
          className="platform-select__menu"
          data-testid={`${testId}-menu`}
          onKeyDown={handleListboxKeyDown}
        >
          {available.length > 0 ? (
            <div className="platform-select__group">
              <div className="platform-select__group-label">Доступно</div>
              {available.map((platform) => renderOption(platform, optionIndex++))}
            </div>
          ) : null}

          {planned.length > 0 ? (
            <div className="platform-select__group">
              <div className="platform-select__group-label">Скоро</div>
              {planned.map((platform) => renderOption(platform, optionIndex++))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
