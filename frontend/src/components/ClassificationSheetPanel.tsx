import { useEffect, useMemo, useState } from 'react'
import { useProjectStore } from '../stores/useProjectStore'

export function ClassificationSheetPanel() {
  const { selectedProjectId } = useProjectStore()
  const [attributes, setAttributes] = useState<Array<{ id: number; name: string; valueType: string }>>([])
  const [cases, setCases] = useState<Array<{ id: number; name: string; description: string | null; values: Record<string, string | null> }>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draftValues, setDraftValues] = useState<Record<string, string>>({})

  const projectId = selectedProjectId ?? 0

  useEffect(() => {
    if (!selectedProjectId) return

    const loadSheet = async () => {
      setLoading(true)
      setError(null)
      try {
        const sheet = await window.api.cases.getClassificationSheet(selectedProjectId) as {
          attributes?: Array<{ id: number; name: string; valueType: string }>
          cases?: Array<{ id: number; name: string; description: string | null; values: Record<string, string | null> }>
        }
        const nextCases = sheet.cases ?? []
        setAttributes(sheet.attributes ?? [])
        setCases(nextCases)
        const initialDraft = Object.fromEntries(
          (nextCases as Array<{ id: number; values: Record<string, string | null> }>).flatMap((item) =>
            Object.entries(item.values).map(([attributeName, value]) => [`${item.id}:${attributeName}`, value ?? ''])
          )
        )
        setDraftValues(initialDraft)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }

    void loadSheet()
  }, [selectedProjectId])

  const handleChange = async (caseId: number, attributeId: number, attributeName: string, value: string) => {
    if (!selectedProjectId) return

    const key = `${caseId}:${attributeName}`
    setDraftValues((current) => ({ ...current, [key]: value }))

    try {
      await window.api.cases.setAttributeValue({
        caseId,
        attributeId,
        value,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const attributeNames = useMemo(() => attributes.map((attribute) => attribute.name), [attributes])

  return (
    <div className="panel">
      <div className="page-header">
        <h3>Classification sheet</h3>
        {loading ? <span className="description">Loading…</span> : null}
      </div>
      {error ? <p className="error-text">{error}</p> : null}
      {projectId ? (
        <>
        <p className="description">A case is your unit of analysis — usually one participant or one interview. Create cases and link sources to them from the panel above; each case becomes a row here.</p>
        <div className="sheet-table-wrap">
          <table className="sheet-table">
            <thead>
              <tr>
                <th>Case</th>
                {attributes.map((attribute) => (
                  <th key={attribute.id}>{attribute.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cases.map((caseItem) => (
                <tr key={caseItem.id}>
                  <td>{caseItem.name}</td>
                  {attributes.map((attribute) => {
                    const key = `${caseItem.id}:${attribute.name}`
                    return (
                      <td key={attribute.id}>
                        <input
                          value={draftValues[key] ?? ''}
                          onChange={(event) => handleChange(caseItem.id, attribute.id, attribute.name, event.target.value)}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      ) : (
        <p className="description">Create or select a project to see the classification sheet.</p>
      )}
      {!attributeNames.length && projectId ? <p className="description">Add attributes from the backend to populate this sheet.</p> : null}
    </div>
  )
}
