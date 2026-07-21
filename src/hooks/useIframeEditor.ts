import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import interact from 'interactjs'
import type { AlignmentGuide, ClipboardPayload, HistorySnapshot, LayerNode, OverlayRect, PropertyValues, ResizeDirection } from '../types/editor'
import { assignFreshEditorIds } from '../utils/sanitizeHtml'
import { ensureAbsolutePosition, getElementMetrics, getPropertyValues, removeLayoutSpacer } from '../utils/elementPosition'

const UNSELECTABLE = new Set(['HTML', 'HEAD', 'BODY', 'SCRIPT', 'STYLE', 'META', 'LINK'])
const TEXT_TAGS = new Set([
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'SPAN', 'A', 'BUTTON', 'LI', 'LABEL',
  'STRONG', 'B', 'EM', 'I', 'U', 'S', 'SMALL', 'SUB', 'SUP', 'MARK', 'TIME',
  'ABBR', 'CITE', 'Q', 'BLOCKQUOTE', 'FIGCAPTION', 'TD', 'TH', 'DT', 'DD',
  'CAPTION', 'LEGEND', 'CODE', 'PRE', 'OL', 'UL',
])
const INLINE_FRAGMENT_TAGS = new Set([
  'SPAN', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'SMALL', 'SUB', 'SUP', 'MARK',
  'TIME', 'ABBR', 'CITE', 'Q', 'CODE',
])

function isTextEditable(element: HTMLElement): boolean {
  if (TEXT_TAGS.has(element.tagName)) return true
  if (!element.textContent?.trim()) return false
  // Imported pages often use a div (or another neutral container) as a text
  // box. Accept it when all children are inline, but never turn a large layout
  // wrapper containing block sections into one giant editable region.
  const view = element.ownerDocument.defaultView
  return Boolean(view && Array.from(element.children).every((child) => {
    const display = view.getComputedStyle(child).display
    return display === 'inline' || display === 'inline-block' || display === 'contents'
  }))
}

function normalizeTextBoxTarget(element: HTMLElement): HTMLElement {
  if (element.tagName === 'LI' && element.parentElement && ['OL', 'UL'].includes(element.parentElement.tagName)) {
    return element.parentElement
  }
  const view = element.ownerDocument.defaultView
  if (!view || !INLINE_FRAGMENT_TAGS.has(element.tagName) || view.getComputedStyle(element).display !== 'inline') return element
  let current: HTMLElement | null = element
  while (current?.parentElement && current.parentElement !== element.ownerDocument.body) {
    const parent: HTMLElement = current.parentElement
    if (isTextEditable(parent)) return parent
    if (view.getComputedStyle(parent).display !== 'inline') break
    current = parent
  }
  return element
}

function isMultiItemLayoutContainer(element: HTMLElement): boolean {
  const view = element.ownerDocument.defaultView
  if (!view) return false
  const visibleChildren = Array.from(element.children).filter((child): child is HTMLElement => {
    if (!(child instanceof view.HTMLElement)) return false
    const style = view.getComputedStyle(child)
    const rect = child.getBoundingClientRect()
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
  })
  if (visibleChildren.length < 2) return false
  const independentChildren = visibleChildren.filter((child) => {
    const style = view.getComputedStyle(child)
    return style.position === 'absolute' || style.position === 'fixed'
      || (style.display !== 'inline' && style.display !== 'contents')
  })
  return independentChildren.length >= 2
}

function findLayoutContainer(element: HTMLElement | null): HTMLElement | null {
  let current = element
  while (current && current !== element?.ownerDocument.body) {
    if (current.hasAttribute('data-editor-id') && isMultiItemLayoutContainer(current)) return current
    current = current.parentElement
  }
  return null
}

function resolveSelectableTarget(rawTarget: HTMLElement | null): HTMLElement | null {
  if (!rawTarget) return null
  const identified = rawTarget.hasAttribute('data-editor-id')
    ? rawTarget
    : rawTarget.closest<HTMLElement>('[data-editor-id]')
  if (!identified) return null
  const normalized = normalizeTextBoxTarget(identified)
  // A wrapper containing several independent boxes is page layout, not a PPT
  // object. Clicking its empty area should deselect instead of moving all boxes.
  if (isMultiItemLayoutContainer(normalized)) {
    return identified !== normalized && !isMultiItemLayoutContainer(identified) ? identified : null
  }
  return normalized
}

