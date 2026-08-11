import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useProjectStore } from '../stores/useProjectStore'

// Navigation items with professional unique icons
const navItems = [
  { to: '/sources', label: 'Sources', icon: '📂' },
  { to: '/coding', label: 'Coding', icon: '🏷️' },
  { to: '/query', label: 'Query', icon: '🔍' },
  { to: '/visualizations', label: 'Visualizations', icon: '📊' },
  { to: '/reports', label: 'Reports', icon: '📋' },
  { to: '/ai', label: 'AI', icon: '🤖' },
]

export function SidebarLayout() {
  const { projects, selectedProjectId, selectProject, deleteProject } = useProjectStore()
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)
  const [collapsed, setCollapsed] = useState(false)

  const handleDeleteClick = (projectId: number) => {
    setPendingDeleteId(projectId)
  }

  const handleConfirmDelete = async (projectId: number) => {
    await deleteProject(projectId)
    setPendingDeleteId(null)
  }

  return (
    <div className={collapsed ? 'app-shell app-shell-collapsed' : 'app-shell'}>
      <aside className="sidebar">
        <div className="sidebar-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p className="eyebrow">
              <span style={{ fontSize: '1.2em' }}>🔬</span> NAVAL-QDA
            </p>
            <button
              type="button"
              className="sidebar-collapse-toggle"
              onClick={() => setCollapsed((value) => !value)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              style={{ 
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: 'var(--space-1)',
                fontSize: '1.2em',
                lineHeight: 1
              }}
            >
              {collapsed ? '›' : '‹'}
            </button>
          </div>
          <h1>Workspace</h1>
        </div>

        <div className="sidebar-section">
          <h2>Projects</h2>
          <ul className="sidebar-list">
            {projects.length === 0 ? (
              <li>
                <button 
                  type="button" 
                  className="ghost-button"
                  style={{ 
                    width: '100%',
                    textAlign: 'center',
                    padding: 'var(--space-3)',
                    color: 'var(--text-muted)'
                  }}
                >
                  No projects yet
                </button>
              </li>
            ) : (
              projects.map((project) => (
                <li key={project.id} className={project.id === selectedProjectId ? 'active' : ''}>
                  {pendingDeleteId === project.id ? (
                    <div className="project-delete-confirm">
                      <span style={{ fontWeight: 'var(--font-semibold)' }}>
                        ⚠️ Are you sure? This will permanently delete "{project.name}" and ALL its data.
                      </span>
                      <div className="inline-form">
                        <button 
                          type="button" 
                          className="ghost-button" 
                          onClick={() => void handleConfirmDelete(project.id)}
                          style={{
                            background: 'var(--error-50)', 
                            color: 'var(--error-700)',
                            borderColor: 'var(--error-200)',
                            fontWeight: 'var(--font-semibold)'
                          }}
                        >
                          Yes, Delete Project
                        </button>
                        <button 
                          type="button" 
                          className="ghost-button" 
                          onClick={() => setPendingDeleteId(null)}
                          style={{ fontWeight: 'var(--font-medium)' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="project-row">
                      <button 
                        type="button" 
                        onClick={() => selectProject(project.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-2)',
                          fontWeight: project.id === selectedProjectId ? 'var(--font-semibold)' : 'var(--font-medium)',
                          flex: 1,
                          minWidth: 0
                        }}
                      >
                        <span className="project-icon" style={{ fontSize: '0.9em' }}>📁</span>
                        <span className="project-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {project.name}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="project-delete-button"
                        title={`Delete ${project.name} - This cannot be undone`}
                        aria-label={`Delete ${project.name}`}
                        onClick={() => handleDeleteClick(project.id)}
                        style={{
                          background: 'var(--error-50)',
                          color: 'var(--error-600)',
                          border: '1px solid var(--error-200)',
                          padding: 'var(--space-1) var(--space-3)',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '1.2em'
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink 
              key={item.to} 
              to={item.to}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              <span className="nav-icon" style={{ fontSize: '1.1em', marginRight: collapsed ? '0' : 'var(--space-2)' }}>
                {item.icon}
              </span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User info or footer */}
        <div 
          style={{
            marginTop: 'auto',
            paddingTop: 'var(--space-4)',
            borderTop: '1px solid var(--border-light)',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
            textAlign: 'center'
          }}
        >
          v{import.meta.env.VITE_APP_VERSION || '0.4.8'}
        </div>
      </aside>

      <main className="content-panel">
        <Outlet />
      </main>
    </div>
  )
}
