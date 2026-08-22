import { useCallback, useEffect, useRef, useState } from 'react';
import type { MediaTransform } from '@reizoko/shared';
import { clamp01, getViewportAspectRatio } from './media-transform-math.js';

interface MediaTransformViewProps {
  imageUrl: string;
  transform: MediaTransform;
  interactive?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  onTransformChange?: (transform: MediaTransform) => void;
}

export function MediaTransformView({
  imageUrl,
  transform,
  interactive = false,
  selected = false,
  onSelect,
  onTransformChange,
}: MediaTransformViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });

  const zoom = transform.zoom ?? 1;
  const position = transform.position ?? { x: 0.5, y: 0.5 };
  const viewportAspect = getViewportAspectRatio(transform, imageSize.width, imageSize.height);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!interactive || !onTransformChange) return;
      event.preventDefault();
      onSelect?.();
      dragRef.current = {
        x: position.x,
        y: position.y,
        startX: event.clientX,
        startY: event.clientY,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [interactive, onSelect, onTransformChange, position.x, position.y],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current || !onTransformChange) return;
      const bounds = containerRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const deltaX = (event.clientX - dragRef.current.startX) / bounds.width;
      const deltaY = (event.clientY - dragRef.current.startY) / bounds.height;
      onTransformChange({
        ...transform,
        position: {
          x: clamp01(dragRef.current.x - deltaX),
          y: clamp01(dragRef.current.y - deltaY),
        },
      });
    },
    [onTransformChange, transform],
  );

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (!interactive || !onTransformChange) return;
      event.preventDefault();
      const nextZoom = Math.min(3, Math.max(1, zoom + (event.deltaY < 0 ? 0.05 : -0.05)));
      onTransformChange({ ...transform, zoom: nextZoom });
    },
    [interactive, onTransformChange, transform, zoom],
  );

  useEffect(() => {
    const image = new Image();
    image.onload = () => {
      setImageSize({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.src = imageUrl;
  }, [imageUrl]);

  const objectPosition = `${position.x * 100}% ${position.y * 100}%`;

  return (
    <div
      ref={containerRef}
      className={[
        'media-transform-view',
        interactive ? 'media-transform-view--interactive' : '',
        selected ? 'media-transform-view--selected' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-testid="media-transform-view"
      data-aspect-ratio={transform.aspectRatio ?? 'original'}
      data-viewport-aspect={viewportAspect.toFixed(4)}
      data-zoom={zoom.toFixed(2)}
      data-position-x={position.x.toFixed(3)}
      data-position-y={position.y.toFixed(3)}
      style={{ aspectRatio: String(viewportAspect) }}
      onClick={onSelect}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
    >
      <div className="media-transform-view__stage">
        <img
          src={imageUrl}
          alt=""
          className="media-transform-view__image"
          style={{
            objectFit: 'cover',
            objectPosition,
            transform: `scale(${zoom}) rotate(${transform.rotation ?? 0}deg) scaleX(${transform.flipHorizontal ? -1 : 1}) scaleY(${transform.flipVertical ? -1 : 1})`,
            transformOrigin: objectPosition,
            filter: buildCssFilter(transform),
          }}
          draggable={false}
        />
      </div>
    </div>
  );
}

function buildCssFilter(transform: MediaTransform): string {
  const adjustments = transform.adjustments;
  if (!adjustments) return 'none';
  const brightness = 100 + (adjustments.brightness ?? 0);
  const contrast = 100 + (adjustments.contrast ?? 0);
  const saturate = 100 + (adjustments.saturation ?? 0);
  const hue = (adjustments.temperature ?? 0) * 0.6;
  return `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%) hue-rotate(${hue}deg)`;
}
