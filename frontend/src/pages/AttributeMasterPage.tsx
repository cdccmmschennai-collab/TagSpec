import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiErrorMessage } from '../lib/api'
import type { Equipment, EquipmentAttribute } from '../lib/types'
import { Button, Badge, EmptyState, Field, LoadingRow, PageHeader, SearchInput } from '../components/ui/primitives'
import { Dialog, ConfirmDialog } from '../components/ui/Dialog'
import { useToast } from '../components/ui/useToast'
import {
  ChevronDownIcon, ChevronUpIcon, PackageIcon, PencilIcon, PlusIcon, TrashIcon,
} from '../components/ui/icons'

export function AttributeMasterPage() {
  const { equipmentId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)

  const list = useQuery({
    queryKey: ['equipment'],
    queryFn: async () => (await api.get<Equipment[]>('/equipment')).data,
  })

  const selectedId = equipmentId ?? ''
  const selected = list.data?.find((e) => e.id === selectedId) ?? null

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (list.data ?? [])
      .filter((e) => (q ? e.equipment_description.toLowerCase().includes(q) || (e.equipment_code ?? '').toLowerCase().includes(q) : true))
      .sort((a, b) => a.equipment_description.localeCompare(b.equipment_description))
  }, [list.data, search])

  return (
    <div className="page">
      <PageHeader
        title="Attribute Master"
        subtitle="Define equipment templates and the ordered attributes that build each tag's Additional Information."
        actions={<Button variant="primary" icon={<PlusIcon size={16} />} onClick={() => setCreateOpen(true)}>Create Equipment</Button>}
      />

      <div className="split">
        {/* Left — equipment list */}
        <div className="panel">
          <div className="panel-head">
            <h3>Equipment</h3>
            <SearchInput value={search} onChange={setSearch} placeholder="Search equipment…" aria-label="Search equipment" />
          </div>
          <div className="panel-scroll">
            {list.isLoading ? (
              <LoadingRow label="Loading…" />
            ) : filtered.length === 0 ? (
              <EmptyState icon={<PackageIcon size={26} />} title="No equipment" message="Create an equipment template to get started." />
            ) : (
              filtered.map((e) => (
                <button
                  key={e.id}
                  className={`list-item ${e.id === selectedId ? 'active' : ''}`.trim()}
                  onClick={() => navigate(`/attribute-master/${e.id}`)}
                >
                  <span className="li-row">
                    <span className="li-title truncate" title={e.equipment_description}>{e.equipment_description}</span>
                    {!e.is_active && <Badge tone="gray">Inactive</Badge>}
                  </span>
                  <span className="li-meta">{e.attributes.length} attribute{e.attributes.length === 1 ? '' : 's'}{e.equipment_code ? ` · ${e.equipment_code}` : ''}</span>
                </button>
              ))
            )}
          </div>
          <div className="panel-foot">{filtered.length} equipment template{filtered.length === 1 ? '' : 's'}</div>
        </div>

        {/* Right — detail */}
        {selected ? (
          <EquipmentDetailPanel equipment={selected} />
        ) : (
          <div className="panel">
            <div className="loading-center" style={{ flex: 1 }}>
              <EmptyState icon={<PackageIcon size={32} />} title="Select an equipment template" message="Choose an item on the left to view and edit its attributes." />
            </div>
          </div>
        )}
      </div>

      <CreateEquipmentDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(eq) => {
          void queryClient.invalidateQueries({ queryKey: ['equipment'] })
          toast.success('Equipment created', eq.equipment_description)
          navigate(`/attribute-master/${eq.id}`)
        }}
      />
    </div>
  )
}

