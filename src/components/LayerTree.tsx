import { useEffect, useState } from 'react'
import type { LayerNode } from '../types/editor'

interface Props {
  nodes: LayerNode[]
  selectedId: string | null
  onSelect: (id: string) => void
}

function NodeView({ node, selectedId, onSelect, depth }: { node: LayerNode; selectedId: string | null; onSelect: (id: string) => void; depth: number }) {
  const [open, setOpen] = useState(depth < 2)
  const hasChildren = node.children.length > 0
  const label = `${node.tag}${node.id ? `#${node.id}` : ''}${node.className ? `.${node.className.trim().split(/\s+/).slice(0, 2).join('.')}` : ''}`
  return (
    <div>
      <div className={`layer-row ${selectedId === node.editorId ? 'selected' : ''}`} style={{ paddingLeft: 10 + depth * 14 }} onClick={() => onSelect(node.editorId)}>
        <button className="tree-toggle" disabled={!hasChildren} onClick={(event) => { event.stopPropagation(); setOpen((value) => !value) }}>
          {hasChildren ? (open ? '▾' : '▸') : '·'}
        </button>
        <span title={label}>{label}</span>
      </div>
      {open && node.children.map((child) => <NodeView key={child.editorId} node={child} selectedId={selectedId} onSelect={onSelect} depth={depth + 1} />)}
    </div>
  )
}

export function LayerTree({ nodes, selectedId, onSelect }: Props) {
  const [bodyOpen, setBodyOpen] = useState(true)
  useEffect(() => setBodyOpen(true), [nodes.length])
  return (
    <aside className="left-panel panel">
      <div className="panel-title">DOM 图层</div>
      <div className="layer-tree">
        <div className="layer-row body-row" onClick={() => setBodyOpen((value) => !value)}>
          <button className="tree-toggle">{bodyOpen ? '▾' : '▸'}</button><span>body</span>
        </div>
        {bodyOpen && nodes.map((node) => <NodeView key={node.editorId} node={node} selectedId={selectedId} onSelect={onSelect} depth={1} />)}
        {!nodes.length && <div className="empty-note">导入 HTML 后显示页面结构</div>}
      </div>
    </aside>
  )
}
