import { useState, useRef, useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutGrid,
  FolderOpen,
  Tag,
  Search,
  BarChart3,
  GitCompareArrows,
  ClipboardList,
  Bot,
  Microscope,
  Folder,
  ChevronLeft,
  ChevronRight,
  PanelLeftOpen,
} from 'lucide-react'
import { useProjectStore } from '../stores/useProjectStore'

// Navigation items with professional, consistent line icons. Project
// Explorer sits first — it's the thing everything else is scoped under,
// not a sub-feature reachable only by clicking the active project.
const navItems = [
  { to: '/projects', label: 'Project Explorer', icon: LayoutGrid },
  { to: '/sources', label: 'Sources', icon: FolderOpen },
  { to: '/coding', label: 'Coding', icon: Tag },
  { to: '/query', label: 'Query', icon: Search },
  { to: '/visualizations', label: 'Visualizations', icon: BarChart3 },
  { to: '/similarity', label: 'Similarity', icon: GitCompareArrows },
  { to: '/reports', label: 'Reports', icon: ClipboardList },
  { to: '/ai', label: 'AI', icon: Bot },
]

export function SidebarLayout() {
  const { projects, selectedProjectId } = useProjectStore()
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

        {/* Purely informational now — not a hidden trigger for Project
            Explorer, which is its own nav destination below. */}
        <div className="sidebar-section">
          <h2>Active project</h2>
          <div className="active-project-row" title={activeProject ? activeProject.name : 'No project selected — pick one in Project Explorer'}>
            <span className="project-icon" style={{ display: 'inline-flex', flexShrink: 0 }}><Folder size={15} strokeWidth={2} /></span>
            <span className="active-project-name">
              {activeProject ? activeProject.name : 'No project selected'}
            </span>
          </div>
        </div>

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
