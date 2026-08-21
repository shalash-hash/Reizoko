import { Copy, FolderOpen, LayoutGrid, List, Plus } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, EmptyState, IconButton, SearchInput } from '@reizoko/ui';
import { formatDateTime } from '@reizoko/shared';
import { useAppStore } from '../stores/app-store';
import './library-view.css';

type LibraryLayout = 'grid' | 'list';

export function LibraryView() {
  const library = useAppStore((s) => s.library);
  const libraryQuery = useAppStore((s) => s.libraryQuery);
  const loadLibrary = useAppStore((s) => s.loadLibrary);
  const openContentItem = useAppStore((s) => s.openContentItem);
  const duplicateContentItem = useAppStore((s) => s.duplicateContentItem);
  const createNewDraft = useAppStore((s) => s.createNewDraft);
  const [layout, setLayout] = useState<LibraryLayout>('grid');

  return (
    <div className="library-view">
      <header className="library-view__header">
        <div>
          <div className="library-view__title-row">
            <h1>Библиотека</h1>
            {library.length > 0 && (
              <Badge variant="default">{library.length}</Badge>
            )}
          </div>
          <p className="library-view__subtitle">Сохранённые Master Post для повторного использования</p>
        </div>
        <Button variant="primary" onClick={() => void createNewDraft()}>
          <Plus size={16} strokeWidth={2} aria-hidden />
          Новый пост
        </Button>
      </header>

      <div className="library-view__toolbar">
        <SearchInput
          value={libraryQuery}
          onChange={(value) => void loadLibrary(value)}
          placeholder="Поиск по названию и тексту…"
        />
        <div className="library-view__layout" role="group" aria-label="Вид списка">
          <IconButton
            label="Сетка"
            size="sm"
            className={layout === 'grid' ? 'library-view__layout-btn--active' : ''}
            onClick={() => setLayout('grid')}
          >
            <LayoutGrid size={16} strokeWidth={2} aria-hidden />
          </IconButton>
          <IconButton
            label="Список"
            size="sm"
            className={layout === 'list' ? 'library-view__layout-btn--active' : ''}
            onClick={() => setLayout('list')}
          >
            <List size={16} strokeWidth={2} aria-hidden />
          </IconButton>
        </div>
      </div>

      {library.length === 0 ? (
        <EmptyState
          icon={<FolderOpen strokeWidth={1.5} />}
          title={libraryQuery ? 'Ничего не найдено' : 'Библиотека пуста'}
          description={
            libraryQuery
              ? 'Попробуйте изменить запрос или создайте новый пост.'
              : 'Создайте первый Master Post в редакторе — он появится здесь автоматически.'
          }
          action={
            !libraryQuery ? (
              <Button variant="primary" onClick={() => void createNewDraft()}>
                Создать пост
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className={`library-view__grid library-view__grid--${layout}`}>
          {library.map((item) => (
            <article key={item.id} className="library-card">
              <div className="library-card__preview" aria-hidden>
                <div className="library-card__preview-line library-card__preview-line--title" />
                <div className="library-card__preview-line" />
                <div className="library-card__preview-line library-card__preview-line--short" />
              </div>
              <div className="library-card__body">
                <h3>{item.title}</h3>
                <p>{item.previewText || 'Без текста'}</p>
                <div className="library-card__meta">
                  <span>Изменён {formatDateTime(item.updatedAt)}</span>
                </div>
              </div>
              <div className="library-card__actions">
                <Button size="sm" onClick={() => void openContentItem(item.id)}>
                  <FolderOpen size={14} strokeWidth={2} aria-hidden />
                  Открыть
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void duplicateContentItem(item.id)}>
                  <Copy size={14} strokeWidth={2} aria-hidden />
                  Копия
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
