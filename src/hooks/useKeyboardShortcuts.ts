import { useEffect, type RefObject } from 'react'

export interface EditorCommands {
  undo: () => void
  redo: () => void
  copy: () => void
  paste: () => void
  remove: () => void
  clearSelection: () => void
  nudge: (dx: number, dy: number) => void
}

export function useKeyboardShortcuts(commands: EditorCommands, iframeRef: RefObject<HTMLIFrameElement | null>, documentKey: string | null): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return
      const mod = event.ctrlKey || event.metaKey
      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        event.shiftKey ? commands.redo() : commands.undo()
      } else if (mod && event.key.toLowerCase() === 'c') {
        event.preventDefault(); commands.copy()
      } else if (mod && event.key.toLowerCase() === 'v') {
        event.preventDefault(); commands.paste()
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault(); commands.remove()
      } else if (event.key === 'Escape') {
        commands.clearSelection()
      } else if (event.key.startsWith('Arrow')) {
        event.preventDefault()
        const step = event.shiftKey ? 10 : 1
        const delta: Record<string, [number, number]> = {
          ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
        }
        commands.nudge(...delta[event.key])
      }
    }
    const frameWindow = iframeRef.current?.contentWindow
    window.addEventListener('keydown', handler)
    frameWindow?.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      frameWindow?.removeEventListener('keydown', handler)
    }
  }, [commands, documentKey, iframeRef])
}
