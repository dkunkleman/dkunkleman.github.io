#!/usr/bin/env python3
"""Build and verify a compact ChatGPT package from a real Property Inspector archive.

The source ZIP is never modified. Exact originals stay in the source archive; this
package contains derived analysis JPEGs plus source hashes and metadata.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
import os
import sys
import zipfile
from datetime import datetime
from pathlib import Path

from PIL import Image, ImageOps


TARGET_BYTES = 250 * 1024 * 1024
PHOTO_MAX_DIMENSION = 1900
PHOTO_JPEG_QUALITY = 80
WEATHER_ID = "WEATHER-INSPECTION-1"

DECISIONS = {
    "access": "Can I access it?",
    "buildability": "Can I build here?",
    "economics": "Can I make money here?",
    "cost_risk": "What might cost me money?",
    "distinctive_value": "What makes this property special?",
}

DECISION_TYPES = {
    "access": {"field.entrance", "field.blocked", "field.culvert", "field.ditch", "field.wet", "field.thick", "field.dry", "field.open"},
    "buildability": {"field.homesite", "field.high", "field.dry", "field.wet", "field.ditch", "field.culvert", "field.blocked", "field.thick", "field.open", "field.entrance"},
    "economics": {"field.timber", "field.tree", "field.homesite", "field.open", "field.entrance", "field.wildlife", "field.high", "field.wet", "field.blocked"},
    "cost_risk": {"field.wet", "field.blocked", "field.culvert", "field.ditch", "field.hazard", "field.thick", "field.entrance", "field.dry", "field.high"},
    "distinctive_value": {"field.tree", "field.wildlife", "field.high", "field.open", "field.homesite", "field.timber", "field.wet"},
}

TASKS = [
    "Executive Summary",
    "Property Overview",
    "Top Strengths",
    "Top Concerns",
    "Access",
    "Drainage",
    "Homesites",
    "Timber",
    "Investment Potential",
    "Questions Answered",
    "Questions Remaining",
    "Cheapest Next Investigation",
    "Suggested Return Route",
    "Builder Notes",
    "Buyer Notes",
    "Seller Transparency Notes",
    "Professional Referral Suggestions",
    "Inspection Critique",
    "Field Collection Critique",
    "Ways to Improve the Next Inspection",
    "Most Valuable Photographs",
    "Least Valuable Photographs",
    "Unnecessary Data Collected",
    "Data Missing",
    "Confidence Scores",
    "Final Recommendation",
]

REPORT_TASK_DEPENDENCIES = {
    "Executive Summary": ("executive_summary", "decision_framework", "observations", "photographs"),
    "Property Overview": ("property", "parcel_boundary", "public_data"),
    "Top Strengths": ("decision_framework", "observations", "photographs"),
    "Top Concerns": ("decision_framework", "observations", "questions_remaining"),
    "Access": ("observations:access", "gps_track", "parcel_boundary"),
    "Drainage": ("observations:drainage", "terrain", "contours", "weather"),
    "Homesites": ("observations:homesites", "terrain", "contours", "parcel_boundary"),
    "Timber": ("observations:timber", "photographs"),
    "Investment Potential": ("decision_framework", "property", "observations", "questions_remaining"),
    "Questions Answered": ("observations", "evidence_relationships"),
    "Questions Remaining": ("questions_remaining",),
    "Cheapest Next Investigation": ("questions_remaining:lowest_cost",),
    "Suggested Return Route": ("suggested_next_visit", "gps_track", "parcel_boundary"),
    "Builder Notes": ("observations", "terrain", "contours", "questions_remaining"),
    "Buyer Notes": ("decision_framework", "observations", "questions_remaining"),
    "Seller Transparency Notes": ("observations", "questions_remaining"),
    "Professional Referral Suggestions": ("questions_remaining",),
    "Inspection Critique": ("inspection_statistics", "evidence_relationships", "metadata"),
    "Field Collection Critique": ("inspection_statistics", "observations", "photographs"),
    "Ways to Improve the Next Inspection": ("inspection_statistics", "questions_remaining", "suggested_next_visit"),
    "Most Valuable Photographs": ("photographs", "evidence_relationships"),
    "Least Valuable Photographs": ("photographs", "evidence_relationships"),
    "Unnecessary Data Collected": ("metadata:omissions",),
    "Data Missing": ("questions_remaining", "inspector_thoughts"),
    "Confidence Scores": ("decision_framework", "observations:confidence"),
    "Final Recommendation": ("decision_framework", "observations", "questions_remaining"),
}


def iso_seconds(value: str | None) -> float | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
    except (TypeError, ValueError):
        return None


def haversine(a: dict, b: dict) -> float:
    lat1 = float(a["lat"])
    lon1 = float(a["lon"])
    lat2 = float(b["lat"])
    lon2 = float(b["lon"])
    radius = 6_371_000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = phi2 - phi1
    dlambda = math.radians(lon2 - lon1)
    value = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(value))


def point_of(item: dict) -> dict:
    if "lat" in item and "lon" in item:
        return {"lat": item["lat"], "lon": item["lon"]}
    gps = item.get("gps") or item.get("location") or {}
    return {"lat": gps.get("latitude"), "lon": gps.get("longitude")}


def time_of(item: dict) -> float | None:
    for key in ("recorded_at", "observed_at", "started_at", "time"):
        parsed = iso_seconds(item.get(key))
        if parsed is not None:
            return parsed
    gps = item.get("gps") or item.get("location") or {}
    return iso_seconds(gps.get("position_at") or gps.get("gps_position_at"))


def distance_time(target: dict, candidate: dict) -> tuple[float, float]:
    a = point_of(target)
    b = point_of(candidate)
    if None in (a.get("lat"), a.get("lon"), b.get("lat"), b.get("lon")):
        distance = float("inf")
    else:
        distance = haversine(a, b)
    ta = time_of(target)
    tb = time_of(candidate)
    delta = abs(ta - tb) if ta is not None and tb is not None else float("inf")
    return distance, delta


def nearest(target: dict, candidates: list[dict], count: int) -> list[tuple[dict, float, float]]:
    ranked = []
    for candidate in candidates:
        distance, delta = distance_time(target, candidate)
        score = distance + min(delta, 7200) * 0.04
        ranked.append((score, candidate, distance, delta))
    ranked.sort(key=lambda row: row[0])
    return [(item, distance, delta) for _, item, distance, delta in ranked[:count]]


def nearest_gps(target: dict, gps_points: list[dict]) -> dict:
    target_time = time_of(target)
    if target_time is not None:
        best = min(gps_points, key=lambda point: abs((iso_seconds(point.get("time")) or 0) - target_time))
    else:
        best = min(gps_points, key=lambda point: distance_time(target, point)[0])
    return best


def cardinal(heading) -> str:
    if heading is None:
        return "NOT_AVAILABLE"
    names = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
    return names[int((float(heading) % 360 + 11.25) // 22.5) % 16]


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while block := handle.read(8 * 1024 * 1024):
            digest.update(block)
    return digest.hexdigest()


def json_bytes(value: object) -> bytes:
    return (json.dumps(value, indent=2, ensure_ascii=False) + "\n").encode("utf-8")


def safe_id(prefix: str, index: int) -> str:
    return f"{prefix}{index:06d}"


def normalize_gps(raw_points: list[dict]) -> tuple[list[dict], dict]:
    points = []
    raw_distance = 0.0
    filtered_distance = 0.0
    rejected_segments = 0
    previous = None
    for index, raw in enumerate(raw_points, 1):
        point = dict(raw)
        point["gps_point_id"] = safe_id("GPS", index)
        point["sequence"] = index
        point["quality_flag"] = "accepted"
        point["use_for_distance"] = True
        if float(point.get("accuracy_m") or 99999) > 30:
            point["quality_flag"] = "poor_accuracy"
            point["use_for_distance"] = False
        if previous is not None:
            distance = haversine(previous, point)
            before = iso_seconds(previous.get("time"))
            after = iso_seconds(point.get("time"))
            delta = after - before if before is not None and after is not None else 0
            raw_distance += distance
            speed = distance / delta if delta > 0 else float("inf")
            previous_accuracy_ok = float(previous.get("accuracy_m") or 99999) <= 30
            current_accuracy_ok = float(point.get("accuracy_m") or 99999) <= 30
            if delta <= 0 or delta > 120 or speed > 5 or not previous_accuracy_ok or not current_accuracy_ok:
                point["use_for_distance"] = False
                if point["quality_flag"] == "accepted":
                    point["quality_flag"] = "gap_or_implausible_segment"
                rejected_segments += 1
            else:
                filtered_distance += distance
        points.append(point)
        previous = point
    return points, {
        "raw_unfiltered_distance_miles": raw_distance / 1609.344,
        "quality_filtered_distance_miles": filtered_distance / 1609.344,
        "distance_method": "Sum consecutive segments only when both points have accuracy <=30 m, elapsed time is 1-120 seconds, and implied speed is <=5 m/s.",
        "rejected_segment_count": rejected_segments,
        "warning": "The source app's raw distance includes GPS jumps and must not be reported as walked distance without qualification.",
    }


def decision_categories(observation_type: str) -> list[dict]:
    result = []
    for decision_id, question in DECISIONS.items():
        if observation_type in DECISION_TYPES[decision_id]:
            result.append({"decision_id": decision_id, "question": question})
    if not result:
        result = [
            {"decision_id": "cost_risk", "question": DECISIONS["cost_risk"]},
            {"decision_id": "distinctive_value", "question": DECISIONS["distinctive_value"]},
        ]
    return result


def confidence_for(observation: dict, photo_links: list[dict], voice_links: list[dict]) -> dict:
    classification = observation.get("evidence_classification") or "Observed"
    score = {"Measured": 55, "Observed": 45, "Public Data": 40, "Estimated": 30, "Interpretation": 20, "Needs Professional Verification": 20}.get(classification, 30)
    basis = [f"Evidence classification: {classification}."]
    accuracy = observation.get("gps", {}).get("accuracy_m")
    if accuracy is not None and accuracy <= 10:
        score += 15
        basis.append("GPS accuracy is 10 m or better.")
    elif accuracy is not None and accuracy <= 25:
        score += 10
        basis.append("GPS accuracy is 25 m or better.")
    elif accuracy is not None and accuracy <= 50:
        score += 5
        basis.append("GPS accuracy is usable but imprecise.")
    else:
        basis.append("GPS accuracy is weak or unavailable.")
    if observation.get("compass_heading_deg") is not None:
        score += 5
        basis.append("Compass heading is available.")
    direct_photo = next((link for link in photo_links if link["relationship"] == "direct"), None)
    close_photo = next((link for link in photo_links if link["distance_m"] <= 25 and link["time_delta_seconds"] <= 600), None)
    if direct_photo:
        score += 25
        basis.append("A photograph is directly attached.")
    elif close_photo:
        score += 18
        basis.append("A photograph is nearby in space and time, but association is inferred.")
    elif photo_links:
        score += 3
        basis.append("Nearest photographs are indexed but may not depict this observation.")
    direct_voice = next((link for link in voice_links if link["relationship"] == "direct"), None)
    close_voice = next((link for link in voice_links if link["distance_m"] <= 25 and link["time_delta_seconds"] <= 600), None)
    if direct_voice:
        score += 10
        basis.append("A voice note is directly attached.")
    elif close_voice:
        score += 6
        basis.append("A voice note is nearby in space and time, but association is inferred.")
    score = max(0, min(100, score))
    label = "high" if score >= 85 else "moderate_high" if score >= 70 else "moderate" if score >= 50 else "low" if score >= 25 else "insufficient"
    return {
        "score_0_to_100": score,
        "level": label,
        "basis": basis,
        "warning": "This is evidence-link confidence, not confidence that the condition is permanent, causal, legally significant, buildable, or economically valuable.",
    }


def optimize_photo(source: bytes) -> tuple[bytes, dict]:
    with Image.open(io.BytesIO(source)) as opened:
        original_width, original_height = opened.size
        image = ImageOps.exif_transpose(opened)
        if image.mode != "RGB":
            image = image.convert("RGB")
        if max(image.size) > PHOTO_MAX_DIMENSION:
            image.thumbnail((PHOTO_MAX_DIMENSION, PHOTO_MAX_DIMENSION), Image.Resampling.LANCZOS)
        output = io.BytesIO()
        image.save(output, "JPEG", quality=PHOTO_JPEG_QUALITY, subsampling=1, optimize=True, progressive=True)
        return output.getvalue(), {
            "source_dimensions_px": {"width": original_width, "height": original_height},
            "analysis_dimensions_px": {"width": image.width, "height": image.height},
        }


def write_member(target: zipfile.ZipFile, name: str, data: bytes, compress: bool = False) -> None:
    method = zipfile.ZIP_DEFLATED if compress else zipfile.ZIP_STORED
    target.writestr(name, data, compress_type=method, compresslevel=9 if compress else None)


def build(source_path: Path, output_path: Path) -> dict:
    if output_path.exists():
        raise FileExistsError(f"Refusing to overwrite existing output: {output_path}")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    partial = output_path.with_suffix(output_path.suffix + ".partial")
    if partial.exists():
        raise FileExistsError(f"Remove the prior incomplete file before retrying: {partial}")

    print("Hashing immutable source archive...", flush=True)
    source_hash = sha256_file(source_path)
    print(f"Source SHA-256: {source_hash}", flush=True)

    with zipfile.ZipFile(source_path, "r") as source:
        source_names = set(source.namelist())
        manifest = json.loads(source.read("inspection.json"))
        raw_observations = manifest["inspection"].get("observations") or []
        raw_photos = manifest.get("photographs") or []
        raw_voices = manifest.get("voice_notes") or []
        gps_points, distance_analysis = normalize_gps(manifest["inspection"].get("gps_track") or [])
        gps_ids = {point["gps_point_id"] for point in gps_points}

        observations = []
        used_observation_ids = set()
        for index, raw in enumerate(raw_observations, 1):
            observation = json.loads(json.dumps(raw))
            candidate = observation.get("observation_id") or safe_id("OBS", index)
            if candidate in used_observation_ids:
                candidate = safe_id("OBS", index)
            observation["observation_id"] = candidate
            used_observation_ids.add(candidate)
            observation["sequence"] = index
            observation["decision_categories"] = decision_categories(observation.get("observation_type") or "field.other")
            observations.append(observation)

        direct_photo_observation = {}
        direct_voice_observation = {}
        for observation in observations:
            attachments = observation.get("attachments") or {}
            if attachments.get("photo_id") is not None:
                direct_photo_observation[str(attachments["photo_id"])] = observation
            if attachments.get("voice_note_id") is not None:
                direct_voice_observation[str(attachments["voice_note_id"])] = observation

        weather = {
            "weather_record_id": WEATHER_ID,
            "source": "Inspector-entered conditions from the real field inspection",
            "evidence_classification": manifest["inspection"].get("conditions", {}).get("evidence_classification") or "Observed",
            "values": manifest["inspection"].get("conditions") or {},
            "limitations": "No authoritative station rainfall history is included. Blank rainfall fields remain unknown and must not be inferred.",
        }

        photo_records = []
        photo_bytes_by_path = {}
        print(f"Optimizing {len(raw_photos)} real photographs...", flush=True)
        substantive_observations = [item for item in observations if item.get("observation_type") not in {"field.photo", "field.voice_note"}]
        for index, photo in enumerate(raw_photos, 1):
            source_member = photo.get("original", {}).get("path")
            if not source_member or source_member not in source_names:
                raise ValueError(f"Missing original photograph for {photo.get('photo_number')}: {source_member}")
            source_bytes = source.read(source_member)
            source_actual_hash = sha256_bytes(source_bytes)
            recorded_hash = photo.get("original", {}).get("sha256")
            if recorded_hash and source_actual_hash != recorded_hash:
                raise ValueError(f"Source hash mismatch for {photo.get('photo_number')}")
            analysis_bytes, dimensions = optimize_photo(source_bytes)
            output_member = f"photos/P{index:03d}.jpg"
            photo_bytes_by_path[output_member] = analysis_bytes
            direct_event = direct_photo_observation.get(str(photo.get("photo_id")))
            nearby_substantive = nearest(photo, substantive_observations, 3) if substantive_observations else []
            primary = None
            relationship = None
            if photo.get("associated_observation_id"):
                primary = next((item for item in observations if item["observation_id"] == photo["associated_observation_id"]), None)
                relationship = "source_association" if primary else None
            if primary is None and nearby_substantive:
                candidate, distance, delta = nearby_substantive[0]
                if distance <= 30 and delta <= 600:
                    primary = candidate
                    relationship = "nearest_substantive_observation"
            if primary is None:
                primary = direct_event or (nearest(photo, observations, 1)[0][0] if observations else None)
                relationship = "direct_photo_event" if direct_event else "nearest_observation"
            gps = nearest_gps(photo, gps_points)
            heading = photo.get("compass_heading_deg")
            location = photo.get("location") or {}
            nearest_links = []
            for item, distance, delta in nearby_substantive:
                nearest_links.append({
                    "observation_id": item["observation_id"],
                    "distance_m": round(distance, 2),
                    "time_delta_seconds": round(delta, 2) if math.isfinite(delta) else None,
                })
            record = {
                "photo_id": photo.get("photo_id") or safe_id("PHOTO", index),
                "photo_number": photo.get("photo_number") or f"P{index}",
                "file_path": output_member,
                "observation_id": primary["observation_id"] if primary else None,
                "observation_relationship": relationship,
                "nearest_observations": nearest_links,
                "gps_point_id": gps["gps_point_id"],
                "time": photo.get("recorded_at"),
                "heading_deg": heading,
                "direction": cardinal(heading),
                "weather_record_id": WEATHER_ID,
                "evidence_classification": photo.get("evidence_classification") or "Observed",
                "map_location": {
                    "latitude": location.get("latitude"),
                    "longitude": location.get("longitude"),
                    "gps_accuracy_m": location.get("gps_accuracy_m"),
                    "property_id": manifest.get("property_id"),
                    "parcel_boundary_path": "map_context/parcel_boundary.geojson",
                    "terrain_path": "map_context/terrain.png",
                    "contours_path": "map_context/contours_2ft.png",
                },
                "category": photo.get("category") or "Other",
                "note": photo.get("note") or "",
                "orientation": photo.get("orientation"),
                "source_original": {
                    "source_archive_member": source_member,
                    "source_filename": photo.get("original", {}).get("source_filename"),
                    "byte_size": len(source_bytes),
                    "sha256": source_actual_hash,
                    "provenance": photo.get("original", {}).get("provenance"),
                    **dimensions,
                },
                "analysis_copy": {
                    "byte_size": len(analysis_bytes),
                    "sha256": sha256_bytes(analysis_bytes),
                    "format": "JPEG",
                    "max_dimension_px": PHOTO_MAX_DIMENSION,
                    "jpeg_quality": PHOTO_JPEG_QUALITY,
                    "purpose": "ChatGPT visual analysis and professional report preparation; exact source bytes remain in the immutable full archive.",
                },
            }
            photo_records.append(record)
            if index % 10 == 0 or index == len(raw_photos):
                print(f"  photographs processed: {index}/{len(raw_photos)}", flush=True)

        voice_records = []
        voice_bytes_by_path = {}
        for index, voice in enumerate(raw_voices, 1):
            source_member = voice.get("audio", {}).get("path")
            if not source_member or source_member not in source_names:
                raise ValueError(f"Missing voice note: {source_member}")
            audio = source.read(source_member)
            actual_hash = sha256_bytes(audio)
            recorded_hash = voice.get("audio", {}).get("sha256")
            if recorded_hash and actual_hash != recorded_hash:
                raise ValueError(f"Voice-note hash mismatch: {source_member}")
            output_member = f"voice_notes/V{index:03d}.m4a"
            voice_bytes_by_path[output_member] = audio
            direct = direct_voice_observation.get(str(voice.get("voice_note_id")))
            primary = direct or (nearest(voice, observations, 1)[0][0] if observations else None)
            gps = nearest_gps(voice, gps_points)
            voice_records.append({
                "voice_note_id": voice.get("voice_note_id") or safe_id("VOICE", index),
                "file_path": output_member,
                "observation_id": primary["observation_id"] if primary else None,
                "observation_relationship": "direct" if direct else "nearest_observation",
                "gps_point_id": gps["gps_point_id"],
                "time": voice.get("started_at"),
                "finished_at": voice.get("finished_at"),
                "duration_ms": voice.get("duration_ms"),
                "heading_deg": voice.get("compass_heading_deg"),
                "direction": cardinal(voice.get("compass_heading_deg")),
                "location": voice.get("location"),
                "evidence_classification": "Observed",
                "byte_size": len(audio),
                "sha256": actual_hash,
            })

        photo_lookup = {str(photo["photo_id"]): photo for photo in photo_records}
        voice_lookup = {str(voice["voice_note_id"]): voice for voice in voice_records}
        raw_photo_lookup = {str(photo.get("photo_id")): photo for photo in raw_photos}
        raw_voice_lookup = {str(voice.get("voice_note_id")): voice for voice in raw_voices}
        for observation in observations:
            attachments = observation.get("attachments") or {}
            direct_photo_id = attachments.get("photo_id")
            direct_voice_id = attachments.get("voice_note_id")
            links_photos = []
            if direct_photo_id is not None and str(direct_photo_id) in photo_lookup:
                photo = photo_lookup[str(direct_photo_id)]
                links_photos.append({"photo_id": photo["photo_id"], "photo_number": photo["photo_number"], "file_path": photo["file_path"], "relationship": "direct", "distance_m": 0.0, "time_delta_seconds": 0.0})
            for raw_photo, distance, delta in nearest(observation, raw_photos, 3):
                photo = photo_lookup[str(raw_photo.get("photo_id"))]
                if any(str(item["photo_id"]) == str(photo["photo_id"]) for item in links_photos):
                    continue
                links_photos.append({"photo_id": photo["photo_id"], "photo_number": photo["photo_number"], "file_path": photo["file_path"], "relationship": "nearest_by_time_and_location", "distance_m": round(distance, 2), "time_delta_seconds": round(delta, 2) if math.isfinite(delta) else None})
                if len(links_photos) >= 3:
                    break
            links_voices = []
            if direct_voice_id is not None and str(direct_voice_id) in voice_lookup:
                voice = voice_lookup[str(direct_voice_id)]
                links_voices.append({"voice_note_id": voice["voice_note_id"], "file_path": voice["file_path"], "relationship": "direct", "distance_m": 0.0, "time_delta_seconds": 0.0})
            for raw_voice, distance, delta in nearest(observation, raw_voices, 2):
                voice = voice_lookup[str(raw_voice.get("voice_note_id"))]
                if any(str(item["voice_note_id"]) == str(voice["voice_note_id"]) for item in links_voices):
                    continue
                links_voices.append({"voice_note_id": voice["voice_note_id"], "file_path": voice["file_path"], "relationship": "nearest_by_time_and_location", "distance_m": round(distance, 2), "time_delta_seconds": round(delta, 2) if math.isfinite(delta) else None})
                if len(links_voices) >= 2:
                    break
            gps = nearest_gps(observation, gps_points)
            observation["gps_point_id"] = gps["gps_point_id"]
            observation["evidence_links"] = {"nearest_photographs": links_photos, "nearest_voice_notes": links_voices}
            observation["confidence"] = confidence_for(observation, links_photos, links_voices)
            observation["evidence_available"] = True

        map_files = {
            "map_context/terrain.png": "context/usgs-terrain.png",
            "map_context/contours_2ft.png": "context/usgs-contours-2ft.png",
            "map_context/parcel_boundary.geojson": "context/parcels.geojson",
        }
        map_bytes = {}
        for output_member, source_member in map_files.items():
            if source_member not in source_names:
                raise ValueError(f"Missing required map evidence: {source_member}")
            map_bytes[output_member] = source.read(source_member)

        relationships = {
            "observation_to_evidence": [{
                "observation_id": observation["observation_id"],
                "gps_point_id": observation["gps_point_id"],
                "photographs": observation["evidence_links"]["nearest_photographs"],
                "voice_notes": observation["evidence_links"]["nearest_voice_notes"],
                "decision_categories": observation["decision_categories"],
                "confidence": observation["confidence"],
            } for observation in observations],
            "photo_to_context": [{
                "photo_id": photo["photo_id"], "photo_number": photo["photo_number"], "file_path": photo["file_path"],
                "gps_point_id": photo["gps_point_id"], "observation_id": photo["observation_id"], "time": photo["time"],
                "heading_deg": photo["heading_deg"], "direction": photo["direction"], "weather_record_id": photo["weather_record_id"],
                "evidence_classification": photo["evidence_classification"], "map_location": photo["map_location"],
            } for photo in photo_records],
            "voice_to_context": [{
                "voice_note_id": voice["voice_note_id"], "file_path": voice["file_path"], "gps_point_id": voice["gps_point_id"],
                "observation_id": voice["observation_id"], "time": voice["time"],
            } for voice in voice_records],
        }

        questions_remaining = [
            {"question": "What is the legal and all-weather access status?", "why_it_matters": "Access and buildability", "lowest_cost_next_source": "Review deed, recorded easements, road-maintenance agreements, and county road records before ordering field work."},
            {"question": "Which areas are buildable under soils, septic, wetlands, floodplain, setbacks, and grade constraints?", "why_it_matters": "Buildability and site cost", "lowest_cost_next_source": "Overlay available public soils, FEMA, wetlands, and zoning records, then target only the leading homesite candidates for professional review."},
            {"question": "How persistent and rainfall-dependent are the wet areas?", "why_it_matters": "Drainage, access, construction, maintenance, and permitting", "lowest_cost_next_source": "Obtain authoritative rainfall totals for the 1-, 7-, and 30-day periods and revisit priority wet areas after a contrasting dry period."},
            {"question": "What utility service, extension distance, and capacity are available?", "why_it_matters": "Buildability and development cost", "lowest_cost_next_source": "Call electric, water, sewer, gas, and communications providers with the parcel ID and nearest road location."},
            {"question": "What timber volume, species mix, quality, and harvest access exist?", "why_it_matters": "Economic potential and clearing offsets", "lowest_cost_next_source": "Use the mapped tree evidence to define a focused forester walk rather than commissioning an unfocused property-wide cruise."},
            {"question": "Which portions of the parcel were not reliably covered?", "why_it_matters": "All five decisions", "lowest_cost_next_source": "Use the quality-filtered route and parcel polygon to generate a gap-focused return route; do not use rejected GPS jumps as coverage."},
        ]

        suggested_next_visit = {
            "objective": "Remove the highest-value remaining uncertainty with the shortest safe route.",
            "route_generation_instruction": "Compare accepted GPS points with the parcel polygon, exclude rejected GPS jumps, identify the largest unvisited areas and decision-critical gaps, then order stops to minimize backtracking from the recorded entrance.",
            "priority_stops": [
                "Uninspected or weakly covered parcel areas affecting the five decisions.",
                "Leading homesite candidates for drainage, grade, access, and utility observations.",
                "Wet areas and culverts after contrasting rainfall conditions.",
                "Blocked access points and potential alternate approaches.",
                "Representative timber areas selected from the mapped tree observations.",
            ],
            "do_not_repeat": "Do not revisit well-documented photo locations unless a specific unanswered question requires changed conditions, measurement, or professional confirmation.",
        }

        source_summary = manifest.get("summary") or {}
        analysis = {
            "package_type": "AI_ANALYSIS_REPORT_PACKAGE",
            "analysis_purpose": "Allow ChatGPT to reconstruct and analyze the real property inspection from one upload without asking the user to match evidence.",
            "executive_summary": {
                "status": "GENERATE_COMPLETE_NARRATIVE_FROM_ALL_EVIDENCE",
                "inspection_id": manifest.get("inspection_id"),
                "property_id": manifest.get("property_id"),
                "inspection_date": manifest["inspection"].get("conditions", {}).get("inspection_date"),
                "recorded_acres": manifest.get("property", {}).get("recorded_acres"),
                "verified_counts": {"gps_points": len(gps_points), "observations": len(observations), "photographs": len(photo_records), "voice_notes": len(voice_records), "inspector_thoughts": 0},
                "critical_warning": distance_analysis["warning"],
            },
            "inspection_statistics": {
                "source_recorded_statistics": source_summary,
                "gps_distance_quality_analysis": distance_analysis,
                "started_at": manifest["inspection"].get("started_at"),
                "finished_at": manifest["inspection"].get("finished_at"),
                "lifecycle_events": manifest["inspection"].get("lifecycle_events") or [],
            },
            "decision_framework": [{"decision_id": key, "question": value, "instruction": "Answer from cited evidence; identify strengths, concerns, unknowns, confidence, and the cheapest next investigation."} for key, value in DECISIONS.items()],
            "property": manifest.get("property"),
            "inspection_conditions": manifest["inspection"].get("conditions") or {},
            "gps_track": {"coordinate_reference_system": "EPSG:4326", "raw_point_count": len(gps_points), "points": gps_points, "distance_quality_analysis": distance_analysis},
            "observations": observations,
            "photographs": photo_records,
            "voice_notes": voice_records,
            "inspector_thoughts": {"status": "NO_EXPLICIT_INSPECTOR_THOUGHTS_RECORDED", "entries": [], "rule": "Do not infer inspector thoughts from ordinary observations or notes and do not convert interpretations into facts."},
            "terrain": {**(manifest.get("map_context", {}).get("layers", {}).get("terrain") or {}), "file_path": "map_context/terrain.png"},
            "contours": {**(manifest.get("map_context", {}).get("layers", {}).get("contours") or {}), "file_path": "map_context/contours_2ft.png"},
            "parcel_boundary": {**(manifest.get("map_context", {}).get("subject_parcel") or {}), "file_path": "map_context/parcel_boundary.geojson"},
            "weather": weather,
            "evidence_relationships": relationships,
            "questions_remaining": questions_remaining,
            "suggested_next_visit": suggested_next_visit,
            "public_data": {"map_context": manifest.get("map_context"), "rule": "Public map layers are context, not a survey, wetland delineation, engineering determination, appraisal, septic approval, or title opinion."},
            "metadata": {
                "source_archive": {"filename": source_path.name, "byte_size": source_path.stat().st_size, "sha256": source_hash, "modified_at": datetime.fromtimestamp(source_path.stat().st_mtime).astimezone().isoformat()},
                "source_package_format": manifest.get("format"),
                "source_package_version": manifest.get("format_version"),
                "generated_at": datetime.now().astimezone().isoformat(),
                "photo_profile": {"max_dimension_px": PHOTO_MAX_DIMENSION, "jpeg_quality": PHOTO_JPEG_QUALITY, "source": "Exact original member from immutable source archive", "original_bytes_included": False},
                "actual_photo_paths": [photo["file_path"] for photo in photo_records],
                "actual_voice_paths": [voice["file_path"] for voice in voice_records],
                "omitted_as_duplicate_or_unnecessary": ["full-resolution original photo bytes", "legacy analysis copies", "events.csv", "observations.csv", "photos.csv", "voice-notes.csv", "track.geojson", "track.gpx", "printable-report.html", "raw orientation sample stream", "repository storage manifests"],
            },
        }

        start_here = f"""# CHATGPT START HERE

