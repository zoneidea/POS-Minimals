# Compact POS controls and bill numbers

Category buttons use a 38px minimum height (previously 76px), compact icons and horizontal labels. Long category names retain their full label rather than being clipped.

POS List rows add one unit when clicked, or when the focused row receives Enter/Space. Existing product-name buttons remain accessible and add once; bubbling from interactive controls is excluded. Loading, error and out-of-stock rows cannot add products. Other DataTable consumers keep their original behavior.

## Bill compatibility and API contract

Migration `202610130008_compact_sale_numbers.sql` replaces only the existing checkout function's number generation. New `saleNo` values are `B` plus 22 unpadded Base64URL characters encoding the full sale UUID (23 characters total). No UUID bits are truncated; the existing unique constraint still applies. All existing authentication, stock locking, audit and idempotency checks are retained.

API payload/response fields are unchanged: checkout and bill endpoints still return `saleNo: string` and the receipt's identical `saleNo`. Clients must treat these case-sensitive numbers as opaque identifiers. Existing bill records, receipt snapshots and replay results retain their original numbers. UI prints the complete number on a dedicated nonwrapping line, using a smaller font for legacy long numbers.

Forward rollout: apply the versioned migration to the confirmed development Supabase before release. Applied on 2026-10-13; no test sale written to the live database. Mixed old/new clients accept both string formats.

Rollback: create a new versioned migration restoring `public.checkout_cash_sale` from `202610120006_cash_checkout.sql` using `CREATE OR REPLACE FUNCTION`. Keep issued short numbers and their snapshots intact; do not alter previous migration checksums or rewrite historical sales.

Verification: 269 tests / 44 files, typecheck and build passed. Database checkout test decodes the new number back to the full UUID and verifies replay keeps the same number. Browser fixture checks confirmed category height 38px, row click adds once, product-name button adds once, and Enter on a List row adds once. Physical printer UAT remains user-side.
