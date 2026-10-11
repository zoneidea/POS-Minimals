# Stock audit page

The owner's `/audits` menu now displays the shop's stock adjustment ledger directly. The existing inventory history Modal and this page share `StockHistory`; there are no duplicated fetching or table implementations.

Displays product/barcode snapshots, quantities before/delta/after, reason, Bangkok timestamp, and actor username/retained user ID. Uses the existing authenticated `GET /api/v1/inventory/stock-movements?page=N&limit=10` contract. No API or database changes; owner checks, tenant-scoped RLS and append-only ledger remain enforced by the existing backend. Deleted products retain their history.

Includes loading, empty, error/retry, ten-row pagination, horizontal table scrolling and shared light/dark styles. Leaving the page aborts its in-flight request. History is read-only; no delete, edit or reverse action is introduced. Other activity types and audit reversal remain pending.
