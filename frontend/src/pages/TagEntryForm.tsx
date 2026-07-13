import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, apiErrorMessage } from '../lib/api'
import type { ClaimResponse, EquipmentAttribute, TagRow } from '../lib/types'

interface Props {
  claim: ClaimResponse
  jobId: string
  onDone: () => void
  onReleased: () => void
}

// Live preview mirrors the backend formatter, but the backend remains
// authoritative for the saved value.
function buildPreview(attributes: EquipmentAttribute[], values: Record<string, string>): string {
  return [...attributes]
    .sort((a, b) => a.display_order - b.display_order)
    .map((a) => {
      const key = a.attribute_name.trim().toUpperCase()
      const value = (values[key] ?? '').trim().replace(/\s+/g, ' ')
      return value ? `${key}:${value}` : ''
    })
    .filter(Boolean)
    .join(',')
}

export function TagEntryForm({ claim, jobId, onDone, onReleased }: Props) {
  const queryClient = useQueryClient()
  const { attributes } = claim
  const [tag, setTag] = useState<TagRow>(claim.tag)
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const a of attributes) {
      const key = a.attribute_name.toUpperCase()
      initial[key] = claim.tag.attribute_values_json?.[key] ?? ''
    }
    return initial
  })
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const rowVersionRef = useRef(tag.row_version)
  rowVersionRef.current = tag.row_version

  // Heartbeat every 2 minutes so the claim does not expire while editing.
  useEffect(() => {
    const interval = setInterval(() => {
      api.post<TagRow>(`/workbooks/tags/${tag.id}/heartbeat`).then(
        ({ data }) => setTag((t) => ({ ...t, claim_expires_at: data.claim_expires_at })),
        () => undefined,
      )
    }, 120_000)
    return () => clearInterval(interval)
  }, [tag.id])

  const preview = useMemo(() => buildPreview(attributes, values), [attributes, values])
  const missingRequired = attributes.filter(
    (a) => a.is_required && !(values[a.attribute_name.toUpperCase()] ?? '').trim(),
  )
  const commaProblem = Object.values(values).some((v) => v.includes(','))

  const save = useMutation({
    mutationFn: async (action: 'draft' | 'complete') => {
      const { data } = await api.post<TagRow>(`/workbooks/tags/${tag.id}/${action}`, {
        values,
        row_version: rowVersionRef.current,
      })
      return { data, action }
    },
    onSuccess: ({ data, action }) => {
      setError(null)
      setTag(data)
      void queryClient.invalidateQueries({ queryKey: ['tags', jobId] })
      void queryClient.invalidateQueries({ queryKey: ['equipment-descriptions', jobId] })
      if (action === 'complete') {
        onDone()
      } else {
        setNotice('Draft saved.')
      }
    },
    onError: (err) => setError(apiErrorMessage(err)),
  })

  const release = useMutation({
    mutationFn: async () => api.post(`/workbooks/tags/${tag.id}/release`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tags', jobId] })
      void queryClient.invalidateQueries({ queryKey: ['equipment-descriptions', jobId] })
      onReleased()
    },
    onError: (err) => setError(apiErrorMessage(err)),
  })

  // Ctrl/Cmd+Enter → Complete and Next.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && missingRequired.length === 0) {
      save.mutate('complete')
    }
  }

  return (
    <div className="card entry-form" onKeyDown={onKeyDown}>
      <div className="entry-head">
        <div>
          <h2>{tag.tag_number}</h2>
          <div className="muted small">
            {tag.equipment_description} · Excel row {tag.excel_row_number} · v{tag.row_version}
          </div>
        </div>
        <button className="btn btn-ghost" onClick={() => release.mutate()} disabled={release.isPending}>
          Release Tag
        </button>
      </div>

      <div className="attr-grid">
        {attributes.map((a) => {
          const key = a.attribute_name.toUpperCase()
          const value = values[key] ?? ''
          const invalid = value.includes(',')
          const requiredMissing = a.is_required && !value.trim()
          return (
            <label key={a.id} className="attr-field">
              <span>
                {a.display_label}
                {a.is_required && <b className="req"> *</b>}
              </span>
              <input
                value={value}
                placeholder={a.placeholder ?? ''}
                aria-invalid={invalid}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
              />
              {invalid && <span className="field-error">Commas are not allowed in a value.</span>}
              {!invalid && requiredMissing && <span className="field-hint">Required</span>}
            </label>
          )
        })}
      </div>

      <div className="preview">
        <div className="muted small">Live preview (backend generates the final value)</div>
        <code>{preview || '—'}</code>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      <div className="entry-actions">
        <button className="btn" onClick={() => save.mutate('draft')} disabled={save.isPending || commaProblem}>
          Save Draft
        </button>
        <button
          className="btn btn-primary"
          onClick={() => save.mutate('complete')}
          disabled={save.isPending || missingRequired.length > 0 || commaProblem}
          title="Ctrl/Cmd + Enter"
        >
          Complete and Next
        </button>
      </div>
    </div>
  )
}
