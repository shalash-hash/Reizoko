import type { VkServerProbeStep } from '@reizoko/core';
import './vk-server-probe-trace.css';

const STATUS_LABEL: Record<VkServerProbeStep['status'], string> = {
  ok: 'OK',
  fail: 'Ошибка',
  warn: 'Внимание',
  skip: 'Пропуск',
};

interface VkServerProbeTraceProps {
  trace: VkServerProbeStep[];
}

export function VkServerProbeTrace({ trace }: VkServerProbeTraceProps) {
  if (trace.length === 0) return null;

  return (
    <details className="vk-probe-trace" data-testid="vk-server-probe-trace" open>
      <summary>Журнал проверки связи ({trace.length})</summary>
      <ol className="vk-probe-trace__list">
        {trace.map((step) => (
          <li
            key={`${step.channel}-${step.id}`}
            className={`vk-probe-trace__item vk-probe-trace__item--${step.status}`}
          >
            <div className="vk-probe-trace__head">
              <span className="vk-probe-trace__status">{STATUS_LABEL[step.status]}</span>
              <span className="vk-probe-trace__label">{step.label}</span>
              <span className="vk-probe-trace__channel">{step.channel}</span>
            </div>
            {step.url ? <div className="vk-probe-trace__url">{step.url}</div> : null}
            {step.detail ? <div className="vk-probe-trace__detail">{step.detail}</div> : null}
          </li>
        ))}
      </ol>
    </details>
  );
}
