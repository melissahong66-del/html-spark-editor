import { useRef } from 'react'

interface Props {
  hasDocument: boolean
  hasSelection: boolean
  canUndo: boolean
  canRedo: boolean
  outerSelectionMode: boolean
  onImport: (file: File) => void
  onUndo: () => void
  onRedo: () => void
  onCopy: () => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onToggleOuterSelection: () => void
  onFindReplace: () => void
  onExport: () => void
}

export function Toolbar(props: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const selectedDisabled = !props.hasSelection
  return (
    <header className="toolbar">
      <div className="toolbar-brand">HTML 视觉编辑器</div>
      <button className="primary" onClick={() => inputRef.current?.click()}>导入 HTML</button>
      <input ref={inputRef} hidden type="file" accept=".html,.htm,text/html" onChange={(event) => {
        const file = event.target.files?.[0]
        if (file) props.onImport(file)
        event.currentTarget.value = ''
      }} />
      <span className="toolbar-divider" />
      <button disabled={!props.canUndo} onClick={props.onUndo}>撤销</button>
      <button disabled={!props.canRedo} onClick={props.onRedo}>重做</button>
      <button disabled={selectedDisabled} onClick={props.onCopy}>复制</button>
      <button disabled={selectedDisabled} onClick={props.onDelete}>删除</button>
      <button disabled={selectedDisabled} onClick={props.onMoveUp}>上移一层</button>
      <button disabled={selectedDisabled} onClick={props.onMoveDown}>下移一层</button>
      <button className={props.outerSelectionMode ? 'active-mode' : ''} disabled={!props.hasDocument} onClick={props.onToggleOuterSelection}>选择外层</button>
      <button disabled={!props.hasDocument} onClick={props.onFindReplace}>查找替换</button>
      <span className="toolbar-spacer" />
      <button className="primary" disabled={!props.hasDocument} onClick={props.onExport}>导出 HTML</button>
    </header>
  )
}
