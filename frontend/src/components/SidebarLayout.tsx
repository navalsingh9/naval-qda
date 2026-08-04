import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useProjectStore } from '../stores/useProjectStore'

export function SidebarLayout() {
  const { projects, selectedProjectId, selectProject, deleteProject } = useProjectStore()
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)

  const handleDeleteClick = (projectId: number) => {
    setPendingDeleteId(projectId)
  }

  const handleConfirmDelete = async (projectId: number) => {
    await deleteProject(projectId)
    setPendingDeleteId(null)
  }

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
                {pendingDeleteId === project.id ? (
                  <div className="project-delete-confirm">
                    <span>Delete "{project.name}" and everything in it?</span>
                    <div className="inline-form">
                      <button type="button" className="ghost-button" onClick={() => void handleConfirmDelete(project.id)}>
                        Delete
                      </button>
                      <button type="button" className="ghost-button" onClick={() => setPendingDeleteId(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="project-row">
                    <button type="button" onClick={() => selectProject(project.id)}>
                      {project.name}
                    </button>
                    <button
                      type="button"
                      className="project-delete-button"
                      title={`Delete ${project.name}`}
                      aria-label={`Delete ${project.name}`}
                      onClick={() => handleDeleteClick(project.id)}
                    >
                      ×
                    </button>
                  </div>
                )}
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
