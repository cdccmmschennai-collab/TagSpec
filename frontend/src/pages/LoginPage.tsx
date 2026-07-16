import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '../auth/useAuth'
import { apiErrorMessage } from '../lib/api'
import { Button, Field } from '../components/ui/primitives'
import { AlertIcon, EyeIcon, EyeOffIcon, LockIcon, UserIcon } from '../components/ui/icons'

const schema = z.object({
  employee_code: z.string().min(1, 'Employee ID is required'),
  password: z.string().min(1, 'Password is required'),
})
type FormValues = z.infer<typeof schema>

function LoginBrand() {
  const [logoOk, setLogoOk] = useState(true)
  return (
    <div className="auth-brand">
      {logoOk ? (
        <img className="brand-logo" src="/company-logo.png" alt="CDC" onError={() => setLogoOk(false)} />
      ) : (
        <span className="brand-mark" aria-hidden="true">TS</span>
      )}
      <div className="auth-name">TagSpec</div>
      <div className="auth-sub">Equipment Attribute Workspace</div>
    </div>
  )
}

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
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
    <div className="auth-wrap">
      <form className="auth-card stack" onSubmit={onSubmit}>
        <LoginBrand />

        <Field label="Employee ID" htmlFor="employee_code" error={errors.employee_code?.message}>
          <div className="input-icon">
            <span className="leading-icon"><UserIcon size={17} /></span>
            <input
              id="employee_code"
              className="input"
              placeholder="Enter Employee ID"
              autoFocus
              autoComplete="username"
              {...register('employee_code')}
            />
          </div>
        </Field>

        <Field label="Password" htmlFor="password" error={errors.password?.message}>
          <div className="input-icon has-trailing">
            <span className="leading-icon"><LockIcon size={17} /></span>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              className="input"
              placeholder="Enter Password"
              autoComplete="current-password"
              {...register('password')}
            />
            <button
              type="button"
              className="trailing-btn"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOffIcon size={17} /> : <EyeIcon size={17} />}
            </button>
          </div>
        </Field>

        {serverError && (
          <div className="alert alert-error"><AlertIcon size={16} /> {serverError}</div>
        )}

        <Button type="submit" variant="primary" className="btn-block btn-auth" loading={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign In'}
        </Button>
      </form>
    </div>
  )
}
