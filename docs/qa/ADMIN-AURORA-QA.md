# System Admin Aurora — 2026-10-13

Reference: `Redesign User Web Interface (2).zip`, Admin governance and Aurora
visual layers. Applied in the archive's order, with current-portal integration.

- Scoped entirely to `.admin-shell.internal-portal`.
- Manrope, purple/cyan accents, translucent rounded sidebar/header/cards.
- Current system-only routes retained: overview, internal accounts, product lookup.
- No imported API clients, old supplier modules, scripts or business logic.
- Preserved permissions, account safeguards and quick-link URLs.
- Mobile retains logout and portal links; tables scroll inside their own wrapper.
- Fixed decorative hero overlay, legacy theme overrides and mobile grid overflow.
- CSS regression checks cover isolation, visible controls and narrow panels.

Manual with an existing Admin session: overview and account/product lists,
light/dark, desktop 1440px and mobile 390px. Opened and cancelled the new-account
form without submitting; no account/order/payment data changed. Login styling
adapted, but not manually exercised by logging out the existing session.

Backend, application.yml, User and Manager untouched during this task.
