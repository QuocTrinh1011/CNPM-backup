from pathlib import Path
import re
import sys

files = sorted(Path("docs").rglob("*.puml"))
errors = []
start_pattern = re.compile(r"^\s*@startuml(?:\s+.*)?$")
enduml_pattern = re.compile(r"^\s*@enduml\s*$")
open_pattern = re.compile(r"^\s*(alt|opt|loop|par|break|critical|group)\b")
end_pattern = re.compile(r"^\s*end(?:\s+.*)?$")
sql_patterns = (
    re.compile(r"\bSELECT\b.*\bFROM\b", re.IGNORECASE),
    re.compile(r"\bINSERT\s+INTO\b", re.IGNORECASE),
    re.compile(r"\bUPDATE\s+[A-Za-z_][\w.]*\s+SET\b", re.IGNORECASE),
    re.compile(r"\bDELETE\s+FROM\b", re.IGNORECASE),
    re.compile(r"\bFOR\s+UPDATE\b", re.IGNORECASE),
)
customer_dir = Path("docs/diagrams/customer")

if not files:
    errors.append("no docs/**/*.puml files found")

for path in files:
    lines = path.read_text(encoding="utf-8").splitlines()
    starts = [number for number, line in enumerate(lines, 1) if start_pattern.match(line)]
    endumls = [number for number, line in enumerate(lines, 1) if enduml_pattern.match(line)]
    if len(starts) != 1:
        errors.append(f"{path}: expected exactly one line-anchored @startuml, found {len(starts)}")
    if len(endumls) != 1:
        errors.append(f"{path}: expected exactly one line-anchored @enduml, found {len(endumls)}")

    blocks = []
    for number, line in enumerate(lines, 1):
        opening = open_pattern.match(line)
        if opening:
            blocks.append((opening.group(1), number))
        elif re.match(r"^\s*end\s+note\b", line):
            pass
        elif end_pattern.match(line):
            if not blocks:
                errors.append(f"{path}:{number}: unmatched end")
            else:
                blocks.pop()

        if any(pattern.search(line) for pattern in sql_patterns):
            errors.append(f"{path}:{number}: SQL-shaped syntax is not allowed")

    for token, number in blocks:
        errors.append(f"{path}:{number}: unclosed {token} block")

    if path.parent == customer_dir and not path.with_suffix(".png").is_file():
        errors.append(f"{path}: missing sibling PNG")

if errors:
    print("\n".join(errors), file=sys.stderr)
    sys.exit(1)
print(f"Validated {len(files)} PlantUML sources.")