This is the AI analysis package for the real {analysis['executive_summary']['inspection_date']} rural-property inspection of parcel `{manifest.get('property_id')}` ({manifest.get('property', {}).get('recorded_acres')} recorded acres).

Begin immediately. Do not ask the user to identify photographs, observations, locations, voice notes, or map files.

## What is here

- `AI_ANALYSIS.json` is the single canonical analysis record. It contains the executive-summary inputs, statistics, five decisions, property, conditions, every GPS point, every observation, photograph and voice index, inspector-thought status, terrain, contours, parcel boundary, weather, evidence relationships, questions remaining, suggested next visit, public data, and metadata.
- `photos/` contains all {len(photo_records)} actual analysis-quality photographs. Each photograph record supplies its exact file path, GPS point, observation, time, heading, direction, weather record, evidence classification, map location, source hash, and derived-file hash.
- `voice_notes/` contains all {len(voice_records)} actual recordings. Each is linked to time, GPS, and an observation.
- `map_context/terrain.png`, `map_context/contours_2ft.png`, and `map_context/parcel_boundary.geojson` provide the actual map context.
- `CHATGPT_TASKS.md` lists the required outputs.

## Evidence relationships

Use `evidence_relationships` in `AI_ANALYSIS.json`. A `direct` relationship came from the source record. `nearest_by_time_and_location` and `nearest_substantive_observation` are computed associations and include distance and time differences so you can judge their strength. Never describe an inferred relationship as direct.

