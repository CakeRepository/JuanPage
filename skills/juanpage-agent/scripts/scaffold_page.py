#!/usr/bin/env python3
"""Create a minimal typed JuanPage example file without duplicating schema validation."""

from __future__ import annotations

import argparse
import re
from pathlib import Path


def identifier(value: str) -> str:
    result = re.sub(r"[^A-Za-z0-9._:-]+", "-", value.strip()).strip("-")
    if not result or not re.match(r"^[A-Za-z0-9]", result):
        raise argparse.ArgumentTypeError("identifier must begin with an alphanumeric character")
    return result[:80]


def variable_name(slug: str) -> str:
    words = re.split(r"[^A-Za-z0-9]+", slug)
    first, *rest = [word for word in words if word]
    return first.lower() + "".join(word[:1].upper() + word[1:] for word in rest)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--slug", required=True, type=identifier)
    parser.add_argument("--title", required=True)
    parser.add_argument("--object-name", required=True)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    output = args.output or Path("src/examples") / f"{args.slug}.ts"
    output.parent.mkdir(parents=True, exist_ok=True)
    variable = variable_name(args.slug)
    object_id = identifier(f"{args.slug}-root")
    content = f'''import type {{ JuanPageDocument }} from "../schema/page.js";\n\nexport const {variable}: JuanPageDocument = {{\n  version: "2.0",\n  title: {args.title!r},\n  objects: [\n    {{ id: {object_id!r}, type: "example", name: {args.object_name!r} }},\n  ],\n}};\n'''
    output.write_text(content, encoding="utf-8")
    print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
