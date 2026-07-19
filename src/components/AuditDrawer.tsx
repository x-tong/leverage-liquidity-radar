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
            <dt>这个指标看什么</dt>
            <dd>{metric.meaning}</dd>
          </div>
          <div>
            <dt>当前代表什么</dt>
            <dd>{metric.currentInterpretation}</dd>
          </div>
          {metric.interpretationRule && (
            <div>
              <dt>当前解释如何更新</dt>
              <dd>{metric.interpretationRule}</dd>
            </div>
          )}
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
          {metric.snapshotHash && (
            <div>
              <dt>原始快照 SHA-256</dt>
              <dd className="snapshot-hash">{metric.snapshotHash}</dd>
            </div>
          )}
        </dl>
        <div className="drawer-actions">
          {(metric.sourceLinks ?? [{ label: '打开原始来源', url: metric.sourceUrl }]).map((source) => (
            <a className="source-button" href={source.url} target="_blank" rel="noreferrer" key={source.url}>
              {source.label}
              <ExternalLink size={16} aria-hidden="true" />
            </a>
          ))}
          {metric.snapshotArchiveUrl && (
            <a className="archive-button" href={metric.snapshotArchiveUrl} target="_blank" rel="noreferrer">
              打开已归档快照
              <ExternalLink size={16} aria-hidden="true" />
            </a>
          )}
        </div>
      </aside>
    </div>
  )
}
