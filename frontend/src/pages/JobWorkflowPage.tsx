import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, API_URL, apiErrorMessage, tokenStore } from '../lib/api'
import { useAuth } from '../auth/useAuth'
import type {
  ClaimResponse,
  Equipment,
  EquipmentAttribute,
  EquipmentDescriptionCount,
  ExportRecord,
  ImportStats,
  TagRow,
  WorkbookJob,
} from '../lib/types'
import { Button, EmptyState, LoadingRow, PageHeader, SearchInput, Tabs, Tile } from '../components/ui/primitives'
import type { TabDef } from '../components/ui/primitives'
import { JobStatusBadge } from '../components/StatusBadge'
import { TagEntryForm } from './TagEntryForm'
import { ReadOnlyTagsTab } from '../components/job/ReadOnlyTagsTab'
import { MissingTemplatesTab } from '../components/job/MissingTemplatesTab'
import { useToast } from '../components/ui/useToast'
import {
  AlertIcon, ArrowRightIcon, ClipboardIcon, DownloadIcon, LayersIcon, PackageIcon,
  RefreshIcon, InboxIcon,
} from '../components/ui/icons'
import { formatDateTime, normalizeEquipmentDescription } from '../lib/format'

interface ActiveEntry { tag: TagRow; attributes: EquipmentAttribute[] }