/* --------------------------------------------------------- detail panel */
function EquipmentDetailPanel({ equipment }: { equipment: Equipment }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [editEquip, setEditEquip] = useState(false)
  const [attrDialog, setAttrDialog] = useState<{ mode: 'create' | 'edit'; attr?: EquipmentAttribute } | null>(null)
  const [removeAttr, setRemoveAttr] = useState<EquipmentAttribute | null>(null)
  const [aliasName, setAliasName] = useState('')

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['equipment'] })
  const onErr = (err: unknown) => toast.error('Action failed', apiErrorMessage(err))

  const attrs = [...equipment.attributes].sort((a, b) => a.display_order - b.display_order)

  const toggleActive = useMutation({
    mutationFn: async () => api.post(`/equipment/${equipment.id}/${equipment.is_active ? 'deactivate' : 'activate'}`),
    onSuccess: () => { void invalidate(); toast.success(equipment.is_active ? 'Equipment deactivated' : 'Equipment activated') },
    onError: onErr,
  })

  const reorder = useMutation({
    mutationFn: async (items: { id: string; display_order: number }[]) =>
      api.post(`/equipment/${equipment.id}/attributes/reorder`, { items }),
    onSuccess: invalidate,
    onError: onErr,
  })

  const toggleRequired = useMutation({
    mutationFn: async (a: EquipmentAttribute) => api.patch(`/equipment/attributes/${a.id}`, { is_required: !a.is_required }),
    onSuccess: invalidate,
    onError: onErr,
  })

  const deleteAttr = useMutation({
    mutationFn: async (a: EquipmentAttribute) => api.delete(`/equipment/attributes/${a.id}`),
    onSuccess: () => { void invalidate(); toast.success('Attribute removed'); setRemoveAttr(null) },
    onError: onErr,
  })

  const addAlias = useMutation({
    mutationFn: async () => api.post(`/equipment/${equipment.id}/aliases`, { alias: aliasName }),
    onSuccess: () => { setAliasName(''); void invalidate(); toast.success('Alias added') },
    onError: onErr,
  })

  function move(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= attrs.length) return
    const reordered = [...attrs]
    const [item] = reordered.splice(index, 1)
    reordered.splice(target, 0, item)
    reorder.mutate(reordered.map((a, i) => ({ id: a.id, display_order: i + 1 })))
  }

  return (
    <div className="panel">
      <div className="panel-head" style={{ gap: '0.75rem' }}>
        <div className="row-between">
          <div className="stack" style={{ gap: '0.2rem' }}>
            <div className="row gap-sm wrap">
              <h2 style={{ fontSize: '1.15rem' }}>{equipment.equipment_description}</h2>
              <Badge tone={equipment.is_active ? 'green' : 'gray'} dot>{equipment.is_active ? 'Active' : 'Inactive'}</Badge>
            </div>
            <div className="small muted">
              {equipment.equipment_code ? `Code ${equipment.equipment_code} · ` : ''}Normalized: {equipment.normalized_description}
            </div>
          </div>
          <div className="row gap-sm">
            <Button size="sm" icon={<PencilIcon size={14} />} onClick={() => setEditEquip(true)}>Edit</Button>
            <Button size="sm" onClick={() => toggleActive.mutate()} loading={toggleActive.isPending}>
              {equipment.is_active ? 'Deactivate' : 'Activate'}
            </Button>
          </div>
        </div>
      </div>

      <div className="panel-scroll" style={{ padding: '1rem 1.1rem' }}>
        <div className="row-between" style={{ marginBottom: '0.6rem' }}>
          <span className="strong small">Attributes <span className="muted">(order builds the generated string)</span></span>
          <Button size="sm" icon={<PlusIcon size={14} />} onClick={() => setAttrDialog({ mode: 'create' })}>Add Attribute</Button>
        </div>

        {attrs.length === 0 ? (
          <EmptyState title="No attributes yet" message="Add attributes to define this equipment's Additional Information format." />
        ) : (
          <div className="table-wrap card">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Attribute</th>
                  <th>Placeholder</th>
                  <th>Required</th>
                  <th>Order</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {attrs.map((a, i) => (
                  <tr key={a.id}>
                    <td className="muted">{a.display_order}</td>
                    <td>
                      <div className="strong">{a.display_label}</div>
                      <div className="tiny muted mono">{a.attribute_name}</div>
                    </td>
                    <td className="muted small truncate" style={{ maxWidth: 160 }}>{a.placeholder || '—'}</td>
                    <td>
                      <button className="badge-btn" onClick={() => toggleRequired.mutate(a)} title="Toggle required" style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>
                        <Badge tone={a.is_required ? 'blue' : 'gray'}>{a.is_required ? 'Required' : 'Optional'}</Badge>
                      </button>
                    </td>
                    <td>
                      <div className="cell-actions">
                        <button className="btn btn-sm btn-icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"><ChevronUpIcon size={14} /></button>
                        <button className="btn btn-sm btn-icon" onClick={() => move(i, 1)} disabled={i === attrs.length - 1} aria-label="Move down"><ChevronDownIcon size={14} /></button>
                      </div>
                    </td>
                    <td>
                      <div className="cell-actions">
                        <button className="btn btn-sm btn-icon" onClick={() => setAttrDialog({ mode: 'edit', attr: a })} aria-label="Edit attribute"><PencilIcon size={14} /></button>
                        <button className="btn btn-sm btn-icon btn-danger" onClick={() => setRemoveAttr(a)} aria-label="Remove attribute"><TrashIcon size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="divider" style={{ margin: '1.1rem 0' }} />

        <div className="strong small" style={{ marginBottom: '0.5rem' }}>Aliases</div>
        {equipment.aliases.length === 0 ? (
          <p className="muted small" style={{ margin: '0 0 0.6rem' }}>No aliases. Add alternate descriptions that should match this template.</p>
        ) : (
          <div className="row gap-sm wrap" style={{ marginBottom: '0.6rem' }}>
            {equipment.aliases.map((al) => <span key={al.id} className="chip">{al.alias}</span>)}
          </div>
        )}
        <div className="toolbar">
          <div className="input-search grow" style={{ maxWidth: 320 }}>
            <input className="input" placeholder="Alias (alternate description)" value={aliasName} onChange={(e) => setAliasName(e.target.value)} aria-label="New alias" style={{ paddingLeft: '0.65rem' }} />
          </div>
          <Button icon={<PlusIcon size={15} />} onClick={() => addAlias.mutate()} disabled={!aliasName.trim() || addAlias.isPending}>Add alias</Button>
        </div>
      </div>

      {editEquip && <EditEquipmentDialog equipment={equipment} onClose={() => setEditEquip(false)} onSaved={() => { void invalidate(); toast.success('Equipment updated') }} />}
      {attrDialog && (
        <AttributeDialog
          equipmentId={equipment.id}
          mode={attrDialog.mode}
          attr={attrDialog.attr}
          onClose={() => setAttrDialog(null)}
          onSaved={() => { void invalidate(); setAttrDialog(null) }}
        />
      )}
      <ConfirmDialog
        open={!!removeAttr}
        onCancel={() => setRemoveAttr(null)}
        onConfirm={() => removeAttr && deleteAttr.mutate(removeAttr)}
        title="Remove attribute"
        message={<>Remove <b>{removeAttr?.display_label}</b> from this equipment? This changes the generated Additional Information format.</>}
        confirmLabel="Remove"
        destructive
        loading={deleteAttr.isPending}
      />
    </div>
  )
}

/* ----------------------------------------------------------- dialogs */
function CreateEquipmentDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (e: Equipment) => void }) {
  const toast = useToast()
  const [description, setDescription] = useState('')
  const [code, setCode] = useState('')
  const create = useMutation({
    mutationFn: async () =>
      (await api.post<Equipment>('/equipment', { equipment_description: description, equipment_code: code || null, attributes: [] })).data,
    onSuccess: (eq) => { setDescription(''); setCode(''); onCreated(eq); onClose() },
    onError: (err) => toast.error('Could not create', apiErrorMessage(err)),
  })
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Create Equipment"
      footer={<><Button onClick={onClose} disabled={create.isPending}>Cancel</Button><Button variant="primary" onClick={() => create.mutate()} loading={create.isPending} disabled={!description.trim()}>Create</Button></>}
    >
      <div className="stack">
        <Field label="Equipment description" htmlFor="ce-desc" required>
          <input id="ce-desc" className="input" autoFocus placeholder="BALL VALVE" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Equipment code" htmlFor="ce-code" hint="Optional short code">
          <input id="ce-code" className="input" placeholder="BV" value={code} onChange={(e) => setCode(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  )
}

function EditEquipmentDialog({ equipment, onClose, onSaved }: { equipment: Equipment; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [description, setDescription] = useState(equipment.equipment_description)
  const [code, setCode] = useState(equipment.equipment_code ?? '')
  const save = useMutation({
    mutationFn: async () => api.patch(`/equipment/${equipment.id}`, { equipment_description: description, equipment_code: code || null }),
    onSuccess: () => { onSaved(); onClose() },
    onError: (err) => toast.error('Could not save', apiErrorMessage(err)),
  })
  return (
    <Dialog
      open
      onClose={onClose}
      title="Edit Equipment"
      footer={<><Button onClick={onClose} disabled={save.isPending}>Cancel</Button><Button variant="primary" onClick={() => save.mutate()} loading={save.isPending} disabled={!description.trim()}>Save</Button></>}
    >
      <div className="stack">
        <Field label="Equipment description" htmlFor="ee-desc" required>
          <input id="ee-desc" className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Equipment code" htmlFor="ee-code">
          <input id="ee-code" className="input" value={code} onChange={(e) => setCode(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  )
}

function AttributeDialog({
  equipmentId, mode, attr, onClose, onSaved,
}: {
  equipmentId: string
  mode: 'create' | 'edit'
  attr?: EquipmentAttribute
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [name, setName] = useState(attr?.attribute_name ?? '')
  const [label, setLabel] = useState(attr?.display_label ?? '')
  const [placeholder, setPlaceholder] = useState(attr?.placeholder ?? '')
  const [required, setRequired] = useState(attr?.is_required ?? true)

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        attribute_name: name,
        display_label: label || null,
        placeholder: placeholder || null,
        is_required: required,
      }
      if (mode === 'create') return api.post(`/equipment/${equipmentId}/attributes`, body)
      return api.patch(`/equipment/attributes/${attr!.id}`, body)
    },
    onSuccess: () => { toast.success(mode === 'create' ? 'Attribute added' : 'Attribute updated'); onSaved() },
    onError: (err) => toast.error('Could not save', apiErrorMessage(err)),
  })

  return (
    <Dialog
      open
      onClose={onClose}
      title={mode === 'create' ? 'Add Attribute' : 'Edit Attribute'}
      footer={<><Button onClick={onClose} disabled={save.isPending}>Cancel</Button><Button variant="primary" onClick={() => save.mutate()} loading={save.isPending} disabled={!name.trim()}>{mode === 'create' ? 'Add' : 'Save'}</Button></>}
    >
      <div className="stack">
        <Field label="Attribute name" htmlFor="ad-name" required hint="Uppercase key used in the generated string, e.g. BODY">
          <input id="ad-name" className="input" autoFocus placeholder="BODY" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Display label" htmlFor="ad-label" hint="Shown to engineers; defaults to the attribute name">
          <input id="ad-label" className="input" placeholder="Body material" value={label} onChange={(e) => setLabel(e.target.value)} />
        </Field>
        <Field label="Placeholder" htmlFor="ad-ph" hint="Example value shown in the input">
          <input id="ad-ph" className="input" placeholder="e.g. A105N" value={placeholder} onChange={(e) => setPlaceholder(e.target.value)} />
        </Field>
        <label className="checkbox">
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} /> Required field
        </label>
      </div>
    </Dialog>
  )
}
