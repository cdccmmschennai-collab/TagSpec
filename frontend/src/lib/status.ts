// Central mapping of backend status values to human labels and badge tones.
// Backend values are preserved verbatim; only presentation changes here.

type Tone = 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'cyan' | 'gray'

interface Meta {
  label: string
  tone: Tone
}

export const TAG_STATUS_META: Record<string, Meta> = {
  AVAILABLE: { label: 'Available', tone: 'blue' },
  CLAIMED: { label: 'Claimed', tone: 'amber' },
  DRAFT: { label: 'Draft', tone: 'violet' },
  COMPLETED: { label: 'Completed', tone: 'green' },
  EXPORTED: { label: 'Exported', tone: 'cyan' },
  EXISTING_IN_EXCEL: { label: 'Existing in Excel', tone: 'gray' },
  TEMPLATE_MISSING: { label: 'Missing Template', tone: 'red' },
  REVIEW_REQUIRED: { label: 'Review Required', tone: 'amber' },
  REVIEWED: { label: 'Reviewed', tone: 'green' },
}

export function tagStatusMeta(status: string): Meta {
  return TAG_STATUS_META[status] ?? { label: status.replace(/_/g, ' '), tone: 'gray' }
}

// Workbook job status → badge presentation.
export const JOB_STATUS_META: Record<string, Meta> = {
  UPLOADED: { label: 'Uploaded', tone: 'gray' },
  VALIDATING: { label: 'Validating', tone: 'amber' },
  READY: { label: 'Ready', tone: 'blue' },
  IN_PROGRESS: { label: 'In Progress', tone: 'amber' },
  EXPORTED: { label: 'Exported', tone: 'green' },
  COMPLETED: { label: 'Completed', tone: 'green' },
  FAILED: { label: 'Failed', tone: 'red' },
}

export function jobStatusMeta(status: string): Meta {
  return JOB_STATUS_META[status] ?? { label: status.replace(/_/g, ' '), tone: 'gray' }
}
