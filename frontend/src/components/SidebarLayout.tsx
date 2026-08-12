import { useState, useRef, useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  FolderOpen,
  Tag,
  Search,
  BarChart3,
  GitCompareArrows,
  ClipboardList,
  Bot,
  Microscope,
  AlertTriangle,
  Folder,
  FolderPlus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  PanelLeftOpen,
  X,
  Check,
} from 'lucide-react'
import { useProjectStore } from '../stores/useProjectStore'

// Navigation items with professional, consistent line icons
const navItems = [
  { to: '/sources', label: 'Sources', icon: FolderOpen },
  { to: '/coding', label: 'Coding', icon: Tag },
  { to: '/query', label: 'Query', icon: Search },
  { to: '/visualizations', label: 'Visualizations', icon: BarChart3 },
  { to: '/similarity', label: 'Similarity', icon: GitCompareArrows },
  { to: '/reports', label: 'Reports', icon: ClipboardList },
  { to: '/ai', label: 'AI', icon: Bot },
]

export function SidebarLayout() {
  const { projects, selectedProjectId, selectProject, deleteProject, createProject } = useProjectStore()
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [explorerOpen, setExplorerOpen] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
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

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return
    await createProject(newProjectName)
    setNewProjectName('')
  }

  const activeProject = projects.find((project) => project.id === selectedProjectId) ?? null

  return (
    <div 
      className={collapsed ? 'app-shell app-shell-collapsed' : 'app-shell'}
      style={{ '--sidebar-width': `${sidebarWidth}px` } as React.CSSProperties}
    >
      <aside className="sidebar" ref={sidebarRef} style={{ position: 'relative', width: collapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)' }}>
        <div className="sidebar-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p className="eyebrow">
              <span style={{ fontSize: '1.2em', display: 'inline-flex', verticalAlign: '-3px' }}><Microscope size={18} strokeWidth={2} /></span> NAVAL-QDA
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
                display: 'inline-flex',
                alignItems: 'center',
                lineHeight: 1
              }}
            >
              {collapsed ? <ChevronRight size={16} strokeWidth={2} /> : <ChevronLeft size={16} strokeWidth={2} />}
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
          <PanelLeftOpen size={18} strokeWidth={2} />
        </button>

        <div className="sidebar-section">
          <h2>Project</h2>
          <button
            type="button"
            className="active-project-row"
            onClick={() => setExplorerOpen(true)}
            title={activeProject ? `${activeProject.name} — click to browse projects` : 'Click to browse or create a project'}
          >
            <span className="project-icon" style={{ display: 'inline-flex', flexShrink: 0 }}><Folder size={15} strokeWidth={2} /></span>
            <span className="active-project-name">
              {activeProject ? activeProject.name : 'No project selected'}
            </span>
          </button>
        </div>

        {explorerOpen && (
          <div className="modal-overlay" onClick={() => setExplorerOpen(false)}>
            <div className="modal project-explorer" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Project Explorer</h3>
                <button type="button" className="chart-action-btn" onClick={() => setExplorerOpen(false)} aria-label="Close">
                  <X size={18} strokeWidth={2} />
                </button>
              </div>

              <div className="inline-form" style={{ marginBottom: 'var(--space-4)' }}>
                <input
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="New project name"
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleCreateProject() }}
                />
                <button type="button" className="primary-button" onClick={() => void handleCreateProject()} disabled={!newProjectName.trim()}>
                  <FolderPlus size={15} strokeWidth={2} style={{ marginRight: '6px', verticalAlign: '-2px' }} />
                  Create
                </button>
              </div>

              <ul className="project-explorer-list">
                {projects.length === 0 ? (
                  <li className="empty">No projects yet — create one above.</li>
                ) : (
                  projects.map((project) => (
                    <li key={project.id}>
                      {pendingDeleteId === project.id ? (
                        <div className="project-delete-confirm">
                          <span style={{ fontWeight: 'var(--font-semibold)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <AlertTriangle size={16} strokeWidth={2} /> Delete "{project.name}" and ALL its data? This cannot be undone.
                          </span>
                          <div className="inline-form">
                            <button
                              type="button"
                              className="ghost-button"
                              onClick={() => void handleConfirmDelete(project.id)}
                              style={{ background: 'var(--error-50)', color: 'var(--error-700)', borderColor: 'var(--error-200)', fontWeight: 'var(--font-semibold)' }}
                            >
                              Yes, Delete Project
                            </button>
                            <button type="button" className="ghost-button" onClick={() => setPendingDeleteId(null)}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className={`project-explorer-row${project.id === selectedProjectId ? ' active' : ''}`}>
                          <button
                            type="button"
                            className="project-explorer-select"
                            onClick={() => { selectProject(project.id); setExplorerOpen(false) }}
                          >
                            <span className="project-icon" style={{ display: 'inline-flex', flexShrink: 0 }}><Folder size={16} strokeWidth={2} /></span>
                            <span className="project-explorer-name">{project.name}</span>
                            {project.id === selectedProjectId && (
                              <span className="project-explorer-active-badge">
                                <Check size={13} strokeWidth={2.5} /> Active
                              </span>
                            )}
                          </button>
                          <button
                            type="button"
                            className="project-delete-button"
                            title={`Delete ${project.name}`}
                            aria-label={`Delete ${project.name}`}
                            onClick={() => handleDeleteClick(project.id)}
                            style={{ color: 'var(--error-600)' }}
                          >
                            <Trash2 size={15} strokeWidth={2} />
                          </button>
                        </div>
                      )}
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        )}

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink 
                key={item.to} 
                to={item.to}
                className={({ isActive }) => (isActive ? 'active' : '')}
              >
                <span className="nav-icon" style={{ display: 'inline-flex', marginRight: collapsed ? '0' : 'var(--space-2)' }}>
                  <Icon size={17} strokeWidth={2} />
                </span>
                <span className="nav-label">{item.label}</span>
              </NavLink>
            )
          })}
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
          v{import.meta.env.VITE_APP_VERSION || '—'}
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
