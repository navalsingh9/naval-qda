import { useEffect, useRef, useState } from 'react'
import { ClassificationSheetPanel } from './ClassificationSheetPanel'
import { CasesPanel } from './CasesPanel'
import { FrameworkMatrixPanel } from './FrameworkMatrixPanel'
import { useProjectStore } from '../stores/useProjectStore'
import { useSourceStore } from '../stores/useSourceStore'
import { useCaseStore } from '../stores/useCaseStore'

type Tab = 'sources' | 'cases' | 'framework'

export function ProjectSourcePage() {
  const { selectedProjectId, createProject, loadProjects, error: projectError, clearError: clearProjectError } = useProjectStore()
  const { sources, loading, error: sourceError, loadSources, importSources, clearError: clearSourceError } = useSourceStore()
  const { cases, loadCases, linkSource } = useCaseStore()
  const [projectName, setProjectName] = useState('')
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)
  const [activeTab, setActiveTab] = useState<Tab>('sources')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    void loadProjects()
  }, [loadProjects])

  useEffect(() => {
    if (selectedProjectId) {
      void loadSources(selectedProjectId)
    }
  }, [selectedProjectId, loadSources])

  useEffect(() => {
    if (selectedProjectId) {
      void loadCases(selectedProjectId)
    }
  }, [selectedProjectId, loadCases])

  const handleCreateProject = async () => {
    if (!projectName.trim()) return
    await createProject(projectName)
    setProjectName('')
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0 || !selectedProjectId) return
    await importSources(selectedProjectId, files)
    event.target.value = ''
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!selectedProjectId) return
    event.preventDefault()
    setIsDraggingOver(true)
  }

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDraggingOver(false)
  }

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDraggingOver(false)
    const files = event.dataTransfer.files
    if (!files || files.length === 0 || !selectedProjectId) return
    await importSources(selectedProjectId, files)
  }

  return (
    <section className="page-card">
      <div className="page-header">
        <div>
          <p className="eyebrow">📁 Project & source management</p>
          <h2>Sources</h2>
          <p className="description">Import documents, organize cases, and manage your coding framework</p>
        </div>
        <button type="button" onClick={handleImportClick} disabled={!selectedProjectId || loading}>
          📥 Import source
        </button>
      </div>

      <input ref={fileInputRef} type="file" accept=".txt,.docx,.pdf" multiple hidden onChange={handleFileSelected} />

      <div className="panel">
        <h3>Create project</h3>
        <div className="inline-form">
          <input value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="New project name" />
          <button type="button" onClick={handleCreateProject} disabled={!projectName.trim()}>
            Create
          </button>
        </div>
        {projectError ? <p className="error-text">{projectError}</p> : null}
        {projectError ? <button type="button" className="ghost-button" onClick={() => clearProjectError()}>Dismiss</button> : null}
      </div>

      <div className="subtab-bar" role="tablist">
        <button type="button" role="tab" aria-selected={activeTab === 'sources'} className={`subtab${activeTab === 'sources' ? ' active' : ''}`} onClick={() => setActiveTab('sources')}>
          Imported sources
          <span className="badge">{sources.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={activeTab === 'cases'} className={`subtab${activeTab === 'cases' ? ' active' : ''}`} onClick={() => setActiveTab('cases')}>
          Cases &amp; classification sheet
          <span className="badge">{cases.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={activeTab === 'framework'} className={`subtab${activeTab === 'framework' ? ' active' : ''}`} onClick={() => setActiveTab('framework')}>
          Framework matrix
        </button>
      </div>

      {activeTab === 'sources' ? (
        <div
          className={`panel drop-zone${isDraggingOver ? ' drop-zone-active' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={(event) => void handleDrop(event)}
        >
          {sourceError ? <p className="error-text">{sourceError}</p> : null}
          {sourceError ? <button type="button" className="ghost-button" onClick={() => clearSourceError()}>Dismiss</button> : null}
          <ul className="list source-list">
            {sources.map((source) => (
              <li key={source.id} className="source-list-row">
                <div className="source-list-info">
                  <strong>{source.title}</strong>
                  <span className="source-path" title={source.file_path}>{source.file_path.split(/[\\/]/).pop()}</span>
                </div>
                <select
                  className="source-list-link"
                  value=""
                  onChange={(event) => {
                    const caseId = Number(event.target.value)
                    if (caseId) {
                      void linkSource(source.id, caseId)
                      setRefreshToken((t) => t + 1)
                    }
                  }}
                >
                  <option value="">Link to case…</option>
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </li>
            ))}
            {!sources.length && !loading ? (
              <li className="empty">
                {selectedProjectId ? 'No sources imported yet. Drag files here, or use Import source.' : 'Select a project first.'}
              </li>
            ) : null}
          </ul>
        </div>
      ) : activeTab === 'cases' ? (
        <div className="panel">
          <div className="panel-grid">
            <CasesPanel projectId={selectedProjectId} onChange={() => setRefreshToken((t) => t + 1)} />
          </div>
          <ClassificationSheetPanel key={refreshToken} />
        </div>
      ) : (
        <FrameworkMatrixPanel />
      )}
    </section>
  )
}
