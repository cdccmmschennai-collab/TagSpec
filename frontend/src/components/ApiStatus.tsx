import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

export function ApiStatus() {
  const { data, isError, isLoading } = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const { data } = await api.get<{ status: string; database?: string }>('/health/db')
      return data
    },
    refetchInterval: 30_000,
  })

  const ok = data?.status === 'ok' && !isError
  const state = isLoading ? 'idle' : ok ? 'ok' : 'bad'
  const label = isLoading ? 'Checking API…' : ok ? 'API online' : 'API offline'

  return (
    <span className="api-status" title="Backend API health" role="status">
      <span className={`dot ${state}`} aria-hidden="true" />
      {label}
    </span>
  )
}
