import { NavLink, Outlet } from 'react-router-dom'
import { useProjectStore } from '../stores/useProjectStore'

export function SidebarLayout() {
  const { projects, selectedProjectId, selectProject } = useProjectStore()

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <p className="eyebrow">NAVAL-QDA</p>
          <h1>Workspace</h1>
        </div>

        <div className="sidebar-section">
          <h2>Projects</h2>
          <ul className="sidebar-list">
            {projects.map((project) => (
              <li key={project.id} className={project.id === selectedProjectId ? 'active' : ''}>
                <button type="button" onClick={() => selectProject(project.id)}>
                  {project.name}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/sources">Sources</NavLink>
          <NavLink to="/coding">Coding</NavLink>
          <NavLink to="/query">Query</NavLink>
          <NavLink to="/visualizations">Visualizations</NavLink>
          <NavLink to="/ai">AI</NavLink>
          <NavLink to="/reports">Reports</NavLink>
        </nav>
      </aside>

      <main className="content-panel">
        <Outlet />
      </main>
    </div>
  )
}
