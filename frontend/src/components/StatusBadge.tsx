import type { TagStatus } from '../lib/types'

const COLORS: Record<string, string> = {
  AVAILABLE: '#2563eb',
  CLAIMED: '#d97706',
  DRAFT: '#7c3aed',
  COMPLETED: '#16a34a',
  EXPORTED: '#0891b2',
  EXISTING_IN_EXCEL: '#6b7280',
  TEMPLATE_MISSING: '#dc2626',
  REVIEW_REQUIRED: '#db2777',
  REVIEWED: '#059669',
}

export function StatusBadge({ status }: { status: TagStatus | string }) {
  const color = COLORS[status] ?? '#6b7280'
  return (
    <span className="badge" style={{ background: `${color}22`, color, borderColor: `${color}55` }}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}
