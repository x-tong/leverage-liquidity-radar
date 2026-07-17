import { CheckCircle2, Clock3, ShieldAlert } from 'lucide-react'
import { auditRows, type DataStatus } from '../data'
import { StatusMark } from './StatusMark'

const icons: Record<DataStatus, typeof CheckCircle2> = {
  verified: CheckCircle2,
  review: ShieldAlert,
}

export function SourceHealth() {
  return (
    <section className="source-health" aria-labelledby="source-health-title">
      <div className="section-heading compact">
        <div>
          <p>数据健康</p>
          <h2 id="source-health-title">不要把延迟藏起来</h2>
        </div>
        <span className="health-clock"><Clock3 size={15} aria-hidden="true" /> 按来源各自时钟</span>
      </div>
      <div className="health-table" role="table" aria-label="数据来源健康情况">
        <div className="health-row health-head" role="row">
          <span role="columnheader">市场</span>
          <span role="columnheader">状态</span>
          <span role="columnheader">最后验证</span>
          <span role="columnheader">审计备注</span>
        </div>
        {auditRows.map((row) => {
          const Icon = icons[row.status]
          return (
            <div className="health-row" role="row" key={row.market}>
              <span role="cell" className="health-market"><Icon size={16} aria-hidden="true" /> {row.market}</span>
              <span role="cell"><StatusMark status={row.status} /></span>
              <span role="cell">{row.checked}</span>
              <span role="cell"><strong>{row.source}</strong><br />{row.detail}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
