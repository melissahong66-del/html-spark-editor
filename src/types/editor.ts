export interface ImportedDocument {
  sourceHtml: string
  sanitizedHtml: string
  doctype: string
  fileName: string
  preservedScripts: Array<{ id: string; html: string }>
}

export interface HistorySnapshot {
  bodyHtml: string
  bodyAttributes: Record<string, string>
  styleContents: string[]
  selectedId: string | null
}

export interface ElementMetrics {
  x: number
  y: number
  width: number
  height: number
  position: string
}

export interface LayerNode {
  editorId: string
  tag: string
  id: string
  className: string
  children: LayerNode[]
}

export interface OverlayRect {
  left: number
  top: number
  width: number
  height: number
}

export interface AlignmentGuide {
  orientation: 'vertical' | 'horizontal'
  position: number
  start: number
  end: number
}

export type ExportIssueKind = 'garbled-text' | 'broken-image' | 'empty-link' | 'out-of-canvas'

export interface ExportIssue {
  kind: ExportIssueKind
  title: string
  count: number
  details: string[]
}

export interface ClipboardPayload {
  html: string
  parentId: string | null
}

export type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

export interface PropertyValues extends ElementMetrics {
  tag: string
  id: string
  className: string
  fontFamily: string
  fontSize: string
  fontWeight: string
  fontStyle: string
  textDecoration: string
  lineHeight: string
  textAlign: string
  color: string
  backgroundColor: string
  borderRadius: string
  borderWidth: string
  borderStyle: string
  borderColor: string
  opacity: string
  marginTop: string
  marginRight: string
  marginBottom: string
  marginLeft: string
  paddingTop: string
  paddingRight: string
  paddingBottom: string
  paddingLeft: string
}
