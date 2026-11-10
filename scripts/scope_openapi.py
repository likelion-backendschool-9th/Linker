#!/usr/bin/env python3
"""Select published operation tags and their referenced components, without changing contracts."""
import argparse
import copy
import json
from pathlib import Path


def scope(document, tags):
    result = copy.deepcopy(document)
    verbs = {"get", "post", "put", "patch", "delete", "head", "options", "trace"}
    paths = {}
    for path, item in document.get("paths", {}).items():
        operations = {key: value for key, value in item.items()
                      if key in verbs and set(value.get("tags", [])).intersection(tags)}
        if operations:
            paths[path] = {key: copy.deepcopy(value) for key, value in item.items() if key not in verbs}
            paths[path].update(copy.deepcopy(operations))
    result["paths"] = paths
    result["tags"] = [tag for tag in result.get("tags", []) if tag.get("name") in tags]
    components = document.get("components", {})
    result["components"] = {}
    if "securitySchemes" in components:
        result["components"]["securitySchemes"] = copy.deepcopy(components["securitySchemes"])
    needed = set()

    def references(value):
        if isinstance(value, dict):
            ref = value.get("$ref", "")
            if ref.startswith("#/components/"):
                needed.add(ref)
            for nested in value.values():
                references(nested)
        elif isinstance(value, list):
            for nested in value:
                references(nested)

    references(result)
    visited = set()
    while needed - visited:
        ref = sorted(needed - visited)[0]
        parts = ref.split("/")
        if len(parts) != 4:
            raise ValueError(f"Unsupported component reference: {ref}")
        kind, name = parts[2], parts[3].replace("~1", "/").replace("~0", "~")
        value = copy.deepcopy(components[kind][name])
        result["components"].setdefault(kind, {})[name] = value
        visited.add(ref)
        references(value)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--tags", nargs="+", required=True)
    args = parser.parse_args()
    result = scope(json.loads(args.input.read_text(encoding="utf-8")), set(args.tags))
    if not result.get("paths"):
        raise SystemExit("No matching published operations")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Scoped {len(result['paths'])} paths")


if __name__ == "__main__":
    main()