Every observation has a stable observation ID, a stable GPS-point ID, nearest photographs, nearest voice notes, decision categories, and an evidence-link confidence score. Every referenced media path was verified inside this ZIP.

## Confidence

- 85-100: high evidence-link confidence.
- 70-84: moderately high.
- 50-69: moderate.
- 25-49: low.
- 0-24: insufficient.

The score measures confidence in the observation's evidence links. It does **not** prove permanence, cause, legal significance, buildability, value, wetland status, septic suitability, or professional conclusions. Give separate decision-level confidence with reasons.

## Inspector thoughts

No explicit Inspector Thought records exist in this source inspection. Do not infer thoughts from ordinary observations or notes. Observed evidence and interpretation must remain separate.

## Generate the report

1. Read all of `AI_ANALYSIS.json`.
2. Inspect every photograph and listen to every voice note; do not sample only a few.
3. Use the accepted GPS points and parcel polygon for route and coverage analysis. Preserve all raw points but exclude points marked poor or implausible from distance and coverage conclusions.
4. Produce every section in `CHATGPT_TASKS.md` without asking the user a preliminary question.
5. Cite observation IDs, photo numbers, voice-note IDs, GPS-point IDs, and public-data sources for material conclusions.
6. Put unsupported matters under Questions Remaining and pair each with the cheapest credible investigation.

