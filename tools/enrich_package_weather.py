#!/usr/bin/env python3
"""Create a new immutable package revision with verified weather context."""

from __future__ import annotations

import argparse
import json
import subprocess
import zipfile
from pathlib import Path


def json_bytes(value: object) -> bytes:
    return (json.dumps(value, indent=2, ensure_ascii=False) + "\n").encode("utf-8")


def weather_record(repo_root: Path) -> dict:
    module = repo_root / "field" / "authoritative-weather.js"
    script = (
        "const w=require(process.argv[1]);"
        "process.stdout.write(JSON.stringify(w.pearsonVerifiedContext("
        "{latitude:30.48987163,longitude:-87.0900716},'2026-08-04T12:00:00.000Z')));"
    )
    completed = subprocess.run(["node", "-e", script, str(module)], check=True, capture_output=True, text=True)
    return json.loads(completed.stdout)


def enrich(source: Path, output: Path, repo_root: Path) -> None:
    if source.resolve() == output.resolve():
        raise ValueError("Output must be a new immutable package revision, not the source package.")
    if output.exists():
        raise FileExistsError(f"Refusing to overwrite existing package revision: {output}")
    weather = weather_record(repo_root)
    weather_file = {
        "weather_record_id": "WEATHER-INSPECTION-1",
        "source": "Official NOAA/NWS/NCEI station context plus separately preserved inspector-entered conditions",
        "evidence_classification": "Public Data",
        "observed_site_conditions": {},
        "manual_context": {},
        "authoritative_context": weather,
        "limitations": "Official station rainfall may differ materially from parcel rainfall. Weather context does not prove site causation, extent, duration, recurrence, or year-round conditions.",
    }
    partial = output.with_suffix(output.suffix + ".partial")
    if partial.exists():
        raise FileExistsError(f"Remove prior incomplete revision before retrying: {partial}")
    with zipfile.ZipFile(source, "r") as old, zipfile.ZipFile(partial, "w", allowZip64=True) as new:
        names = set(old.namelist())
        if "AI_ANALYSIS.json" not in names:
            raise ValueError("Source is not an AI analysis package: AI_ANALYSIS.json is absent.")
        analysis = json.loads(old.read("AI_ANALYSIS.json"))
        weather_file["observed_site_conditions"] = analysis.get("inspection_conditions") or {}
        existing_weather = analysis.get("weather") or {}
        weather_file["manual_context"] = existing_weather.get("manual_context") or existing_weather.get("values") or {}
        analysis["weather"] = weather_file
        analysis.setdefault("metadata", {})["weather_enrichment"] = {
            "revision": "authoritative-weather-1",
            "created_at": "2026-08-04T12:00:00.000Z",
            "source_package": source.name,
            "source_package_preserved": True,
        }
        for info in old.infolist():
            if info.filename in {"AI_ANALYSIS.json", "WEATHER_CONTEXT.json"}:
                continue
            new.writestr(info, old.read(info.filename), compress_type=info.compress_type)
        new.writestr("AI_ANALYSIS.json", json_bytes(analysis), compress_type=zipfile.ZIP_DEFLATED)
        new.writestr("WEATHER_CONTEXT.json", json_bytes(weather_file), compress_type=zipfile.ZIP_DEFLATED)
    partial.replace(output)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    repo_root = Path(__file__).resolve().parents[1]
    enrich(args.source.resolve(), args.output.resolve(), repo_root)
    print(args.output.resolve())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
