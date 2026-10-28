import { useMemo, useRef, useState } from 'react'
import { CATEGORIES, type Category } from '../lib/categories'
import { useDialogFocus } from '../hooks/useDialogFocus'
import { DialogPortal } from './DialogPortal'
import { Icon } from './Icon'

interface CategoryPickerProps {
  open: boolean
  onClose: () => void
  onPick: (category: Category) => void
}

export function CategoryPicker({ open, onClose, onPick }: CategoryPickerProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const panelRef = useRef<HTMLElement | null>(null)

  const closePicker = () => {
    setQuery('')
    onClose()
  }

  useDialogFocus({
    open,
    onClose: closePicker,
    panelRef,
    initialFocusRef: inputRef,
  })

  const pickCategory = (category: Category) => {
    setQuery('')
    onPick(category)
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return CATEGORIES
    return CATEGORIES.filter(
      (category) =>
        category.zh.includes(needle) ||
        category.en.toLowerCase().includes(needle) ||
        category.id.toLowerCase().includes(needle),
    )
  }, [query])

  if (!open) return null

  return (
    <DialogPortal>
      <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closePicker()
      }}
    >
      <section
        ref={panelRef}
        className="category-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-picker-title"
        tabIndex={-1}
      >
        <button
          type="button"
          className="artwork-modal__close"
          aria-label="关闭词卡选择"
          onClick={closePicker}
        >
          <Icon name="close" size={20} />
        </button>

        <div className="category-picker__head">
          <p className="eyebrow">自由画 · 存为挑战</p>
          <h2 id="category-picker-title">给这幅画选个题</h2>
          <p>选中后，它会以这张词卡作为挑战目标收进画廊。</p>
        </div>

        <label className="category-picker__search">
          <Icon name="scan" size={17} />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索词卡，比如 猫 / cat"
            aria-label="搜索词卡"
          />
          <span>{String(filtered.length).padStart(2, '0')}</span>
        </label>

        <div className="category-picker__list" role="group" aria-label="词卡列表">
          {filtered.map((category) => (
            <button
              key={category.id}
              type="button"
              className="category-pick"
              onClick={() => pickCategory(category)}
            >
              <span aria-hidden="true">{category.emoji}</span>
              <span>
                <strong>{category.zh}</strong>
                <small>{category.en}</small>
              </span>
            </button>
          ))}
          {filtered.length === 0 ? (
            <p className="category-picker__empty">没有找到这张词卡，换个词试试。</p>
          ) : null}
        </div>
      </section>
    </div>
    </DialogPortal>
  )
}
