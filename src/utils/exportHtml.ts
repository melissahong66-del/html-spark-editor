import type { ImportedDocument } from '../types/editor'
import { cleanEditorMarkers } from './sanitizeHtml'

const SCRIPT_PLACEHOLDER = 'editor-preserved-script:'

function restorePreservedScripts(document: Document, imported: ImportedDocument): void {
  const scripts = new Map(imported.preservedScripts.map((script) => [script.id, script.html]))
  const walker = document.createTreeWalker(document, NodeFilter.SHOW_COMMENT)
  const placeholders: Comment[] = []
  let current = walker.nextNode()
  while (current) {
    const comment = current as Comment
    if (comment.data.startsWith(SCRIPT_PLACEHOLDER)) placeholders.push(comment)
    current = walker.nextNode()
  }
  placeholders.forEach((placeholder) => {
    const html = scripts.get(placeholder.data.slice(SCRIPT_PLACEHOLDER.length))
    if (!html) {
      placeholder.remove()
      return
    }
    const template = document.createElement('template')
    template.innerHTML = html
    const script = template.content.firstChild
    if (script) placeholder.replaceWith(script)
    else placeholder.remove()
  })
}

export function buildExportHtml(imported: ImportedDocument, iframeDocument: Document): string {
  const parser = new DOMParser()
  const output = parser.parseFromString(imported.sanitizedHtml, 'text/html')
  output.documentElement.replaceWith(iframeDocument.documentElement.cloneNode(true))
  cleanEditorMarkers(output)
  restorePreservedScripts(output, imported)
  return `${imported.doctype}\n${output.documentElement.outerHTML}`
}

export function downloadHtml(html: string, originalFileName: string): void {
  const base = originalFileName.replace(/\.(?:html?|HTML?)$/, '')
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${base}-edited.html`
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
