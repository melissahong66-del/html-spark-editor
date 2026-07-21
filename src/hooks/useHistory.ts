import { useCallback, useRef, useState } from 'react'
import type { HistorySnapshot } from '../types/editor'

export function useHistory(limit = 50) {
  const snapshots = useRef<HistorySnapshot[]>([])
  const index = useRef(-1)
  const [, render] = useState(0)
  const refresh = () => render((value) => value + 1)

  const reset = useCallback((snapshot: HistorySnapshot) => {
    snapshots.current = [snapshot]
    index.current = 0
    refresh()
  }, [])

  const push = useCallback((snapshot: HistorySnapshot) => {
    const current = snapshots.current[index.current]
    if (current && JSON.stringify(current) === JSON.stringify(snapshot)) return
    snapshots.current = snapshots.current.slice(0, index.current + 1)
    snapshots.current.push(snapshot)
    if (snapshots.current.length > limit) snapshots.current.shift()
    index.current = snapshots.current.length - 1
    refresh()
  }, [limit])

  const undo = useCallback(() => {
    if (index.current <= 0) return null
    index.current -= 1
    refresh()
    return snapshots.current[index.current]
  }, [])

  const redo = useCallback(() => {
    if (index.current >= snapshots.current.length - 1) return null
    index.current += 1
    refresh()
    return snapshots.current[index.current]
  }, [])

  return {
    reset, push, undo, redo,
    canUndo: index.current > 0,
    canRedo: index.current >= 0 && index.current < snapshots.current.length - 1,
  }
}
