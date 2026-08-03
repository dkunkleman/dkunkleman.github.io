(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.EvidenceSets = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SET_TYPES = ["Water Area", "Individual Tree", "Tree Group / Canopy", "Potential Homesite", "Drainage Feature", "Road / Access", "Boundary Marker", "View", "Vegetation / Clearing", "Other"];
  const PHOTO_ROLES = ["Context", "Close-up", "Measurement", "Relationship to surroundings", "Opposite direction", "Whole subject", "Detail", "Before", "After", "Whole tree", "Bark", "Base / ground", "Lower trunk to first fork", "Crown / canopy", "Visible crown segment", "Connected branch", "Leaf upper surface", "Leaf underside", "Twig / terminal bud", "Fruit / seed / cone / flower", "Scale photograph", "Visible defect", "Root condition", "Targets", "Surrounding canopy", "360-degree panorama", "Transition", "Other"];
  const PREFIXES = { "Water Area": "WG", "Individual Tree": "TR", "Tree Group / Canopy": "TG", "Potential Homesite": "HS", "Drainage Feature": "DF", "Road / Access": "AC", "Boundary Marker": "BM", View: "VW", "Vegetation / Clearing": "VG", Other: "ES" };
  const REQUIRED_ROLES = {
    "Individual Tree": ["Bark", "Base / ground", "Crown / canopy"],
    "Tree Group / Canopy": ["Context", "Surrounding canopy"],
    "Potential Homesite": ["Context"],
    "Water Area": ["Context", "Measurement", "Transition"]
  };
  const TREE_VISIBILITY = ["Yes", "No â€” canopy blocks it", "No â€” nearby trees block it", "No â€” brush blocks it", "No â€” water or unsafe ground blocks it", "No â€” property boundary or access prevents it", "Unsure"];
  const SPECIES_DETERMINATIONS = ["Inspector confirmed", "Probable", "Possible", "Unknown", "Professional identification requested"];
  const FALLEN_LEAF_CONFIDENCE = ["Yes â€” watched it fall or traced it to this tree", "Probably", "Unsure"];

  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function nowIso(value) { return value || new Date().toISOString(); }
  function makeId(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
  function photoNumber(photo) { return Number(String(photo && photo.photo_number || "").replace(/\D/g, "")); }
  function recordId(recordType, record) {
    if (!record) return null;
    if (recordType === "photo") return record.id || record.photo_id || null;
    if (recordType === "voice_note") return record.id || record.voice_note_id || null;
    if (recordType === "gps_point") return record.id || record.gps_point_id || null;
    if (recordType === "measurement") return record.id || record.measurement_id || null;
    return record.id || record.observation_id || null;
  }

  function ensureEvidenceSetModel(inspection) {
    const data = inspection || {};
    data.evidence_sets = Array.isArray(data.evidence_sets) ? data.evidence_sets : [];
    data.evidence_set_events = Array.isArray(data.evidence_set_events) ? data.evidence_set_events : [];
    data.evidence_set_suggestions = Array.isArray(data.evidence_set_suggestions) ? data.evidence_set_suggestions : [];
    data.active_evidence_set_id = data.active_evidence_set_id || null;
    data.evidence_set_counters = data.evidence_set_counters && typeof data.evidence_set_counters === "object" ? data.evidence_set_counters : {};
    return data;
  }

  function appendEvent(inspection, event) {
    const data = ensureEvidenceSetModel(inspection);
    const row = Object.assign({
      event_id: makeId("evidence-set-event"),
      recorded_at: new Date().toISOString(),
      immutable: true
    }, clone(event || {}));
    data.evidence_set_events.push(row);
    return row;
  }

  function startEvidenceSet(inspection, request) {
    const data = ensureEvidenceSetModel(inspection);
    const input = request || {};
    if (!SET_TYPES.includes(input.set_type)) throw new Error("Choose what this evidence set documents.");
    if (data.active_evidence_set_id) throw new Error("Finish the active subject before starting another one.");
    const prefix = PREFIXES[input.set_type] || "ES";
    const next = Number(data.evidence_set_counters[prefix] || 0) + 1;
    data.evidence_set_counters[prefix] = next;
    const id = input.evidence_set_id || `evidence-set-${prefix.toLowerCase()}-${String(next).padStart(3, "0")}`;
    const label = input.label || `${input.set_type} ${prefix}-${next}`;
    const createdAt = nowIso(input.created_at);
    const set = {
      schema_name: "property-intelligence-evidence-set",
      schema_version: "1.0",
      evidence_set_id: id,
      property_id: data.property_id || null,
      inspection_id: data.inspection_id || null,
      set_type: input.set_type,
      label,
      created_at: createdAt,
      created_by: input.created_by || data.inspector_identity || "Field Inspector",
      status: "active",
      relationship_basis: input.relationship_basis || "inspector_started_subject",
      inspector_confirmed: input.inspector_confirmed !== false,
      tree_id: input.set_type === "Individual Tree" ? (input.tree_id || `tree:${data.property_id || "property"}:${String(next).padStart(6, "0")}`) : null,
      subject_details: clone(input.subject_details || {}),
      original_definition_preserved: true
    };
    data.evidence_sets.push(set);
    data.active_evidence_set_id = id;
    appendEvent(data, { evidence_set_id: id, event_type: "set_started", created_by: set.created_by, inspector_confirmed: set.inspector_confirmed });
    return set;
  }

  function attachRecord(inspection, evidenceSetId, recordType, record, options) {
    const data = ensureEvidenceSetModel(inspection);
    const set = data.evidence_sets.find(item => item.evidence_set_id === evidenceSetId);
    if (!set) throw new Error("The evidence set no longer exists.");
    const id = typeof record === "string" ? record : recordId(recordType, record);
    if (!id) throw new Error("The evidence record has no stable ID.");
    const settings = options || {};
    return appendEvent(data, {
      evidence_set_id: evidenceSetId,
      event_type: "record_attached",
      record_type: recordType,
      record_id: id,
      photo_role: recordType === "photo" ? (settings.photo_role || "Context") : null,
      relationship_basis: settings.relationship_basis || "active_inspector_started_set",
      inspector_confirmed: settings.inspector_confirmed !== false,
      created_by: settings.created_by || data.inspector_identity || "Field Inspector"
    });
  }

  function setPhotoRole(inspection, evidenceSetId, photoId, role, options) {
    if (!PHOTO_ROLES.includes(role)) throw new Error("Choose a recognized photograph role.");
    return appendEvent(inspection, {
      evidence_set_id: evidenceSetId,
      event_type: "photo_role_assigned",
      record_type: "photo",
      record_id: photoId,
      photo_role: role,
      inspector_confirmed: !(options && options.inspector_confirmed === false),
      created_by: options && options.created_by || inspection.inspector_identity || "Field Inspector"
    });
  }

  function detachRecord(inspection, evidenceSetId, recordType, id, reason) {
    return appendEvent(inspection, {
      evidence_set_id: evidenceSetId,
      event_type: "record_detached",
      record_type: recordType,
      record_id: id,
      reason: reason || "inspector_removed_relationship",
      inspector_confirmed: true,
      created_by: inspection.inspector_identity || "Field Inspector"
    });
  }

  function finishEvidenceSet(inspection, evidenceSetId, details, at) {
    const data = ensureEvidenceSetModel(inspection);
    const set = data.evidence_sets.find(item => item.evidence_set_id === evidenceSetId);
    if (!set) throw new Error("The evidence set no longer exists.");
    appendEvent(data, { evidence_set_id: evidenceSetId, event_type: "set_finished", finished_at: nowIso(at), subject_details: clone(details || {}), inspector_confirmed: true, created_by: data.inspector_identity || "Field Inspector" });
    if (data.active_evidence_set_id === evidenceSetId) data.active_evidence_set_id = null;
    return effectiveEvidenceSet(data, evidenceSetId);
  }

  function effectiveEvidenceSet(inspection, evidenceSetId) {
    const data = ensureEvidenceSetModel(inspection);
    const source = data.evidence_sets.find(item => item.evidence_set_id === evidenceSetId);
    if (!source) return null;
    const result = clone(source);
    const links = new Map();
    const voidedEventIds = new Set((data.corrections || []).filter(item => item.target && item.target.record_type === "group_assignment" && (item.resulting_status === "voided" || item.status === "voided")).map(item => String(item.target.record_id)));
    const events = data.evidence_set_events.filter(item => item.evidence_set_id === evidenceSetId && !voidedEventIds.has(String(item.event_id))).sort((a, b) => String(a.recorded_at || "").localeCompare(String(b.recorded_at || "")));
    events.forEach(event => {
      const key = `${event.record_type || ""}:${event.record_id || ""}`;
      if (event.event_type === "record_attached") links.set(key, { record_type: event.record_type, record_id: event.record_id, photo_role: event.photo_role || null, attached_by_event_id: event.event_id, inspector_confirmed: event.inspector_confirmed !== false });
      if (event.event_type === "photo_role_assigned" && links.has(key)) links.get(key).photo_role = event.photo_role;
      if (event.event_type === "record_detached") links.delete(key);
      if (event.event_type === "set_finished") {
        result.status = "finished";
        result.finished_at = event.finished_at || event.recorded_at;
        result.subject_details = Object.assign({}, result.subject_details || {}, clone(event.subject_details || {}));
      }
      if (event.event_type === "set_voided") result.status = "voided";
    });
    result.record_links = Array.from(links.values());
    result.photo_links = result.record_links.filter(item => item.record_type === "photo");
    result.voice_note_ids = result.record_links.filter(item => item.record_type === "voice_note").map(item => item.record_id);
    result.observation_ids = result.record_links.filter(item => item.record_type === "observation").map(item => item.record_id);
    result.measurement_ids = result.record_links.filter(item => item.record_type === "measurement").map(item => item.record_id);
    result.event_ids = events.map(item => item.event_id);
    return result;
  }

  function buildEffectiveEvidenceSets(inspection) {
    const data = ensureEvidenceSetModel(inspection);
    return data.evidence_sets.map(item => effectiveEvidenceSet(data, item.evidence_set_id)).filter(item => item && item.status !== "voided" && item.inspector_confirmed);
  }

  function haversineMeters(a, b) {
    const lat1 = Number(a && a.lat), lon1 = Number(a && a.lon), lat2 = Number(b && b.lat), lon2 = Number(b && b.lon);
    if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return null;
    const r = 6371008.8, p1 = lat1 * Math.PI / 180, p2 = lat2 * Math.PI / 180;
    const dp = (lat2 - lat1) * Math.PI / 180, dl = (lon2 - lon1) * Math.PI / 180;
    const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return 2 * r * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  function maxSeparation(records) {
    let maximum = 0, known = false;
    for (let i = 0; i < records.length; i += 1) for (let j = i + 1; j < records.length; j += 1) {
      const distance = haversineMeters(records[i], records[j]);
      if (distance != null) { known = true; maximum = Math.max(maximum, distance); }
    }
    return known ? Math.round(maximum * 10) / 10 : null;
  }

  function summarizeEvidenceSet(inspection, set) {
    const data = inspection || {};
    const effective = typeof set === "string" ? effectiveEvidenceSet(data, set) : set;
    if (!effective) return null;
    const photoMap = new Map((data.photos || []).map(item => [String(item.id), item]));
    const photos = (effective.photo_links || []).map(link => ({ link, photo: photoMap.get(String(link.record_id)) })).filter(item => item.photo);
    const times = photos.map(item => item.photo.recorded_at || item.photo.time).filter(Boolean).sort();
    const roles = photos.map(item => item.link.photo_role).filter(Boolean);
    const isTreeSet = ["Individual Tree", "Tree Group / Canopy"].includes(effective.set_type);
    const required = isTreeSet ? treeEvidencePlan(effective.subject_details || {}).required_roles : (REQUIRED_ROLES[effective.set_type] || ["Context"]);
    const missing = required.filter(role => !roles.includes(role));
    const summary = {
      schema_name: "property-intelligence-evidence-set-summary",
      schema_version: "1.0",
      evidence_set_id: effective.evidence_set_id,
      label: effective.label,
      set_type: effective.set_type,
      status: effective.status,
      tree_id: effective.tree_id || null,
      first_timestamp: times[0] || null,
      last_timestamp: times[times.length - 1] || null,
      photograph_count: photos.length,
      photographs: photos.map(item => ({ photo_id: item.photo.id, photo_number: item.photo.photo_number || null, role: item.link.photo_role, latitude: item.photo.lat, longitude: item.photo.lon, timestamp: item.photo.recorded_at || item.photo.time })),
      exact_photo_locations_preserved: true,
      maximum_photo_separation_m: maxSeparation(photos.map(item => item.photo)),
      observation_ids: effective.observation_ids || [],
      voice_note_ids: effective.voice_note_ids || [],
      measurement_ids: effective.measurement_ids || [],
      subject_details: clone(effective.subject_details || {}),
      missing_high_value_views: missing,
      report_rule: `Describe ${effective.label} as one subject; list its individual photographs and roles without counting them as separate subjects.`
    };
    if (isTreeSet) summary.tree_identification = {
      visibility: effective.subject_details && effective.subject_details.whole_tree_visibility || "Unsure",
      visibility_limitation: effective.subject_details && effective.subject_details.whole_tree_visibility_reason || null,
      purpose: effective.subject_details && effective.subject_details.purpose || "unknown",
      evidence_plan: treeEvidencePlan(effective.subject_details || {}),
      ai_species_suggestions: eventsForSet(data, effective.evidence_set_id).filter(item => item.event_type === "ai_species_suggestion").map(item => item.suggestion),
      inspector_determinations: eventsForSet(data, effective.evidence_set_id).filter(item => item.event_type === "species_determination").map(item => item.determination),
      leaf_provenance: eventsForSet(data, effective.evidence_set_id).filter(item => item.event_type === "leaf_provenance_recorded").map(item => ({ photo_id: item.record_id, confidence: item.confidence })),
      confidence_limit: effective.subject_details && effective.subject_details.whole_t×‹h‘éì¶»§q«^vÛK]™YHšY]ÈØ\È›ÝØY™[HØZ[˜X›KˆY[YšXØ][ÛˆÛÛ™šY[˜ÙH]\Ý™Y›XÝHZ\ÜÚ[™ÈšY]È[™™[HÛ›HÛˆØ\\™Y˜\šË[šËÜ›ÝÛˆœ˜YÛY[ËÛÛ›™XÝYX]™\ËÚYËØY™\›ÙXÝ]™HX]\šX[[™Xš]]ˆˆˆ[ˆNÂˆYˆ
Y™™XÝ]™KœÙ]Ý\HOOH•Ø]\ˆ\™XHŠHÂˆÛÛœÝØ]\ˆHÝÜË›X\
][HOˆ][KœÝËØ]\ŠK™š[\Š›ÛÛX[ŠNÂˆÝ[[X\žKØ]\ˆHÂˆYX\Ý\™YÙ\ÎˆØ]\‹›X\
][HOˆ
È\Ø˜[™ˆ][KØ]\—Ù\Ø˜[™[\Ù^XÝÚ[Žˆ][KØ]\—Ù\Ù^XÝÚ[ˆOH[È[ˆ][KØ]\—Ù\Ù^XÝÚ[‹˜\Ú\Îˆ][K›YX\Ý\™[Y[Ø˜\Ú\È[JJKˆ\Ý[X]YÛ[™ÝÙˆØ]\‹›X\
][HOˆ[X™\Š][KØ]\—Û[™ÝÙ
JK™š[\Š[X™\‹š\Ñš[š]JKœÛÜ

KŠHOˆˆHJVÌH[ˆ\Ý[X]YÝÚYÙˆØ]\‹›X\
][HOˆ[X™\Š][KØ]\—ÝÚYÙ
JK™š[\Š[X™\‹š\Ñš[š]JKœÛÜ

KŠHOˆˆHJVÌH[ˆÝ[™[™×ÛÜ—Ù›ÝÚ[™Îˆ\œ˜^K™œ›ÛJ™]ÈÙ]
Ø]\‹›X\
][HOˆ][KØ]\—Ý\H][KØ]\—Ø™Z]š[ÜŠK™š[\Š›ÛÛX[ŠJJKˆ˜[œÚ][Û—ÜÝ×ÚYÎˆÝÜË™š[\Š][HOˆ][K›[šËœÝ×Ü›ÛHOOH•˜[œÚ][ÛˆŠK›X\
][HOˆ][KœÝËšY
Kˆ›Ý[™\žWÜ[Nˆ[ÝÙÜ˜\YÚ[È\™HØœÙ\™Yˆ[žHÛÛ›™XÝ[™ÈÝ][™H\È[™™\œ™Y[™]\Ý™HÝ[YY™™\™[Hœ›ÛHØœÙ\™YÚ[Ëˆ‚ˆNÂˆBˆ™]\›ˆÝ[[X\žNÂˆB‚ˆ[˜Ý[Ûˆ]™[Ñ›Ü”Ù]
[œÜXÝ[Û‹]šY[˜ÙTÙ]Y
HÂˆ™]\›ˆ
[œÜXÝ[Û‹™]šY[˜ÙWÜÙ]Ù]™[È×JK™š[\Š][HOˆ][K™]šY[˜ÙWÜÙ]ÚYOOH]šY[˜ÙTÙ]Y
KœÛÜ

KŠHOˆÝš[™ÊKœ™XÛÜ™YØ]ˆŠK›ØØ[PÛÛ\\™JÝš[™Ê‹œ™XÛÜ™YØ]ˆŠJJNÂˆB‚ˆ[˜Ý[Ûˆ™YQ]šY[˜ÙT[Š]Z[ÊHÂˆÛÛœÝ[™›ÈH]Z[ÈßNÂˆÛÛœÝš\ÚXš[]HH‘QWÕ’TÒP’SUKš[˜ÛY\Ê[™›ËÚÛWÝ™YWÝš\ÚXš[]JHÈ[™›ËÚÛWÝ™YWÝš\ÚXš[]Hˆ•[œÝ\™HŽÂˆÛÛœÝ\œÜÙHHÝš[™Ê[™›Ëœ\œÜÙH[šÛ›ÝÛˆŠKÓÝÙ\Ø\ÙJ
NÂˆ]™\]Z\™YÂˆYˆ
\œÜÙHOOH[X™\ˆØ[\HŠH™\]Z\™YHÈ“YX\Ý\™[Y[‹˜\šÈ‹“ÝÙ\ˆ[šÈÈš\œÝ›ÜšÈ‹•š\ÚX›HÜ›ÝÛˆÙYÛY[—NÂˆ[ÙHYˆ
\œÜÙHOOH›[™ØØ\Hˆ\œÜÙHOOHœ™\Ù\™HŠH™\]Z\™YHÈ˜\ÙHÈÜ›Ý[™‹”™[][ÛœÚ\ÈÝ\œ›Ý[™[™ÜÈ‹•š\ÚX›HÜ›ÝÛˆÙYÛY[—NÂˆ[ÙHYˆ
\œÜÙHOOHš^˜\™ŠH™\]Z\™YHÈ˜\ÙHÈÜ›Ý[™‹•š\ÚX›HY™XÝ‹”™[][ÛœÚ\ÈÝ\œ›Ý[™[™ÜÈ‹•\™Ù]È—NÂˆ[ÙHYˆ
\œÜÙHOOHœÜXÚY\ÈY[YšXØ][ÛˆŠH™\]Z\™YHÈ˜\šÈ‹ÛÛ›™XÝYœ˜[˜Ú‹“XYˆ\\ˆÝ\™˜XÙH‹“XYˆ[™\œÚYH‹•ÚYÈÈ\›Z[˜[Y—NÂˆ[ÙHYˆ
\œÜÙHOOH™›Ü™\ÝÚ\˜XÝ\ˆŠH™\]Z\™YHÈÛÛ^‹”Ý\œ›Ý[™[™ÈØ[›ÜH‹”™[][ÛœÚ\ÈÝ\œ›Ý[™[™ÜÈ—NÂˆ[ÙH™\]Z\™YHÈ˜\šÈ‹˜\ÙHÈÜ›Ý[™‹•š\ÚX›HÜ›ÝÛˆÙYÛY[—NÂˆYˆ
š\ÚXš[]HOOH–Y\ÈŠH™\]Z\™Y[œÚY
•ÚÛH™YHŠNÂˆ[ÙH™\]Z\™Y[œÚY
“ÝÙ\ˆ[šÈÈš\œÝ›ÜšÈŠNÂˆ™]\›ˆÂˆÚÛWÝ™YWÝš\ÚXš[]Nˆš\ÚXš[]Kˆ\œÜÙNˆ[™›Ëœ\œÜÙH[šÛ›ÝÛˆ‹ˆ™\]Z\™YÜ›Û\Îˆ\œ˜^K™œ›ÛJ™]ÈÙ]
™\]Z\™Y
JKˆ\ÙY[ÝÚ[—Ø]˜Z[X›NˆÈ‘œZ]ÈÙYYÈÛÛ™HÈ›ÝÙ\ˆ‹”ØØ[HÝÙÜ˜\‹“ÜÜÚ]H\™XÝ[Ûˆ‹ŒÍŒYYÜ™YH[›Ü˜[XH—KˆØœÝXÝ[Û—Ú\×Ý˜[YÙ]šY[˜ÙNˆš\ÚXš[]HOOH–Y\È‹ˆ×Û›ÝÜ™\X]ÝÚÛWÝ™YWÜ›Û\ˆš\ÚXš[]KœÝ\ÕÚ]
“›È8 %ŠKˆØY™]WÜ[Nˆ“™]™\ˆÜ›ÜÜÈØ]\‹Û[X‹[\ˆ[œØY™Hœ\ÚX]™H]]Üš^™Y›Ü\KÜˆÝ[™[ˆ˜Y™šXÈÈÛÛ\]HHÚXÚÛ\Ýˆ‹ˆ™\ÜÜ[Nˆš\ÚXš[]HOOH–Y\ÈˆÈ”™\ÜHØ\\™YÚÛK]™YHÛÛ^[™Ý\ˆY[YžZ[™ÈšY]ÜËˆˆˆ™\Ü]HÚÛK]™YHšY]ÈØ\È›ÝØY™[HØZ[˜X›H
	Ýš\ÚXš[]_JH[™^Z[ˆÝÈ][Z]ÈÛÛ™šY[˜ÙHÚ]Ý]Üš]XÚ^š[™ÈH[œÜXÝÜ‹˜ˆNÂˆB‚ˆ[˜Ý[ÛˆYZTÜXÚY\ÔÝYÙÙ\Ý[ÛŠ[œÜXÝ[Û‹]šY[˜ÙTÙ]YÝYÙÙ\Ý[ÛŠHÂˆÛÛœÝ]HH[œÝ\™Q]šY[˜ÙTÙ][Ù[
[œÜXÝ[ÛŠNÂˆYˆ
Y]K™]šY[˜ÙWÜÙ]ËœÛÛYJ][HOˆ][K™]šY[˜ÙWÜÙ]ÚYOOH]šY[˜ÙTÙ]Y	‰ˆÈ’[™]šYX[™YH‹•™YHÜ›Ý\ÈØ[›ÜH—Kš[˜ÛY\Ê][KœÙ]Ý\JJJH›ÝÈ™]È\œ›ÜŠ”ÜXÚY\ÈÝYÙÙ\Ý[ÛœÈ™\]Z\™HH™YH]šY[˜ÙHÙ]ˆŠNÂˆÛÛœÝ[œ]HÝYÙÙ\Ý[ÛˆßNÂˆ™]\›ˆ\[™]™[
]KÈ]šY[˜ÙWÜÙ]ÚYˆ]šY[˜ÙTÙ]Y]™[Ý\Nˆ˜ZWÜÜXÚY\×ÜÝYÙÙ\Ý[Ûˆ‹ÝYÙÙ\Ý[ÛŽˆÈZÙ[WÜÜXÚY\Îˆ[œ]›ZÙ[WÜÜXÚY\È•[šÛ›ÝÛˆ‹[\›˜]]™WÜÜXÚY\Îˆ\œ˜^Kš\Ð\œ˜^J[œ]˜[\›˜]]™WÜÜXÚY\ÊHÈ[œ]˜[\›˜]]™WÜÜXÚY\Èˆ×KÛÛ™šY[˜ÙWÛ]™[ˆ[œ]˜ÛÛ™šY[˜ÙWÛ]™[›ÝÈ‹Y[YžZ[™×Ù™X]\™\×Ýš\ÚX›Nˆ\œ˜^Kš\Ð\œ˜^J[œ]šY[YžZ[™×Ù™X]\™\×Ýš\ÚX›JHÈ[œ]šY[YžZ[™×Ù™X]\™\×Ýš\ÚX›Hˆ×K[\Ü[Ù™X]\™\×ÛZ\ÜÚ[™Îˆ\œ˜^Kš\Ð\œ˜^J[œ]š[\Ü[Ù™X]\™\×ÛZ\ÜÚ[™ÊHÈ[œ]š[\Ü[Ù™X]\™\×ÛZ\ÜÚ[™Èˆ×KÝ]\ÎˆRHÝYÙÙ\Ý[Ûˆ8 %›ÝÛÛ™š\›YY‹\ØÛZ[Y\Žˆ“™]™\ˆ™\Ù[\ÈRHÜXÚY\ÈÝYÙÙ\Ý[Ûˆ\ÈÛÛ™š\›YYˆˆK[œÜXÝÜ—ØÛÛ™š\›YYˆ˜[ÙKÜ™X]YØžNˆ[œ]˜Ü™X]YØžHRH™]šY]ÈˆJNÂˆB‚ˆ[˜Ý[Ûˆ™XÛÜ™ÜXÚY\Ñ]\›Z[˜][ÛŠ[œÜXÝ[Û‹]šY[˜ÙTÙ]Y]\›Z[˜][Û‹ÜXÚY\ËÜ™X]YžJHÂˆYˆ
TÔPÒQT×ÑUT“RSUSÓ”Ëš[˜ÛY\Ê]\›Z[˜][ÛŠJH›ÝÈ™]È\œ›ÜŠÚÛÜÙHH™XÛÙÛš^™YÜXÚY\ËZY[YšXØ][Ûˆ]\›Z[˜][Û‹ˆŠNÂˆ™]\›ˆ\[™]™[
[œÜXÝ[Û‹È]šY[˜ÙWÜÙ]ÚYˆ]šY[˜ÙTÙ]Y]™[Ý\NˆœÜXÚY\×Ù]\›Z[˜][Ûˆ‹]\›Z[˜][ÛŽˆÈÝ]\Îˆ]\›Z[˜][Û‹ÜXÚY\ÎˆÜXÚY\È•[šÛ›ÝÛˆ‹™XÛÜ™YØžNˆÜ™X]YžH[œÜXÝ[Û‹š[œÜXÝÜ—ÚY[]H‘šY[[œÜXÝÜˆ‹˜XÝX[Ü[Nˆ]\›Z[˜][ÛˆOOH’[œÜXÝÜˆÛÛ™š\›YYˆÈ’[œÜXÝÜ‹XÛÛ™š\›YYšY[Y[YšXØ][ÛŽÈ›ÝHXÙ[œÙY›Ù™\ÜÚ[Û˜[]\›Z[˜][Ûˆ[›\ÜÈÝ]Yˆˆˆ“›ÝÛÛ™š\›YYˆˆK[œÜXÝÜ—ØÛÛ™š\›YYˆYKÜ™X]YØžNˆÜ™X]YžH[œÜXÝ[Û‹š[œÜXÝÜ—ÚY[]H‘šY[[œÜXÝÜˆˆJNÂˆB‚ˆ[˜Ý[Ûˆ™XÛÜ™XY”›Ý™[˜[˜ÙJ[œÜXÝ[Û‹]šY[˜ÙTÙ]YÝÒYÛÛ™šY[˜ÙKÜ™X]YžJHÂˆYˆ
QSS—ÓPQ—ÐÓÓ‘’QSÑKš[˜ÛY\ÊÛÛ™šY[˜ÙJJH›ÝÈ™]È\œ›ÜŠÚÛÜÙHÝÈÛÛ™šY[HHXYˆØ[YHœ›ÛH\È™YKˆŠNÂˆ™]\›ˆ\[™]™[
[œÜXÝ[Û‹È]šY[˜ÙWÜÙ]ÚYˆ]šY[˜ÙTÙ]Y]™[Ý\Nˆ›XY—Ü›Ý™[˜[˜ÙWÜ™XÛÜ™Y‹™XÛÜ™Ý\NˆœÝÈ‹™XÛÜ™ÚYˆÝÒYÛÛ™šY[˜ÙK\ÜÛØÚX][Û—ÜÝ]\ÎˆÛÛ™šY[˜ÙHOOHSS—ÓPQ—ÐÓÓ‘’QSÑVÌHÈš[œÜXÝÜ—ØÛÛ™š\›YYˆˆ
ÛÛ™šY[˜ÙHOOH”›Ø˜X›HˆÈœ›Ø˜X›Hˆˆ[™\šYšYYŠKXÝ]˜][Û—Ü[Nˆ[ˆ[™\šYšYY˜[[ˆXYˆ\È™]™\ˆÚ[[H™X]Y\È™[Û™Ú[™ÈÈH™YKˆ‹[œÜXÝÜ—ØÛÛ™š\›YYˆYKÜ™X]YØžNˆÜ™X]YžH[œÜXÝ[Û‹š[œÜXÝÜ—ÚY[]H‘šY[[œÜXÝÜˆˆJNÂˆB‚ˆ[˜Ý[ÛˆÜ™X]Q]šY[˜ÙTÙ]Ý[[X\šY\Ê[œÜXÝ[ÛŠHÂˆ™]\›ˆÈØÚ[XWÛ˜[YNˆœ›Ü\KZ[[YÙ[˜ÙKY]šY[˜ÙK\Ù]Z[™^‹ØÚ[XWÝ™\œÚ[ÛŽˆŒKŒ‹Ù]ÎˆZ[Y™™XÝ]™Q]šY[˜ÙTÙ]Ê[œÜXÝ[ÛŠK›X\
Ù]OˆÝ[[X\š^™Q]šY[˜ÙTÙ]
[œÜXÝ[Û‹Ù]
JHNÂˆB‚ˆ[˜Ý[ÛˆYÝYÙÙ\Ý[ÛŠ[œÜXÝ[Û‹ÝYÙÙ\Ý[ÛŠHÂˆÛÛœÝ]HH[œÝ\™Q]šY[˜ÙTÙ][Ù[
[œÜXÝ[ÛŠNÂˆYˆ
]K™]šY[˜ÙWÜÙ]ÜÝYÙÙ\Ý[ÛœËœÛÛYJ][HOˆ][KœÝYÙÙ\Ý[Û—ÚYOOHÝYÙÙ\Ý[Û‹œÝYÙÙ\Ý[Û—ÚY
JH™]\›ˆ[ÂˆÛÛœÝ›ÝÈHØš™XÝ˜\ÜÚYÛŠÈÝ]\Îˆœ[™[™×Ú[œÜXÝÜ—ØÛÛ™š\›X][Ûˆ‹Ü™X]YØ]ˆ™]È]J
KÒTÓÔÝš[™Ê
KXÝ]˜][Û—Ü[Nˆ“™]™\ˆXÝ]˜]HÜˆÜ›Ý\Ú[[Kˆ[œÜXÝÜˆÛÛ™š\›X][Ûˆ\È™\]Z\™YˆˆKÛÛ™JÝYÙÙ\Ý[ÛŠJNÂˆ]K™]šY[˜ÙWÜÙ]ÜÝYÙÙ\Ý[ÛœËœ\Ú
›ÝÊNÂˆ™]\›ˆ›ÝÎÂˆB‚ˆ[˜Ý[ÛˆYX\œÛÛ”ÝYÙÙ\Ý[ÛœÊ[œÜXÝ[ÛŠHÂˆÛÛœÝ]HH[œÝ\™Q]šY[˜ÙTÙ][Ù[
[œÜXÝ[ÛŠNÂˆÛÛœÝÝÜÈH]KœÝÜÈ×NÂˆÛÛœÝ\ÈH[X™\ˆOˆÝÜËœÛÛYJÝÈOˆÝÓ[X™\ŠÝÊHOOH[X™\ŠNÂˆÛÛœÝY˜[™ÙHH
Y\K[X™\œË›Û\ËX™[
HOˆÂˆYˆ
[[X™\œË™]™\žJ\ÊJH™]\›ŽÂˆYÝYÙÙ\Ý[ÛŠ]KÈÝYÙÙ\Ý[Û—ÚYˆYÙ]Ý\Nˆ\KÝYÙÙ\ÝYÛX™[ˆX™[Ý×ÚYÎˆ[X™\œË›X\
[X™\ˆOˆÝÜË™š[™
ÝÈOˆÝÓ[X™\ŠÝÊHOOH[X™\ŠKšY
KÝYÙÙ\ÝYÜÝ×Ü›Û\Îˆ[X™\œË›X\

[X™\‹[™^
HOˆ
ÈÝ×ÚYˆÝÜË™š[™
ÝÈOˆÝÓ[X™\ŠÝÊHOOH[X™\ŠKšYÝ×Û[X™\Žˆ	Û[X™\ŸX›ÛNˆ›Û\ÖÚ[™^HÛÛ^ˆJJK˜\Ú\Îˆ’[œÜXÝÜ‹Y\™XÝYX\œÛÛˆ›ØY™]šY]ÈˆJNÂˆNÂˆY˜[™ÙJœX\œÛÛ‹\K\ËZ\™ÛÛÙ‹’[™]šYX[™YH‹ÍK‹×KÈ˜\šÈ‹˜\ÙHÈÜ›Ý[™‹•ÚÛH™YH—K“X]\™H\™ÛÛÙKTÈŠNÂˆY˜[™ÙJœX\œÛÛ‹\\LZ\™ÛÛÙ‹’[™]šYX[™YH‹ÍKLKÈ˜\šÈ‹˜\ÙHÈÜ›Ý[™‹•ÚÛH™YH—K”ÙXÛÛ™\™ÛÛÙTLŠNÂˆY˜[™ÙJœX\œÛÛ‹\LK\LË\[™H‹’[™]šYX[™YH‹ÍLKL‹L×KÈ˜\šÈ‹˜\ÙHÈÜ›Ý[™‹•ÚÛH™YH—K“X]\™H[™HLKTLÈŠNÂˆY˜[™ÙJœX\œÛÛ‹\MË\NK\[™KXØ[›ÜH‹•™YHÜ›Ý\ÈØ[›ÜH‹ÍMËNNWKÈ•ÚÛH™YH‹”Ý\œ›Ý[™[™ÈØ[›ÜH‹ÛÛ^—K”[™H[™Ø[ØX›HØ[›ÜHMËTNHŠNÂˆY˜[™ÙJœX\œÛÛ‹\\K\[™H‹’[™]šYX[™YH‹ÍWKÈ•ÚÛH™YH‹˜\šÈ—K“X]\™H[™HTHŠNÂˆY˜[™ÙJœX\œÛÛ‹\‹\ËZ\™ÛÛÙ‹’[™]šYX[™YH‹Í‹×KÈ•ÚÛH™YH‹˜\šÈ—K“X]\™H\™ÛÛÙ‹TÈŠNÂˆY˜[™ÙJœX\œÛÛ‹\Ž\Ì‹]Ø]\ˆ‹•Ø]\ˆ\™XH‹ÍŽŽKÌÌKÌ—KÈÛÛ^‹”™[][ÛœÚ\ÈÝ\œ›Ý[™[™ÜÈ‹ÛÜÙK]\‹‘]Z[‹“YX\Ý\™[Y[—K“ØØ[^™YØ]\ˆ\™XHŽTÌˆŠNÂˆYˆ
\ÊÌÊJHYÝYÙÙ\Ý[ÛŠ]KÈÝYÙÙ\Ý[Û—ÚYˆœX\œÛÛ‹\ÌË]˜[œÚ][Ûˆ‹Ù]Ý\Nˆ“Ý\ˆ‹ÝYÙÙ\ÝYÛX™[ˆ•˜[œÚ][ÛˆÈÜ›Ý[™Ú]Ý]š\ÚX›HÝ[™[™ÈØ]\ˆ‹Ý×ÚYÎˆÜÝÜË™š[™
ÝÈOˆÝÓ[X™\ŠÝÊHOOHÌÊKšYKÝYÙÙ\ÝYÜÝ×Ü›Û\ÎˆÞÈÝ×ÚYˆÝÜË™š[™
ÝÈOˆÝÓ[X™\ŠÝÊHOOHÌÊKšYÝ×Û[X™\Žˆ”ÌÈ‹›ÛNˆ•˜[œÚ][ÛˆˆWK˜\Ú\Îˆ’[œÜXÝÜ‹Y\™XÝYX\œÛÛˆ›ØY™]šY]ÎÈÛÛœÚY\ˆ]XÚ[™ÈÈHÛÛ™š\›YYŽTÌˆØ]\ˆÙ]ˆˆJNÂˆ™]\›ˆ]K™]šY[˜ÙWÜÙ]ÜÝYÙÙ\Ý[ÛœÎÂˆB‚ˆ[˜Ý[ÛˆÝYÙÙ\Ý™XÙ[Ü›Ý\
[œÜXÝ[Û‹Ü[ÛœÊHÂˆÛÛœÝ]HH[œÝ\™Q]šY[˜ÙTÙ][Ù[
[œÜXÝ[ÛŠNÂˆÛÛœÝÙ][™ÜÈHØš™XÝ˜\ÜÚYÛŠÈX^ÜÙXÛÛ™ÎˆLŒX^Ù\Ý[˜ÙWÛNˆMKZ[š[][WÜÝÜÎˆˆKÜ[ÛœÈßJNÂˆÛÛœÝ\ÜÚYÛ™YH™]ÈÙ]
Z[Y™™XÝ]™Q]šY[˜ÙTÙ]Ê]JK™›]X\
Ù]Oˆ
Ù]œÝ×Û[šÜÈ×JK›X\
[šÈOˆÝš[™Ê[šËœ™XÛÜ™ÚY
JJJNÂˆÛÛœÝÝÜÈH
]KœÝÜÈ×JK™š[\Š][HOˆX\ÜÚYÛ™Yš\ÊÝš[™Ê][KšY
JJKœÛXÙJ
KœÛÜ

KŠHOˆÝš[™ÊKœ™XÛÜ™YØ]K[YHˆŠK›ØØ[PÛÛ\\™JÝš[™Ê‹œ™XÛÜ™YØ]‹[YHˆŠJJNÂˆYˆ
ÝÜË›[™ÝÙ][™ÜË›Z[š[][WÜÝÜÊH™]\›ˆ[ÂˆÛÛœÝZ[HÜÝÜÖÜÝÜË›[™ÝHWWNÂˆ›Üˆ
][™^HÝÜË›[™ÝHŽÈ[™^HÈ[™^OHJHÂˆÛÛœÝØ[™Y]HHÝÜÖÚ[™^K]\ÝHZ[ÝZ[›[™ÝHWNÂˆÛÛœÝÙXÛÛ™ÈHX]˜XœÊ™]È]J]\Ýœ™XÛÜ™YØ]]\Ý[YJHH™]È]JØ[™Y]Kœ™XÛÜ™YØ]Ø[™Y]K[YJJHÈLÂˆÛÛœÝ\Ý[˜ÙHH]™\œÚ[™SY]\œÊØ[™Y]K]\Ý
NÂˆÛÛœÝØ[YTÝXš™XÝHÝš[™ÊØ[™Y]KœÝ×ÛYX[š[™È	‰ˆØ[™Y]KœÝ×ÛYX[š[™ËœÝXš™XÝØ[™Y]K˜Ø]YÛÜžHˆŠHOOHÝš[™Ê]\ÝœÝ×ÛYX[š[™È	‰ˆ]\ÝœÝ×ÛYX[š[™ËœÝXš™XÝ]\Ý˜Ø]YÛÜžHˆŠNÂˆÛÛœÝØÙ[™SX]ÚHØ[™Y]KœØÙ[™WÜÚYÛ˜]\™H	‰ˆ]\ÝœØÙ[™WÜÚYÛ˜]\™H	‰ˆØ[™Y]KœØÙ[™WÜÚYÛ˜]\™HOOH]\ÝœØÙ[™WÜÚYÛ˜]\™NÂˆYˆ
ÙXÛÛ™ÈHÙ][™ÜË›X^ÜÙXÛÛ™È	‰ˆ
\Ý[˜ÙHOH[\Ý[˜ÙHHÙ][™ÜË›X^Ù\Ý[˜ÙWÛJH	‰ˆ
Ø[YTÝXš™XÝØÙ[™SX]Ú
JHZ[œ\Ú
Ø[™Y]JNÈ[ÙHœ™XZÎÂˆBˆYˆ
Z[›[™ÝÙ][™ÜË›Z[š[][WÜÝÜÊH™]\›ˆ[ÂˆZ[œ™]™\œÙJ
NÂˆÛÛœÝÝYÙÙ\Ý[Û’YH]]ËYÜ›Ý\IÝZ[›X\
][HOˆ][KšY
Kš›Ú[Š‹HŠ_XÂˆÛÛœÝ^\Ý[™ÈH]K™]šY[˜ÙWÜÙ]ÜÝYÙÙ\Ý[ÛœË™š[™
][HOˆ][KœÝYÙÙ\Ý[Û—ÚYOOHÝYÙÙ\Ý[Û’Y
NÂˆYˆ
^\Ý[™ÊH™]\›ˆ^\Ý[™ÎÂˆ™]\›ˆYÝYÙÙ\Ý[ÛŠ]KÈÝYÙÙ\Ý[Û—ÚYˆÝYÙÙ\Ý[Û’YÙ]Ý\Nˆ“Ý\ˆ‹ÝYÙÙ\ÝYÛX™[ˆ”ÜÜÚX›HØ[YHÝXš™XÝ‹Ý×ÚYÎˆZ[›X\
][HOˆ][KšY
KÝYÙÙ\ÝYÜÝ×Ü›Û\ÎˆZ[›X\

][K[™^
HOˆ
ÈÝ×ÚYˆ][KšYÝ×Û[X™\Žˆ][KœÝ×Û[X™\ˆ[›ÛNˆ[™^OOHÈÛÛ^ˆˆ‘]Z[ˆJJK˜\Ú\ÎˆZÙ[ˆÚ][ˆ	ÜÙ][™ÜË›X^ÜÙXÛÛ™ßHÙXÛÛ™È[™	ÜÙ][™ÜË›X^Ù\Ý[˜ÙWÛ_HY]\œÈÚ]X]Ú[™ÈÝXš™XÝØØ]YÛÜžHÜˆØÙ[™HÚYÛ˜]\™K˜JNÂˆB‚ˆ[˜Ý[Ûˆ]XÝÝXš™XÝÚ[™ÙJ[œÜXÝ[Û‹Ü[ÛœÊHÂˆÛÛœÝ]HH[œÝ\™Q]šY[˜ÙTÙ][Ù[
[œÜXÝ[ÛŠNÂˆÛÛœÝÙ][™ÜÈHØš™XÝ˜\ÜÚYÛŠÈX^ÜÙXÛÛ™ÎˆNX^Ù\Ý[˜ÙWÛNˆKÜ[ÛœÈßJNÂˆÛÛœÝÝÜÈH
]KœÝÜÈ×JKœÛXÙJ
KœÛÜ

KŠHOˆÝš[™ÊKœ™XÛÜ™YØ]K[YHˆŠK›ØØ[PÛÛ\\™JÝš[™Ê‹œ™XÛÜ™YØ]‹[YHˆŠJJNÂˆYˆ
ÝÜË›[™ÝŠH™]\›ˆ[ÂˆÛÛœÝ™]š[Ý\ÈHÝÜÖÜÝÜË›[™ÝH—KÝ\œ™[HÝÜÖÜÝÜË›[™ÝHWNÂˆÛÛœÝ™]š[Ý\ÔÝXš™XÝHÝš[™Ê™]š[Ý\ËœÝ×ÛYX[š[™È	‰ˆ™]š[Ý\ËœÝ×ÛYX[š[™ËœÝXš™XÝ™]š[Ý\Ë˜Ø]YÛÜžHˆŠNÂˆÛÛœÝÝ\œ™[ÝXš™XÝHÝš[™ÊÝ\œ™[œÝ×ÛYX[š[™È	‰ˆÝ\œ™[œÝ×ÛYX[š[™ËœÝXš™XÝÝ\œ™[˜Ø]YÛÜžHˆŠNÂˆÛÛœÝÙXÛÛ™ÈHX]˜XœÊ™]È]JÝ\œ™[œ™XÛÜ™YØ]Ý\œ™[[YJHH™]È]J™]š[Ý\Ëœ™XÛÜ™YØ]™]š[Ý\Ë[YJJHÈLÂˆÛÛœÝ\Ý[˜ÙHH]™\œÚ[™SY]\œÊ™]š[Ý\ËÝ\œ™[
NÂˆÛÛœÝØÙ[™PÚ[™ÙYH™]š[Ý\ËœØÙ[™WÜÚYÛ˜]\™H	‰ˆÝ\œ™[œØÙ[™WÜÚYÛ˜]\™H	‰ˆ™]š[Ý\ËœØÙ[™WÜÚYÛ˜]\™HOOHÝ\œ™[œØÙ[™WÜÚYÛ˜]\™NÂˆYˆ
ÙXÛÛ™ÈHÙ][™ÜË›X^ÜÙXÛÛ™È	‰ˆ
\Ý[˜ÙHOH[\Ý[˜ÙHHÙ][™ÜË›X^Ù\Ý[˜ÙWÛJH	‰ˆ™]š[Ý\ÔÝXš™XÝ	‰ˆÝ\œ™[ÝXš™XÝ	‰ˆ
™]š[Ý\ÔÝXš™XÝOOHÝ\œ™[ÝXš™XÝØÙ[™PÚ[™ÙY
JH™]\›ˆÈ™]š[Ý\×ÜÝ×ÚYˆ™]š[Ý\ËšYÝ\œ™[ÜÝ×ÚYˆÝ\œ™[šY™]š[Ý\×ÜÝXš™XÝˆ™]š[Ý\ÔÝXš™XÝÝ\œ™[ÜÝXš™XÝˆÝ\œ™[ÝXš™XÝ[YWÙ[WÜÙXÛÛ™ÎˆÙXÛÛ™Ë\Ý[˜ÙWÛNˆ\Ý[˜ÙK›Û\ˆ\™H[ÝHÝ\[™ÈH™]ÈÝXš™XÝÈ‹XÝ]˜][Û—Ü[Nˆ’[œÜXÝÜˆÛÛ™š\›X][Ûˆ™\]Z\™YˆˆNÂˆ™]\›ˆ[ÂˆB‚ˆ[˜Ý[ÛˆÛÛ™š\›TÝYÙÙ\Ý[ÛŠ[œÜXÝ[Û‹ÝYÙÙ\Ý[Û’YÜ™X]YžJHÂˆÛÛœÝ]HH[œÝ\™Q]šY[˜ÙTÙ][Ù[
[œÜXÝ[ÛŠNÂˆÛÛœÝÝYÙÙ\Ý[ÛˆH]K™]šY[˜ÙWÜÙ]ÜÝYÙÙ\Ý[ÛœË™š[™
][HOˆ][KœÝYÙÙ\Ý[Û—ÚYOOHÝYÙÙ\Ý[Û’Y
NÂˆYˆ
\ÝYÙÙ\Ý[ÛŠH›ÝÈ™]È\œ›ÜŠ•HÜ›Ý\[™ÈÝYÙÙ\Ý[ÛˆØ\È›Ý›Ý[™ˆŠNÂˆYˆ
ÝYÙÙ\Ý[Û‹œÝ]\ÈOOH˜ÛÛ™š\›YYŠH™]\›ˆY™™XÝ]™Q]šY[˜ÙTÙ]
]KÝYÙÙ\Ý[Û‹™]šY[˜ÙWÜÙ]ÚY
NÂˆÛÛœÝ™]š[Ý\ÐXÝ]™HH]K˜XÝ]™WÙ]šY[˜ÙWÜÙ]ÚYÂˆ]K˜XÝ]™WÙ]šY[˜ÙWÜÙ]ÚYH[ÂˆÛÛœÝÙ]HÝ\]šY[˜ÙTÙ]
]KÈÙ]Ý\NˆÝYÙÙ\Ý[Û‹œÙ]Ý\KX™[ˆÝYÙÙ\Ý[Û‹œÝYÙÙ\ÝYÛX™[Ü™X]YØžNˆÜ™X]YžK™[][ÛœÚ\Ø˜\Ú\ÎˆÛÛ™š\›YYÜÝYÙÙ\Ý[ÛŽ‰ÜÝYÙÙ\Ý[Û’YX[œÜXÝÜ—ØÛÛ™š\›YYˆYHJNÂˆ
ÝYÙÙ\Ý[Û‹œÝYÙÙ\ÝYÜÝ×Ü›Û\È×JK™›Ü‘XXÚ
][HOˆ]XÚ™XÛÜ™
]KÙ]™]šY[˜ÙWÜÙ]ÚYœÝÈ‹][KœÝ×ÚYÈÝ×Ü›ÛNˆ][Kœ›ÛKÜ™X]YØžNˆÜ™X]YžK™[][ÛœÚ\Ø˜\Ú\ÎˆÛÛ™š\›YYÜÝYÙÙ\Ý[ÛŽ‰ÜÝYÙÙ\Ý[Û’YXJJNÂˆš[š\Ú]šY[˜ÙTÙ]
]KÙ]™]šY[˜ÙWÜÙ]ÚYÈÛÝ\˜ÙWÜÝYÙÙ\Ý[Û—ÚYˆÝYÙÙ\Ý[Û’YJNÂˆÝYÙÙ\Ý[Û‹œÝ]\ÈH˜ÛÛ™š\›YYŽÂˆÝYÙÙ\Ý[Û‹˜ÛÛ™š\›YYØ]H™]È]J
KÒTÓÔÝš[™Ê
NÂˆÝYÙÙ\Ý[Û‹˜ÛÛ™š\›YYØžHHÜ™X]YžH]Kš[œÜXÝÜ—ÚY[]H‘šY[[œÜXÝÜˆŽÂˆÝYÙÙ\Ý[Û‹™]šY[˜ÙWÜÙ]ÚYHÙ]™]šY[˜ÙWÜÙ]ÚYÂˆ]K˜XÝ]™WÙ]šY[˜ÙWÜÙ]ÚYH™]š[Ý\ÐXÝ]™NÂˆ™]\›ˆY™™XÝ]™Q]šY[˜ÙTÙ]
]KÙ]™]šY[˜ÙWÜÙ]ÚY
NÂˆB‚ˆ™]\›ˆÂˆÑUÕTTËÕ×Ô“ÓTË‘TURT‘QÔ“ÓTË‘QWÕ’TÒP’SUKÔPÒQT×ÑUT“RSUSÓ”ËSS—ÓPQ—ÐÓÓ‘’QSÑKˆ[œÝ\™Q]šY[˜ÙTÙ][Ù[Ý\]šY[˜ÙTÙ]]XÚ™XÛÜ™Ù]ÝÔ›ÛK]XÚ™XÛÜ™š[š\Ú]šY[˜ÙTÙ]ˆY™™XÝ]™Q]šY[˜ÙTÙ]Z[Y™™XÝ]™Q]šY[˜ÙTÙ]ËÝ[[X\š^™Q]šY[˜ÙTÙ]Ü™X]Q]šY[˜ÙTÙ]Ý[[X\šY\Ëˆ™YQ]šY[˜ÙT[‹YZTÜXÚY\ÔÝYÙÙ\Ý[Û‹™XÛÜ™ÜXÚY\Ñ]\›Z[˜][Û‹™XÛÜ™XY”›Ý™[˜[˜ÙKˆÝYÙÙ\Ý™XÙ[Ü›Ý\]XÝÝXš™XÝÚ[™ÙKYX\œÛÛ”ÝYÙÙ\Ý[ÛœËÛÛ™š\›TÝYÙÙ\Ý[Û‹]™\œÚ[™SY]\œËX^Ù\\˜][Û‚ˆNÂŸJNÂ