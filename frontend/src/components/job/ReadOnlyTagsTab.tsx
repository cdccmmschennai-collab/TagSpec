import { useMemo, useState } from 'react'
import type { TagRow } from '../../lib/types'
import { Button, EmptyState, LoadingRow, Pagination, SearchInput } from '../ui/primitives'
import { StatusBadge } from '../StatusBadge'
import { TagDetailDrawer } from './TagDetailDrawer'
import { EditCompletedTagDrawer } from './EditCompletedTagDrawer'
import { EyeIcon, PencilIcon, InboxIcon, AlertIcon } from '../ui/icons'
import { formatDateTime } from '../../lib/format'

const PAGE_SIZE = 10

const STATUSES_BY_MODE: Record<'existing' | 'completed', string[]> = {
  existing: ['EXISTING_IN_EXCEL'],
  completed: ['COMPLETED', 'EXPORTED', 'REVIEWED'],
}

export function ReadOnlyTagsTab({
  mode,
  tags,
  isLoading,
  error,
  jobId,
}: {
  mode: 'existing' | 'completed'
  tags: TagRow[] | undefined
  isLoading: boolean
  error: unknown
  jobId?: string
}) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState<TagRow | null>(null)
  const [editing, setEditing] = useState<TagRow | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = (tags ?? []).filter((t) => STATUSES_BY_MODE[mode].includes(t.status))
    if (!q) return list
    return list.filter(
      (t) =>
        (t.tag_number ?? '').toLowerCase().includes(q) ||
        (t.equipment_description ?? '').toLowerCase().includes(q) ||
        (t.generated_additional_information ?? t.original_additional_information ?? '').toLowerCase().includes(q),
    )
  }, [tags, search, mode])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageSlice = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  if (isLoading) return <LoadingRow label="Loading tags…" />
  if (error) return <div className="alert alert-error"><AlertIcon size={16} /> {String(error)}</div>

  return (
    <div className="stack">
      <div className="toolbar">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search tag, equipment or value…" />
        <span className="small muted nowrap">
          {filtered.length === 0
            ? '0 tags'
            : `Showing ${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, filtered.length)} of ${filtered.length} tag${filtered.length === 1 ? '' : 's'}`}
        </span>
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
                {pageSlice.map((t) => {
                  const addl = t.generated_additional_information ?? t.original_additional_information ?? ''
                  return (
                    <tr key={t.id}>
                      <td className="mono strong nowrap">{t.tag_number}</td>
                      <td className="nowrap">{t.equipment_description}</td>
                      {mode === 'completed' && <td className="muted nowrap">{formatDateTime(t.completed_at)}</td>}
                      <td className="muted truncate" style={{ maxWidth: 360 }} title={addl}>{addl || '—'}</td>
                      <td><StatusBadge status={t.status} /></td>
                      <td>
                        <div className="row gap-sm">
                          <Button size="sm" icon={<EyeIcon size={14} />} onClick={() => setDetail(t)}>View</Button>
                          {mode === 'completed' && (
                            <Button size="sm" icon={<PencilIcon size={14} />} onClick={() => setEditing(t)}>Edit</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={safePage} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      <TagDetailDrawer tag={detail} onClose={() => setDetail(null)} />
      {mode === 'completed' && jobId && (
        <EditCompletedTagDrawer tag={editing} jobId={jobId} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}
