import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, apiErrorMessage } from '../lib/api'
import { useAuth } from '../auth/useAuth'
import type { WorkbookJob } from '../lib/types'
import { Button, Card, EmptyState, LoadingRow, PageHeader, SearchInput, Select, Tile } from '../components/ui/primitives'
import { JobStatusBadge } from '../components/StatusBadge'
import { UploadWorkbookDrawer } from '../components/UploadWorkbookDrawer'
import { RefreshIcon, UploadIcon, SheetIcon, ArrowRightIcon, AlertIcon } from '../components/ui/icons'
import { formatDateTime } from '../lib/format'
import { jobStatusMeta } from '../lib/status'

export function JobsPage() {
  const { user } = useAuth()
  const canUpload = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR'
  const [uploadOpen, setUploadOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const jobs = useQuery({
    queryKey: ['jobs'],
    queryFn: async () => (await api.get<WorkbookJob[]>('/workbooks')).data,
  })

  const all = useMemo(() => jobs.data ?? [], [jobs.data])

  const counts = useMemo(() => {
    const c = { total: all.length, ready: 0, inProgress: 0, exported: 0 }
    for (const j of all) {
      if (j.status === 'READY') c.ready++
      else if (j.status === 'IN_PROGRESS') c.inProgress++
      else if (j.status === 'EXPORTED' || j.status === 'COMPLETED') c.exported++
    }
    return c
  }, [all])

  const statusOptions = useMemo(() => Array.from(new Set(all.map((j) => j.status))), [all])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all.filter((j) => {
      if (statusFilter !== 'ALL' && j.status !== statusFilter) return false
      if (!q) return true
      return (
        j.job_name.toLowerCase().includes(q) ||
        (j.project_code ?? '').toLowerCase().includes(q) ||
        (j.revision ?? '').toLowerCase().includes(q)
      )
    })
  }, [all, search, statusFilter])

  return (
    <div className="page">
      <PageHeader
        title="Workbook Jobs"
        subtitle="Upload and manage equipment specification workbooks."
        actions={
          canUpload && (
            <Button variant="primary" icon={<UploadIcon size={16} />} onClick={() => setUploadOpen(true)}>
              Upload Workbook
            </Button>
          )
        }
      />

      {all.length > 0 && (
        <div className="summary-grid">
          <Tile label="Total Jobs" value={counts.total} tone="blue" />
          <Tile label="Ready" value={counts.ready} tone="cyan" />
          <Tile label="In Progress" value={counts.inProgress} tone="amber" />
          <Tile label="Exported" value={counts.exported} tone="green" />
        </div>
      )}

      <Card>
        <div className="card-head">
          <div className="toolbar grow">
            <SearchInput value={search} onChange={setSearch} placeholder="Search workbook, project, revision…" />
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status" style={{ width: 'auto' }}>
              <option value="ALL">All statuses</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>{jobStatusMeta(s).label}</option>
              ))}
            </Select>
          </div>
          <div className="row gap-sm">
            <Button size="sm" icon={<RefreshIcon size={15} />} onClick={() => jobs.refetch()} loading={jobs.isFetching}>
              Refresh
            </Button>
          </div>
        </div>

        {jobs.isLoading ? (
          <LoadingRow label="Loading jobs…" />
        ) : jobs.isError ? (
          <div className="card-body"><div className="alert alert-error"><AlertIcon size={16} /> {apiErrorMessage(jobs.error)}</div></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<SheetIcon size={34} />}
            title={all.length === 0 ? 'No workbooks yet' : 'No matching jobs'}
            message={all.length === 0 ? 'Upload an equipment specification workbook to get started.' : 'Try a different search or status filter.'}
            action={canUpload && all.length === 0 ? (
              <Button variant="primary" icon={<UploadIcon size={16} />} onClick={() => setUploadOpen(true)}>Upload Workbook</Button>
            ) : undefined}
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Workbook</th>
                  <th>Project</th>
                  <th>Revision</th>
                  <th>Sheet</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((j) => (
                  <tr key={j.id}>
                    <td>
                      <div className="row gap-sm">
                        <span className="muted"><SheetIcon size={16} /></span>
                        <span className="strong truncate" style={{ maxWidth: 260 }} title={j.job_name}>{j.job_name}</span>
                      </div>
                    </td>
                    <td>{j.project_code ?? <span className="muted">—</span>}</td>
                    <td>{j.revision ?? <span className="muted">—</span>}</td>
                    <td>{j.sheet_name ?? <span className="muted">—</span>}</td>
                    <td><JobStatusBadge status={j.status} /></td>
                    <td className="muted nowrap">{formatDateTime(j.updated_at)}</td>
                    <td>
                      <Link className="btn btn-sm" to={`/jobs/${j.id}`}>
                        Open Job <ArrowRightIcon size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <UploadWorkbookDrawer open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </div>
  )
}
