# Admin diagrams

Admin diagrams are organized by diagram type and file format so that source files, editable diagrams, and rendered previews are easy to locate.

Admin diagrams use the same monochrome, white-background, black-border visual style as the Customer diagrams for a consistent presentation.

```text
admin/
├── sequence/
│   ├── source/    # Visual Paradigm .vpp source files
│   ├── plantuml/  # PlantUML sequence-diagram sources
│   └── images/    # Rendered sequence-diagram PNG files
└── use-case/
    ├── plantuml/  # PlantUML use-case-diagram sources
    └── images/    # Rendered use-case-diagram PNG files
```

The root-level `SEQUENCE/` directory is intentionally not used. New Admin diagram assets should be added to the appropriate folder under `docs/diagrams/admin/`.

The detailed textual specifications are maintained in [`../../use-cases/admin/admin-use-case-specifications.docx`](../../use-cases/admin/admin-use-case-specifications.docx).