## Do not assume

- No observation is proof that a condition is absent elsewhere.
- A nearby photo or voice note is not a direct link unless marked direct.
- The source app's raw 15.78-mile distance is reliable; GPS jumps inflated it. Use the quality-filtered estimate and explain the method.
- Parcel lines are a boundary survey.
- Wet areas are jurisdictional wetlands or permanent.
- A marked homesite is buildable, permitted, septic-suitable, or economically optimal.
- Timber observations establish volume or value.
- Public layers or inspector observations replace engineering, surveying, title, appraisal, forestry, environmental, or permitting work.
"""

        task_lines = ["# CHATGPT TASKS", "", "Produce one complete Property Intelligence Report from this package. Begin analysis immediately and do not ask the user to match evidence.", ""]
        task_lines.extend(f"## {item}\n" for item in TASKS)
        task_lines.extend([
            "## Output rules\n",
            "- Cite the strongest evidence for every material conclusion.\n",
            "- State what is known, what is inferred, and what remains unknown.\n",
            "- Give an explained confidence score for each of the five property decisions.\n",
            "- Every recommended next action must state the uncertainty it removes, estimated cost tier, and decision it could change.\n",
            "- Do not invent dollar values, legal rights, buildability, wetland status, timber value, or utility availability.\n",
            "- Generate the report even when evidence is incomplete; unresolved matters belong under Questions Remaining.\n",
        ])
        tasks_md = "\n".join(task_lines)

        with zipfile.ZipFile(partial, "w", allowZip64=True) as target:
            write_member(target, "CHATGPT_START_HERE.md", start_here.encode("utf-8"), compress=True)
            write_member(target, "CHATGPT_TASKS.md", tasks_md.encode("utf-8"), compress=True)
            write_member(target, "AI_ANALYSIS.json", json_bytes(analysis), compress=True)
            for name, data in photo_bytes_by_path.items():
                write_member(target, name, data)
            for name, data in voice_bytes_by_path.items():
                write_member(target, name, data)
            for name, data in map_bytes.items():
                write_member(target, name, data, compress=name.endswith(".geojson"))

    size = partial.stat().st_size
    if size > TARGET_BYTES:
        raise ValueError(f"Generated package is {size / 1024 / 1024:.1f} MB, above the 250 MB target. Source and partial output were preserved for review.")
    os.replace(partial, output_path)
    return {"output_path": str(output_path), "byte_size": size, "megabytes": round(size / 1024 / 1024, 2), "source_sha256": source_hash}


def report_section_readiness(analysis: dict) -> dict:
    observations = analysis.get("observations") or []
    observation_types = {item.get("observation_type") for item in observations}
    special_sources = {
        "observations:access": bool(observation_types & {"field.entrance", "field.blocked", "field.culvert", "field.wet", "field.dry"}),
        "observations:drainage": bool(observation_types & {"field.wet", "field.dry", "field.culvert", "field.ditch", "field.high"}),
        "observations:homesites": bool(observation_types & {"field.homesite", "field.high", "field.dry", "field.wet"}),
        "observations:timber": bool(observation_types & {"field.tree", "field.timber"}),
        "observations:confidence": bool(observations) and all(item.get("confidence") for item in observations),
        "questions_remaining:lowest_cost": bool(analysis.get("questions_remaining")) and all(item.get("lowest_cost_next_source") for item in analysis["questions_remaining"]),
        "metadata:omissions": bool((analysis.get("metadata") or {}).get("omitted_as_duplicate_or_unnecessary")),
    }
    readiness = {}
    for task, dependencies in REPORT_TASK_DEPENDENCIES.items():
        checks = []
        for source in dependencies:
            available = special_sources.get(source)
            if available is None:
                available = bool(analysis.get(source))
            checks.append({"source": source, "available": available})
        readiness[task] = {
            "ready": all(check["available"] for check in checks),
            "evidence_sources": checks,
        }
    return readiness


def validate(package_path: Path) -> dict:
    failures = []
    with zipfile.ZipFile(package_path, "r") as package:
        bad_crc = package.testzip()
        if bad_crc:
            failures.append(f"CRC failure: {bad_crc}")
        names = set(package.namelist())
        required = {"CHATGPT_START_HERE.md", "CHATGPT_TASKS.md", "AI_ANALYSIS.json", "map_context/terrain.png", "map_context/contours_2ft.png", "map_context/parcel_boundary.geojson"}
        failures.extend(f"Missing required member: {name}" for name in sorted(required - names))
        analysis = json.loads(package.read("AI_ANALYSIS.json"))
        for map_path in ("map_context/terrain.png", "map_context/contours_2ft.png"):
            if map_path in names:
                try:
                    with Image.open(io.BytesIO(package.read(map_path))) as image:
                        image.verify()
                except Exception as error:
                    failures.append(f"Map image cannot be decoded: {map_path}: {error}")
        if "map_context/parcel_boundary.geojson" in names:
            try:
                parcel_geojson = json.loads(package.read("map_context/parcel_boundary.geojson"))
                if not parcel_geojson.get("type"):
                    failures.append("Parcel boundary GeoJSON lacks a type")
            except Exception as error:
                failures.append(f"Parcel boundary GeoJSON cannot be parsed: {error}")
        gps_ids = {point["gps_point_id"] for point in analysis["gps_track"]["points"]}
        observation_ids = {item["observation_id"] for item in analysis["observations"]}
        photo_ids = {str(item["photo_id"]) for item in analysis["photographs"]}
        voice_ids = {str(item["voice_note_id"]) for item in analysis["voice_notes"]}
        decoded_photo_count = 0
        for photo in analysis["photographs"]:
            path = photo.get("file_path")
            if path not in names:
                failures.append(f"Missing photograph: {path}")
                continue
            data = package.read(path)
            if sha256_bytes(data) != photo["analysis_copy"]["sha256"]:
                failures.append(f"Photograph hash mismatch: {path}")
            try:
                with Image.open(io.BytesIO(data)) as image:
                    image.verify()
                decoded_photo_count += 1
            except Exception as error:
                failures.append(f"Photograph cannot be decoded: {path}: {error}")
            for field in ("gps_point_id", "observation_id", "time", "heading_deg", "direction", "weather_record_id", "evidence_classification", "map_location"):
                if field not in photo:
                    failures.append(f"Photograph {photo.get('photo_number')} lacks {field}")
            if photo.get("gps_point_id") not in gps_ids:
                failures.append(f"Broken photo GPS link: {photo.get('photo_number')}")
            if photo.get("observation_id") not in observation_ids:
                failures.append(f"Broken photo observation link: {photo.get('photo_number')}")
        for observation in analysis["observations"]:
            if observation.get("gps_point_id") not in gps_ids:
                failures.append(f"Broken observation GPS link: {observation.get('observation_id')}")
            links = observation.get("evidence_links") or {}
            if not links.get("nearest_photographs"):
                failures.append(f"Observation lacks photograph evidence: {observation.get('observation_id')}")
            if not links.get("nearest_voice_notes"):
                failures.append(f"Observation lacks voice-note relationship: {observation.get('observation_id')}")
            if not observation.get("decision_categories"):
                failures.append(f"Observation lacks decision category: {observation.get('observation_id')}")
            if not observation.get("confidence"):
                failures.append(f"Observation lacks confidence: {observation.get('observation_id')}")
            for link in links.get("nearest_photographs", []):
                if str(link.get("photo_id")) not in photo_ids or link.get("file_path") not in names:
                    failures.append(f"Broken observation-photo link: {observation.get('observation_id')}")
            for link in links.get("nearest_voice_notes", []):
                if str(link.get("voice_note_id")) not in voice_ids or link.get("file_path") not in names:
                    failures.append(f"Broken observation-voice link: {observation.get('observation_id')}")
        for voice in analysis["voice_notes"]:
            path = voice.get("file_path")
            if path not in names:
                failures.append(f"Missing voice note: {path}")
                continue
            if sha256_bytes(package.read(path)) != voice.get("sha256"):
                failures.append(f"Voice-note hash mismatch: {path}")
            if b"ftyp" not in package.read(path)[:32]:
                failures.append(f"Voice note does not have an expected M4A/MP4 header: {path}")
            if voice.get("gps_point_id") not in gps_ids or voice.get("observation_id") not in observation_ids:
                failures.append(f"Broken voice-note relationship: {voice.get('voice_note_id')}")
        required_sections = ["executive_summary", "inspection_statistics", "decision_framework", "property", "inspection_conditions", "gps_track", "observations", "photographs", "voice_notes", "inspector_thoughts", "terrain", "contours", "parcel_boundary", "weather", "evidence_relationships", "questions_remaining", "suggested_next_visit", "public_data", "metadata"]
        for section in required_sections:
            if section not in analysis:
                failures.append(f"Missing analysis section: {section}")
        tasks_text = package.read("CHATGPT_TASKS.md").decode("utf-8")
        for task in TASKS:
            if f"## {task}" not in tasks_text:
                failures.append(f"Missing report task: {task}")
        readiness = report_section_readiness(analysis)
        for task, state in readiness.items():
            if not state["ready"]:
                unavailable = ", ".join(check["source"] for check in state["evidence_sources"] if not check["available"])
                failures.append(f"Report section lacks required evidence: {task}: {unavailable}")
        result = {
            "package_path": str(package_path),
            "byte_size": package_path.stat().st_size,
            "megabytes": round(package_path.stat().st_size / 1024 / 1024, 2),
            "sha256": sha256_file(package_path),
            "zip_member_count": len(names),
            "gps_points": len(gps_ids),
            "observations": len(observation_ids),
            "photographs": len(photo_ids),
            "decoded_photographs": decoded_photo_count,
            "voice_notes": len(voice_ids),
            "inspector_thoughts": len(analysis["inspector_thoughts"]["entries"]),
            "all_referenced_photographs_exist": not any("photo" in item.lower() for item in failures),
            "all_observations_have_evidence": not any("observation" in item.lower() for item in failures),
            "all_report_tasks_present": not any("report task" in item.lower() for item in failures),
            "all_report_sections_producible": all(state["ready"] for state in readiness.values()),
            "report_section_readiness": readiness,
            "broken_links": [item for item in failures if "broken" in item.lower() or "missing" in item.lower()],
            "failures": failures,
            "passed": not failures and package_path.stat().st_size <= TARGET_BYTES,
        }
        return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--verification", type=Path)
    args = parser.parse_args()
    built = build(args.source.resolve(), args.output.resolve())
    print(json.dumps(built, indent=2), flush=True)
    verification = validate(args.output.resolve())
    verification_path = args.verification.resolve() if args.verification else args.output.with_suffix(".verification.json").resolve()
    verification_path.write_bytes(json_bytes(verification))
    print(json.dumps(verification, indent=2), flush=True)
    print(f"Verification written: {verification_path}", flush=True)
    return 0 if verification["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
