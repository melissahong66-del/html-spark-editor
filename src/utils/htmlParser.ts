import type { ImportedDocument } from '../types/editor'
import { addEditorIds, sanitizeDocument } from './sanitizeHtml'

function readDoctype(source: string): string {
  return source.match(/<!doctype[^>]*>/i)?.[0] ?? '<!doctype html>'
}

export function parseImportedHtml(sourceHtml: string, fileName: string): ImportedDocument {
  const parser = new DOMParser()
  const document = parser.parseFromString(sourceHtml, 'text/html')
  const preservedScripts = Array.from(document.querySelectorAll('script')).map((script, index) => {
    const id = `script-${index}`
    const html = script.outerHTML
    script.replaceWith(document.createComment(`editor-preserved-script:${id}`))
    return { id, html }
  })
  sanitizeDocument(document)
  addEditorIds(document)
  return {
    sourceHtml,
    sanitizedHtml: `<!doctype html>\n${document.documentElement.outerHTML}`,
    doctype: readDoctype(sourceHtml),
    fileName,
    preservedScripts,
  }
}
