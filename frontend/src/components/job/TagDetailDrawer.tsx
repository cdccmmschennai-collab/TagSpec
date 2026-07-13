import type { TagRow } from '../../lib/types'
import { Drawer } from '../ui/Dialog'
import { StatusBadge } from '../StatusBadge'
import { formatDateTime } from '../../lib/format'

export function TagDetailDrawer({ tag, onClose }: { tag: TagRow | null; onClose: () => void }) {
  const addl = tag?.generated_additional_information ?? tag?.original_additional_information ?? ''
  return (
    <Drawer open={!!tag} onClose={onClose} title={tag?.tag_number ?? 'Tag'} subtitle={tag?.equipment_description ?? undefined}>
      {tag && (
        <div className="stack">
          <div className="row gap-sm wrap">
            <StatusBadge status={tag.status} />
            <span className="chip">Excel row {tag.excel_row_number}</span>
            {tag.completed_at && <span className="chip">Completed {formatDateTime(tag.completed_at)}</span>}
          </div>

          <div className="field">
            <span className="label">Additional Information</span>
            <div className="preview" style={{ marginTop: 0 }}>
              <code>{addl || '—'}</code>
            </div>
          </div>

          {tag.attribute_values_json && Object.keys(tag.attribute_values_json).length > 0 && (
            <div className="field">
              <span className="label">Attribute values</span>
              <div className="table-wrap card">
                <table className="table">
                  <tbody>
                    {Object.entries(tag.attribute_values_json).map(([k, v]) => (
                      <tr key={k}>
                        <td className="muted nowrap">{k}</td>
                        <td className="mono">{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </Drawer>
  )
}
