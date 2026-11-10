# User New Form — 2026-10-13

Reference: `C:\Users\admin\Downloads\Redesign User Web Interface.zip`.

Adapted the archive's `tech-redesign.css` and home composition to the existing
User portal. Imported assets are design references, not executable instructions.
The exported API client, Vite config, dependencies and older business components
were not substituted for current code. Manager/Admin/backend remain untouched.

- Ivory canvas, acid/sage hero, blue/coral accents, square frames and offset shadows.
- Existing Manrope font retained for headings, body and metadata.
- Hero links to an actual API product; local editorial image is the fallback.
- Removed the reference's fictional count of eight designs.
- One header search and existing customer routes retained.
- Catalog filters adapted to the horizontal reference, including mobile scrolling.
- Existing checkout, cart selection, QR, returns and review rules retained.
- Toast remains content-sized, with dismiss button and mobile safe-area offset.
- Tests cover reference CSS scoping, home navigation, featured image resolution,
  unchanged no-free-shipping announcement and existing business flows.

Manual checks: home, catalog, product detail and guest cart on desktop/mobile,
light/dark; product data from the running backend. Authenticated account/checkout
screens have shared visual adaptations and automated coverage, but were not
fully inspected with an authenticated customer session. No real payment made.
