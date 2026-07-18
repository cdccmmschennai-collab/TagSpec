import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiErrorMessage } from '../../lib/api'
import type { Equipment, TagRow } from '../../lib/types'
import { Drawer } from '../ui/Dialog'
import { Button } from '../ui/primitives'
import { StatusBadge } from '../StatusBadge'
import { AlertIcon, CheckIcon } from '../ui/icons'
import { useToast } from '../ui/useToast'
import { buildPreview } from '../../pages/TagEntryForm'

// Supervisor correction of a tag's values after it has left the claim workflow
// (COMPLETED / EXPORTED / REVIEWED). Reuses the same value/preview logic as
// TagEntryForm, but saves via /tags/{id}/edit instead of the claim-based /complete.
export function EditCompletedTagDrawer({
  tag,
  jobId,
  onClose,
}: {
  tag: TagRow | null
  jobId: string
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const toast = useToast()

  const equipment = useQuery({
    queryKey: ['equipment', tag?.equipment_template_id],
    enabled: !!tag?.equipment_template_id,
    queryFn: async () => (await api.get<Equipment>(`/equipment/${tag!.equipment_template_id}`)).data,
  })
  const attributes = useMemo(
    () => (equipment.data?.attributes ?? []).filter((a) => a.is_active).sort((a, b) => a.display_order - b.display_order),
    [equipment.data],
  )

  const [values, setValues] = useState<Record<string, string>>({})
  useEffect(() => {
    if (!tag) return
    const initial: Record<string, string> = {}
    for (const a of attributes) {
      const key = a.attribute_name.toUpperCase()
      initial[key] = tag.attribute_values_json?.[key] ?? ''
    }
    setValues(initial)
  }, [tag, attributes])

  const preview = useMemo(() => buildPreview(attributes, values), [attributes, values])
  const missingRequired = attributes.filter((a) => a.is_required && !(values[a.attribute_name.toUpperCase()] ?? '').trim())
  const commaProblem = Object.values(values).some((v) => v.includes(','))

  const save = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<TagRow>(`/workbooks/tags/${tag!.id}/edit`, {
        values,
        row_version: tag!.row_version,
      })
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['job-tags', jobId, 'completed'] })
      void queryClient.invalidateQueries({ queryKey: ['equipment-descriptions', jobId] })
      toast.success('Tag updated', `${data.tag_number} saved.`)
      onClose()
    },
    onError: (err) => toast.error('Could not save', apiErrorMessage(err)),
  })

  return (
    <Drawer
      open={!!tag}
      onClose={onClose}
      title={tag?.tag_number ?? 'Tag'}
      subtitle={tag?.equipment_description ?? undefined}
      footer={
        tag && (
          <>
            <Button onClick={onClose} disabled={save.isPending}>Cancel</Button>
            <Button
              variant="primary"
              icon={<CheckIcon size={16} />}
              onClick={() => save.mutate()}
              loading={save.isPending}
              disabled={missingRequired.length > 0 || commaProblem || equipment.isLoading}
            >
              Save changes
            </Button>
          </>
        )
      }
    >
      {tag && (
        <div className="stack">
          <div className="row gap-sm wrap">
            <StatusBadge status={tag.status} />
            <span className="chip">Excel row {tag.excel_row_number}</span>
          </div>

          {equipment.isLoading ? (
            <div className="small muted">Loading attributes…</div>
          ) : (
            <div className="attr-grid">
              {attributes.map((a) => {
                const key = a.attribute_name.toUpperCase()
                const value = values[key] ?? ''
                const invalid = value.includes(',')
                const requiredMissing = a.is_required && !value.trim()
                const fieldId = `edit-attr-${a.id}`
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
          )}

          <div className="preview">
            <div className="preview-label">Generated Additional Information (preview)</div>
            <code>{preview || '—'}</code>
          </div>

          {commaProblem && (
            <div className="alert alert-warn">
              <AlertIcon size={16} />
              <div className="small">Remove commas to save.</div>
            </div>
          )}
        </div>
      )}
    </Drawer>
  )
}
