import { useCallback, useMemo, useRef, useState } from 'react'
import { Toolbar } from './components/Toolbar'
import { EditorCanvas } from './components/EditorCanvas'
import { PropertiesPanel } from './components/PropertiesPanel'
import { ExportCheckDialog } from './components/ExportCheckDialog'
import { useHistory } from './hooks/useHistory'
import { useIframeEditor } from './hooks/useIframeEditor'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { parseImportedHtml } from './utils/htmlParser'
import { buildExportHtml, downloadHtml, inspectExportDocument } from './utils/exportHtml'
import type { ExportIssue, HistorySnapshot, ImportedDocument } from './types/editor'

export default function App() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [imported, setImported] = useState<ImportedDocument | null>(null)
  const [srcDoc, setSrcDoc] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [exportIssues, setExportIssues] = useState<ExportIssue[] | null>(null)
  const [outerSelectionMode, setOuterSelectionMode] = useState(false)
  const history = useHistory(50)

  const handleCommit = useCallback((snapshot: HistorySnapshot) => history.push(snapshot), [history.push])
  const handleReady = useCallback((snapshot: HistorySnapshot) => history.reset(snapshot), [history.reset])
  const editor = useIframeEditor({ iframeRef, onCommit: handleCommit, onReady: handleReady, outerSelectionMode })

  const undo = useCallback(() => { const snapshot = history.undo(); if (snapshot) editor.restoreSnapshot(snapshot) }, [editor, history])
  const redo = useCallback(() => { const snapshot = history.redo(); if (snapshot) editor.restoreSnapshot(snapshot) }, [editor, history])

  const commands = useMemo(() => ({
    undo, redo, copy: editor.copy, paste: editor.paste, remove: editor.remove,
    clearSelection: editor.clearSelection, nudge: editor.nudge,
  }), [editor.clearSelection, editor.copy, editor.nudge, editor.paste, editor.remove, redo, undo])
  useKeyboardShortcuts(commands, iframeRef, srcDoc)

  const importFile = async (file: File) => {
    setError(null)
    if (!/\.html?$/i.test(file.name)) {
      setError('请选择 .html 或 .htm 文件。')
      return
    }
    try {
      const source = await file.text()
      const parsed = parseImportedHtml(source, file.name)
      editor.clearSelection()
      setImported(parsed)
      setSrcDoc(parsed.sanitizedHtml)
      setNotice('已禁用页面脚本和原有交互。本地相对图片及其他相对资源可能无法加载。')
    } catch (cause) {
      setError(`导入失败：${cause instanceof Error ? cause.message : '无法读取文件'}`)
    }
  }

  const performExport = () => {
    const document = iframeRef.current?.contentDocument
    if (!imported || !document) return
    try {
      downloadHtml(buildExportHtml(imported, document), imported.fileName)
    } catch (cause) {
      setError(`导出失败：${cause instanceof Error ? cause.message : '无法生成文件'}`)
    }
  }

  const exportFile = () => {
    const document = iframeRef.current?.contentDocument
    if (!imported || !document) return
    const issues = inspectExportDocument(document)
    if (issues.length > 0) {
      setExportIssues(issues)
      return
    }
    performExport()
  }

  return <div className="app-shell">
    <Toolbar hasDocument={Boolean(imported)} hasSelection={Boolean(editor.selected)} canUndo={history.canUndo} canRedo={history.canRedo} outerSelectionMode={outerSelectionMode}
      onImport={importFile} onUndo={undo} onRedo={redo} onCopy={editor.copy} onDelete={editor.remove}
      onMoveUp={() => editor.changeZIndex(1)} onMoveDown={() => editor.changeZIndex(-1)} onToggleOuterSelection={() => { editor.clearSelection(); setOuterSelectionMode((active) => !active) }} onExport={exportFile} />
    {(notice || error) && <div className={`notice ${error ? 'error' : ''}`}><span>{error ?? notice}</span><button aria-label="关闭提示" onClick={() => { setNotice(null); setError(null) }}>×</button></div>}
    <div className="editor-layout">
      <EditorCanvas iframeRef={iframeRef} srcDoc={srcDoc} selectionRect={editor.selectionRect} hoverRect={editor.hoverRect} guides={editor.guides} isTextEditing={editor.isTextEditing} selectedIsContainer={editor.selectedIsContainer}
        onLoad={editor.bindDocument} onResizeStart={editor.startResize} onResizeMove={editor.moveResize} onResizeEnd={editor.endResize} />
      <PropertiesPanel values={editor.properties} lockAspect={editor.lockAspect} onLockAspect={editor.setLockAspect}
        selectedTextCount={editor.selectedTextCount} onChange={editor.updateProperty} onTransformCase={editor.transformTextCase}
        onToggleNumberedList={editor.toggleNumberedList} onToggleBulletList={editor.toggleBulletList} onCommit={editor.commitProperty} />
    </div>
    {exportIssues && <ExportCheckDialog issues={exportIssues} onBack={() => setExportIssues(null)} onContinue={() => { setExportIssues(null); performExport() }} />}
  </div>
}
