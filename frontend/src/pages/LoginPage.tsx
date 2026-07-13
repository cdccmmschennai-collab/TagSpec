import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '../auth/useAuth'
import { apiErrorMessage } from '../lib/api'

const schema = z.object({
  employee_code: z.string().min(1, 'Employee code is required'),
  password: z.string().min(1, 'Password is required'),
})
type FormValues = z.infer<typeof schema>

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      await login(values.employee_code, values.password)
      navigate('/jobs')
    } catch (err) {
      setServerError(apiErrorMessage(err))
    }
  })

  return (
    <div className="center-page">
      <form className="card login-card" onSubmit={onSubmit}>
        <h1>Sign in</h1>
        <p className="muted">Equipment Additional Information Tool</p>

        <label>
          Employee code
          <input autoFocus {...register('employee_code')} />
          {errors.employee_code && <span className="field-error">{errors.employee_code.message}</span>}
        </label>

        <label>
          Password
          <input type="password" {...register('password')} />
          {errors.password && <span className="field-error">{errors.password.message}</span>}
        </label>

        {serverError && <div className="alert alert-error">{serverError}</div>}

        <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