function beginListFromTypedText(element: HTMLElement): boolean {
  if (element.querySelector('ol, ul')) return false
  const document = element.ownerDocument
  const selection = document.defaultView?.getSelection()
  let lineElement = element
  let current = selection?.anchorNode instanceof document.defaultView!.HTMLElement
    ? selection.anchorNode
    : selection?.anchorNode?.parentElement
  while (current && current !== element) {
    const parent = current.parentElement
    if (parent === element) {
      const display = document.defaultView?.getComputedStyle(current).display
      if (display && display !== 'inline' && display !== 'contents') lineElement = current
      break
    }
    current = parent
  }
  const text = lineElement.innerText.replace(/\u00a0/g, ' ').trim()
  const numberedMatch = text.match(/^1(?:[.．、])?\s*(.*)$/s)
  const bulletMatch = text.match(/^[-*•]\s*(.*)$/s)
  const match = numberedMatch ?? bulletMatch
  if (!match) return false
  const list = document.createElement(numberedMatch ? 'ol' : 'ul')
  const first = document.createElement('li')
  const second = document.createElement('li')
  first.textContent = match[1]
  if (!first.textContent) first.appendChild(document.createElement('br'))
  second.appendChild(document.createElement('br'))
  list.append(first, second)
  assignFreshEditorIds(list)
  if (lineElement === element) element.replaceChildren(list)
  else lineElement.replaceWith(list)
  const range = document.createRange()
  range.selectNodeContents(second)
  range.collapse(true)
  selection?.removeAllRanges()
  selection?.addRange(range)
  return true
}

interface SnapTarget {
  value: number
  start: number
  end: number
  full?: boolean
}

const SNAP_THRESHOLD = 6
const PIXEL_PROPERTIES = new Set([
  'fontSize', 'lineHeight', 'borderRadius', 'borderWidth',
  'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
])

interface Options {
  iframeRef: RefObject<HTMLIFrameElement | null>
  onCommit: (snapshot: HistorySnapshot) => void
  onReady: (snapshot: HistorySnapshot) => void
  outerSelectionMode: boolean
}

interface ResizeState {
  element: HTMLElement
  direction: ResizeDirection
  left: number
  top: number
  width: number
  height: number
  ratio: number
}

