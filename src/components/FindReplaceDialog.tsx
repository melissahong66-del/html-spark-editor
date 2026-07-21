import { useEffect, useState } from 'react'

interface Props {
  onClose: () => void
  onCount: (query: string, caseSensitive: boolean) => number
  onReplace: (query: string, replacement: string, caseSensitive: boolean, replaceAll: boolean) => number
}

export function FindReplaceDialog({ onClose, onCount, onReplace }: Props) {
  const [query, setQuery] = useState('')
  const [replacement, setReplacement] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [count, setCount] = useState(0)
  const [message, setMessage] = useState('')

  useEffect(() => {
    setCount(onCount(query, caseSensitive))
    setMessage('')
  }, [caseSensitive, onCount, query])

  const replace = (all: boolean) => {
    const changed = onReplace(query, replacement, caseSensitive, all)
    setCount(onCount(query, caseSensitive))
    setMessage(changed ? `已替换 ${changed} 处` : '没有可替换的内容')
  }

  return <div className="dialog-backdrop" role="presentation">
    <section className="find-replace-dialog" role="dialog" aria-modal="true" aria-labelledby="find-replace-title">
      <div className="export-check-header">
        <div><h2 id="find-replace-title">查找替换</h2><p>只处理页面文字，不修改 HTML、CSS 或脚本</p></div>
        <button className="dialog-close" aria-label="关闭" onClick={onClose}>×</button>
      </div>
      <label className="find-replace-field"><span>查找内容</span><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="输入需要查找的文字" /></label>
      <label className="find-replace-field"><span>替换为</span><input value={replacement} onChange={(event) => setReplacement(event.target.value)} placeholder="留空可删除查找内容" /></label>
      <div className="find-replace-options">
        <label><input type="checkbox" checked={caseSensitive} onChange={(event) => setCaseSensitive(event.target.checked)} /> 区分大小写</label>
        <strong>{query ? `找到 ${count} 处` : '请输入查找内容'}</strong>
      </div>
      {message && <p className="find-replace-message">{message}</p>}
      <div className="dialog-actions">
        <button onClick={onClose}>关闭</button>
        <button disabled={!query || count === 0} onClick={() => replace(false)}>替换一个</button>
        <button className="primary" disabled={!query || count === 0} onClick={() => replace(true)}>全部替换</button>
      </div>
    </section>
  </div>
}
