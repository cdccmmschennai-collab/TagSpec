import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiErrorMessage } from '../lib/api'
import type { Equipment } from '../lib/types'

export function EquipmentMasterPage() {
  const queryClient = useQueryClient()
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  const equipment = useQuery({
    queryKey: ['equipment'],
    queryFn: async () => (await api.get<Equipment[]>('/equipment')).data,
  })

  const create = useMutation({
    mutationFn: async () =>
      (await api.post<Equipment>('/equipment', { equipment_description: description, attributes: [] })).data,
    onSuccess: () => {
      setDescription('')
      setError(null)
      void queryClient.invalidateQueries({ queryKey: ['equipment'] })
    },
    onError: (err) => setError(apiErrorMessage(err)),
  })

  const toggle = useMutation({
    mutationFn: async (eq: Equipment) =>
      api.post(`/equipment/${eq.id}/${eq.is_active ? 'deactivate' : 'activate'}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['equipment'] }),
  })

  return (
    <div className="page">
      <h1>Equipment Master</h1>

      <section className="card">
        <h2>Create equipment</h2>
        <div className="upload-row">
          <input
            placeholder="Equipment description (e.g. BALL VALVE)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button
            className="btn btn-primary"
            onClick={() => create.mutate()}
            disabled={!description.trim() || create.isPending}
          >
            Create
          </button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
      </section>

      <section className="card">
        <h2>Equipment</h2>
        {equipment.isLoading && <p>Loading…</p>}
        {equipment.data && equipment.data.length === 0 && <p className="muted">No equipment yet.</p>}
        {equipment.data && equipment.data.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Attributes</th>
                <th>Aliases</th>
                <th>Active</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {equipment.data.map((eq) => (
                <tr key={eq.id}>
                  <td>{eq.equipment_description}</td>
                  <td>{eq.attributes.length}</td>
                  <td>{eq.aliases.length}</td>
                  <td>{eq.is_active ? 'Yes' : 'No'}</td>
                  <td className="btn-row">
                    <Link className="btn btn-sm" to={`/equipment-master/${eq.id}`}>
                      Edit
                    </Link>
                    <button className="btn btn-sm btn-ghost" onClick={() => toggle.mutate(eq)}>
                      {eq.is_active ? 'Deactivate' : 'Activate'}
                    </button>
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
