import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api, tokenStore } from '../lib/api'
import type { TokenResponse, User } from '../lib/types'

interface AuthState {
  user: User | null
  loading: boolean
  login: (employeeCode: string, password: string) => Promise<void>
  logout: () => void
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const loadMe = useCallback(async () => {
    if (!tokenStore.access) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const { data } = await api.get<User>('/auth/me')
      setUser(data)
    } catch {
      tokenStore.clear()
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadMe()
  }, [loadMe])

  const login = useCallback(async (employeeCode: string, password: string) => {
    const { data } = await api.post<TokenResponse>('/auth/login', {
      employee_code: employeeCode,
      password,
    })
    tokenStore.set(data.access_token, data.refresh_token)
    const me = await api.get<User>('/auth/me')
    setUser(me.data)
  }, [])

  const logout = useCallback(() => {
    tokenStore.clear()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, logout }),
    [user, loading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
