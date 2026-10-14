# Initial page recovery

The remaining reload button belonged to PageLoadBoundary, which catches lazy-module/render failures, not normal API errors. Inspection of a previous production POS chunk URL returned HTTP 200 with text/html (the SPA fallback), rather than JavaScript. A document retained across deployments can therefore fail its first lazy-page import; a document reload then fetches the current bundle. This mechanism matches the reported reload-to-recover symptom; an authenticated user session was not inspected.

The app now handles Vite's cancelable preload-error event before rendering. When online, it records a session-scoped timestamp and automatically reloads the current document once within a 60-second window to obtain current deployment assets. The guard persists across reloads and prevents repeated reloads during a sustained outage. Offline/storage-blocked or repeated failures retain the standard error UI instead. Auth and draft-cart storage are not changed; no API mutation is retried.

PageLoadBoundary now displays “ไม่สามารถโหลดข้อมูลได้” without a reload button or instruction. Repository search found no remaining “โหลดใหม่” UI in TS/TSX source. Existing manual authentication recheck and email-resend controls have separate purposes.

Verification: 45 test files / 272 tests, typecheck and production build passed. Regression tests cover automatic recovery, guard persistence after document reload, later independent failures, offline conditions and unavailable storage. Authenticated first-entry UAT after release remains user-side.
