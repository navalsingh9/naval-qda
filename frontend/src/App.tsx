import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { SidebarLayout } from './components/SidebarLayout'
import { CodingWorkspacePage } from './components/CodingWorkspacePage'
import { PlaceholderPage } from './components/PlaceholderPage'
import { ProjectSourcePage } from './components/ProjectSourcePage'
import { QueryWorkspacePage } from './components/QueryWorkspacePage'
import { AiSettingsPanel } from './components/AiSettingsPanel'

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<SidebarLayout />}>
          <Route index element={<Navigate to="/sources" replace />} />
          <Route path="/sources" element={<ProjectSourcePage />} />
          <Route path="/coding" element={<CodingWorkspacePage />} />
          <Route path="/nodes" element={<PlaceholderPage title="Nodes" />} />
          <Route path="/query" element={<QueryWorkspacePage />} />
          <Route path="/ai" element={<AiSettingsPanel />} />
          <Route path="/reports" element={<PlaceholderPage title="Reports" />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default App
