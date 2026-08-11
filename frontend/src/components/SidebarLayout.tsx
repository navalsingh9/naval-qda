import { useState, useRef, useEffect } from 'react'
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
  const [sidebarWidth, setSidebarWidth] = useState<number>(280)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartX, setDragStartX] = useState<number>(0)
  const [dragStartWidth, setDragStartWidth] = useState<number>(0)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const dragHandleRef = useRef<HTMLDivElement>(null)
  
  const MIN_WIDTH = 200
  const MAX_WIDTH = 400

  useEffect(() => {
    const savedWidth = localStorage.getItem('sidebar-width')
    if (savedWidth) {
      setSidebarWidth(Number(savedWidth))
    }
  }, [])

  useEffect(() => {
    if (!isDragging) {
      localStorage.setItem('sidebar-width', sidebarWidth.toString())
    }
  }, [sidebarWidth, isDragging])

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    setDragStartX(e.clientX)
    // If collapsed, start from the collapsed width (64px), otherwise use current sidebarWidth
    const startWidth = collapsed ? 64 : sidebarWidth
    setDragStartWidth(startWidth)
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return
    const delta = e.clientX - dragStartX
    const newWidth = dragStartWidth + delta
    if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
      setSidebarWidth(newWidth)
      if (collapsed) {
        setCollapsed(false)
      }
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    if (isDragging) {
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    } else {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    return () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragStartX, dragStartWidth])

  const handleDeleteClick = (projectId: number) => {
    setPendingDeleteId(projectId)
  }

  const handleConfirmDelete = async (projectId: number) => {
    await deleteProject(projectId)
    setPendingDeleteId(null)
  }

  return (
    <div 
      className={collapsed ? 'app-shell app-shell-collapsed' : 'app-shell'}
      style={{ '--sidebar-width': `${sidebarWidth}px` } as React.CSSProperties}
    >
      <aside className="sidebar" ref={sidebarRef} style={{ position: 'relative', width: collapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)' }}>
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
        <button
          type="button"
          className="sidebar-toggle"
          onClick={() => setCollapsed(false)}
          aria-label="Expand sidebar"
          title="Expand sidebar"
        >
          ☰
        </button>

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
        <div 
          className="sidebar-resize-handle"
          ref={dragHandleRef}
          onMouseDown={handleMouseDown}
        />
      </aside>

      <main className="content-panel">
        <Outlet />
      </main>
    </div>
  )
}
