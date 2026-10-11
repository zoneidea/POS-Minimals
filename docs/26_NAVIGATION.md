# Navigation — 2026-10-12

Root `/` redirects authenticated OWNER to `/dashboard`, other roles to `/pos` after server identity verification. Existing deep links remain in place. Sidebar uses icons only, accessible labels, hover/focus tooltips and an active-page indicator. Menus are filtered using verified server permissions; API authorization remains authoritative. Signout is an icon in the sidebar.

ACCOUNTANT retains report-only rights; opening POS displays forbidden rather than adding sales permission. Category management and account details remain functional. Dashboard, POS and other future modules show an explicit development state; no invented metrics or fake checkout are presented. Those module implementations are separate work.

TypeScript, 86 existing automated checks and build pass. Browser verified actual owner redirect and sidebar rendering. Employee/accountant landing behavior has no live account evidence yet.
