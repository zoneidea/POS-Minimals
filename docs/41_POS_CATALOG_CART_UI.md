# POS catalog views and compact cart

Latest user instructions: product selection increases quantity by repeated clicks in the catalog; cart rows have quantity text and a red trailing remove icon, without plus/minus controls. Removing a row removes the local draft only. Existing clear-cart confirmation, persistence and Checkout Modal remain.

Grid/List toggle shares the same loaded page and cart. List reuses DataTable, ten products per page, with an accessible product-name button to add stock-available items. Both modes use existing authenticated GET /api/v1/products payload/response; no API, migration, role or tenancy changes.

Desktop catalog and cart share the same viewport-bounded height (maximum 620px). Product body/table and cart rows scroll independently; pagination/summary/Checkout remain outside scrolling bodies. Mobile stacks two 400px panels with horizontally scrollable table content.

Loading improvements: effects depend on filter primitives instead of object identity, avoiding a new API request for identical category/search submission. View switching uses loaded data without fetching again. Same-query refresh keeps existing products visible, while changed filters/scope clear prior data. Abort and response guards prevent obsolete responses; adding/pagination are guarded during loading, including keyboard activation. Product images use lazy loading, asynchronous decoding and explicit dimensions. No stock/price/permission cache introduced; checkout retains authoritative server validation. No throughput/latency benchmark claim.

Verification: typecheck/build; 23 focused cart persistence, pagination and authenticated catalog HTTP tests. Local IAB desktop 1280x720 and mobile 390x844: Grid add twice gives quantity 2; List add gives 3; reload restores 3; trailing remove returns empty cart. Desktop panel heights 512px each; mobile 400px each, document width 390px. Console errors empty. Hosted catalog has one product, so long multi-page populated scroll and network latency benchmarking remain pending. No checkout or stock write performed. Build retains existing bundle size warning.

## Compact row and square cards

Cart rows now place product name, quantity, line amount and a red X removal button on the first line, with unit price below. Long names truncate with a title tooltip. Grid cards have a 1:1 aspect ratio; their images fill the available space above the compact product details. Desktop card measured 162.39 × 162.39px, mobile 143 × 143px at 390px viewport; cart quantity and amount share the name baseline. Typecheck/build passed; browser console errors empty. No business/API changes.


## Full photo cards — 2026-10-23

Shared ProductGrid cards now place images edge-to-edge inside the square card with centered `object-fit: cover` (portrait/landscape images may crop). Name, price, stock/availability and add icon overlay a dark bottom gradient. Names wrap up to two lines and expose the complete name in a tooltip and accessible button label. Missing images retain the existing placeholder; stock-disabled cards remain disabled and visibly desaturated.

The shared component covers retail, cafe, restaurant ordering, LINE and customer QR menus. Loading, pagination, click handlers and checkout stay unchanged; no API/schema/permission changes. Browser fixture QA at desktop and 390px mobile verified image bounds, square cards, overlaid white text, long names, no-image and out-of-stock states, add-to-cart interaction, LINE style compatibility and light/dark themes. TypeScript/build and nearest UI regression checks passed. Screenshots use placeholder products, not real shop data.
