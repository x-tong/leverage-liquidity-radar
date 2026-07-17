import { ExternalLink, X } from 'lucide-react'
import type { Metric } from '../data'

interface AuditDrawerProps {
  metric: Metric | null
  onClose: () => void
}

export function AuditDrawer({ metric, onClose }: AuditDrawerProps) {
  if (!metric) return null

  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <aside className="audit-drawer" role="dialog" aria-modal="true" aria-label={`${metric.label} 的审计信息`} onMouseDown={(event) => event.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <p>数据审计</p>
            <h2>{metric.label}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭审计面板">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <dl className="audit-list">
          <div>
            <dt>当前读数</dt>
            <dd className="drawer-value">{metric.value}</dd>
          </div>
          <div>
            <dt>来源</dt>
            <dd>{metric.source}</dd>
          </div>
          <div>
            <dt>频率</dt>
            <dd>{metric.frequency}</dd>
          </div>
          <div>
            <dt>计算</dt>
            <dd>{metric.formula}</dd>
          </div>
          <div>
            <dt>已知局限</dt>
            <dd>{metric.caveat}</dd>
          </div>
        </dl>
        <a className="source-button" href={metric.sourceUrl} target="_blank" rel="noreferrer">
          打开原始来源
          <ExternalLink size={16} aria-hidden="true" />
        </a>
      </aside>
    </div>
  )
}
