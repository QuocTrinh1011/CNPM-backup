# Customer Use Case Deliverables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the Customer CRM and Sales use case diagram and the detailed Word specifications required by Issues #52 and #53.

**Architecture:** Keep the PlantUML diagram and the Word document as separate deliverables under the existing customer documentation folders. The diagram is the high-level source of truth; the Word document expands the same eight use cases and links each one to its existing customer sequence diagram.

**Tech Stack:** PlantUML source and PNG, Python `python-docx`, bundled workspace Python runtime, bundled document rendering tools when available, PowerShell validation scripts.

---

### Task 1: Add the Customer Use Case Diagram Source

**Files:**
- Create: `docs/diagrams/customer/III-00-customer-use-case.puml`

- [ ] **Step 1: Write the PlantUML source**

Add a readable `Customer Portal` boundary with the `Customer` actor, the payOS supporting actor, eight primary Customer use cases, and the mandatory/optional `include` and `extend` relationships defined in the design spec. Keep the labels at business level; do not include SQL or implementation-only operations.

- [ ] **Step 2: Validate the source structure**

Run a source check for one `@startuml` and one `@enduml`, balanced braces, all eight primary use-case labels, Customer associations to all eight primary use cases, the payOS association to payment, and the required `include`/`extend` relationships. Expected: all checks pass.

- [ ] **Step 3: Commit the diagram source**

```text
git add docs/diagrams/customer/III-00-customer-use-case.puml
git commit -m "docs: add customer use case diagram source"
```

### Task 2: Render and Review the Diagram PNG

**Files:**
- Create: `docs/diagrams/customer/III-00-customer-use-case.png`

- [ ] **Step 1: Render the approved PlantUML source**

Use the available PlantUML renderer. If the repository/runtime has no renderer, install or use an official PlantUML jar in a temporary tool location, then generate the PNG from the committed source.

- [ ] **Step 2: Inspect the generated image**

Open the PNG at full resolution and check that actors, use-case labels, relationship arrows, system boundary, and the legend remain readable without clipping or overlap. If inspection finds a defect, revise the PlantUML source, rerender the PNG, and inspect it again before committing.

- [ ] **Step 3: Commit the PNG**

```text
git add docs/diagrams/customer/III-00-customer-use-case.png
git commit -m "docs: render customer use case diagram"
```

### Task 3: Build the Detailed Customer Use Case Specifications

**Files:**
- Create: `docs/use-cases/customer-use-case-specifications.docx`
- Create: `tools/build_customer_usecase_specifications.py`

- [ ] **Step 1: Prepare the document builder**

Use the bundled workspace Python runtime and `python-docx`. Configure A4 page size, readable margins, black title/heading styles, consistent table borders, wrapped text, and page numbering only if it can be verified safely. Keep the builder in the repository so the Word deliverable can be regenerated from the documented content.

- [ ] **Step 2: Add the document introduction and traceability table**

Write the document in Vietnamese, state the Customer CRM and Sales scope, and explicitly state that email verification, production payment settlement, and shipping integration are outside this MVP document. Include a traceability table with each use case's identifier/name, FR identifier, Issue number, diagram reference, and sequence file reference.

- [ ] **Step 3: Add one complete section for each use case**

For each of the eight functions, include: identifier/name, primary actor, supporting actors, trigger, preconditions, postconditions, main success flow, alternative flows, exception flows, business rules, and validation requirements. Preserve these exact MVP rules: refresh-token rotation and reuse detection, normal logout revoking only the current session; feedback requires an eligible `CONFIRMED`, `SHIPPED`, `DELIVERED`, or `COMPLETED` order and one feedback per customer/product; surveys must be published and valid; ordering locks/reserves inventory in a transaction and derives totals server-side; a supplied promo code is validated and applied before sending the final amount to payOS; Return URL/cancelUrl are display-only; webhook signature, order, amount, and idempotency are validated; and order history is restricted to the authenticated owner.

- [ ] **Step 4: Save the DOCX and inspect its extracted text**

Confirm that all eight use-case headings and all required fields are present, with no placeholder text or unsupported requirement.

### Task 4: Render and Review the Word Document

**Files:**
- QA output only: a temporary per-run DOCX render directory outside the repository

- [ ] **Step 1: Render every DOCX page to PNG**

Use the bundled document renderer and the workspace dependency Python runtime. If the bundled LibreOffice renderer is unavailable, report the limitation and use the safest available local rendering route before delivery.

- [ ] **Step 2: Inspect every page**

Check title/heading hierarchy, table wrapping, page breaks, margins, glyphs, clipping, and overlaps. Revise the document and rerender if any page is defective.

- [ ] **Step 3: Run document audits**

Run text extraction and any available style/accessibility checks. Expected: eight sections, no placeholders, and readable rendered pages.

### Task 5: Final Consistency, Commit, and Pull Request

**Files:**
- Modify: Issue/PR evidence only; no unrelated source files

- [ ] **Step 1: Run repository checks**

Run `git diff --check` and the repository documentation checks available for PlantUML and documentation files. Confirm the PNG and DOCX exist at the required paths.

- [ ] **Step 2: Review the complete diff**

Verify that the diagram, Word document, and any documented generator contain only the approved scope and are consistent with the PRD and sequences #15–#22.

- [ ] **Step 3: Commit the final deliverables**

Tasks 1 and 2 already commit the diagram source and PNG. Commit only the remaining DOCX, builder, or revision files created after those commits:

```text
git add docs/use-cases/customer-use-case-specifications.docx tools/build_customer_usecase_specifications.py
git commit -m "docs: complete customer use case specifications"
```

- [ ] **Step 4: Push and open one PR**

Push `codex/customer-usecase-issues` and open a PR targeting `main` with `Closes #52` and `Closes #53`, a deliverables list, and fresh verification evidence. Do not merge automatically.
