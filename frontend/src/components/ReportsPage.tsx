import { CodingReportPanel } from './CodingReportPanel'
import { ProjectSummaryPanel } from './ProjectSummaryPanel'

export function ReportsPage() {
  return (
    <section className="page-card">
      <div className="page-header">
        <div>
          <p className="eyebrow">Reports</p>
          <h2>Coding report and project summary</h2>
        </div>
      </div>

      <div className="panel-grid reports-grid">
        <CodingReportPanel />
        <ProjectSummaryPanel />
      </div>
    </section>
  )
}
