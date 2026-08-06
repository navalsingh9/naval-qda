import { useState } from 'react'
import { useCaseStore } from '../stores/useCaseStore'

type CasesPanelProps = {
  projectId: number | null
  onChange: () => void
}

export function CasesPanel({ projectId, onChange }: CasesPanelProps) {
  const { cases, createCase, createAttribute, error, clearError } = useCaseStore()
  const [caseName, setCaseName] = useState('')
  const [attributeName, setAttributeName] = useState('')
  const [attributeType, setAttributeType] = useState('text')

  if (projectId === null) {
    return (
      <div className="panel">
        <h3>Cases</h3>
        <p className="description">Select a project first.</p>
      </div>
    )
  }

  const handleAddCase = async () => {
    if (!caseName.trim()) return
    await createCase(projectId, caseName)
    setCaseName('')
    onChange()
  }

  const handleAddAttribute = async () => {
    if (!attributeName.trim()) return
    await createAttribute(projectId, attributeName, attributeType)
    setAttributeName('')
    onChange()
  }

  return (
    <div className="panel">
      <h3>Cases</h3>
      {error ? <p className="error-text">{error}</p> : null}
      {error ? <button type="button" className="ghost-button" onClick={() => clearError()}>Dismiss</button> : null}

      <div className="case-chip-list">
        {cases.map((caseItem) => (
          <span key={caseItem.id} className="case-chip">
            {caseItem.name}
          </span>
        ))}
        {!cases.length ? <p className="description">No cases yet.</p> : null}
      </div>

      <label className="field-label">
        Case name
        <div className="inline-form" style={{ marginBottom: 0 }}>
          <input value={caseName} onChange={(event) => setCaseName(event.target.value)} placeholder="e.g. P1" />
          <button type="button" onClick={() => void handleAddCase()} disabled={!caseName.trim()}>
            Add case
          </button>
        </div>
      </label>

      <label className="field-label">
        Attribute name
        <div className="inline-form" style={{ marginBottom: 0 }}>
          <input value={attributeName} onChange={(event) => setAttributeName(event.target.value)} placeholder="e.g. Rank" />
          <select value={attributeType} onChange={(event) => setAttributeType(event.target.value)}>
            <option value="text">Text</option>
            <option value="numeric">Numeric</option>
            <option value="categorical">Categorical</option>
          </select>
          <button type="button" onClick={() => void handleAddAttribute()} disabled={!attributeName.trim()}>
            Add attribute
          </button>
        </div>
      </label>
    </div>
  )
}
