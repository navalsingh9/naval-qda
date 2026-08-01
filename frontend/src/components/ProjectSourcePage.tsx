import { useEffect, useRef, useState } from 'react'
import { ClassificationSheetPanel } from './ClassificationSheetPanel'
import { useProjectStore } from '../stores/useProjectStore'
import { useSourceStore } from '../stores/useSourceStore'

export function ProjectSourcePage() {
  const { selectedProjectId, createProject, loadProjects, error: projectError, clearError: clearProjectError } = useProjectStore()
  const { sources, loading, error: sourceError, loadSources, importSource, clearError: clearSourceError } = useSourceStore()
  const [projectName, setProjectName] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    void loadProjects()
  }, [loadProjects])

  useEffect(() => {
    if (selectedProjectId) {
      void loadSources(selectedProjectId)
    }
  }, [selectedProjectId, loadSources])

  const handleCreateProject = async () => {
    if (!projectName.trim()) return
    await createProject(projectName)
    setProjectName('')
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !selectedProjectId) return
    await importSource(selectedProjectId, file)
    event.target.value = ''
  }

  return (
    <section className="page-card">
      <div className="page-header">
        <div>
          <p className="eyebrow">Project &amp; source management</p>
          <h2>Sources</h2>
        </div>
        <button type="button" onClick={handleImportClick} disabled={!selectedProjectId || loading}>
          Import source
        </button>
      </div>

      <input ref={fileInputRef} type="file" accept=".txt,.docx,.pdf" hidden onChange={handleFileSelected} />

      <div className="panel-grid">
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

        <div className="panel">
          <h3>Imported sources</h3>
          {sourceError ? <p className="error-text">{sourceError}</p> : null}
          {sourceError ? <button type="button" className="ghost-button" onClick={() => clearSourceError()}>Dismiss</button> : null}
          <ul className="list">
            {sources.map((source) => (
              <li key={source.id}>
                <strong>{source.title}</strong>
                <span>{source.file_path}</span>
              </li>
            ))}
            {!sources.length && !loading ? <li className="empty">No sources imported yet.</li> : null}
          </ul>
        </div>
      </div>

      <div className="panel-grid sheet-grid">
        <ClassificationSheetPanel />
      </div>
    </section>
  )
}
