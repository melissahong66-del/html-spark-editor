import type { ElementMetrics, PropertyValues } from '../types/editor'

export function getElementMetrics(element: HTMLElement): ElementMetrics {
  const rect = element.getBoundingClientRect()
  const style = element.ownerDocument.defaultView!.getComputedStyle(element)
  return {
    x: Number.parseFloat(style.left) || element.offsetLeft || 0,
    y: Number.parseFloat(style.top) || element.offsetTop || 0,
    width: rect.width,
    height: rect.height,
    position: style.position,
  }
}

export function ensureAbsolutePosition(element: HTMLElement): ElementMetrics {
  const rect = element.getBoundingClientRect()
  const parent = element.offsetParent instanceof HTMLElement ? element.offsetParent : element.parentElement
  if (!parent) return getElementMetrics(element)
  const view = element.ownerDocument.defaultView!
  const elementStyle = view.getComputedStyle(element)
  const inlineTransition = element.style.getPropertyValue('transition')
  const inlineTransitionPriority = element.style.getPropertyPriority('transition')
  // Imported pages often use `transition: all`. It would animate the newly
  // assigned top/left values and look like the box is escaping downward.
  element.style.setProperty('transition', 'none', 'important')

  // Keep the element's original slot in normal flow. Without this placeholder,
  // turning a heading/paragraph into an absolutely positioned PPT-like box
  // makes every following element jump up immediately.
  const editorId = element.getAttribute('data-editor-id')
  const existingSpacer = editorId
    ? element.parentElement?.querySelector<HTMLElement>(`:scope > [data-editor-layout-spacer-for="${CSS.escape(editorId)}"]`)
    : null
  if (elementStyle.position !== 'absolute' && !existingSpacer && element.parentElement && editorId) {
    const spacerTag = element.tagName === 'LI'
      ? 'li'
      : elementStyle.display.startsWith('inline') ? 'span' : 'div'
    const spacer = element.ownerDocument.createElement(spacerTag)
    spacer.setAttribute('data-editor-layout-spacer-for', editorId)
    spacer.setAttribute('aria-hidden', 'true')
    spacer.style.display = elementStyle.display === 'inline' ? 'inline-block' : elementStyle.display
    spacer.style.boxSizing = 'border-box'
    spacer.style.width = `${rect.width}px`
    spacer.style.height = `${rect.height}px`
    spacer.style.marginTop = elementStyle.marginTop
    spacer.style.marginRight = elementStyle.marginRight
    spacer.style.marginBottom = elementStyle.marginBottom
    spacer.style.marginLeft = elementStyle.marginLeft
    spacer.style.visibility = 'hidden'
    spacer.style.pointerEvents = 'none'
    spacer.style.flex = 'none'
    element.parentElement.insertBefore(spacer, element)
  }
  if (view.getComputedStyle(parent).position === 'static') parent.style.position = 'relative'
  const parentRect = parent.getBoundingClientRect()
  const left = rect.left - parentRect.left - parent.clientLeft + parent.scrollLeft
  const top = rect.top - parentRect.top - parent.clientTop + parent.scrollTop
  element.style.width = `${Math.max(20, rect.width)}px`
  element.style.height = `${Math.max(20, rect.height)}px`
  element.style.position = 'absolute'
  element.style.left = `${left}px`
  element.style.top = `${top}px`
  element.style.margin = '0px'
  element.setAttribute('data-editor-has-layout-spacer', 'true')

  // Adding the spacer can change margin collapsing, flex/grid placement, or
  // the containing block's geometry. Correct the final rendered position
  // against the original screen rectangle so the box never jumps on convert.
  const positionedRect = element.getBoundingClientRect()
  const correctedLeft = left + rect.left - positionedRect.left
  const correctedTop = top + rect.top - positionedRect.top
  if (Math.abs(correctedLeft - left) > 0.01) element.style.left = `${correctedLeft}px`
  if (Math.abs(correctedTop - top) > 0.01) element.style.top = `${correctedTop}px`
  // getBoundingClientRect above forces the no-transition positioning to be
  // applied before the imported transition rule is restored.
  if (inlineTransition) element.style.setProperty('transition', inlineTransition, inlineTransitionPriority)
  else element.style.removeProperty('transition')
  return getElementMetrics(element)
}

export function removeLayoutSpacer(element: HTMLElement): void {
  const editorId = element.getAttribute('data-editor-id')
  if (!editorId || !element.parentElement) return
  element.parentElement
    .querySelector<HTMLElement>(`:scope > [data-editor-layout-spacer-for="${CSS.escape(editorId)}"]`)
    ?.remove()
}

export function getPropertyValues(element: HTMLElement): PropertyValues {
  const view = element.ownerDocument.defaultView!
  const style = view.getComputedStyle(element)
  const metrics = getElementMetrics(element)
  return {
    ...metrics,
    tag: element.tagName.toLowerCase(), id: element.id, className: element.className,
    fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight,
    fontStyle: style.fontStyle, textDecoration: style.textDecorationLine,
    lineHeight: style.lineHeight, textAlign: style.textAlign, color: style.color,
    backgroundColor: style.backgroundColor, borderRadius: style.borderRadius,
    borderWidth: style.borderWidth, borderStyle: style.borderStyle, borderColor: style.borderColor,
    opacity: style.opacity, marginTop: style.marginTop, marginRight: style.marginRight,
    marginBottom: style.marginBottom, marginLeft: style.marginLeft, paddingTop: style.paddingTop,
    paddingRight: style.paddingRight, paddingBottom: style.paddingBottom, paddingLeft: style.paddingLeft,
  }
}
