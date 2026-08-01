import { SearchPanel } from './SearchPanel'
import { WordFrequencyTable } from './WordFrequencyTable'
import { MatrixHeatmap } from './MatrixHeatmap'
import { HierarchyTreemap } from './HierarchyTreemap'
import { CodingComparisonPanel } from './CodingComparisonPanel'

export function QueryWorkspacePage() {
  return (
    <section className="page-card">
      <div className="page-header">
        <div>
          <p className="eyebrow">Query & visualization</p>
          <h2>Search, frequencies, and matrix views</h2>
        </div>
      </div>

      <div className="panel-grid query-grid">
        <SearchPanel />
        <WordFrequencyTable />
      </div>

      <div className="panel-grid query-grid">
        <MatrixHeatmap />
        <HierarchyTreemap />
      </div>

      <div className="panel-grid query-grid">
        <CodingComparisonPanel />
      </div>
    </section>
  )
}
