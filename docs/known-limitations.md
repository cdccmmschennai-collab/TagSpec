# Known limitations

- **`.xlsx` only.** `.xls` and `.xlsm` are rejected at upload.
- **openpyxl preservation scope.** Export is verified (automated regression test,
  `tests/test_export.py`) to preserve: sheet names & order, non-target cell values,
  formulas, hyperlinks, merged ranges, freeze panes, hidden rows/columns/sheets,
  row heights, column widths, and data validations. openpyxl **cannot** guarantee
  preservation of:
  - VBA macros (`.xlsm`) and ActiveX controls,
  - charts, images, drawings, shapes, SmartArt,
  - embedded OLE objects,
  - some conditional-formatting edge cases and pivot caches.
  Workbooks relying on those objects are out of scope for automated export.
- **Single detected sheet is exported.** Only the sheet where the required headers
  were detected is written to; other sheets are copied unchanged.
- **No offline editing.** The app requires the central server and PostgreSQL (PWA is
  installability-only; see Phase 12).
- **Reconciliation (Phase 9)** statuses (`REVIEW_REQUIRED`/`REVIEWED`) exist in the
  model and lifecycle; the revised-workbook reconciliation UI is not yet built.
