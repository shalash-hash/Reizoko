import { useMemo, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Heading1, ImagePlus, Trash2, Type } from 'lucide-react';
import type {
  ContentBlock,
  ContentBlockType,
  HeadingBlockData,
  ImageBlockData,
  TextBlockData,
} from '@reizoko/shared';
import { createBlock, reorderBlocks } from '@reizoko/core';
import { Button, IconButton } from '@reizoko/ui';
import './block-editor.css';

interface BlockEditorProps {
  blocks: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
  onAddImage: () => void;
  getMediaUrl: (mediaId: string) => string | null;
  title: string;
  onTitleChange: (title: string) => void;
}

export function BlockEditor({
  blocks,
  onChange,
  onAddImage,
  getMediaUrl,
  title,
  onTitleChange,
}: BlockEditorProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sortedBlocks = useMemo(
    () => [...blocks].sort((a, b) => a.order - b.order),
    [blocks],
  );

  const activeBlock = activeId ? sortedBlocks.find((b) => b.id === activeId) : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortedBlocks.findIndex((b) => b.id === active.id);
    const newIndex = sortedBlocks.findIndex((b) => b.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    onChange(reorderBlocks(sortedBlocks, oldIndex, newIndex));
  };

  const addBlock = (type: ContentBlockType) => {
    if (type === 'image') {
      onAddImage();
      return;
    }
    onChange([...sortedBlocks, createBlock(type, sortedBlocks.length)]);
  };

  const updateBlock = (id: string, data: ContentBlock['data']) => {
    onChange(sortedBlocks.map((block) => (block.id === id ? { ...block, data } : block)));
  };

  const removeBlock = (id: string) => {
    onChange(
      sortedBlocks
        .filter((block) => block.id !== id)
        .map((block, index) => ({ ...block, order: index })),
    );
  };

  return (
    <div className="block-editor">
      <div className="block-editor__canvas">
        <div className="block-editor__paper">
          <input
            className="block-editor__title"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Название поста"
          />

          <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={sortedBlocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            <div className="block-editor__list">
              {sortedBlocks.map((block) => (
                <SortableBlock
                  key={block.id}
                  block={block}
                  isFocused={focusedId === block.id}
                  onFocus={() => setFocusedId(block.id)}
                  onBlur={() => setFocusedId((id) => (id === block.id ? null : id))}
                  onUpdate={updateBlock}
                  onRemove={removeBlock}
                  getMediaUrl={getMediaUrl}
                />
              ))}
            </div>
          </SortableContext>

          <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
            {activeBlock ? (
              <div className="block-item block-item--ghost">
                <BlockContent block={activeBlock} getMediaUrl={getMediaUrl} readOnly />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        <div className="block-editor__add-bar">
          <Button size="sm" variant="ghost" onClick={() => addBlock('text')}>
            <Type size={15} strokeWidth={2} aria-hidden />
            Текст
          </Button>
          <Button size="sm" variant="ghost" onClick={() => addBlock('heading')}>
            <Heading1 size={15} strokeWidth={2} aria-hidden />
            Заголовок
          </Button>
          <Button size="sm" variant="ghost" onClick={() => addBlock('image')}>
            <ImagePlus size={15} strokeWidth={2} aria-hidden />
            Изображение
          </Button>
        </div>
        </div>
      </div>
    </div>
  );
}

interface SortableBlockProps {
  block: ContentBlock;
  isFocused: boolean;
  onFocus: () => void;
  onBlur: () => void;
  onUpdate: (id: string, data: ContentBlock['data']) => void;
  onRemove: (id: string) => void;
  getMediaUrl: (mediaId: string) => string | null;
}

function SortableBlock({
  block,
  isFocused,
  onFocus,
  onBlur,
  onUpdate,
  onRemove,
  getMediaUrl,
}: SortableBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`block-item ${isFocused ? 'block-item--focused' : ''} ${isDragging ? 'block-item--dragging' : ''}`}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      <button
        type="button"
        className="block-item__handle"
        {...attributes}
        {...listeners}
        aria-label="Перетащить блок"
      >
        <GripVertical size={16} strokeWidth={1.75} />
      </button>
      <div className="block-item__content">
        <BlockContent
          block={block}
          getMediaUrl={getMediaUrl}
          onUpdate={(data) => onUpdate(block.id, data)}
        />
      </div>
      <div className="block-item__actions">
        <IconButton label="Удалить блок" size="sm" onClick={() => onRemove(block.id)}>
          <Trash2 size={14} strokeWidth={2} />
        </IconButton>
      </div>
    </div>
  );
}

interface BlockContentProps {
  block: ContentBlock;
  getMediaUrl: (mediaId: string) => string | null;
  onUpdate?: (data: ContentBlock['data']) => void;
  readOnly?: boolean;
}

function BlockContent({ block, getMediaUrl, onUpdate, readOnly = false }: BlockContentProps) {
  if (block.type === 'text') {
    return (
      <textarea
        className="block-item__textarea"
        value={(block.data as TextBlockData).text}
        onChange={(e) => onUpdate?.({ text: e.target.value })}
        placeholder="Введите текст…"
        rows={4}
        readOnly={readOnly}
      />
    );
  }

  if (block.type === 'heading') {
    return (
      <input
        className="block-item__heading"
        value={(block.data as HeadingBlockData).text}
        onChange={(e) =>
          onUpdate?.({
            text: e.target.value,
            level: (block.data as HeadingBlockData).level ?? 1,
          })
        }
        placeholder="Заголовок"
        readOnly={readOnly}
      />
    );
  }

  if (block.type === 'image') {
    const url = getMediaUrl((block.data as ImageBlockData).mediaId);
    return (
      <div className="block-item__image">
        {url ? (
          <img src={url} alt={(block.data as ImageBlockData).alt ?? ''} />
        ) : (
          <div className="block-item__image-placeholder">
            <ImagePlus size={24} strokeWidth={1.5} aria-hidden />
            <span>Изображение не загружено</span>
          </div>
        )}
      </div>
    );
  }

  return null;
}
