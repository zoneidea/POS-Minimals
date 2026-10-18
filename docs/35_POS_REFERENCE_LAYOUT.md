# POS reference layout and draft cart

> Theme and right-panel controls were subsequently updated by the user; see [current checkout panel](36_POS_CHECKOUT_PANEL.md). This document records the earlier image-based stage.

The user-supplied restaurant POS screenshot now grounds `/pos`: compact white icon rail/header, red search/category selection, image product grid on the left, white cart on the right, takeaway/Delivery toggle, quantity controls, total and green payment button. Mobile stacks the cart below the catalog. Other modules keep their existing theme and DataTables. The user's latest image instruction overrides table presentation specifically for the POS catalog; ten products per API page and pagination remain.

Products/categories use existing authenticated, tenant-restricted APIs. Category chips page in groups of ten. Search Enter supports name/SKU/barcode substring; the exact barcode API capability remains available but the old separate exact-input field is removed to match the single search bar. No new API or database contract. Catalog categories are passed as the existing `categoryId` query parameter.

Clicking in-stock products adds to a draft cart. Quantity changes are bounded by the latest catalog stock snapshot, zero removes a line, and clearing the entire cart requires a confirmation Modal. Storage is scoped by authenticated user+organization; validation rejects malformed saved values and storage failure displays a notice. Prices/totals use integer cents (`bigint`) to avoid decimal rounding. This is an estimate, not a stock reservation or server quote. Existing product snapshots in a saved cart can become stale and must be revalidated by the future checkout endpoint. Takeaway/Delivery is a visual draft selection, not a persisted sale or delivery integration. No customer personal data is collected.

Payment is disabled with a visible explanation until atomic server checkout exists. No sale, payment or stock mutation occurs on this screen. Images without real assets use only `placehold.co`, per the user's image rule. The current catalog endpoint returns imageUrl null; image upload remains pending. Restaurant names/food examples from the reference are not inserted into the user's shop.

Verification: TypeScript and production build pass; four cart tests cover stock bounds, removal, decimal and large totals, storage key isolation and invalid saved data. Browser inspection confirms live category filtering, order-mode toggle, loading staying in the workspace, desktop 1280×607 and mobile 390×844. The user's shop is empty, so hosted populated-cart UAT remains pending. Visual comparison and intentional deviations are recorded in root `design-qa.md`.

## Cart persistence update

Cart changes now write synchronously before React state updates, so immediate reload/menu navigation does not depend on a later effect. The same existing user+shop storage key is retained. Restoration reads without overwriting saved data; storage/read failures display a notice while keeping the current in-memory draft usable. Cart clearing remains limited to explicit removal/confirmed clear or confirmed sale success. Isolated storage tests cover restoring items/quantities across new mounts, scope isolation, removal and avoiding writes on malformed restoration. Local drafts remain specific to browser/origin.

## POS fullscreen control — 2026-10-18

- Icon button beside Grid/List toggles the browser Fullscreen API for the whole application, retaining Checkout dialogs and existing POS data.
- `fullscreenchange` keeps the button state synchronized with Escape/browser exit. Leaving POS exits fullscreen only when this control initiated it.
- Unsupported browsers show a disabled button with an explanatory tooltip; request failures use the existing warning dialog.
- Local UI and typecheck verified. The in-app test browser did not retain native fullscreen, so actual enter/exit/Escape behavior requires Chrome/Edge browser UAT.
