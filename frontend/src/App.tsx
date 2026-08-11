import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { SidebarLayout } from './components/SidebarLayout'
import { CodingWorkspacePage } from './components/CodingWorkspacePage'
import { ProjectSourcePage } from './components/ProjectSourcePage'
import { QueryWorkspacePage } from './components/QueryWorkspacePage'
import { VisualizationsPage } from './components/VisualizationsPage'
import { VisualizationDashboard } from './components/VisualizationDashboard'
import { AiSettingsPanel } from './components/AiSettingsPanel'
import { ReportsPage } from './components/ReportsPage'

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<SidebarLayout />}>
          <Route index element={<Navigate to="/sources" replace />} />
          <Route path="/sources" element={<ProjectSourcePage />} />
          <Route path="/coding" element={<CodingWorkspacePage />} />
          <Route path="/query" element={<QueryWorkspacePage />} />
          <Route path="/visualizations" element={<VisualizationDashboard />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/ai" element={<AiSettingsPanel />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default App
