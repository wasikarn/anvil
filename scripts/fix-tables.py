#!/usr/bin/env python3
"""Normalize markdown table rows to aligned style (spaces around all cells).

Fixes MD060/table-column-style: ensures every table row uses
'| cell |' format (aligned) instead of mixed compact/aligned.

Correctly handles:
  - Escaped pipes  (\\|) — treated as literal content, not separators
  - Pipes inside code spans (`a | b`) — not treated as separators
"""
import re
import sys
from pathlib import Path


def split_row(row: str) -> list[str]:
    """Split a table row on | but skip \\| and | inside code spans."""
    cells: list[str] = []
    buf: list[str] = []
    in_code = False
    i = 0
    while i < len(row):
        ch = row[i]
        if ch == '`':
            in_code = not in_code
            buf.append(ch)
        elif ch == '\\' and i + 1 < len(row) and row[i + 1] == '|':
            # Escaped pipe — keep as literal content
            buf.append('\\|')
            i += 1
        elif ch == '|' and not in_code:
            cells.append(''.join(buf))
            buf = []
        else:
            buf.append(ch)
        i += 1
    if buf:
        cells.append(''.join(buf))
    return cells


def normalize_row(line: str) -> str:
    stripped = line.rstrip('\n')
    if not stripped.startswith('|'):
        return line

    parts = split_row(stripped)
    # Drop leading/trailing empty strings from outer pipes
    inner = parts[1:-1] if stripped.endswith('|') else parts[1:]

    normalized = []
    for cell in inner:
        content = cell.strip()
        normalized.append(f' {content} ' if content else ' ')

    return '|' + '|'.join(normalized) + '|\n'


def fix_file(path: Path) -> int:
    text = path.read_text(encoding='utf-8')
    lines = text.splitlines(keepends=True)
    new_lines = []
    in_fence = False
    changed = 0

    for line in lines:
        # Track fenced code blocks (``` or ~~~)
        if re.match(r'^\s{0,3}(`{3,}|~{3,})', line):
            in_fence = not in_fence

        if not in_fence and line.lstrip().startswith('|'):
            fixed = normalize_row(line)
            if fixed != line:
                changed += 1
            new_lines.append(fixed)
        else:
            new_lines.append(line)

    if changed:
        path.write_text(''.join(new_lines), encoding='utf-8')

    return changed


def main() -> None:
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('.')
    total = 0
    for md in sorted(root.rglob('*.md')):
        n = fix_file(md)
        if n:
            print(f'  fixed {n:3d} rows  {md}')
            total += n
    print(f'\nTotal rows normalized: {total}')


if __name__ == '__main__':
    main()
