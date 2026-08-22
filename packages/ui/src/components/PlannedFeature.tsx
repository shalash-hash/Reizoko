import type { ReactNode } from 'react';
import { Badge } from './Badge.js';
import './planned-feature.css';

interface PlannedFeatureProps {
  title: string;
  description: string;
  stage?: 2 | 3;
  children?: ReactNode;
}

export function PlannedFeature({ title, description, stage, children }: PlannedFeatureProps) {
  return (
    <div className="planned-feature">
      <div className="planned-feature__icon" aria-hidden>
        ◇
      </div>
      <div className="planned-feature__header">
        <h2>{title}</h2>
        <Badge variant="planned">{stage ? `Этап ${stage}` : 'Скоро'}</Badge>
      </div>
      <p>{description}</p>
      {children}
    </div>
  );
}
