# Agent 1.2.0: additive LAEK Money support

Approved by the owner on 2026-10-28, with POSJung compatibility required. Existing `/print`, `/pair`, `/printers` and `/customer-display/*` payloads and renderer are retained. Existing application identity, profile directory and POS origins remain intact. LAEK origin is added exactly, without wildcards.

New `/fx/customer/*` and `/fx/rates/*` controllers use a separate strict decimal-string protocol, separate sandboxed renderer, independent sessions/sequences/leases, and a shared physical-screen reservation wrapper. FX cannot take over an open POS monitor. No API/DB/Web POS source changes are required. FX rendering permits local bundled assets only and does not interpret text as HTML.

New capabilities are advertised only when FX controllers exist. Two selected screens must be different extended monitors; primary/mirrored outputs are rejected. Unplug closes the affected window. A missing heartbeat clears the public frame after 15 seconds. Existing printer HTML support is reused, with print requests owned by the web app and no financial writes in Agent.

Verification: `node --test src/*.check.mjs`; Electron smoke for receipt, original customer display, tray identity, and FX renderer. Local smoke does not submit physical print jobs or open a physical public display. Windows/macOS driver, paper, dual-monitor and restart UAT is still required. Installers remain unsigned/not notarized as in the existing release workflow.

Release from a dedicated tag/branch; do not include unrelated deleted test files from another checkout or change the POSJung web deployment. Existing v1.1.2 download URLs remain available.
