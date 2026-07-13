import type { ButtonHTMLAttributes, ReactNode, SelectHTMLAttributes, InputHTMLAttributes } from 'react'
import { useId } from 'react'
import { SearchIcon } from './icons'

/* ------------------------------------------------------------ Button */
type ButtonVariant = 'primary' | 'default' | 'ghost' | 'danger'
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'md'
  loading?: boolean
  icon?: ReactNode
}
const VARIANT: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  default: '',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
}
export function Button({
  variant = 'default',
  size = 'md',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`btn ${VARIANT[variant]} ${size === 'sm' ? 'btn-sm' : ''} ${className}`.trim()}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <span className="spinner" aria-hidden="true" /> : icon}
      {children}
    </button>
  )
}

/* ------------------------------------------------------------- Badge */
type BadgeTone = 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'cyan' | 'gray'
export function Badge({ tone = 'gray', dot, children }: { tone?: BadgeTone; dot?: boolean; children: ReactNode }) {
  return (
    <span className={`badge badge-${tone}`}>
      {dot && <span className="badge-dot" />}
      {children}
    </span>
  )
}

/* -------------------------------------------------------------- Card */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`.trim()}>{children}</section>
}

/* --------------------------------------------------------- PageHeader */
export function PageHeader({
  title,
  subtitle,
  breadcrumb,
  actions,
}: {
  title: ReactNode
  subtitle?: ReactNode
  breadcrumb?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div>
      {breadcrumb && <nav className="breadcrumb" aria-label="Breadcrumb">{breadcrumb}</nav>}
      <div className="page-header">
        <div className="titles">
          <h1>{title}</h1>
          {subtitle && <p className="subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="actions">{actions}</div>}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- Field */
export function Field({
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
}: {
  label: string
  htmlFor?: string
  required?: boolean
  error?: string | null
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="field">
      <label className="label" htmlFor={htmlFor}>
        {label}
        {required && <b className="req"> *</b>}
      </label>
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  )
}

/* ------------------------------------------------------------- Input */
export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  'aria-label': ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  'aria-label'?: string
}) {
  return (
    <div className="input-search grow">
      <SearchIcon size={16} />
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

/* ------------------------------------------------------------ Select */
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="input" {...props} />
}

/* -------------------------------------------------------- EmptyState */
export function EmptyState({ icon, title, message, action }: { icon?: ReactNode; title: string; message?: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      {icon && <div className="es-icon">{icon}</div>}
      <div className="es-title">{title}</div>
      {message && <div className="es-msg">{message}</div>}
      {action}
    </div>
  )
}

/* ----------------------------------------------------- Spinner / load */
export function Spinner({ lg }: { lg?: boolean }) {
  return <span className={`spinner ${lg ? 'lg' : ''}`.trim()} role="status" aria-label="Loading" />
}
export function LoadingRow({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="loading-center">
      <Spinner /> {label}
    </div>
  )
}
export function Skeleton({ height = 16, width = '100%' }: { height?: number; width?: number | string }) {
  return <div className="skeleton" style={{ height, width }} />
}

/* --------------------------------------------------------------- Tabs */
export interface TabDef {
  key: string
  label: string
  count?: number
  icon?: ReactNode
}
export function Tabs({ tabs, active, onChange }: { tabs: TabDef[]; active: string; onChange: (key: string) => void }) {
  const id = useId()
  return (
    <div className="tabs" role="tablist" aria-label="Workspace sections">
      {tabs.map((t) => (
        <button
          key={t.key}
          id={`${id}-${t.key}`}
          role="tab"
          aria-selected={active === t.key}
          className={`tab ${active === t.key ? 'active' : ''}`.trim()}
          onClick={() => onChange(t.key)}
        >
          {t.icon}
          {t.label}
          {typeof t.count === 'number' && <span className="count">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

/* --------------------------------------------------------- Summary tile */
type TileTone = 'blue' | 'green' | 'amber' | 'violet' | 'cyan' | 'gray' | 'red'
export function Tile({
  label,
  value,
  tone = 'blue',
  active,
  onClick,
}: {
  label: string
  value: number | string
  tone?: TileTone
  active?: boolean
  onClick?: () => void
}) {
  const content = (
    <>
      <span className="tile-value">{value}</span>
      <span className="tile-label">{label}</span>
      <span className={`tile-accent ${tone}`} />
    </>
  )
  if (onClick) {
    return (
      <button type="button" className={`tile ${active ? 'active' : ''}`.trim()} onClick={onClick} aria-pressed={active}>
        {content}
      </button>
    )
  }
  return <div className="tile">{content}</div>
}
