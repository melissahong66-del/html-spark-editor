import type { RefObject } from 'react'
import type { OverlayRect, ResizeDirection } from '../types/editor'
import { SelectionOverlay } from './SelectionOverlay'

interface Props {
  iframeRef: RefObject<HTMLIFrameElement | null>
  srcDoc: string | null
  selectionRect: OverlayRect | null
  hoverRect: OverlayRect | null
  isTextEditing: boolean
  onLoad: () => void
  onResizeStart: (direction: ResizeDirection) => void
  onResizeMove: (dx: number, dy: number, shiftKey: boolean) => void
  onResizeEnd: () => void
}

export function EditorCanvas(props: Props) {
  return (
    <main className="workspace">
      {props.srcDoc ? <div className="iframe-shell">
        <iframe ref={props.iframeRef} title="HTML 编辑画布" sandbox="allow-same-origin" srcDoc={props.srcDoc} onLoad={props.onLoad} />
        <SelectionOverlay selection={props.selectionRect} hover={props.hoverRect} editing={props.isTextEditing} onResizeStart={props.onResizeStart} onResizeMove={props.onResizeMove} onResizeEnd={props.onResizeEnd} />
      </div> : <div className="welcome-card">
        <div className="welcome-icon">HTML</div>
        <h2>导入一个 HTML 文件开始编辑</h2>
        <p>支持普通静态 HTML、内联样式和 &lt;style&gt; 样式。</p>
      </div>}
    </main>
  )
}
