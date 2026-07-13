import axios from 'axios'
import type { AxiosError } from 'axios'
import type { ApiError } from './types'

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

const TOKEN_KEY = 'eai_access_token'
const REFRESH_KEY = 'eai_refresh_token'

export const tokenStore = {
  get access() {
    return localStorage.getItem(TOKEN_KEY)
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY)
  },
  set(access: string, refresh: string) {
    localStorage.setItem(TOKEN_KEY, access)
    localStorage.setItem(REFRESH_KEY, refresh)
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

export const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
})

api.interceptors.request.use((config) => {
  const token = tokenStore.access
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiError>) => {
    if (error.response?.status === 401) {
      // Token invalid/expired — clear and let the UI redirect to login.
      const url = error.config?.url ?? ''
      if (!url.includes('/auth/login')) {
        tokenStore.clear()
      }
    }
    return Promise.reject(error)
  },
)

export function apiErrorMessage(error: unknown): string {
  const err = error as AxiosError<ApiError>
  return (
    err.response?.data?.error?.message ??
    err.message ??
    'An unexpected error occurred'
  )
}

export function apiErrorCode(error: unknown): string | undefined {
  const err = error as AxiosError<ApiError>
  return err.response?.data?.error?.code
}
