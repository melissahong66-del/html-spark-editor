import { useEffect, useRef, type MouseEvent as ReactMouseEvent } from 'react'
import type { AlignmentGuide, OverlayRect, ResizeDirection } from '../types/editor'

interface Props {
  selection: OverlayRect | null
  hover: OverlayRect | null
  guides: AlignmentGuide[]
  editing: boolean
  container: boolean
  onResizeStart: (direction: ResizeDirection) => void
  onResizeMove: (dx: number, dy: number, shiftKey: boolean) => void
  onResizeEnd: () => void
}

const DIRECTIONS: ResizeDirection[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

export function SelectionOverlay({ selection, guides, editing, container, onResizeStart, onResizeMove, onResizeEnd }: Props) {
  const cleanupDrag = useRef<(() => void) | null>(null)

  useEffect(() => () => cleanupDrag.current?.(), [])

  const start = (direction: ResizeDirection, event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    cleanupDrag.current?.()
    const startX = event.clientX
    const startY = event.clientY
    const dragDocument = event.currentTarget.ownerDocument
    const dragWindow = dragDocument.defaultView
    if (!dragWindow) return
    const shield = dragDocument.createElement('div')
    shield.setAttribute('data-editor-resize-shield', 'true')
    shield.style.position = 'fixed'
    shield.style.inset = '0'
    shield.style.zIndex = '2147483647'
    shield.style.background = 'transparent'
    shield.style.cursor = dragWindow.getComputedStyle(event.currentTarget).cursor
    shield.style.userSelect = 'none'
    dragDocument.body.appendChild(shield)
    onResizeStart(direction)
    const move = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault()
      onResizeMove(moveEvent.clientX - startX, moveEvent.clientY - startY, moveEvent.shiftKey)
    }
    const cleanup = () => {
      dragWindow.removeEventListener('mousemove', move)
      dragWindow.removeEventListener('mouseup', finish)
      shield.remove()
      cleanupDrag.current = null
    }
    const finish = (upEvent: MouseEvent) => {
      upEvent.preventDefault()
      cleanup()
      onResizeEnd()
    }
    cleanupDrag.current = cleanup
    dragWindow.addEventListener('mousemove', move)
    dragWindow.addEventListener('mouseup', finish)
  }

  const compact = Boolean(selection && (selection.width < 48 || selection.height < 28))
  const visibleDirections = compact ? DIRECTIONS.filter((direction) => direction.length === 2) : DIRECTIONS

  return <>
    {guides.map((guide, index) => <div
      key={`${guide.orientation}-${guide.position}-${index}`}
      className={`alignment-guide alignment-guide-${guide.orientation}`}
      style={guide.orientation === 'vertical'
        ? { left: guide.position, top: guide.start, height: Math.max(1, guide.end - guide.start) }
        : { top: guide.position, left: guide.start, width: Math.max(1, guide.end - guide.start) }}
    />)}
    {selection && <div className={`selection-overlay${editing ? ' selection-overlay-editing' : ''}${container ? ' selection-overlay-container' : ''}`} style={selection}>
      {!editing && visibleDirections.map((direction) => <div
        key={direction}
        className={`resize-handle handle-${direction}`}
        onMouseDown={(event) => start(direction, event)}
      />)}
      {!editing && <div className="size-badge">{Math.round(selection.width)} × {Math.round(selection.height)}</div>}
    </div>}
  </>
}
