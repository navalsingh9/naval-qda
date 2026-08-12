import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { SidebarLayout } from './components/SidebarLayout'
import { ProjectExplorerPage } from './components/ProjectExplorerPage'
import { CodingWorkspacePage } from './components/CodingWorkspacePage'
import { ProjectSourcePage } from './components/ProjectSourcePage'
import { QueryWorkspacePage } from './components/QueryWorkspacePage'
import { VisualizationDashboard } from './components/VisualizationDashboard'
import { SimilarityPage } from './components/SimilarityPage'
import { AiSettingsPanel } from './components/AiSettingsPanel'
import { ReportsPage } from './components/ReportsPage'

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<SidebarLayout />}>
          <Route index element={<Navigate to="/projects" replace />} />
          <Route path="/projects" element={<ProjectExplorerPage />} />
          <Route path="/sources" element={<ProjectSourcePage />} />
          <Route path="/coding" element={<CodingWorkspacePage />} />
          <Route path="/query" element={<QueryWorkspacePage />} />
          <Route path="/visualizations" element={<VisualizationDashboard />} />
          <Route path="/similarity" element={<SimilarityPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/ai" element={<AiSettingsPanel />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default App
