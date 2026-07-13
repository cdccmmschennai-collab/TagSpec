import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, apiErrorMessage } from '../lib/api'
import type { UploadResponse } from '../lib/types'
import { Drawer } from './ui/Dialog'
import { Button, Field } from './ui/primitives'
import { useToast } from './ui/useToast'
import { UploadIcon, SheetIcon } from './ui/icons'
import { formatBytes } from '../lib/format'

export function UploadWorkbookDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [projectCode, setProjectCode] = useState('')
  const [revision, setRevision] = useState('')
  const [jobName, setJobName] = useState('')
  const [dragging, setDragging] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)

  function reset() {
    setFile(null)
    setProjectCode('')
    setRevision('')
    setJobName('')
    setFileError(null)
  }

  function pickFile(f: File | undefined) {
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.xlsx')) {
      setFileError('Only .xlsx workbooks are supported.')
      return
    }
    setFileError(null)
    setFile(f)
  }

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Choose an .xlsx file first')
      const form = new FormData()
      form.append('file', file)
      if (projectCode) form.append('project_code', projectCode)
      if (revision) form.append('revision', revision)
      if (jobName) form.append('job_name', jobName)
      const { data } = await api.post<UploadResponse>('/workbooks', form)
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['jobs'] })
      if (data.duplicate) {
        toast.warning('Workbook already uploaded', 'Showing the existing job for this file.')
      } else {
        const v = data.validation
        toast.success(
          'Workbook uploaded',
          v ? `Sheet “${v.sheet_name}”, header row ${v.header_row_number} detected.` : undefined,
        )
      }
      reset()
      onClose()
    },
    onError: (err) => toast.error('Upload failed', apiErrorMessage(err)),
  })

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Upload Workbook"
      subtitle="Import an equipment specification workbook (.xlsx)."
      footer={
        <>
          <Button onClick={onClose} disabled={upload.isPending}>Cancel</Button>
          <Button variant="primary" icon={<UploadIcon size={16} />} loading={upload.isPending} disabled={!file} onClick={() => upload.mutate()}>
            Upload
          </Button>
        </>
      }
    >
      <div className="stack">
        <div
          className={`dropzone ${dragging ? 'drag' : ''}`.trim()}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files?.[0]) }}
          role="button"
          tabIndex={0}
          aria-label="Choose or drop an .xlsx workbook"
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        >
          {file ? (
            <>
              <span className="dz-icon"><SheetIcon size={26} /></span>
              <span className="dz-file">{file.name}</span>
              <span className="dz-hint">{formatBytes(file.size)} · click to replace</span>
            </>
          ) : (
            <>
              <span className="dz-icon"><UploadIcon size={26} /></span>
              <span className="dz-title">Drag &amp; drop or browse</span>
              <span className="dz-hint">Accepts a single .xlsx workbook</span>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx"
            hidden
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
        </div>
        {fileError && <div className="alert alert-error">{fileError}</div>}

        <Field label="Project code" htmlFor="up-project" hint="Optional — e.g. P389">
          <input id="up-project" className="input" placeholder="P389" value={projectCode} onChange={(e) => setProjectCode(e.target.value)} />
        </Field>
        <Field label="Revision" htmlFor="up-rev" hint="Optional — e.g. REV1">
          <input id="up-rev" className="input" placeholder="REV1" value={revision} onChange={(e) => setRevision(e.target.value)} />
        </Field>
        <Field label="Job name" htmlFor="up-name" hint="Optional — defaults to the file name">
          <input id="up-name" className="input" placeholder="Defaults to file name" value={jobName} onChange={(e) => setJobName(e.target.value)} />
        </Field>
      </div>
    </Drawer>
  )
}
