/* Lightweight inline icon set in the Lucide visual style (stroke, 24x24,
   currentColor). Kept local to avoid a runtime dependency. */
import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Base({ size = 18, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export const UploadIcon = (p: IconProps) => (
  <Base {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v12" /></Base>
)
export const SearchIcon = (p: IconProps) => (
  <Base {...p}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></Base>
)
export const RefreshIcon = (p: IconProps) => (
  <Base {...p}><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" /></Base>
)
export const SheetIcon = (p: IconProps) => (
  <Base {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M8 13h8" /><path d="M8 17h8" /><path d="M8 9h2" /></Base>
)
export const ChevronDownIcon = (p: IconProps) => (<Base {...p}><path d="m6 9 6 6 6-6" /></Base>)
export const ChevronUpIcon = (p: IconProps) => (<Base {...p}><path d="m18 15-6-6-6 6" /></Base>)
export const XIcon = (p: IconProps) => (<Base {...p}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></Base>)
export const CheckIcon = (p: IconProps) => (<Base {...p}><path d="M20 6 9 17l-5-5" /></Base>)
export const CheckCircleIcon = (p: IconProps) => (<Base {...p}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" /></Base>)
export const AlertIcon = (p: IconProps) => (
  <Base {...p}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4" /><path d="M12 17h.01" /></Base>
)
export const InfoIcon = (p: IconProps) => (<Base {...p}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></Base>)
export const PlusIcon = (p: IconProps) => (<Base {...p}><path d="M5 12h14" /><path d="M12 5v14" /></Base>)
export const ArrowRightIcon = (p: IconProps) => (<Base {...p}><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></Base>)
export const ArrowLeftIcon = (p: IconProps) => (<Base {...p}><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></Base>)
export const LogOutIcon = (p: IconProps) => (<Base {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></Base>)
export const UserIcon = (p: IconProps) => (<Base {...p}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></Base>)
export const PackageIcon = (p: IconProps) => (
  <Base {...p}><path d="m7.5 4.27 9 5.15" /><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></Base>
)
export const LayersIcon = (p: IconProps) => (
  <Base {...p}><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" /><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" /><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" /></Base>
)
export const EyeIcon = (p: IconProps) => (<Base {...p}><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></Base>)
export const TrashIcon = (p: IconProps) => (<Base {...p}><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></Base>)
export const GripIcon = (p: IconProps) => (<Base {...p}><circle cx="9" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="18" r="1" /><circle cx="15" cy="6" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="18" r="1" /></Base>)
export const DownloadIcon = (p: IconProps) => (<Base {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /><path d="M12 15V3" /></Base>)
export const FilterIcon = (p: IconProps) => (<Base {...p}><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" /></Base>)
export const LockIcon = (p: IconProps) => (<Base {...p}><rect width="18" height="11" x="3" y="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></Base>)
export const PencilIcon = (p: IconProps) => (<Base {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></Base>)
export const InboxIcon = (p: IconProps) => (
  <Base {...p}><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></Base>
)
export const ClipboardIcon = (p: IconProps) => (
  <Base {...p}><rect width="8" height="4" x="8" y="2" rx="1" ry="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="m9 14 2 2 4-4" /></Base>
)
