import { useState } from 'react'
import { AlertTriangle, Check, Folder, FolderPlus, Trash2 } from 'lucide-react'
import { useProjectStore } from '../stores/useProjectStore'

// Project Explorer used to live inside a modal that only opened when you
// clicked the active project's own name in the sidebar — which made
// browsing/creating/deleting projects feel like a sub-feature of whichever
// project happened to be active, backwards from how it actually works.
// It's now a real page/nav destination, same as Sources, Coding, etc.
export function ProjectExplorerPage() {
  const { projects, selectedProjectId, selectProject, deleteProject, createProject } = useProjectStore()
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)
  const [newProjectName, setNewProjectName] = useState('')

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return
    await createProject(newProjectName)
    setNewProjectName('')
  }

  const handleConfirmDelete = async (projectId: number) => {
    await deleteProject(projectId)
    setPendingDeleteId(null)
  }

  return (
    <section className="page-card">
      <div className="page-header">
        <div>
          <p className="eyebrow">Workspace</p>
          <h2>Project Explorer</h2>
          <p className="description">Browse your projects, switch which one is active, or create a new one.</p>
        </div>
      </div>

      <div className="panel">
        <h3>Create project</h3>
        <div className="inline-form">
          <input
            value={newProjectName}
            onChange={(event) => setNewProjectName(event.target.value)}
            placeholder="New project name"
            onKeyDown={(event) => { if (event.key === 'Enter') void handleCreateProject() }}
          />
          <button type="button" onClick={() => void handleCreateProject()} disabled={!newProjectName.trim()}>
            <FolderPlus size={15} strokeWidth={2} style={{ marginRight: '6px', verticalAlign: '-2px' }} />
            Create
          </button>
        </div>
      </div>

      <div className="panel">
        <h3>All projects</h3>
        {projects.length === 0 ? (
          <p className="description">No projects yet — create one above.</p>
        ) : (
          <ul className="project-explorer-list">
            {projects.map((project) => (
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
                      onClick={() => selectProject(project.id)}
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
                      onClick={() => setPendingDeleteId(project.id)}
                      style={{ color: 'var(--error-600)' }}
                    >
                      <Trash2 size={15} strokeWidth={2} />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
