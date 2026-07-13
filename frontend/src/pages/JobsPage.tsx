import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiErrorMessage } from '../lib/api'
import { useAuth } from '../auth/useAuth'
import type { UploadResponse, WorkbookJob } from '../lib/types'

export function JobsPage() {
  const { user } = useAuth()
  const canUpload = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR'
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [projectCode, setProjectCode] = useState('')
  const [revision, setRevision] = useState('')
  const [result, setResult] = useState<UploadResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const jobs = useQuery({
    queryKey: ['jobs'],
    queryFn: async () => (await api.get<WorkbookJob[]>('/workbooks')).data,
  })

  const upload = useMutation({
    mutationFn: async () => {
      const file = fileRef.current?.files?.[0]
      if (!file) throw new Error('Choose an .xlsx file first')
      const form = new FormData()
      form.append('file', file)
      if (projectCode) form.append('project_code', projectCode)
      if (revision) form.append('revision', revision)
      const { data } = await api.post<UploadResponse>('/workbooks', form)
      return data
    },
    onSuccess: (data) => {
      setResult(data)
      setError(null)
      void queryClient.invalidateQueries({ queryKey: ['jobs'] })
    },
    onError: (err) => {
      setError(apiErrorMessage(err))
      setResult(null)
    },
  })

  return (
    <div className="page">
      <h1>Workbook Jobs</h1>

      {canUpload && (
        <section className="card">
          <h2>Upload a workbook</h2>
          <div className="upload-row">
            <input ref={fileRef} type="file" accept=".xlsx" />
            <input
              placeholder="Project code (e.g. P389)"
              value={projectCode}
              onChange={(e) => setProjectCode(e.target.value)}
            />
            <input
              placeholder="Revision (e.g. REV1)"
              value={revision}
              onChange={(e) => setRevision(e.target.value)}
            />
            <button
              className="btn btn-primary"
              onClick={() => upload.mutate()}
              disabled={upload.isPending}
            >
              {upload.isPending ? 'Uploading…' : 'Upload'}
            </button>
          </div>

          {error && <div className="alert alert-error">{error}</div>}
          {result && (
            <div className={`alert ${result.duplicate ? 'alert-warn' : 'alert-success'}`}>
              {result.duplicate
                ? 'This workbook was already uploaded — showing the existing job.'
                : 'Uploaded and validated.'}
              {result.validation && (
                <div className="muted small">
                  Sheet <b>{result.validation.sheet_name}</b>, header row{' '}
                  {result.validation.header_row_number}, columns: TAG=
                  {result.validation.tag_column_number}, EQUIP=
                  {result.validation.equipment_column_number}, ADDL=
                  {result.validation.additional_info_column_number}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <section className="card">
        <h2>Jobs</h2>
        {jobs.isLoading && <p>Loading…</p>}
        {jobs.isError && <div className="alert alert-error">{apiErrorMessage(jobs.error)}</div>}
        {jobs.data && jobs.data.length === 0 && <p className="muted">No jobs yet.</p>}
        {jobs.data && jobs.data.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Project</th>
                <th>Rev</th>
                <th>Sheet</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {jobs.data.map((j) => (
                <tr key={j.id}>
                  <td>{j.job_name}</td>
                  <td>{j.project_code ?? '—'}</td>
                  <td>{j.revision ?? '—'}</td>
                  <td>{j.sheet_name ?? '—'}</td>
                  <td>{j.status}</td>
                  <td>
                    <Link className="btn btn-sm" to={`/jobs/${j.id}`}>
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
