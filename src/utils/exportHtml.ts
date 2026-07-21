import type { ExportIssue, ImportedDocument } from '../types/editor'
import { cleanEditorMarkers } from './sanitizeHtml'

const SCRIPT_PLACEHOLDER = 'editor-preserved-script:'

function elementLabel(element: Element): string {
  const id = element.id ? `#${element.id}` : ''
  const className = typeof element.className === 'string' && element.className.trim()
    ? `.${element.className.trim().split(/\s+/).slice(0, 2).join('.')}`
    : ''
  return `${element.tagName.toLowerCase()}${id}${className}`
}

export function inspectExportDocument(document: Document): ExportIssue[] {
  const issues: ExportIssue[] = []
  const text = document.body?.innerText ?? ''
  const mojibakeMatches = text.match(/(?:锟斤拷|�|Ã[\x80-\xBF]|Â[\x80-\xBF]|â(?:€|™|€œ|€)|杩欐|涓€|寮€|鈥斺€|銆佹|锛屽)/g) ?? []
  if (mojibakeMatches.length > 0) {
    issues.push({
      kind: 'garbled-text', title: '疑似乱码', count: mojibakeMatches.length,
      details: [`检测到：${Array.from(new Set(mojibakeMatches)).slice(0, 3).join('、')}`],
    })
  }

  const brokenImages = Array.from(document.images).filter((image) => {
    const source = image.getAttribute('src')?.trim()
    return !source || (image.complete && image.naturalWidth === 0)
  })
  if (brokenImages.length > 0) {
    issues.push({
      kind: 'broken-image', title: '可能失效的图片', count: brokenImages.length,
      details: brokenImages.slice(0, 3).map((image) => `${elementLabel(image)}：${image.getAttribute('src') || '没有图片地址'}`),
    })
  }

  const emptyLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('a')).filter((link) => {
    const href = link.getAttribute('href')?.trim()
    return !href || href === '#'
  })
  if (emptyLinks.length > 0) {
    issues.push({
      kind: 'empty-link', title: '空链接', count: emptyLinks.length,
      details: emptyLinks.slice(0, 3).map((link) => `${elementLabel(link)}：${link.textContent?.trim().slice(0, 24) || '无文字'}`),
    })
  }

  const view = document.defaultView
  const outOfCanvas = view ? Array.from(document.querySelectorAll<HTMLElement>('[data-editor-id]')).filter((element) => {
    const style = view.getComputedStyle(element)
    if (style.display === 'none' || style.visibility === 'hidden') return false
    const rect = element.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return false
    if (rect.left < -1 || rect.top < -1 || rect.right <= 0 || rect.bottom <= 0) return true
    const parent = element.parentElement
    if (!parent || parent === document.body) return false
    const parentStyle = view.getComputedStyle(parent)
    const parentRect = parent.getBoundingClientRect()
    const clippedX = ['hidden', 'clip'].includes(parentStyle.overflowX) && (rect.left < parentRect.left - 1 || rect.right > parentRect.right + 1)
    const clippedY = ['hidden', 'clip'].includes(parentStyle.overflowY) && (rect.top < parentRect.top - 1 || rect.bottom > parentRect.bottom + 1)
    return clippedX || clippedY
  }) : []
  if (outOfCanvas.length > 0) {
    issues.push({
      kind: 'out-of-canvas', title: '超出画布或被容器裁切', count: outOfCanvas.length,
      details: outOfCanvas.slice(0, 3).map(elementLabel),
    })
  }
  return issues
}

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
