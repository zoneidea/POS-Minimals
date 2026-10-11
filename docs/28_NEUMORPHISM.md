# Neumorphism theme — 2026-10-12

User superseded the detached-card visual design with a complete Neumorphism web-app theme. Shared theme.css now uses one continuous blue-gray surface, paired light/shade shadows, raised buttons, inset selected navigation and inputs. Header, sidebar, toolbar, empty area and pagination no longer appear as floating white cards. Navy text/teal emphasis and visible keyboard-focus outlines preserve readable states. Dark mode uses the same material treatment in slate/navy.

Reference: https://www.figma.com/resource-library/web-design-trends/#trend-8-neumorphism. Generated concept: /Users/zone-idea/.codex/generated_images/01a129eb-31bc-7703-a57c-6b641f1308d5/exec-65e64edd-057a-4249-aa78-12bdb859899a.png. IAB screenshot: same directory, pos-neumorphism-desktop.jpg. Both inspected via view_image; QA artifacts remain outside Git.

Comparison points: continuous canvas, integrated header/rail, raised neutral buttons, inset active teal tag menu, circular empty-state icon, unchanged Thai copy. Kept original Lucide icons/order and a single existing add action rather than the generated image's extra add action. Disabled controls deliberately flatten. These preserve the actual interaction model.

IAB checked category empty state, open/cancel form, light/dark toggle, password-reset request form, and 390x844 mobile (client width = scroll width = 390). Desktop native viewport and reference-to-render comparison complete. Build passes. No new automated tests added for CSS-only styling. Business behavior and current feature coverage unchanged. This replaces docs/27 visual direction.
