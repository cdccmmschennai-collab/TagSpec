import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiErrorMessage } from '../../lib/api'
import type { Equipment, EquipmentDescriptionCount } from '../../lib/types'
import { Button, EmptyState, Select } from '../ui/primitives'
import { Dialog } from '../ui/Dialog'
import { useToast } from '../ui/useToast'
import { CheckCircleIcon, PackageIcon, PlusIcon } from '../ui/icons'

export function MissingTemplatesTab({
  jobId,
  descriptions,
  isSupervisor,
  isAdmin,
}: {
  jobId: string
  descriptions: EquipmentDescriptionCount[]
  isSupervisor: boolean
  isAdmin: boolean
}) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [mapping, setMapping] = useState<EquipmentDescriptionCount | null>(null)
  const [templateId, setTemplateId] = useState('')

  const unmatched = descriptions.filter((d) => d.equipment_template_id === null)
  const totalTags = unmatched.reduce((s, d) => s + d.total, 0)

  const equipment = useQuery({
    queryKey: ['equipment'],
    enabled: isSupervisor,
    queryFn: async () => (await api.get<Equipment[]>('/equipment')).data,
  })

  const assign = useMutation({
    mutationFn: async () => {
      if (!mapping || !templateId) throw new Error('Choose a template')
      return api.post(`/workbooks/${jobId}/assign-equipment`, {
        normalized_equipment_description: mapping.normalized_equipment_description,
        equipment_template_id: templateId,
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['equipment-descriptions', jobId] })
      void queryClient.invalidateQueries({ queryKey: ['job-tags', jobId] })
      toast.success('Template mapped', `“${mapping?.equipment_description}” is now workable.`)
      setMapping(null)
      setTemplateId('')
    },
    onError: (err) => toast.error('Could not map template', apiErrorMessage(err)),
  })

  if (unmatched.length === 0) {
    return (
      <EmptyState
        icon={<CheckCircleIcon size={32} />}
        title="Every equipment description is matched"
        message="All imported tags map to an equipment template in the Attribute Master."
      />
    )
  }

  return (
    <div className="stack">
      <div className="alert alert-info">
        <PackageIcon size={16} />
        <div>
          <div className="strong">{unmatched.length} unmatched equipment description{unmatched.length === 1 ? '' : 's'} · {totalTags} affected tag{totalTags === 1 ? '' : 's'}</div>
          <div className="small">These descriptions have no matching template, so their tags cannot be worked yet. Map them to an existing template or create a new one in the Attribute Master.</div>
        </div>
      </div>

      <div className="table-wrap card">
        <table className="table">
          <thead>
            <tr>
              <th>Equipment description (unmatched)</th>
              <th className="num">Affected tags</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {unmatched.map((d) => (
              <tr key={d.normalized_equipment_description}>
                <td className="strong">{d.equipment_description}</td>
                <td className="num">{d.total}</td>
                <td>
                  <div className="cell-actions">
                    {isSupervisor && (
                      <Button size="sm" onClick={() => { setMapping(d); setTemplateId('') }}>Map to template</Button>
                    )}
                    {isAdmin && (
                      <Link className="btn btn-sm" to="/attribute-master"><PlusIcon size={14} /> Create template</Link>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog
        open={!!mapping}
        onClose={() => setMapping(null)}
        title="Map to an existing template"
        subtitle={mapping?.equipment_description}
        footer={
          <>
            <Button onClick={() => setMapping(null)} disabled={assign.isPending}>Cancel</Button>
            <Button variant="primary" onClick={() => assign.mutate()} loading={assign.isPending} disabled={!templateId}>
              Map {mapping?.total ?? 0} tag{mapping?.total === 1 ? '' : 's'}
            </Button>
          </>
        }
      >
        <div className="field">
          <label className="label" htmlFor="map-template">Equipment template</label>
          <Select id="map-template" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            <option value="">Select a template…</option>
            {(equipment.data ?? [])
              .filter((e) => e.is_active)
              .map((e) => (
                <option key={e.id} value={e.id}>{e.equipment_description}</option>
              ))}
          </Select>
          <span className="field-hint">All tags with this description will be pointed at the chosen template and become available for entry.</span>
        </div>
      </Dialog>
    </div>
  )
}
