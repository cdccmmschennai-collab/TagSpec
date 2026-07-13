import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

export function HealthStatus() {
  const { data, isError, isLoading } = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const { data } = await api.get<{ status: string; database?: string }>('/health/db')
      return data
    },
    refetchInterval: 30_000,
  })

  const ok = data?.status === 'ok' && !isError
  const label = isLoading ? 'checking…' : ok ? 'API online' : 'API offline'
  const color = isLoading ? '#9ca3af' : ok ? '#16a34a' : '#dc2626'

  return (
    <span className="health" title="Backend API health">
      <span className="dot" style={{ background: color }} />
      {label}
    </span>
  )
}
