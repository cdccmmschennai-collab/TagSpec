import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, apiErrorCode, apiErrorMessage } from '../lib/api'
import type { EquipmentAttribute, TagRow } from '../lib/types'
import { Button } from '../components/ui/primitives'
import { useToast } from '../components/ui/useToast'
import { StatusBadge } from '../components/StatusBadge'
import { AlertIcon, CheckIcon, LockIcon } from '../components/ui/icons'

interface Props {
  tag: TagRow
  attributes: EquipmentAttribute[]
  jobId: string
  currentUserId: string
  onCompleted: () => void
  onReleased: () => void
}

// Live preview mirrors the backend formatter; the backend remains authoritative.
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

export function TagEntryForm({ tag: initialTag, attributes, jobId, currentUserId, onCompleted, onReleased }: Props) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [tag, setTag] = useState<TagRow>(initialTag)
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const a of attributes) {
      const key = a.attribute_name.toUpperCase()
      initial[key] = initialTag.attribute_values_json?.[key] ?? ''
    }
    return initial
  })
  const [conflict, setConflict] = useState<string | null>(null)

  const ownedByMe = tag.claimed_by === currentUserId
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
      setConflict(null)
      setTag(data)
      void queryClient.invalidateQueries({ queryKey: ['tags', jobId] })
      void queryClient.invalidateQueries({ queryKey: ['job-tags', jobId] })
      void queryClient.invalidateQueries({ queryKey: ['equipment-descriptions', jobId] })
      if (action === 'complete') {
        toast.success('Tag completed', `${data.tag_number} saved. Pick the next tag to continue.`)
        onCompleted()
      } else {
        toast.success('Draft saved', `${data.tag_number} kept as a draft.`)
      }
    },
    onError: (err) => {
      const code = apiErrorCode(err)
      if (code === 'STALE_TAG_VERSION' || code === 'TAG_CLAIM_EXPIRED' || code === 'TAG_NOT_OWNED') {
        setConflict(apiErrorMessage(err))
      }
      toast.error('Could not save', apiErrorMessage(err))
    },
  })

  const release = useMutation({
    mutationFn: async () => api.post(`/workbooks/tags/${tag.id}/release`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tags', jobId] })
      void queryClient.invalidateQueries({ queryKey: ['job-tags', jobId] })
      void queryClient.invalidateQueries({ queryKey: ['equipment-descriptions', jobId] })
      toast.info('Tag released', `${tag.tag_number} is available again.`)
      onReleased()
    },
    onError: (err) => toast.error('Could not release', apiErrorMessage(err)),
  })

  // Ctrl/Cmd+Enter → Complete & Next.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && missingRequired.length === 0 && !commaProblem) {
      save.mutate('complete')
    }
  }

  return (
    <div className="panel entry-panel" onKeyDown={onKeyDown}>
      <div className="entry-head">
        <div className="stack" style={{ gap: '0.3rem' }}>
          <div className="row gap-sm wrap">
            <span className="tagno">{tag.tag_number}</span>
            <StatusBadge status={tag.status} />
            <span className="chip"><LockIcon size={12} /> {ownedByMe ? 'Claimed by you' : 'Claimed by another user'}</span>
          </div>
          <div className="muted small">{tag.equipment_description} · Excel row {tag.excel_row_number} · v{tag.row_version}</div>
        </div>
        <Button variant="ghost" onClick={() => release.mutate()} loading={release.isPending}>Release Tag</Button>
      </div>

      <div className="entry-body">
        {conflict && (
          <div className="alert alert-warn" style={{ marginBottom: '1rem' }}>
            <AlertIcon size={16} />
            <div>
              <div className="strong">This tag changed while you were editing</div>
              <div className="small">{conflict} — release the tag and re-open it to continue safely.</div>
            </div>
          </div>
        )}

        <div className="attr-grid">
          {attributes.map((a) => {
            const key = a.attribute_name.toUpperCase()
            const value = values[key] ?? ''
            const invalid = value.includes(',')
            const requiredMissing = a.is_required && !value.trim()
            const fieldId = `attr-${a.id}`
            return (
              <div key={a.id} className="field">
                <label className="label" htmlFor={fieldId}>
                  {a.display_label}
                  {a.is_required && <b className="req"> *</b>}
                </label>
                <input
                  id={fieldId}
                  className="input"
                  value={value}
                  placeholder={a.placeholder ?? ''}
                  aria-invalid={invalid}
                  aria-required={a.is_required}
                  onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                />
                {invalid ? (
                  <span className="field-error">Commas are not allowed in a value.</span>
                ) : requiredMissing ? (
                  <span className="field-hint">Required</span>
                ) : null}
              </div>
            )
          })}
        </div>

        <div className="preview">
          <div className="preview-label">Generated Additional Information (preview)</div>
          <code>{preview || '—'}</code>
        </div>
      </div>

      <div className="entry-foot">
        <span className="small muted">
          {missingRequired.length > 0
            ? `${missingRequired.length} required field${missingRequired.length > 1 ? 's' : ''} remaining`
            : commaProblem
              ? 'Remove commas to save'
              : 'Ready to complete'}
        </span>
        <div className="foot-actions">
          <Button onClick={() => save.mutate('draft')} loading={save.isPending} disabled={commaProblem}>
            Save Draft
          </Button>
          <Button
            variant="primary"
            icon={<CheckIcon size={16} />}
            onClick={() => save.mutate('complete')}
            loading={save.isPending}
            disabled={missingRequired.length > 0 || commaProblem}
            title="Ctrl/Cmd + Enter"
          >
            Complete &amp; Next
          </Button>
        </div>
      </div>
    </div>
  )
}
