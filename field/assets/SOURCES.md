# Offline map source record

The field app vendors these files so the map remains usable without cell service. The inspection area is WGS 84 longitude/latitude bounding box `-87.1,30.4825,-87.083,30.497`.

- `usgs-terrain.png` — USGS 3DEP Elevation ImageServer, `Hillshade Elevation Tinted`, 1800 × 1500 PNG. SHA-256 `A8A67946DAB883B9049A74F9EB9EA34722BB58BF7326C4B735471F295E2E1E33`.
- `usgs-contours-2ft.png` — USGS 3DEP Elevation ImageServer, `Preset 2ft Contour Interval`, 1800 × 1500 PNG. SHA-256 `62563712AEA6DDCAABD30DEBFB9EC1FF4D8797C08EE60EA248871EC84F5C7973`.
- `parcels.json` — county `ParcelsOpenData/FeatureServer/0`, WGS 84 geometries and `PAR_NUM`, `ParcelDisp`, `CALC_ACRE` attributes. 75 intersecting features. SHA-256 `CBA8A35FD2147FB94C87F35C0DDCD76EABC6E39872BDF12178E358A597E4E38E`.

Subject parcel: `PAR_NUM 221S280000001010000`, display ID `22-1S-28-0000-00101-0000`, recorded `CALC_ACRE 86.7464918`.

The original service URLs and retrieval date are also written into each inspection package's map-context metadata. Files retrieved 2026-08-02.
