# Customer Use Case Diagram and Specifications Design

## Goal

Complete Issues #52 and #53 with a Customer CRM and Sales Use Case Diagram and a Word document containing detailed specifications for the eight Customer functions.

## Scope

The deliverables cover the Customer Portal functions defined in Part III and the repository PRD:

1. Account registration
2. Login, access-session refresh, and logout
3. Profile and preference management
4. Product feedback and rating after a valid purchase
5. Survey response submission
6. Product catalog browsing, search, and filtering
7. Shopping cart, order creation, promo-code application when supplied, and payOS payment
8. Order history and status tracking

The design follows the existing customer sequence diagrams and treats payOS as an external supporting actor for online payment. It does not add email verification, production payment settlement, shipping integration, or other out-of-scope features.

## Diagram design

Create one PlantUML use case diagram under `docs/diagrams/customer/` with a `Customer Portal` system boundary. The `Customer` actor is associated with all eight primary use cases. The payOS actor is associated with the payment sub-use case.

Use `include` for mandatory subflows such as authentication session handling, purchase eligibility verification before feedback, and payment processing during order placement. Use `extend` only for optional behavior such as search/filtering from catalog browsing and applying a promo code when the customer provides one. The diagram must remain readable and must not encode implementation-level SQL or API details.

## Word document design

Create `docs/use-cases/customer-use-case-specifications.docx` in Vietnamese, matching the language of the existing PRD and project requirements. The document will contain:

- A clear title and short scope introduction.
- A traceability table mapping each use case to its FR/Issue identifiers, diagram, and sequence file.
- One consistent section for each of the eight use cases.
- Primary and supporting actors, preconditions, postconditions, trigger, main success flow, alternative flows, exception flows, business rules, and validation requirements.
- Explicit alignment with current MVP rules: purchased-product eligibility for feedback, valid published surveys, server-side order total, promo-code calculation before payOS, and webhook as payment source of truth.

The document will use a readable report layout with black headings, deliberate spacing, bordered tables, and no unsupported requirements. It will be rendered to page images for visual QA before delivery.

## Consistency rules

- The eight use-case names and numbering must match the eight customer sequence diagrams.
- Authentication wording must preserve refresh-token rotation, reuse detection, and logout-current-session behavior.
- Feedback must require an eligible order status and enforce one feedback per customer/product.
- Ordering must preserve inventory transaction/locking, promo validation and final amount, payOS Return URL as display-only, and webhook validation/idempotency.
- Order history must restrict access to the authenticated customer's own orders.

## Verification

- Validate the PlantUML source has balanced blocks and the eight primary use cases.
- Render the PlantUML source to PNG and inspect the image for clipping and readability.
- Extract and inspect the DOCX text for all eight sections and required fields.
- Render every DOCX page to PNG and inspect each page for clipping, overlap, broken tables, or missing glyphs.
- Run repository documentation checks if available.

## Delivery

Use one branch and one Pull Request for both issues. The PR description will include `Closes #52` and `Closes #53`, list the generated files, and report verification evidence. No merge will be performed automatically.
