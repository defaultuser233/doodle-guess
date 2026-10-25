import type { CSSProperties } from 'react'
import { Icon } from './Icon'
import {
  BRUSHES,
  PALETTE,
  type BrushId,
  type Tool,
} from '../lib/drawing'

interface BrushToolbarProps {
  color: string
  sizeId: BrushId
  tool: Tool
  canUndo: boolean
  canRedo: boolean
  hasInk: boolean
  onColorChange: (color: string) => void
  onSizeChange: (size: BrushId) => void
  onToolChange: (tool: Tool) => void
  onUndo: () => void
  onRedo: () => void
  onClear: () => void
}

export function BrushToolbar({
  color,
  sizeId,
  tool,
  canUndo,
  canRedo,
  hasInk,
  onColorChange,
  onSizeChange,
  onToolChange,
  onUndo,
  onRedo,
  onClear,
}: BrushToolbarProps) {
  return (
    <div className="toolbar" role="toolbar" aria-label="画笔工具">
      <div className="toolbar__group toolbar__colors" aria-label="颜色">
        {PALETTE.map((swatch) => (
          <button
            key={swatch.value}
            type="button"
            className={`swatch${color === swatch.value && tool === 'pen' ? ' is-active' : ''}`}
            style={{ '--swatch': swatch.value } as CSSProperties}
            aria-label={`${swatch.name}画笔`}
            aria-pressed={color === swatch.value && tool === 'pen'}
            onClick={() => {
              onColorChange(swatch.value)
              onToolChange('pen')
            }}
          >
            <span />
          </button>
        ))}
      </div>

      <span className="toolbar__divider" aria-hidden="true" />

      <div className="toolbar__group toolbar__brushes" aria-label="笔刷">
        {BRUSHES.map((brush) => (
          <button
            key={brush.id}
            type="button"
            className={`brush-button${sizeId === brush.id && tool === 'pen' ? ' is-active' : ''}`}
            aria-label={`${brush.label}画笔`}
            aria-pressed={sizeId === brush.id && tool === 'pen'}
            onClick={() => {
              onSizeChange(brush.id)
              onToolChange('pen')
            }}
          >
            <span
              className="brush-button__dot"
              style={{ width: Math.max(4, brush.size / 2.2), height: Math.max(4, brush.size / 2.2) }}
            />
          </button>
        ))}
      </div>

      <span className="toolbar__divider" aria-hidden="true" />

      <button
        type="button"
        className={`tool-button${tool === 'eraser' ? ' is-active' : ''}`}
        aria-pressed={tool === 'eraser'}
        aria-label="橡皮擦"
        onClick={() => onToolChange(tool === 'eraser' ? 'pen' : 'eraser')}
      >
        <Icon name="eraser" size={21} />
        <span>橡皮</span>
      </button>

      <span className="toolbar__divider" aria-hidden="true" />

      <div className="toolbar__group">
        <button
          type="button"
          className="icon-button"
          aria-label="撤销"
          disabled={!canUndo}
          onClick={onUndo}
        >
          <Icon name="undo" size={21} />
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label="重做"
          disabled={!canRedo}
          onClick={onRedo}
        >
          <Icon name="redo" size={21} />
        </button>
        <button
          type="button"
          className="icon-button icon-button--danger"
          aria-label="清空画布"
          disabled={!hasInk}
          onClick={onClear}
        >
          <Icon name="trash" size={20} />
        </button>
      </div>
    </div>
  )
}