export function JobWorkflowPage() {
  const { jobId = '' } = useParams()
  const { user } = useAuth()
  const currentUserId = user?.id ?? ''
  const isSupervisor = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR'
  const isAdmin = user?.role === 'ADMIN'
  const queryClient = useQueryClient()
  const toast = useToast()

  const [tab, setTab] = useState('data-entry')
  const [selectedEquipment, setSelectedEquipment] = useState('')
  const [active, setActive] = useState<ActiveEntry | null>(null)
  const [equipSearch, setEquipSearch] = useState('')
  const [tagSearch, setTagSearch] = useState('')

  const job = useQuery({
    queryKey: ['job', jobId],
    queryFn: async () => (await api.get<WorkbookJob>(`/workbooks/${jobId}`)).data,
  })

  const descriptions = useQuery({
    queryKey: ['equipment-descriptions', jobId],
    queryFn: async () =>
      (await api.get<EquipmentDescriptionCount[]>(`/workbooks/${jobId}/equipment-descriptions`)).data,
  })

  const queue = useQuery({
    queryKey: ['tags', jobId, selectedEquipment],
    enabled: !!selectedEquipment,
    queryFn: async () =>
      (await api.get<TagRow[]>(`/workbooks/${jobId}/tags`, { params: { equipment: selectedEquipment } })).data,
  })

  const inProgress = useQuery({
    queryKey: ['job-tags', jobId, 'in-progress'],
    enabled: tab === 'in-progress',
    queryFn: async () => {
      const params = isSupervisor ? { statuses: ['CLAIMED', 'DRAFT'] } : undefined
      return (await api.get<TagRow[]>(`/workbooks/${jobId}/tags`, { params })).data
    },
  })

  const existing = useQuery({
    queryKey: ['job-tags', jobId, 'existing'],
    enabled: tab === 'existing' && isSupervisor,
    queryFn: async () =>
      (await api.get<TagRow[]>(`/workbooks/${jobId}/tags`, { params: { statuses: ['EXISTING_IN_EXCEL'] } })).data,
  })

  const completed = useQuery({
    queryKey: ['job-tags', jobId, 'completed'],
    enabled: tab === 'completed' && isSupervisor,
    queryFn: async () =>
      (await api.get<TagRow[]>(`/workbooks/${jobId}/tags`, { params: { statuses: ['COMPLETED', 'EXPORTED', 'REVIEWED'] } })).data,
  })

  const exports = useQuery({
    queryKey: ['exports', jobId],
    enabled: isSupervisor,
    queryFn: async () => (await api.get<ExportRecord[]>(`/workbooks/${jobId}/exports`)).data,
  })

  // ---- aggregate counts (from descriptions; visible to all roles) ----
  const agg = useMemo(() => {
    const d = descriptions.data ?? []
    return {
      total: d.reduce((s, x) => s + x.total, 0),
      available: d.reduce((s, x) => s + x.available, 0),
      inProgress: d.reduce((s, x) => s + x.in_progress, 0),
      completed: d.reduce((s, x) => s + x.completed, 0),
      existing: d.reduce((s, x) => s + x.existing_in_excel, 0),
      templateMissing: d.reduce((s, x) => s + x.template_missing, 0),
      unmatched: d.filter((x) => x.equipment_template_id === null).length,
    }
  }, [descriptions.data])

  // ---- actions ----
  const runImport = useMutation({
    mutationFn: async () => (await api.post<ImportStats>(`/workbooks/${jobId}/import`, null, { params: { rerun: true } })).data,
    onSuccess: (stats) => {
      void queryClient.invalidateQueries({ queryKey: ['equipment-descriptions', jobId] })
      void queryClient.invalidateQueries({ queryKey: ['job-tags', jobId] })
      void queryClient.invalidateQueries({ queryKey: ['job', jobId] })
      toast.success('Rows re-scanned', `${stats.total_tag_rows} tag rows · ${stats.available_tags} available · ${stats.existing_in_excel_tags} existing in Excel.`)
    },
    onError: (err) => toast.error('Re-scan failed', apiErrorMessage(err)),
  })

  const runExport = useMutation({
    mutationFn: async () => (await api.post<ExportRecord>(`/workbooks/${jobId}/export`)).data,
    onSuccess: (rec) => {
      void queryClient.invalidateQueries({ queryKey: ['exports', jobId] })
      void queryClient.invalidateQueries({ queryKey: ['job', jobId] })
      toast.success('Excel generated', `${rec.output_filename} · ${rec.row_count_written} rows written.`)
    },
    onError: (err) => toast.error('Export failed', apiErrorMessage(err)),
  })

  const selectTag = useMutation({
    mutationFn: async (tag: TagRow): Promise<ActiveEntry> => {
      if (tag.status === 'AVAILABLE') {
        const { data } = await api.post<ClaimResponse>(`/workbooks/tags/${tag.id}/claim`)
        return { tag: data.tag, attributes: data.attributes }
      }
      // Resume a draft/claim we already own — fetch attributes from the template.
      if (!tag.equipment_template_id) throw new Error('This tag has no equipment template')
      const { data } = await api.get<Equipment>(`/equipment/${tag.equipment_template_id}`)
      const attrs = data.attributes.filter((a) => a.is_active).sort((a, b) => a.display_order - b.display_order)
      return { tag, attributes: attrs }
    },
    onSuccess: (entry) => {
      setActive(entry)
      void queryClient.invalidateQueries({ queryKey: ['tags', jobId] })
    },
    onError: (err) => toast.error('Could not open tag', apiErrorMessage(err)),
  })

  function downloadExport(rec: ExportRecord) {
    const token = tokenStore.access
    void fetch(`${API_URL}/api/v1/workbooks/exports/${rec.id}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = rec.output_filename
        a.click()
        URL.revokeObjectURL(url)
      })
      .catch(() => toast.error('Download failed'))
  }

  if (job.isLoading) return <LoadingRow label="Loading job…" />
  if (job.isError || !job.data)
    return <div className="alert alert-error"><AlertIcon size={16} /> {apiErrorMessage(job.error)}</div>

  const j = job.data
  const metaBits = [j.project_code, j.revision ? `Rev ${j.revision}` : null, j.sheet_name].filter(Boolean).join(' · ')

  const tabs: TabDef[] = [
    { key: 'data-entry', label: 'Data Entry', count: agg.available, icon: <ClipboardIcon size={15} /> },
    { key: 'in-progress', label: 'In Progress', count: agg.inProgress, icon: <RefreshIcon size={15} /> },
    ...(isSupervisor
      ? [
          { key: 'completed', label: 'Completed', count: agg.completed, icon: <LayersIcon size={15} /> },
          { key: 'existing', label: 'Existing in Excel', count: agg.existing, icon: <InboxIcon size={15} /> },
        ]
      : []),
    { key: 'missing', label: 'Missing Templates', count: agg.unmatched, icon: <PackageIcon size={15} /> },
  ]

  function goTab(key: string) {
    if (tabs.some((t) => t.key === key)) setTab(key)
  }

  return (
    <div className="page">
      <PageHeader
        breadcrumb={<><Link to="/jobs">Jobs</Link><span className="sep">/</span><span>{j.job_name}</span></>}
        title={j.job_name}
        subtitle={<span className="row gap-sm wrap">{metaBits || 'No metadata'} <JobStatusBadge status={j.status} /></span>}
        actions={
          isSupervisor && (
            <>
              <Button icon={<RefreshIcon size={16} />} onClick={() => runImport.mutate()} loading={runImport.isPending}>
                Re-scan rows
              </Button>
              <Button variant="primary" icon={<DownloadIcon size={16} />} onClick={() => runExport.mutate()} loading={runExport.isPending}>
                Generate Excel
              </Button>
            </>
          )
        }
      />

      <div className="summary-grid">
        <Tile label="Total Tags" value={agg.total} tone="gray" />
        <Tile label="Available" value={agg.available} tone="blue" active={tab === 'data-entry'} onClick={() => goTab('data-entry')} />
        <Tile label="In Progress" value={agg.inProgress} tone="amber" active={tab === 'in-progress'} onClick={() => goTab('in-progress')} />
        <Tile label="Completed" value={agg.completed} tone="green" active={tab === 'completed'} onClick={() => goTab('completed')} />
        <Tile label="Existing in Excel" value={agg.existing} tone="cyan" active={tab === 'existing'} onClick={() => goTab('existing')} />
        <Tile label="Missing Template" value={agg.templateMissing} tone="red" active={tab === 'missing'} onClick={() => goTab('missing')} />
      </div>

      {isSupervisor && exports.data && exports.data.length > 0 && (
        <div className="card card-body">
          <div className="row-between">
            <span className="strong small">Generated exports</span>
            <span className="tiny muted">{exports.data.length} file{exports.data.length === 1 ? '' : 's'}</span>
          </div>
          <div className="stack" style={{ marginTop: '0.6rem', gap: '0.4rem' }}>
            {exports.data.slice(0, 4).map((e) => (
              <div key={e.id} className="row-between">
                <span className="small mono truncate" style={{ maxWidth: 420 }}>{e.output_filename}</span>
                <span className="row gap-sm">
                  <span className="tiny muted">{e.status} · {e.row_count_written} rows · {formatDateTime(e.generated_at)}</span>
                  {e.status === 'SUCCESS' && (
                    <Button size="sm" icon={<DownloadIcon size={14} />} onClick={() => downloadExport(e)}>Download</Button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-body" style={{ paddingBottom: 0 }}>
          <Tabs tabs={tabs} active={tab} onChange={setTab} />
        </div>
        <div className="card-body">
          {tab === 'data-entry' && (
            <DataEntryWorkspace
              descriptions={descriptions.data ?? []}
              descriptionsLoading={descriptions.isLoading}
              equipSearch={equipSearch}
              setEquipSearch={setEquipSearch}
              tagSearch={tagSearch}
              setTagSearch={setTagSearch}
              selectedEquipment={selectedEquipment}
              onSelectEquipment={(norm) => { setSelectedEquipment(norm); setActive(null) }}
              queue={queue.data}
              queueLoading={queue.isLoading}
              currentUserId={currentUserId}
              active={active}
              onSelectTag={(t) => selectTag.mutate(t)}
              selecting={selectTag.isPending}
              jobId={jobId}
              onCompleted={() => { setActive(null); void queue.refetch() }}
              onReleased={() => { setActive(null); void queue.refetch() }}
            />
          )}

          {tab === 'in-progress' && (
            <InProgressTab
              tags={inProgress.data}
              isLoading={inProgress.isLoading}
              currentUserId={currentUserId}
              isSupervisor={isSupervisor}
              onResume={(t) => { setTab('data-entry'); setSelectedEquipment(normalizeEquipmentDescription(t.equipment_description)); selectTag.mutate(t) }}
            />
          )}

          {tab === 'completed' && isSupervisor && (
            <ReadOnlyTagsTab mode="completed" tags={completed.data} isLoading={completed.isLoading} error={completed.error} jobId={jobId} />
          )}

          {tab === 'existing' && isSupervisor && (
            <ReadOnlyTagsTab mode="existing" tags={existing.data} isLoading={existing.isLoading} error={existing.error} />
          )}

          {tab === 'missing' && (
            <MissingTemplatesTab jobId={jobId} descriptions={descriptions.data ?? []} isSupervisor={isSupervisor} isAdmin={isAdmin} />
          )}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------ Data Entry three-panel */
function DataEntryWorkspace(props: {
  descriptions: EquipmentDescriptionCount[]
  descriptionsLoading: boolean
  equipSearch: string
  setEquipSearch: (v: string) => void
  tagSearch: string
  setTagSearch: (v: string) => void
  selectedEquipment: string
  onSelectEquipment: (norm: string) => void
  queue: TagRow[] | undefined
  queueLoading: boolean
  currentUserId: string
  active: ActiveEntry | null
  onSelectTag: (t: TagRow) => void
  selecting: boolean
  jobId: string
  onCompleted: () => void
  onReleased: () => void
}) {
  const {
    descriptions, descriptionsLoading, equipSearch, setEquipSearch, tagSearch, setTagSearch,
    selectedEquipment, onSelectEquipment, queue, queueLoading, currentUserId, active,
    onSelectTag, selecting, jobId, onCompleted, onReleased,
  } = props

  const filteredEquip = useMemo(() => {
    const q = equipSearch.trim().toLowerCase()
    return descriptions
      .filter((d) => (q ? d.equipment_description.toLowerCase().includes(q) : true))
      .sort((a, b) => b.available - a.available || a.equipment_description.localeCompare(b.equipment_description))
  }, [descriptions, equipSearch])

  const selectedDesc = descriptions.find((d) => d.normalized_equipment_description === selectedEquipment)

  const { available, mine } = useMemo(() => {
    const list = queue ?? []
    const q = tagSearch.trim().toLowerCase()
    const match = (t: TagRow) => (q ? (t.tag_number ?? '').toLowerCase().includes(q) : true)
    return {
      available: list.filter((t) => t.status === 'AVAILABLE' && match(t)),
      mine: list.filter((t) => (t.status === 'CLAIMED' || t.status === 'DRAFT') && t.claimed_by === currentUserId && match(t)),
    }
  }, [queue, tagSearch, currentUserId])

  return (
    <div className="workspace">
      {/* Panel 1 — Equipment */}
      <div className="panel">
        <div className="panel-head">
          <h3>Equipment</h3>
          <SearchInput value={equipSearch} onChange={setEquipSearch} placeholder="Search equipment…" aria-label="Search equipment" />
        </div>
        <div className="panel-scroll">
          {descriptionsLoading ? (
            <LoadingRow label="Loading…" />
          ) : filteredEquip.length === 0 ? (
            <EmptyState icon={<PackageIcon size={26} />} title="No equipment" message="Import rows to populate equipment." />
          ) : (
            filteredEquip.map((d) => {
              const noTemplate = d.equipment_template_id === null
              return (
                <button
                  key={d.normalized_equipment_description}
                  className={`list-item ${selectedEquipment === d.normalized_equipment_description ? 'active' : ''}`.trim()}
                  onClick={() => onSelectEquipment(d.normalized_equipment_description)}
                >
                  <span className="li-row">
                    <span className="li-title truncate" title={d.equipment_description}>{d.equipment_description}</span>
                    {noTemplate && <span className="badge badge-red">No template</span>}
                  </span>
                  <span className="li-meta">{d.available} available · {d.total} total{d.existing_in_excel ? ` · ${d.existing_in_excel} existing` : ''}</span>
                </button>
              )
            })
          )}
        </div>
        <div className="panel-foot">{filteredEquip.length} equipment type{filteredEquip.length === 1 ? '' : 's'}</div>
      </div>

      {/* Panel 2 — Tag Queue */}
      <div className="panel">
        <div className="panel-head">
          <h3>Tag Queue</h3>
          {selectedDesc ? (
            <>
              <div className="strong small truncate" title={selectedDesc.equipment_description}>{selectedDesc.equipment_description}</div>
              <SearchInput value={tagSearch} onChange={setTagSearch} placeholder="Search tag number…" aria-label="Search tags" />
            </>
          ) : (
            <div className="small muted">Select equipment to load its tags</div>
          )}
        </div>
        <div className="panel-scroll">
          {!selectedEquipment ? (
            <EmptyState icon={<ClipboardIcon size={26} />} title="No equipment selected" message="Choose an equipment type on the left." />
          ) : queueLoading ? (
            <LoadingRow label="Loading tags…" />
          ) : (
            <>
              {mine.length > 0 && (
                <>
                  <div className="tiny muted" style={{ padding: '0.2rem 0.4rem' }}>YOUR WORK IN PROGRESS</div>
                  {mine.map((t) => (
                    <button key={t.id} className="queue-item" disabled={selecting} onClick={() => onSelectTag(t)}>
                      <span className="qi-tag">{t.tag_number}</span>
                      <span className={`badge badge-${t.status === 'DRAFT' ? 'violet' : 'amber'}`}>{t.status === 'DRAFT' ? 'Draft' : 'Claimed'}</span>
                    </button>
                  ))}
                  <div className="divider" />
                </>
              )}
              <div className="tiny muted" style={{ padding: '0.2rem 0.4rem' }}>AVAILABLE ({available.length})</div>
              {available.length === 0 ? (
                <EmptyState title="No available tags" message="Every tag here is completed, claimed by others, or already in Excel." />
              ) : (
                available.map((t) => (
                  <button key={t.id} className="queue-item" disabled={selecting} onClick={() => onSelectTag(t)}>
                    <span className="qi-tag">{t.tag_number}</span>
                    <ArrowRightIcon size={15} />
                  </button>
                ))
              )}
            </>
          )}
        </div>
      </div>

      {/* Panel 3 — Attribute Entry */}
      {active ? (
        <TagEntryForm
          key={active.tag.id}
          tag={active.tag}
          attributes={active.attributes}
          jobId={jobId}
          currentUserId={currentUserId}
          onCompleted={onCompleted}
          onReleased={onReleased}
        />
      ) : (
        <div className="panel entry-panel">
          <div className="loading-center" style={{ flex: 1 }}>
            <EmptyState
              icon={<ClipboardIcon size={32} />}
              title="Select a tag to begin"
              message="Pick a tag from the queue to claim it and enter its attribute values."
            />
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------- In Progress tab */
function InProgressTab({
  tags,
  isLoading,
  currentUserId,
  isSupervisor,
  onResume,
}: {
  tags: TagRow[] | undefined
  isLoading: boolean
  currentUserId: string
  isSupervisor: boolean
  onResume: (t: TagRow) => void
}) {
  const rows = (tags ?? []).filter((t) => t.status === 'CLAIMED' || t.status === 'DRAFT')
  if (isLoading) return <LoadingRow label="Loading in-progress tags…" />
  if (rows.length === 0)
    return <EmptyState icon={<RefreshIcon size={30} />} title="Nothing in progress" message="Claimed and draft tags will appear here." />

  return (
    <div className="table-wrap card">
      <table className="table">
        <thead>
          <tr>
            <th>Tag</th>
            <th>Equipment</th>
            <th>Status</th>
            <th>Claimed</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const mine = t.claimed_by === currentUserId
            return (
              <tr key={t.id}>
                <td className="mono strong nowrap">{t.tag_number}</td>
                <td className="nowrap">{t.equipment_description}</td>
                <td><span className={`badge badge-${t.status === 'DRAFT' ? 'violet' : 'amber'}`}>{t.status === 'DRAFT' ? 'Draft' : 'Claimed'}</span></td>
                <td className="muted nowrap">{formatDateTime(t.claimed_at)}</td>
                <td>
                  {mine ? (
                    <Button size="sm" onClick={() => onResume(t)}>Resume</Button>
                  ) : (
                    <span className="tiny muted">{isSupervisor ? 'Another employee' : ''}</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
