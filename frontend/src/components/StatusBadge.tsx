import { Badge } from './ui/primitives'
import { tagStatusMeta, jobStatusMeta } from '../lib/status'

export function StatusBadge({ status }: { status: string }) {
  const meta = tagStatusMeta(status)
  return <Badge tone={meta.tone} dot>{meta.label}</Badge>
}

export function JobStatusBadge({ status }: { status: string }) {
  const meta = jobStatusMeta(status)
  return <Badge tone={meta.tone} dot>{meta.label}</Badge>
}
