import type { ExportIssue } from '../types/editor'

interface Props {
  issues: ExportIssue[]
  onBack: () => void
  onContinue: () => void
}

const ICONS: Record<ExportIssue['kind'], string> = {
  'garbled-text': '字',
  'broken-image': '图',
  'empty-link': '链',
  'out-of-canvas': '界',
}

export function ExportCheckDialog({ issues, onBack, onContinue }: Props) {
  const total = issues.reduce((sum, issue) => sum + issue.count, 0)
  return <div className="dialog-backdrop" role="presentation">
    <section className="export-check-dialog" role="dialog" aria-modal="true" aria-labelledby="export-check-title">
      <div className="export-check-header">
        <div><h2 id="export-check-title">导出检查</h2><p>发现 {total} 项可能需要注意的问题</p></div>
        <button className="dialog-close" aria-label="关闭" onClick={onBack}>×</button>
      </div>
      <div className="export-check-list">
        {issues.map((issue) => <div className="export-check-item" key={issue.kind}>
          <span className="export-check-icon">{ICONS[issue.kind]}</span>
          <div><strong>{issue.title}（{issue.count}）</strong>
            {issue.details.map((detail) => <p key={detail}>{detail}</p>)}
          </div>
        </div>)}
      </div>
      <p className="export-check-note">检查不会自动修改页面。你可以返回处理，也可以保留现状继续导出。</p>
      <div className="dialog-actions">
        <button onClick={onBack}>返回检查</button>
        <button className="primary" onClick={onContinue}>仍然导出</button>
      </div>
    </section>
  </div>
}
