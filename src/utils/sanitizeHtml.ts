const BLOCKED_ELEMENTS = 'script,iframe,object,embed'
const URL_ATTRIBUTES = ['href', 'src', 'action', 'formaction', 'xlink:href']
const DANGEROUS_PROTOCOL = /^\s*(?:javascript|vbscript|data\s*:\s*text\/html)/i

export function sanitizeDocument(document: Document): Document {
  document.querySelectorAll(BLOCKED_ELEMENTS).forEach((node) => node.remove())
  document.querySelectorAll('meta[http-equiv]').forEach((node) => {
    if (node.getAttribute('http-equiv')?.toLowerCase() === 'refresh') node.remove()
  })

  document.querySelectorAll('*').forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase()
      if (name.startsWith('on')) element.removeAttribute(attribute.name)
    })
    URL_ATTRIBUTES.forEach((name) => {
      const value = element.getAttribute(name)
      if (value && DANGEROUS_PROTOCOL.test(value)) element.removeAttribute(name)
    })
  })

  return document
}

export function addEditorIds(document: Document): void {
  let counter = 0
  document.body.querySelectorAll('*').forEach((element) => {
    element.setAttribute('data-editor-id', `editor-${Date.now()}-${counter++}`)
  })
}

export function assignFreshEditorIds(root: Element): void {
  let counter = 0
  ;[root, ...Array.from(root.querySelectorAll('*'))].forEach((element) => {
    element.setAttribute('data-editor-id', `editor-${Date.now()}-${counter++}-${Math.random().toString(36).slice(2, 7)}`)
  })
}

export function cleanEditorMarkers(document: Document): void {
  document.querySelectorAll('*').forEach((element) => {
    if (element.hasAttribute('data-editor-text-editing') && element instanceof HTMLElement) {
      const cursor = element.getAttribute('data-editor-original-cursor') ?? ''
      const priority = element.getAttribute('data-editor-original-cursor-priority') ?? ''
      if (cursor) element.style.setProperty('cursor', cursor, priority)
      else element.style.removeProperty('cursor')
      const outline = element.getAttribute('data-editor-original-outline') ?? ''
      const outlinePriority = element.getAttribute('data-editor-original-outline-priority') ?? ''
      if (outline) element.style.setProperty('outline', outline, outlinePriority)
      else element.style.removeProperty('outline')
    }
    Array.from(element.attributes).forEach((attribute) => {
      if (attribute.name.startsWith('data-editor-')) element.removeAttribute(attribute.name)
    })
    element.removeAttribute('contenteditable')
    element.removeAttribute('spellcheck')
  })
}
