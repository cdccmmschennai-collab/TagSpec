import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiErrorMessage } from '../lib/api'
import type { Equipment, EquipmentAttribute } from '../lib/types'

export function EquipmentDetailPage() {
  const { equipmentId = '' } = useParams()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [attrName, setAttrName] = useState('')
  const [attrRequired, setAttrRequired] = useState(true)
  const [aliasName, setAliasName] = useState('')

  const eq = useQuery({
    queryKey: ['equipment', equipmentId],
    queryFn: async () => (await api.get<Equipment>(`/equipment/${equipmentId}`)).data,
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['equipment', equipmentId] })
    void queryClient.invalidateQueries({ queryKey: ['equipment'] })
  }

  const addAttr = useMutation({
    mutationFn: async () =>
      api.post(`/equipment/${equipmentId}/attributes`, {
        attribute_name: attrName,
        is_required: attrRequired,
      }),
    onSuccess: () => {
      setAttrName('')
      setError(null)
      invalidate()
    },
    onError: (err) => setError(apiErrorMessage(err)),
  })

  const addAlias = useMutation({
    mutationFn: async () => api.post(`/equipment/${equipmentId}/aliases`, { alias: aliasName }),
    onSuccess: () => {
      setAliasName('')
      setError(null)
      invalidate()
    },
    onError: (err) => setError(apiErrorMessage(err)),
  })

  const reorder = useMutation({
    mutationFn: async (items: { id: string; display_order: number }[]) =>
      api.post(`/equipment/${equipmentId}/attributes/reorder`, { items }),
    onSuccess: invalidate,
    onError: (err) => setError(apiErrorMessage(err)),
  })

  const toggleRequired = useMutation({
    mutationFn: async (a: EquipmentAttribute) =>
      api.patch(`/equipment/attributes/${a.id}`, { is_required: !a.is_required }),
    onSuccess: invalidate,
  })

  const removeAttr = useMutation({
    mutationFn: async (a: EquipmentAttribute) => api.delete(`/equipment/attributes/${a.id}`),
    onSuccess: invalidate,
  })

  function move(attrs: EquipmentAttribute[], index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= attrs.length) return
    const reordered = [...attrs]
    const [item] = reordered.splice(index, 1)
    reordered.splice(target, 0, item)
    reorder.mutate(reordered.map((a, i) => ({ id: a.id, display_order: i + 1 })))
  }

  if (eq.isLoading) return <div className="page">Loading…</div>
  if (eq.isError || !eq.data)
    return <div className="page"><div className="alert alert-error">{apiErrorMessage(eq.error)}</div></div>

  const attrs = [...eq.data.attributes].sort((a, b) => a.display_order - b.display_order)

  return (
    <div className="page">
      <Link to="/equipment-master" className="muted small">← Equipment Master</Link>
      <h1>{eq.data.equipment_description}</h1>
      <div className="muted small">Normalized: {eq.data.normalized_description}</div>

      {error && <div className="alert alert-error">{error}</div>}

      <section className="card">
        <h2>Attributes (order controls the generated string)</h2>
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Required</th>
              <th>Order</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {attrs.map((a, i) => (
              <tr key={a.id}>
                <td>{i + 1}</td>
                <td>{a.attribute_name}</td>
                <td>
                  <button className="btn btn-sm btn-ghost" onClick={() => toggleRequired.mutate(a)}>
                    {a.is_required ? 'Required' : 'Optional'}
                  </button>
                </td>
                <td className="btn-row">
                  <button className="btn btn-sm" onClick={() => move(attrs, i, -1)} disabled={i === 0}>↑</button>
                  <button className="btn btn-sm" onClick={() => move(attrs, i, 1)} disabled={i === attrs.length - 1}>↓</button>
                </td>
                <td>
                  <button className="btn btn-sm btn-ghost" onClick={() => removeAttr.mutate(a)}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="upload-row">
          <input placeholder="New attribute name" value={attrName} onChange={(e) => setAttrName(e.target.value)} />
          <label className="inline-check">
            <input type="checkbox" checked={attrRequired} onChange={(e) => setAttrRequired(e.target.checked)} />
            Required
          </label>
          <button className="btn btn-primary" onClick={() => addAttr.mutate()} disabled={!attrName.trim() || addAttr.isPending}>
            Add attribute
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Aliases</h2>
        {eq.data.aliases.length === 0 && <p className="muted">No aliases.</p>}
        <ul className="alias-list">
          {eq.data.aliases.map((al) => (
            <li key={al.id}>{al.alias}</li>
          ))}
        </ul>
        <div className="upload-row">
          <input placeholder="Alias (alternate description)" value={aliasName} onChange={(e) => setAliasName(e.target.value)} />
          <button className="btn btn-primary" onClick={() => addAlias.mutate()} disabled={!aliasName.trim() || addAlias.isPending}>
            Add alias
          </button>
        </div>
      </section>
    </div>
  )
}
