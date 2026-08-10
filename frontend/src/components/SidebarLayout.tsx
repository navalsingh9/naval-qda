import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useProjectStore } from '../stores/useProjectStore'

// Navigation items with icons (using emoji for simplicity)
const navItems = [
  { to: '/sources', label: 'Sources', icon: '📁' },
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
        <button
          type="button"
          className="sidebar-collapse-toggle"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '›' : '‹'}
        </button>
        
        <div className="sidebar-header">
          <p className="eyebrow">
            <span style={{ fontSize: '1.2em' }}>🎯</span> NAVAL-QDA
          </p>
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
                      <span>Delete "{project.name}" and everything in it?</span>
                      <div className="inline-form">
                        <button 
                          type="button" 
                          className="ghost-button" 
                          onClick={() => void handleConfirmDelete(project.id)}
                          style={{ background: 'var(--error-50)', color: 'var(--error-700)' }}
                        >
                          Delete
                        </button>
                        <button type="button" className="ghost-button" onClick={() => setPendingDeleteId(null)}>
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
                          fontWeight: project.id === selectedProjectId ? 'var(--font-semibold)' : 'var(--font-medium)'
                        }}
                      >
                        <span style={{ fontSize: '0.9em' }}>📂</span>
                        {project.name}
                      </button>
                      <button
                        type="button"
                        className="project-delete-button"
                        title={`Delete ${project.name}`}
                        aria-label={`Delete ${project.name}`}
                        onClick={() => handleDeleteClick(project.id)}
                      >
                        ✕
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
              {!collapsed && <span style={{ fontSize: '1.1em', marginRight: 'var(--space-2)' }}>{item.icon}</span>}
              <span>{item.label}</span>
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
