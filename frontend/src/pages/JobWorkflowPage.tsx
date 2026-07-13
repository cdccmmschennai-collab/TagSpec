import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, API_URL, apiErrorMessage, tokenStore } from '../lib/api'
import { useAuth } from '../auth/useAuth'
import { StatusBadge } from '../components/StatusBadge'
import { TagEntryForm } from './TagEntryForm'
import type {
  ClaimResponse,
  EquipmentDescriptionCount,
  ExportRecord,
  ImportStats,
  TagRow,
  WorkbookJob,
} from '../lib/types'

export function JobWorkflowPage() {
  const { jobId = '' } = useParams()
  const { user } = useAuth()
  const isSupervisor = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR'
  const queryClient = useQueryClient()

  const [selectedEquipment, setSelectedEquipment] = useState<string>('')
  const [claim, setClaim] = useState<ClaimResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [importStats, setImportStats] = useState<ImportStats | null>(null)

  const job = useQuery({
    queryKey: ['job', jobId],
    queryFn: async () => (await api.get<WorkbookJob>(`/workbooks/${jobId}`)).data,
  })

  const descriptions = useQuery({
    queryKey: ['equipment-descriptions', jobId],
    queryFn: async () =>
      (await api.get<EquipmentDescriptionCount[]>(`/workbooks/${jobId}/equipment-descriptions`)).data,
  })

  const tags = useQuery({
    queryKey: ['tags', jobId, selectedEquipment],
    enabled: !!selectedEquipment,
    queryFn: async () =>
      (
        await api.get<TagRow[]>(`/workbooks/${jobId}/tags`, {
          params: { equipment: selectedEquipment },
        })
      ).data,
  })

  const completed = useQuery({
    queryKey: ['tags-completed', jobId],
    enabled: isSupervisor,
    queryFn: async () =>
      (
        await api.get<TagRow[]>(`/workbooks/${jobId}/tags`, {
          params: { statuses: ['COMPLETED', 'EXPORTED', 'EXISTING_IN_EXCEL'] },
        })
      ).data,
  })

  const exports = useQuery({
    queryKey: ['exports', jobId],
    queryFn: async () => (await api.get<ExportRecord[]>(`/workbooks/${jobId}/exports`)).data,
  })

  const runImport = useMutation({
    mutationFn: async () => (await api.post<ImportStats>(`/workbooks/${jobId}/import`)).data,
    onSuccess: (data) => {
      setImportStats(data)
      void queryClient.invalidateQueries({ queryKey: ['equipment-descriptions', jobId] })
    },
    onError: (err) => setError(apiErrorMessage(err)),
  })

  const claimTag = useMutation({
    mutationFn: async (tagId: string) =>
      (await api.post<ClaimResponse>(`/workbooks/tags/${tagId}/claim`)).data,
    onSuccess: (data) => {
      setClaim(data)
      setError(null)
      void queryClient.invalidateQueries({ queryKey: ['tags', jobId] })
    },
    onError: (err) => setError(apiErrorMessage(err)),
  })

  const runExport = useMutation({
    mutationFn: async () => (await api.post<ExportRecord>(`/workbooks/${jobId}/export`)).data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['exports', jobId] })
      void queryClient.invalidateQueries({ queryKey: ['tags-completed', jobId] })
    },
    onError: (err) => setError(apiErrorMessage(err)),
  })

  const selected = useMemo(
    () => descriptions.data?.find((d) => d.normalized_equipment_description === selectedEquipment),
    [descriptions.data, selectedEquipment],
  )

  function downloadExport(rec: ExportRecord) {
    const token = tokenStore.access
    // FileResponse download needs the bearer token; fetch as blob then save.
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
  }

  if (job.isLoading) return <div className="page">Loading…</div>
  if (job.isError) return <div className="page"><div className="alert alert-error">{apiErrorMessage(job.error)}</div></div>

  return (
    <div className="page">
      <h1>{job.data?.job_name}</h1>
      <div className="muted small">
        {job.data?.project_code ?? '—'} · rev {job.data?.revision ?? '—'} · status {job.data?.status}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {isSupervisor && (
        <section className="card">
          <div className="row-between">
            <h2>Import &amp; Export</h2>
            <div className="btn-row">
              <button className="btn" onClick={() => runImport.mutate()} disabled={runImport.isPending}>
                {runImport.isPending ? 'Importing…' : 'Import / Re-scan rows'}
              </button>
              <button className="btn btn-primary" onClick={() => runExport.mutate()} disabled={runExport.isPending}>
                {runExport.isPending ? 'Exporting…' : 'Generate Excel'}
              </button>
            </div>
          </div>
          {importStats && (
            <div className="stats">
              <Stat label="Tag rows" value={importStats.total_tag_rows} />
              <Stat label="Available" value={importStats.available_tags} />
              <Stat label="Existing in Excel" value={importStats.existing_in_excel_tags} />
              <Stat label="Template missing" value={importStats.template_missing_tags} />
              <Stat label="Unmatched equip." value={importStats.unmatched_equipment_count} />
              {importStats.duplicate_tag_numbers.length > 0 && (
                <Stat label="Duplicate tags" value={importStats.duplicate_tag_numbers.length} />
              )}
            </div>
          )}
          {exports.data && exports.data.length > 0 && (
            <div className="export-list">
              {exports.data.map((e) => (
                <div key={e.id} className="export-row">
                  <span>{e.output_filename}</span>
                  <span className="muted small">{e.status} · {e.row_count_written} rows</span>
                  {e.status === 'SUCCESS' && (
                    <button className="btn btn-sm" onClick={() => downloadExport(e)}>
                      Download
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="card">
        <h2>Data entry</h2>
        <label className="select-label">
          Equipment description
          <select
            value={selectedEquipment}
            onChange={(e) => {
              setSelectedEquipment(e.target.value)
              setClaim(null)
            }}
          >
            <option value="">Select equipment…</option>
            {descriptions.data?.map((d) => (
              <option key={d.normalized_equipment_description} value={d.normalized_equipment_description}>
                {d.equipment_description} — {d.available} available / {d.total} total
              </option>
            ))}
          </select>
        </label>

        {selected && (
          <div className="stats">
            <Stat label="Total" value={selected.total} />
            <Stat label="Available" value={selected.available} />
            <Stat label="In progress" value={selected.in_progress} />
            <Stat label="Completed" value={selected.completed} />
            <Stat label="Existing" value={selected.existing_in_excel} />
            <Stat label="No template" value={selected.template_missing} />
          </div>
        )}

        {selectedEquipment && !claim && (
          <div className="tag-list">
            {tags.isLoading && <p>Loading tags…</p>}
            {tags.data && tags.data.length === 0 && (
              <p className="muted">No selectable tags for this equipment.</p>
            )}
            {tags.data?.map((t) => (
              <button
                key={t.id}
                className="tag-chip"
                onClick={() => claimTag.mutate(t.id)}
                disabled={claimTag.isPending}
              >
                {t.tag_number} <StatusBadge status={t.status} />
              </button>
            ))}
          </div>
        )}

        {claim && (
          <TagEntryForm
            claim={claim}
            jobId={jobId}
            onDone={() => {
              setClaim(null)
              void queryClient.invalidateQueries({ queryKey: ['tags', jobId] })
              void queryClient.invalidateQueries({ queryKey: ['tags-completed', jobId] })
            }}
            onReleased={() => setClaim(null)}
          />
        )}
      </section>

      {isSupervisor && completed.data && completed.data.length > 0 && (
        <section className="card">
          <h2>Completed &amp; existing (read-only)</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Tag</th>
                <th>Equipment</th>
                <th>Status</th>
                <th>Additional Information</th>
              </tr>
            </thead>
            <tbody>
              {completed.data.map((t) => (
                <tr key={t.id}>
                  <td>{t.tag_number}</td>
                  <td>{t.equipment_description}</td>
                  <td><StatusBadge status={t.status} /></td>
                  <td className="mono small">
                    {t.generated_additional_information ?? t.original_additional_information ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}
