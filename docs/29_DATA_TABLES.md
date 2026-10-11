# Tables and form controls — 2026-10-12

Inputs use flat borders and backgrounds with a visible focus outline, without raised or inset shadows. Buttons retain ordinary Tailwind styles.

Use `apps/web/src/components/DataTable.tsx` for tabular business data. Current implemented table: categories. Page size is 10, fetched from the API; pagination includes first, previous, next and last with boundary disabling, total count and an empty state. Narrow screens scroll within the table region. Future modules must use the same component and pagination policy.

Category create/edit opens a Modal; deletion opens a separate confirmation Modal. Deletion retains the record and audit history using deleted_at/deleted_by. Existing product-reference checks and OWNER authorization remain enforced on the backend.

Validation: TypeScript, 92 automated tests and production build pass. Local visual/keyboard review of these UI changes remains for user acceptance.
