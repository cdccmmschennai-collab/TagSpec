# Database model

All primary keys are UUIDs. Timestamps are timezone-aware.

## Tables

- **application_users** — `employee_code` (unique), `full_name`, `password_hash`
  (bcrypt), `role`, `is_active`.
- **equipment_templates** — `equipment_description`, `normalized_description`
  (unique), `equipment_code`, `version`, `is_active`.
- **equipment_aliases** — `equipment_template_id`, `alias`, `normalized_alias`
  (unique). An alias may not collide with another description or alias.
- **equipment_attributes** — `equipment_template_id`, `attribute_name` (unique per
  template), `display_label`, `display_order`, `is_required`, `placeholder`, `is_active`.
- **workbook_jobs** — original filename/stored filename/path, `file_hash` (SHA-256),
  `file_size`, detected `sheet_name` / `header_row_number` /
  `tag|equipment|additional_info_column_number`, `status`, `uploaded_by`.
- **imported_tag_rows** — `workbook_job_id`, `sheet_name`, `excel_row_number`
  (unique together), `tag_number` + normalized, `equipment_description` + normalized,
  `equipment_template_id`, `original_additional_information`, `attribute_values_json`
  (JSONB, authoritative), `generated_additional_information`, `status`, claim fields
  (`claimed_by`, `claimed_at`, `claim_expires_at`, `last_heartbeat_at`),
  completion fields, `row_version` (optimistic concurrency).
- **tag_entry_history** — append-only audit of every action (CLAIMED, DRAFT_SAVED,
  COMPLETED, RELEASED, FORCE_RELEASED, …) with value snapshots and version numbers.
- **export_history** — one row per export attempt: output filename/path,
  `row_count_written`, `file_hash`, `status`, `error_message`.

## Indexes (for 10–20 concurrent users)

`imported_tag_rows` is indexed on `(workbook_job_id, status)`,
`(workbook_job_id, normalized_equipment_description)`, `claimed_by`,
`workbook_job_id`, `normalized_tag_number`, and `status`.