export function useIframeEditor({ iframeRef, onCommit, onReady, outerSelectionMode }: Options) {
  const [selected, setSelected] = useState<HTMLElement | null>(null)
  const [hovered, setHovered] = useState<HTMLElement | null>(null)
  const [selectionRect, setSelectionRect] = useState<OverlayRect | null>(null)
  const [hoverRect, setHoverRect] = useState<OverlayRect | null>(null)
  const [properties, setProperties] = useState<PropertyValues | null>(null)
  const [layers, setLayers] = useState<LayerNode[]>([])
  const [lockAspect, setLockAspect] = useState(false)
  const [selectedTextCount, setSelectedTextCount] = useState(0)
  const [isTextEditing, setIsTextEditing] = useState(false)
  const [guides, setGuides] = useState<AlignmentGuide[]>([])
  const selectedRef = useRef<HTMLElement | null>(null)
  const outerSelectionModeRef = useRef(outerSelectionMode)
  outerSelectionModeRef.current = outerSelectionMode
  const savedRange = useRef<Range | null>(null)
  const selectionPointerActive = useRef(false)
  const clipboard = useRef<ClipboardPayload | null>(null)
  const resizeState = useRef<ResizeState | null>(null)
  const editState = useRef<{
    element: HTMLElement
    html: string
    cursor: string
    cursorPriority: string
    outline: string
    outlinePriority: string
    caretColor: string
    caretColorPriority: string
  } | null>(null)
  const observer = useRef<MutationObserver | null>(null)
  const raf = useRef(0)
  const updateOverlayRef = useRef<() => void>(() => undefined)
  const buildLayersRef = useRef<() => void>(() => undefined)

  const getDocument = useCallback(() => iframeRef.current?.contentDocument ?? null, [iframeRef])

  const captureSnapshot = useCallback((): HistorySnapshot | null => {
    const document = getDocument()
    if (!document?.body) return null
    return {
      bodyHtml: document.body.innerHTML,
      bodyAttributes: Object.fromEntries(Array.from(document.body.attributes).map((attr) => [attr.name, attr.value])),
      styleContents: Array.from(document.head.querySelectorAll('style')).map((style) => style.textContent ?? ''),
      selectedId: selectedRef.current?.getAttribute('data-editor-id') ?? null,
    }
  }, [getDocument])

  const updateOverlay = useCallback(() => {
    const toRect = (element: HTMLElement | null): OverlayRect | null => {
      if (!element?.isConnected) return null
      const rect = element.getBoundingClientRect()
      const view = element.ownerDocument.defaultView
      if (!view || rect.bottom <= 0 || rect.right <= 0 || rect.top >= view.innerHeight || rect.left >= view.innerWidth) return null
      return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
    }
    setSelectionRect(toRect(selected))
    setHoverRect(hovered === selected ? null : toRect(hovered))
    if (selected?.isConnected) {
      const nextProperties = getPropertyValues(selected)
      const range = savedRange.current
      if (range && !range.collapsed && selected.contains(range.commonAncestorContainer)) {
        const commonElement = range.commonAncestorContainer.nodeType === 1
          ? range.commonAncestorContainer as Element
          : range.commonAncestorContainer.parentElement
        const textTarget = commonElement?.closest<HTMLElement>('[data-editor-inline-style="true"]') ?? commonElement
        if (textTarget) {
          const textStyle = selected.ownerDocument.defaultView!.getComputedStyle(textTarget)
          nextProperties.fontFamily = textStyle.fontFamily
          nextProperties.fontSize = textStyle.fontSize
          nextProperties.fontWeight = textStyle.fontWeight
          nextProperties.fontStyle = textStyle.fontStyle
          nextProperties.textDecoration = textStyle.textDecorationLine
          nextProperties.color = textStyle.color
          nextProperties.backgroundColor = textStyle.backgroundColor
        }
      }
      setProperties(nextProperties)
    }
    else setProperties(null)
  }, [hovered, selected])

  const buildLayers = useCallback(() => {
    const document = getDocument()
    if (!document?.body) return
    const makeNode = (element: Element): LayerNode | null => {
      if (UNSELECTABLE.has(element.tagName)) return null
      const editorId = element.getAttribute('data-editor-id')
      if (!editorId) return null
      return {
        editorId,
        tag: element.tagName.toLowerCase(),
        id: element.id,
        className: typeof element.className === 'string' ? element.className : '',
        children: Array.from(element.children).map(makeNode).filter((node): node is LayerNode => Boolean(node)),
      }
    }
    setLayers(Array.from(document.body.children).map(makeNode).filter((node): node is LayerNode => Boolean(node)))
  }, [getDocument])

  updateOverlayRef.current = updateOverlay
  buildLayersRef.current = buildLayers

  const scheduleRefresh = useCallback(() => {
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(() => {
      updateOverlayRef.current()
      buildLayersRef.current()
    })
  }, [])

  const commit = useCallback(() => {
    scheduleRefresh()
    const snapshot = captureSnapshot()
    if (snapshot) onCommit(snapshot)
  }, [captureSnapshot, onCommit, scheduleRefresh])

  const selectElement = useCallback((element: HTMLElement | null) => {
    if (element && !element.hasAttribute('data-editor-id')) {
      element = element.closest<HTMLElement>('[data-editor-id]')
    }
    if (element && UNSELECTABLE.has(element.tagName)) element = null
    if (selectedRef.current !== element) {
      savedRange.current = null
      setSelectedTextCount(0)
    }
    selectedRef.current = element
    setSelected(element)
    setHovered(null)
    setLockAspect(element?.tagName === 'IMG')
  }, [])

  useEffect(() => {
    updateOverlay()
    // Text selection and box dragging are mutually exclusive, just like PPT:
    // while the caret is active, let the browser own every drag gesture.
    if (!selected || isTextEditing) return
    let rawLeft = 0
    let rawTop = 0
    let rawViewportLeft = 0
    let rawViewportTop = 0
    const interaction = interact(selected, { context: selected.ownerDocument }).draggable({
      ignoreFrom: '[contenteditable="true"]',
      listeners: {
        start: () => {
          const metrics = ensureAbsolutePosition(selected)
          const rect = selected.getBoundingClientRect()
          rawLeft = metrics.x
          rawTop = metrics.y
          rawViewportLeft = rect.left
          rawViewportTop = rect.top
          setGuides([])
          scheduleRefresh()
        },
        move: (event) => {
          const view = selected.ownerDocument.defaultView
          const currentRect = selected.getBoundingClientRect()
          rawLeft += event.dx
          rawTop += event.dy
          rawViewportLeft += event.dx
          rawViewportTop += event.dy
          const proposed = {
            left: rawViewportLeft,
            top: rawViewportTop,
            right: rawViewportLeft + currentRect.width,
            bottom: rawViewportTop + currentRect.height,
            width: currentRect.width,
            height: currentRect.height,
          }
          const xTargets: SnapTarget[] = []
          const yTargets: SnapTarget[] = []
          if (view) {
            xTargets.push({ value: view.innerWidth / 2, start: 0, end: view.innerHeight, full: true })
            yTargets.push({ value: view.innerHeight / 2, start: 0, end: view.innerWidth, full: true })
          }
          Array.from(selected.parentElement?.children ?? []).forEach((sibling) => {
            if (!(sibling instanceof selected.ownerDocument.defaultView!.HTMLElement) || sibling === selected) return
            const style = view?.getComputedStyle(sibling)
            if (!style || style.display === 'none' || style.visibility === 'hidden') return
            const rect = sibling.getBoundingClientRect()
            if (rect.width <= 0 || rect.height <= 0) return
            ;[rect.left, rect.left + rect.width / 2, rect.right].forEach((value) => xTargets.push({ value, start: rect.top, end: rect.bottom }))
            ;[rect.top, rect.top + rect.height / 2, rect.bottom].forEach((value) => yTargets.push({ value, start: rect.left, end: rect.right }))
          })
          const xAnchors = [proposed.left, proposed.left + proposed.width / 2, proposed.right]
          const yAnchors = [proposed.top, proposed.top + proposed.height / 2, proposed.bottom]
          let bestX: { delta: number; target: SnapTarget } | null = null
          let bestY: { delta: number; target: SnapTarget } | null = null
          xTargets.forEach((target) => xAnchors.forEach((anchor) => {
            const delta = target.value - anchor
            if (Math.abs(delta) <= SNAP_THRESHOLD && (!bestX || Math.abs(delta) < Math.abs(bestX.delta))) bestX = { delta, target }
          }))
          yTargets.forEach((target) => yAnchors.forEach((anchor) => {
            const delta = target.value - anchor
            if (Math.abs(delta) <= SNAP_THRESHOLD && (!bestY || Math.abs(delta) < Math.abs(bestY.delta))) bestY = { delta, target }
          }))
          const snapX = bestX as { delta: number; target: SnapTarget } | null
          const snapY = bestY as { delta: number; target: SnapTarget } | null
          selected.style.left = `${rawLeft + (snapX?.delta ?? 0)}px`
          selected.style.top = `${rawTop + (snapY?.delta ?? 0)}px`
          const nextGuides: AlignmentGuide[] = []
          if (snapX) nextGuides.push({
            orientation: 'vertical', position: snapX.target.value,
            start: snapX.target.full ? snapX.target.start : Math.min(proposed.top, snapX.target.start),
            end: snapX.target.full ? snapX.target.end : Math.max(proposed.bottom, snapX.target.end),
          })
          if (snapY) nextGuides.push({
            orientation: 'horizontal', position: snapY.target.value,
            start: snapY.target.full ? snapY.target.start : Math.min(proposed.left, snapY.target.start),
            end: snapY.target.full ? snapY.target.end : Math.max(proposed.right, snapY.target.end),
          })
          setGuides(nextGuides)
          scheduleRefresh()
        },
        end: () => { setGuides([]); commit() },
      },
    })
    return () => { interaction.unset() }
    // The interaction must stay mounted for the whole gesture. Hover and overlay
    // updates happen frequently while the pointer moves and must not unset it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, isTextEditing])

  const finishTextEdit = useCallback((save: boolean) => {
    const editing = editState.current
    if (!editing) return
    if (!save) editing.element.innerHTML = editing.html
    const changed = editing.element.innerHTML !== editing.html
    editing.element.removeAttribute('contenteditable')
    editing.element.removeAttribute('spellcheck')
    if (editing.cursor) editing.element.style.setProperty('cursor', editing.cursor, editing.cursorPriority)
    else editing.element.style.removeProperty('cursor')
    if (editing.outline) editing.element.style.setProperty('outline', editing.outline, editing.outlinePriority)
    else editing.element.style.removeProperty('outline')
    if (editing.caretColor) editing.element.style.setProperty('caret-color', editing.caretColor, editing.caretColorPriority)
    else editing.element.style.removeProperty('caret-color')
    editing.element.removeAttribute('data-editor-text-editing')
    editing.element.removeAttribute('data-editor-original-cursor')
    editing.element.removeAttribute('data-editor-original-cursor-priority')
    editing.element.removeAttribute('data-editor-original-outline')
    editing.element.removeAttribute('data-editor-original-outline-priority')
    editState.current = null
    setIsTextEditing(false)
    if (save && changed) commit(); else scheduleRefresh()
  }, [commit, scheduleRefresh])

  const enterTextEdit = useCallback((target: HTMLElement) => {
    if (!isTextEditable(target)) return
    if (editState.current?.element === target) {
      target.focus()
      return
    }
    if (editState.current) finishTextEdit(true)
    selectElement(target)
    const currentSelection = target.ownerDocument.defaultView?.getSelection()
    const hasActiveTextSelection = Boolean(
      currentSelection && currentSelection.rangeCount > 0 && !currentSelection.isCollapsed
      && target.contains(currentSelection.getRangeAt(0).commonAncestorContainer),
    )
    if (!hasActiveTextSelection) {
      savedRange.current = null
      setSelectedTextCount(0)
    }
    editState.current = {
      element: target,
      html: target.innerHTML,
      cursor: target.style.getPropertyValue('cursor'),
      cursorPriority: target.style.getPropertyPriority('cursor'),
      outline: target.style.getPropertyValue('outline'),
      outlinePriority: target.style.getPropertyPriority('outline'),
      caretColor: target.style.getPropertyValue('caret-color'),
      caretColorPriority: target.style.getPropertyPriority('caret-color'),
    }
    target.contentEditable = 'true'
    target.spellcheck = false
    target.setAttribute('data-editor-text-editing', 'true')
    target.setAttribute('data-editor-original-cursor', editState.current.cursor)
    target.setAttribute('data-editor-original-cursor-priority', editState.current.cursorPriority)
    target.setAttribute('data-editor-original-outline', editState.current.outline)
    target.setAttribute('data-editor-original-outline-priority', editState.current.outlinePriority)
    target.style.setProperty('cursor', 'text', 'important')
    target.style.setProperty('outline', 'none', 'important')
    target.style.setProperty('caret-color', 'currentColor', 'important')
    setIsTextEditing(true)
    target.focus({ preventScroll: true })
    requestAnimationFrame(() => target.focus({ preventScroll: true }))
    const onBlur = () => finishTextEdit(true)
    target.addEventListener('blur', onBlur, { once: true })
    scheduleRefresh()
  }, [finishTextEdit, scheduleRefresh, selectElement])

  const bindDocument = useCallback(() => {
    const document = getDocument()
    const frameWindow = document?.defaultView
    if (!document?.body || !frameWindow) return
    observer.current?.disconnect()

    const onClick = (event: MouseEvent) => {
      let target = event.target instanceof frameWindow.HTMLElement ? event.target : null
      const editing = editState.current
      if (editing) {
        // Inside contenteditable the browser must receive the click itself so
        // it can place the caret, drag-select characters and double-click a
        // word. Only actions outside the active box are intercepted.
        if (target && editing.element.contains(target)) return
        event.preventDefault()
        event.stopPropagation()
        finishTextEdit(true)
      } else {
        event.preventDefault()
        event.stopPropagation()
      }
      const identifiedTarget = target?.hasAttribute('data-editor-id')
        ? target
        : target?.closest<HTMLElement>('[data-editor-id]') ?? null
      if (outerSelectionModeRef.current || event.altKey) {
        target = findLayoutContainer(identifiedTarget)
      } else {
        target = resolveSelectableTarget(target)
      }
      if (target && !UNSELECTABLE.has(target.tagName)) {
        if (!outerSelectionModeRef.current && selectedRef.current === target && isTextEditable(target)) {
          enterTextEdit(target)
        } else {
          selectElement(target)
        }
      } else {
        selectElement(null)
      }
    }
    const onDoubleClick = (event: MouseEvent) => {
      const rawTarget = event.target instanceof frameWindow.HTMLElement ? event.target : null
      if (rawTarget && editState.current?.element.contains(rawTarget)) {
        return
      }
      event.preventDefault(); event.stopPropagation()
      const target = resolveSelectableTarget(rawTarget)
      if (!target || !isTextEditable(target)) return
      enterTextEdit(target)
    }
    const storeTextSelection = (selection: Selection | null): boolean => {
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return false
      const range = selection.getRangeAt(0)
      const startElement = range.startContainer instanceof frameWindow.HTMLElement
        ? range.startContainer
        : range.startContainer.parentElement
      const rawTextElement = startElement?.closest<HTMLElement>('[data-editor-id]') ?? null
      const textElement = rawTextElement ? normalizeTextBoxTarget(rawTextElement) : null
      if (!textElement || !textElement.contains(range.endContainer)) return false
      if (selectedRef.current !== textElement) selectElement(textElement)
      savedRange.current = range.cloneRange()
      setSelectedTextCount(Array.from(selection.toString()).length)
      scheduleRefresh()
      return true
    }
    const onSelectionChange = () => {
      const selection = frameWindow.getSelection()
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        // Clicking the property panel temporarily collapses the iframe's
        // native Selection in some browsers. Keep our saved character range;
        // a real caret click inside the text box clears it on mouseup below.
        if (editState.current && savedRange.current) return
        if (document.hasFocus()) {
          savedRange.current = null
          setSelectedTextCount(0)
          scheduleRefresh()
        }
        return
      }
      storeTextSelection(selection)
    }
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target instanceof frameWindow.HTMLElement ? event.target : null
      selectionPointerActive.current = Boolean(target && editState.current?.element.contains(target))
    }
    const onMouseUp = () => {
      if (!selectionPointerActive.current) return
      selectionPointerActive.current = false
      frameWindow.requestAnimationFrame(() => {
        const selection = frameWindow.getSelection()
        if (storeTextSelection(selection)) return
        savedRange.current = null
        setSelectedTextCount(0)
        scheduleRefresh()
      })
    }
    const onInput = (event: Event) => {
      const target = event.target instanceof frameWindow.HTMLElement ? event.target : null
      if (!target || !editState.current?.element.contains(target)) return
      savedRange.current = null
      setSelectedTextCount(0)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (editState.current && !event.shiftKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
        savedRange.current = null
        setSelectedTextCount(0)
      }
      if (event.key === 'Escape' && editState.current) {
        event.preventDefault(); event.stopPropagation(); finishTextEdit(false)
      } else if (event.key === 'Enter' && editState.current && beginListFromTypedText(editState.current.element)) {
        event.preventDefault(); event.stopPropagation()
        savedRange.current = null
        setSelectedTextCount(0)
        scheduleRefresh()
      } else if ((event.key === 'Enter' || event.key === 'F2') && !editState.current && selectedRef.current && isTextEditable(selectedRef.current)) {
        event.preventDefault(); event.stopPropagation(); enterTextEdit(selectedRef.current)
      }
    }
    const block = (event: Event) => { event.preventDefault(); event.stopPropagation() }
    document.addEventListener('click', onClick, true)
    document.addEventListener('dblclick', onDoubleClick, true)
    document.addEventListener('mousedown', onMouseDown, true)
    document.addEventListener('mouseup', onMouseUp, true)
    document.addEventListener('input', onInput, true)
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('selectionchange', onSelectionChange)
    document.addEventListener('submit', block, true)
    document.addEventListener('dragstart', block, true)
    frameWindow.addEventListener('scroll', scheduleRefresh)
    observer.current = new MutationObserver(scheduleRefresh)
    observer.current.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true })
    buildLayers(); scheduleRefresh()
    const snapshot = captureSnapshot()
    if (snapshot) onReady(snapshot)

    return () => {
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('dblclick', onDoubleClick, true)
      document.removeEventListener('mousedown', onMouseDown, true)
      document.removeEventListener('mouseup', onMouseUp, true)
      document.removeEventListener('input', onInput, true)
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('selectionchange', onSelectionChange)
      document.removeEventListener('submit', block, true)
      document.removeEventListener('dragstart', block, true)
      frameWindow.removeEventListener('scroll', scheduleRefresh)
      observer.current?.disconnect()
    }
  }, [buildLayers, captureSnapshot, enterTextEdit, finishTextEdit, getDocument, onReady, scheduleRefresh, selectElement])

  const restoreSnapshot = useCallback((snapshot: HistorySnapshot) => {
    const document = getDocument()
    if (!document?.body) return
    document.body.innerHTML = snapshot.bodyHtml
    Array.from(document.body.attributes).forEach((attribute) => document.body.removeAttribute(attribute.name))
    Object.entries(snapshot.bodyAttributes).forEach(([name, value]) => document.body.setAttribute(name, value))
    document.head.querySelectorAll('style').forEach((style, index) => { style.textContent = snapshot.styleContents[index] ?? '' })
    const next = snapshot.selectedId ? document.querySelector<HTMLElement>(`[data-editor-id="${CSS.escape(snapshot.selectedId)}"]`) : null
    savedRange.current = null
    setSelectedTextCount(0)
    selectElement(next)
    buildLayers(); scheduleRefresh()
  }, [buildLayers, getDocument, scheduleRefresh, selectElement])

  const selectById = useCallback((id: string) => {
    selectElement(getDocument()?.querySelector<HTMLElement>(`[data-editor-id="${CSS.escape(id)}"]`) ?? null)
  }, [getDocument, selectElement])

  const updateProperty = useCallback((name: keyof PropertyValues, value: string) => {
    if (!selected) return
    const range = savedRange.current
    const isTextStyle = name === 'fontFamily' || name === 'fontSize' || name === 'fontWeight' || name === 'fontStyle' || name === 'textDecoration' || name === 'color' || name === 'backgroundColor'
    if (isTextStyle && range && !range.collapsed && selected.contains(range.commonAncestorContainer)) {
      const finalValue = name === 'fontSize' && /^-?\d+(?:\.\d+)?$/.test(value) ? `${value}px` : value
      const commonElement = range.commonAncestorContainer.nodeType === 1
        ? range.commonAncestorContainer as Element
        : range.commonAncestorContainer.parentElement
      const existingSpan = commonElement?.closest<HTMLElement>('[data-editor-inline-style="true"]') ?? null
      // Reuse an existing editor span only when the current selection covers
      // all of its text. If the user selects two characters inside a span that
      // was styled earlier, reusing it would incorrectly recolor the whole span.
      const canReuseSpan = Boolean(existingSpan && selected.contains(existingSpan) && existingSpan.textContent === range.toString())
      let span: HTMLElement
      if (canReuseSpan && existingSpan) {
        span = existingSpan
      } else {
        span = selected.ownerDocument.createElement('span')
        span.setAttribute('data-editor-inline-style', 'true')
        try {
          range.surroundContents(span)
        } catch {
          const contents = range.extractContents()
          span.appendChild(contents)
          range.insertNode(span)
        }
      }
      const cssName = name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
      span.style.setProperty(cssName, finalValue, 'important')
      // The new selection can contain an older styled span. Styling only the
      // outer wrapper would lose to the descendant's explicit color/size, so
      // apply this one property to descendants that are wholly inside the
      // extracted selection as well. Content outside the range is untouched.
      span.querySelectorAll<HTMLElement>('*').forEach((descendant) => {
        descendant.style.setProperty(cssName, finalValue, 'important')
      })
      const nextRange = selected.ownerDocument.createRange()
      nextRange.selectNodeContents(span)
      savedRange.current = nextRange
      const selection = selected.ownerDocument.defaultView?.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(nextRange)
      scheduleRefresh()
      return
    }
    if (name === 'id') selected.id = value
    else if (name === 'className') selected.className = value
    else if (name === 'x' || name === 'y') {
      ensureAbsolutePosition(selected)
      selected.style[name === 'x' ? 'left' : 'top'] = `${Number(value) || 0}px`
    } else if (name === 'width' || name === 'height') {
      ensureAbsolutePosition(selected)
      selected.style[name] = `${Math.max(20, Number(value) || 20)}px`
    } else if (name === 'position') selected.style.position = value
    else if (!['tag'].includes(name)) {
      const styleName = name as keyof CSSStyleDeclaration
      const finalValue = PIXEL_PROPERTIES.has(name) && /^-?\d+(?:\.\d+)?$/.test(value) ? `${value}px` : value
      if (isTextStyle) {
        const cssName = String(styleName).replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
        selected.style.setProperty(cssName, finalValue, 'important')
        // A text box may contain spans/strong tags with their own imported
        // rules. PPT-style whole-box formatting must override those too.
        selected.querySelectorAll<HTMLElement>('*').forEach((descendant) => {
          if (descendant.textContent?.trim()) descendant.style.setProperty(cssName, finalValue, 'important')
        })
      } else {
        ;(selected.style as unknown as Record<string, string>)[styleName as string] = finalValue
      }
    }
    scheduleRefresh()
  }, [scheduleRefresh, selected])

  const transformTextCase = useCallback((mode: 'upper' | 'lower') => {
    if (!selected) return
    const transform = (value: string) => mode === 'upper'
      ? value.replace(/[a-z]/g, (letter) => letter.toUpperCase())
      : value.replace(/[A-Z]/g, (letter) => letter.toLowerCase())
    const range = savedRange.current
    const hasCharacterSelection = Boolean(
      range && !range.collapsed && selected.contains(range.commonAncestorContainer),
    )
    const walker = selected.ownerDocument.createTreeWalker(selected, 4)
    const textNodes: Text[] = []
    let current = walker.nextNode()
    while (current) {
      if (!hasCharacterSelection || range!.intersectsNode(current)) textNodes.push(current as Text)
      current = walker.nextNode()
    }
    let changed = false
    textNodes.forEach((node) => {
      let start = 0
      let end = node.data.length
      if (hasCharacterSelection && range!.startContainer === node) start = range!.startOffset
      if (hasCharacterSelection && range!.endContainer === node) end = range!.endOffset
      if (end <= start) return
      const original = node.data.slice(start, end)
      const next = transform(original)
      if (next === original) return
      node.replaceData(start, end - start, next)
      changed = true
    })
    if (!changed) return
    if (hasCharacterSelection && range) {
      savedRange.current = range.cloneRange()
      const selection = selected.ownerDocument.defaultView?.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(savedRange.current)
    }
    commit()
  }, [commit, selected])

  const toggleList = useCallback((command: 'insertOrderedList' | 'insertUnorderedList') => {
    if (!selected || !isTextEditable(selected)) return
    const document = selected.ownerDocument
    const view = document.defaultView
    if (!view) return
    const wasEditing = editState.current?.element === selected
    if (!wasEditing) selected.contentEditable = 'true'
    selected.focus({ preventScroll: true })
    const selection = view.getSelection()
    const range = savedRange.current && selected.contains(savedRange.current.commonAncestorContainer)
      ? savedRange.current.cloneRange()
      : document.createRange()
    if (!savedRange.current || !selected.contains(range.commonAncestorContainer)) range.selectNodeContents(selected)
    selection?.removeAllRanges()
    selection?.addRange(range)
    const selectedLines = range.toString()
      .replace(/\u00a0/g, ' ')
      .split(/\r?\n/)
      .map((line) => line.trim().replace(/^(?:\d+[.．、)]|[-*•])\s*/, ''))
      .filter(Boolean)
    if (!range.collapsed && selectedLines.length > 1) {
      const list = document.createElement(command === 'insertOrderedList' ? 'ol' : 'ul')
      selectedLines.forEach((line) => {
        const item = document.createElement('li')
        item.textContent = line
        list.appendChild(item)
      })
      list.style.paddingInlineStart = '1.5em'
      list.style.listStyleType = command === 'insertOrderedList' ? 'decimal' : 'disc'
      assignFreshEditorIds(list)
      const wholeText = selected.innerText.replace(/\u00a0/g, ' ').trim()
      if (range.toString().replace(/\u00a0/g, ' ').trim() === wholeText) {
        selected.replaceChildren(list)
      } else {
        range.deleteContents()
        range.insertNode(list)
      }
    } else {
      document.execCommand(command, false)
    }
    selected.querySelectorAll('ol, ul, li').forEach((element) => {
      if (!element.hasAttribute('data-editor-id')) assignFreshEditorIds(element)
    })
    selected.querySelectorAll<HTMLOListElement | HTMLUListElement>('ol, ul').forEach((list) => {
      if (!list.style.paddingInlineStart) list.style.paddingInlineStart = '1.5em'
      if (!list.style.listStyleType) list.style.listStyleType = list.tagName === 'OL' ? 'decimal' : 'disc'
    })
    if (!wasEditing) selected.removeAttribute('contenteditable')
    savedRange.current = null
    setSelectedTextCount(0)
    commit()
  }, [commit, selected])

  const toggleNumberedList = useCallback(() => toggleList('insertOrderedList'), [toggleList])
  const toggleBulletList = useCallback(() => toggleList('insertUnorderedList'), [toggleList])

  const startResize = useCallback((direction: ResizeDirection) => {
    if (!selected) return
    const metrics = ensureAbsolutePosition(selected)
    resizeState.current = { element: selected, direction, left: metrics.x, top: metrics.y, width: metrics.width, height: metrics.height, ratio: metrics.width / metrics.height }
  }, [selected])

  const moveResize = useCallback((dx: number, dy: number, shiftKey: boolean) => {
    if (!resizeState.current) return
    const start = resizeState.current
    const target = start.element
    if (!target.isConnected) return
    const { direction } = start
    let width = start.width + (direction.includes('e') ? dx : direction.includes('w') ? -dx : 0)
    let height = start.height + (direction.includes('s') ? dy : direction.includes('n') ? -dy : 0)
    if (lockAspect || shiftKey) {
      if (direction === 'n' || direction === 's') width = height * start.ratio
      else height = width / start.ratio
    }
    width = Math.max(20, width); height = Math.max(20, height)
    let left = start.left; let top = start.top
    if (direction.includes('w')) left = start.left + start.width - width
    if (direction.includes('n')) top = start.top + start.height - height
    target.style.left = `${left}px`; target.style.top = `${top}px`
    target.style.width = `${width}px`; target.style.height = `${height}px`
    scheduleRefresh()
  }, [lockAspect, scheduleRefresh])

  const endResize = useCallback(() => { resizeState.current = null; commit() }, [commit])

  const remove = useCallback(() => {
    if (!selected) return
    removeLayoutSpacer(selected)
    selected.remove(); selectElement(null); commit()
  }, [commit, selectElement, selected])

  const copy = useCallback(() => {
    if (!selected) return
    clipboard.current = { html: selected.outerHTML, parentId: selected.parentElement?.getAttribute('data-editor-id') ?? null }
  }, [selected])

  const paste = useCallback(() => {
    const payload = clipboard.current; const document = getDocument()
    if (!payload || !document?.body) return
    const template = document.createElement('template'); template.innerHTML = payload.html.trim()
    const clone = template.content.firstElementChild as HTMLElement | null
    if (!clone) return
    assignFreshEditorIds(clone)
    const parent = payload.parentId ? document.querySelector<HTMLElement>(`[data-editor-id="${CSS.escape(payload.parentId)}"]`) : document.body
    ;(parent ?? document.body).appendChild(clone)
    if (clone.style.position === 'absolute') {
      clone.style.left = `${(Number.parseFloat(clone.style.left) || 0) + 10}px`
      clone.style.top = `${(Number.parseFloat(clone.style.top) || 0) + 10}px`
    }
    selectElement(clone); commit()
  }, [commit, getDocument, selectElement])

  const changeZIndex = useCallback((delta: number) => {
    if (!selected) return
    const computed = selected.ownerDocument.defaultView!.getComputedStyle(selected).zIndex
    selected.style.zIndex = `${(computed === 'auto' ? 0 : Number.parseInt(computed, 10) || 0) + delta}`
    commit()
  }, [commit, selected])

  const nudge = useCallback((dx: number, dy: number) => {
    if (!selected) return
    const metrics = ensureAbsolutePosition(selected)
    selected.style.left = `${metrics.x + dx}px`; selected.style.top = `${metrics.y + dy}px`
    commit()
  }, [commit, selected])

  useEffect(() => () => { observer.current?.disconnect(); cancelAnimationFrame(raf.current) }, [])

  return {
    selected, properties, layers, selectionRect, hoverRect, guides, lockAspect, setLockAspect, selectedTextCount, isTextEditing,
    selectedIsContainer: Boolean(selected && isMultiItemLayoutContainer(selected)),
    bindDocument, captureSnapshot, restoreSnapshot, selectById, clearSelection: () => selectElement(null),
    updateProperty, transformTextCase, toggleNumberedList, toggleBulletList, commitProperty: commit, startResize, moveResize, endResize,
    remove, copy, paste, changeZIndex, nudge, refresh: scheduleRefresh,
  }
}
