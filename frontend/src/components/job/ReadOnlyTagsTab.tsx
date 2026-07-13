import { useMemo, useState } from 'react'
import type { TagRow } from '../../lib/types'
import { Button, EmptyState, LoadingRow, SearchInput } from '../ui/primitives'
import { StatusBadge } from '../StatusBadge'
import { TagDetailDrawer } from './TagDetailDrawer'
import { EyeIcon, InboxIcon, AlertIcon } from '../ui/icons'
import { formatDateTime } from '../../lib/format'

const PAGE = 50

export function ReadOnlyTagsTab({
  mode,
  tags,
  isLoading,
  error,
}: {
  mode: 'existing' | 'completed'
  tags: TagRow[] | undefined
  isLoading: boolean
  error: unknown
}) {
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const [detail, setDetail] = useState<TagRow | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = tags ?? []
    if (!q) return list
    return list.filter(
      (t) =>
        (t.tag_number ?? '').toLowerCase().includes(q) ||
        (t.equipment_description ?? '').toLowerCase().includes(q) ||
        (t.generated_additional_information ?? t.original_additional_information ?? '').toLowerCase().includes(q),
    )
  }, [tags, search])

  const shown = filtered.slice(0, limit)

  if (isLoading) return <LoadingRow label="Loading tags…" />
  if (error) return <div className="alert alert-error"><AlertIcon size={16} /> {String(error)}</div>

  return (
    <div className="stack">
      <div className="toolbar">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setLimit(PAGE) }} placeholder="Search tag, equipment or value…" />
        <span className="small muted nowrap">{filtered.length} tag{filtered.length === 1 ? '' : 's'}</span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<InboxIcon size={32} />}
          title={mode === 'existing' ? 'No pre-existing values' : 'Nothing completed yet'}
          message={
            mode === 'existing'
              ? 'Tags that already carried Additional Information in the workbook will appear here.'
              : 'Completed tags will appear here once engineers finish attribute entry.'
          }
        />
      ) : (
        <>
          <div className="table-wrap card">
            <table className="table">
              <thead>
                <tr>
                  <th>Tag</th>
                  <th>Equipment</th>
                  {mode === 'completed' && <th>Completed</th>}
                  <th>Additional Information</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {shown.map((t) => {
                  const addl = t.generated_additional_information ?? t.original_additional_information ?? ''
                  return (
                    <tr key={t.id}>
                      <td className="mono strong nowrap">{t.tag_number}</td>
                      <td className="nowrap">{t.equipment_description}</td>
                      {mode === 'completed' && <td className="muted nowrap">{formatDateTime(t.completed_at)}</td>}
                      <td className="muted truncate" style={{ maxWidth: 360 }} title={addl}>{addl || '—'}</td>
                      <td><StatusBadge status={t.status} /></td>
                      <td>
                        <Button size="sm" icon={<EyeIcon size={14} />} onClick={() => setDetail(t)}>View</Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {filtered.length > limit && (
            <div className="row" style={{ justifyContent: 'center' }}>
              <Button onClick={() => setLimit((l) => l + PAGE)}>Show more ({filtered.length - limit} remaining)</Button>
            </div>
          )}
        </>
      )}

      <TagDetailDrawer tag={detail} onClose={() => setDetail(null)} />
    </div>
  )
}
