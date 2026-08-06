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
  const [valueType, setValueType] = useState('text')

  if (!projectId) {
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
    await createAttribute(projectId, attributeName, valueType)
    setAttributeName('')
    onChange()
  }

  return (
    <div className="panel">
      <h3>Cases</h3>
      {error ? <p className="error-text">{error}</p> : null}
      {error ? <button type="button" className="ghost-button" onClick={() => clearError()}>Dismiss</button> : null}

      <div className="chip-list">
        {cases.map((caseItem) => (
          <span key={caseItem.id} className="chip">{caseItem.name}</span>
        ))}
        {!cases.length ? <span className="description">No cases yet.</span> : null}
      </div>

      <div className="inline-form">
        <input value={caseName} onChange={(event) => setCaseName(event.target.value)} placeholder="Case name" />
        <button type="button" onClick={() => void handleAddCase()} disabled={!caseName.trim()}>
          Add case
        </button>
      </div>

      <div className="inline-form">
        <input value={attributeName} onChange={(event) => setAttributeName(event.target.value)} placeholder="Attribute name" />
        <select value={valueType} onChange={(event) => setValueType(event.target.value)}>
          <option value="text">Text</option>
          <option value="numeric">Numeric</option>
          <option value="categorical">Categorical</option>
        </select>
        <button type="button" onClick={() => void handleAddAttribute()} disabled={!attributeName.trim()}>
          Add attribute
        </button>
      </div>
    </div>
  )
}
