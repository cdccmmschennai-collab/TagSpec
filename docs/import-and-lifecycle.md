# Excel import rules, tag lifecycle, locking & export

## Header detection (upload)

- Only `.xlsx` is accepted; the file signature (`PK\x03\x04`) and openpyxl
  readability are both checked — not just the extension.
- A configurable number of leading rows (`HEADER_SEARCH_ROWS`, default 25) is scanned
  across every worksheet for a row containing all three required headers
  (normalized, case/whitespace-insensitive): `TAG NUMBER REV-1`,
  `EQUIPMENT DESCRIPTION`, `ADDITIONAL INFORMATION`.
- Column positions are **detected**, never hardcoded. The detected sheet, header row
  and column numbers are stored on the job.
- Uploads are de-duplicated by SHA-256; a duplicate returns the existing job.
- Filenames are sanitized and stored under a random server-side name; path traversal
  is blocked.

## Row import → status

A row is a candidate only when both tag and equipment description are present
(blank/metadata rows are ignored). Original Excel row numbers are preserved.

| Excel `ADDITIONAL INFORMATION` | Template match | Status |
|--------------------------------|----------------|--------|
| blank | matched (desc or alias) | `AVAILABLE` |
| blank | no match | `TEMPLATE_MISSING` |
| has content | any | `EXISTING_IN_EXCEL` (original stored verbatim) |

Duplicate normalized tag numbers within a workbook are reported (not dropped).

## Tag status lifecycle

```
AVAILABLE ──claim──► CLAIMED ──save draft──► DRAFT ──complete──► COMPLETED ──export──► EXPORTED
    ▲                   │  │                    │                    ▲
    └──release/expire/force-release────────────┘                    │
TEMPLATE_MISSING ──assign template──► AVAILABLE                      │
REVIEW_REQUIRED / REVIEWED (reconciliation) ────────────────────────┘
EXISTING_IN_EXCEL (read-only; excluded from the editor dropdown)
```

Editors only see `AVAILABLE` tags plus tags they themselves claimed. `EXISTING_IN_EXCEL`,
`COMPLETED`, `TEMPLATE_MISSING`, and tags claimed by others are excluded by the
**backend query**, not just frontend filtering. Supervisors can request any status.

## Tag locking (concurrency)

- Claiming is a single atomic `UPDATE ... WHERE status = 'AVAILABLE' (or expired)
  RETURNING id`. Exactly one of many simultaneous requests wins; the rest get
  `TAG_ALREADY_CLAIMED`.
- Claims expire after `CLAIM_EXPIRY_MINUTES` (default 30). The frontend heartbeats
  every 2 minutes; saving a draft also refreshes the claim. Expired claims may return
  to `AVAILABLE`.
- Saves use `row_version` optimistic concurrency; a stale save returns
  `STALE_TAG_VERSION` rather than overwriting newer work.
- Error codes: `TAG_ALREADY_CLAIMED`, `TAG_CLAIM_EXPIRED`, `TAG_NOT_OWNED`,
  `STALE_TAG_VERSION`, `TAG_ALREADY_COMPLETED`.

## Formatting rules

Order comes only from the master `display_order`. `KEY:VALUE` pairs joined by single
commas, no trailing comma. Empty optional attributes are skipped; required attributes
must have values before completion. Whitespace is normalized. Commas inside a value are
rejected because comma is the pair separator.

## Export rules

- The original is loaded read-only conceptually and copied; **only** the
  `ADDITIONAL INFORMATION` cell of each completed row is written, located by the
  **stored sheet name + Excel row number + column number** (never re-searched by tag).
- Written atomically (temp file + `os.replace`), verified to reopen, hashed, recorded
  in `export_history`. Concurrent exports of the same job are blocked
  (`EXPORT_IN_PROGRESS`). Existing-in-Excel values are left untouched.
