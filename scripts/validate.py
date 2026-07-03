#!/usr/bin/env python3
"""
Structural lint for the vibe-clock@vibe desklet.

Catches the two classes of bugs that have actually broken this desklet before:
  1. Malformed JSON/SVG/JS that Cinnamon fails to parse silently or with an
     unhelpful traceback (e.g. the header "name" vs "description" mixup that
     crashed the settings dialog before it ever opened a window).
  2. Settings-schema entries that don't match what Cinnamon's own widget
     types require (missing "step" on a spinbutton, a "dependency" pointing
     at a style value that doesn't exist, etc).

Run this after touching desklet.js, settings-schema.json, metadata.json or
any *.svg in cinnamon-desklet/vibe-clock@vibe/ - before reloading Cinnamon.
"""

import json
import re
import subprocess
import sys
import xml.dom.minidom as minidom
from pathlib import Path

DESKLET_DIR = Path(__file__).resolve().parent.parent / "cinnamon-desklet" / "vibe-clock@vibe"

errors = []
warnings = []


def fail(msg):
    errors.append(msg)


def warn(msg):
    warnings.append(msg)


def check_json_files():
    for name in ["metadata.json", "settings-schema.json"]:
        path = DESKLET_DIR / name
        if not path.exists():
            fail(f"{name}: file missing")
            continue
        try:
            with open(path, encoding="utf-8") as f:
                json.load(f)
        except json.JSONDecodeError as e:
            fail(f"{name}: invalid JSON - {e}")


def check_svg_files():
    for path in sorted(DESKLET_DIR.glob("*.svg")):
        try:
            minidom.parse(str(path))
        except Exception as e:
            fail(f"{path.name}: invalid XML - {e}")


def check_js_syntax():
    path = DESKLET_DIR / "desklet.js"
    if not path.exists():
        fail("desklet.js: file missing")
        return
    result = subprocess.run(["node", "--check", str(path)], capture_output=True, text=True)
    if result.returncode != 0:
        fail(f"desklet.js: syntax error -\n{result.stderr.strip()}")


# Cinnamon's xlet-settings.py requirements per widget type, reverse-engineered
# from /usr/share/cinnamon/cinnamon-settings/xlet-settings.py and
# /usr/share/cinnamon/js/ui/settings.js. Keep in sync if Cinnamon changes.
REQUIRED_FIELDS = {
    "header": ["description"],
    "checkbox": ["default", "description"],
    "switch": ["default", "description"],
    "spinbutton": ["default", "min", "max", "step", "description"],
    "scale": ["default", "min", "max", "step", "description"],
    "colorchooser": ["default", "description"],
    "entry": ["default", "description"],
    "combobox": ["default", "description", "options"],
    "iconfilechooser": ["default", "description"],
}


def check_settings_schema():
    path = DESKLET_DIR / "settings-schema.json"
    if not path.exists():
        return
    with open(path, encoding="utf-8") as f:
        schema = json.load(f)

    style_options = None
    for key, entry in schema.items():
        if key == "style" and entry.get("type") == "combobox":
            style_options = set(entry.get("options", {}).values())

    for key, entry in schema.items():
        entry_type = entry.get("type")
        if entry_type is None:
            fail(f"settings-schema.json: '{key}' has no \"type\"")
            continue

        required = REQUIRED_FIELDS.get(entry_type)
        if required is None:
            warn(f"settings-schema.json: '{key}' has unrecognized type '{entry_type}' - not validated")
            continue

        for field in required:
            if field not in entry:
                fail(f"settings-schema.json: '{key}' (type={entry_type}) is missing required field \"{field}\"")

        dependency = entry.get("dependency")
        if dependency and style_options is not None:
            m = re.match(r"^([\w-]+)([=!<>]+)(.+)$", dependency)
            if m and m.group(1) == "style":
                dep_value = m.group(3)
                if dep_value not in style_options:
                    fail(f"settings-schema.json: '{key}' depends on style={dep_value!r}, "
                         f"but 'style' combobox has no such option (has: {sorted(style_options)})")


def check_style_registry_consistency():
    """
    Cross-check STYLES prefixes declared in desklet.js against
    settings-schema.json sections, without duplicating the full key-building
    logic (that lives in desklet.js's buildSettingsKeys()).
    """
    js_path = DESKLET_DIR / "desklet.js"
    schema_path = DESKLET_DIR / "settings-schema.json"
    if not js_path.exists() or not schema_path.exists():
        return

    js_source = js_path.read_text(encoding="utf-8")
    prefix_matches = list(re.finditer(r'prefix:\s*"([\w-]+)"', js_source))
    if not prefix_matches:
        warn("desklet.js: could not find any STYLES prefixes via regex - skipping cross-check")
        return

    # Bound each style's block to [this "prefix:" match, next one) so a brace
    # inside e.g. a multi-line icon() function doesn't truncate the search
    # window the way a naive [^}]* would.
    prefixes = []
    generated_bg_prefixes = set()
    for i, m in enumerate(prefix_matches):
        prefix = m.group(1)
        prefixes.append(prefix)
        block_end = prefix_matches[i + 1].start() if i + 1 < len(prefix_matches) else len(js_source)
        block = js_source[m.start():block_end]
        if re.search(r'generatedBackground:\s*true', block):
            generated_bg_prefixes.add(prefix)

    with open(schema_path, encoding="utf-8") as f:
        schema = json.load(f)
    schema_keys = set(schema.keys())

    for prefix in prefixes:
        common = ["accent-color", "show-icon", "icon-size", "time-font-size", "top-decor", "bottom-decor"]
        extra = ["glow-color", "date-color", "bg-color"] if prefix in generated_bg_prefixes else ["time-color"]
        for suffix in common + extra:
            expected = f"{prefix}-{suffix}"
            if expected not in schema_keys:
                fail(f"settings-schema.json: missing '{expected}' expected by STYLES.{prefix} in desklet.js")

    icon_files = re.findall(r'"sprite-([\w-]+)\.svg"', js_source)
    for character in icon_files:
        svg_path = DESKLET_DIR / f"sprite-{character}.svg"
        if not svg_path.exists():
            fail(f"desklet.js references sprite-{character}.svg but the file doesn't exist")


def main():
    check_json_files()
    check_svg_files()
    check_js_syntax()
    check_settings_schema()
    check_style_registry_consistency()

    for w in warnings:
        print(f"WARN  {w}")
    for e in errors:
        print(f"FAIL  {e}")

    if errors:
        print(f"\n{len(errors)} error(s), {len(warnings)} warning(s).")
        sys.exit(1)

    print(f"OK - all checks passed ({len(warnings)} warning(s)).")


if __name__ == "__main__":
    main()
