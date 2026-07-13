// Shared types mirroring the backend API contracts.

export type Role = 'ADMIN' | 'SUPERVISOR' | 'EDITOR'

export interface User {
  id: string
  employee_code: string
  full_name: string
  role: Role
  is_active: boolean
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface EquipmentAttribute {
  id: string
  equipment_template_id: string
  attribute_name: string
  display_label: string
  display_order: number
  is_required: boolean
  placeholder: string | null
  is_active: boolean
}

export interface EquipmentAlias {
  id: string
  equipment_template_id: string
  alias: string
  normalized_alias: string
}

export interface Equipment {
  id: string
  equipment_code: string | null
  equipment_description: string
  normalized_description: string
  version: number
  is_active: boolean
  attributes: EquipmentAttribute[]
  aliases: EquipmentAlias[]
}

export interface WorkbookJob {
  id: string
  job_name: string
  project_code: string | null
  revision: string | null
  original_filename: string
  stored_filename: string
  file_hash: string
  file_size: number
  sheet_name: string | null
  header_row_number: number | null
  tag_column_number: number | null
  equipment_column_number: number | null
  additional_info_column_number: number | null
  status: string
  uploaded_by: string | null
  uploaded_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface ValidationSummary {
  sheet_name: string
  header_row_number: number
  tag_column_number: number
  equipment_column_number: number
  additional_info_column_number: number
  detected_headers: Record<string, number>
  missing_columns: string[]
}

export interface UploadResponse {
  job: WorkbookJob
  duplicate: boolean
  validation: ValidationSummary | null
  message: string | null
}

export interface ImportStats {
  total_rows_inspected: number
  total_tag_rows: number
  equipment_description_count: number
  matched_equipment_count: number
  unmatched_equipment_count: number
  available_tags: number
  template_missing_tags: number
  existing_in_excel_tags: number
  duplicate_tag_numbers: string[]
}

export interface EquipmentDescriptionCount {
  equipment_description: string
  normalized_equipment_description: string
  equipment_template_id: string | null
  total: number
  available: number
  in_progress: number
  completed: number
  existing_in_excel: number
  template_missing: number
}

export type TagStatus =
  | 'AVAILABLE'
  | 'TEMPLATE_MISSING'
  | 'EXISTING_IN_EXCEL'
  | 'CLAIMED'
  | 'DRAFT'
  | 'COMPLETED'
  | 'REVIEW_REQUIRED'
  | 'REVIEWED'
  | 'EXPORTED'

export interface TagRow {
  id: string
  workbook_job_id: string
  sheet_name: string
  excel_row_number: number
  tag_number: string | null
  revision: string | null
  equipment_description: string | null
  equipment_template_id: string | null
  original_additional_information: string | null
  attribute_values_json: Record<string, string> | null
  generated_additional_information: string | null
  status: TagStatus
  claimed_by: string | null
  claimed_at: string | null
  claim_expires_at: string | null
  completed_by: string | null
  completed_at: string | null
  row_version: number
}

export interface ClaimResponse {
  tag: TagRow
  attributes: EquipmentAttribute[]
}

export interface ExportRecord {
  id: string
  workbook_job_id: string
  output_filename: string
  row_count_written: number
  generated_at: string
  file_hash: string | null
  status: string
  error_message: string | null
}

export interface ApiError {
  error: { code: string; message: string; details?: unknown }
}
