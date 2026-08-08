const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const root = path.resolve(__dirname, "..");
const outputDir = process.argv[2];

if (!outputDir) {
  throw new Error("Usage: node scripts/build-water-contact-sheets.js <output-directory>");
}

const photos = JSON.parse(
  fs.readFileSync(path.join(root, "pearson-road-map/data/ALL_PHOTO_POINTS.geojson"), "utf8")
).features;
const parcelSource = JSON.parse(
  fs.readFileSync(
    path.join(root, "field-simple-test-direct-v10-where-am-i-v5/assets/parcels.json"),
    "utf8"
  )
);
const subjectParcel = parcelSource.features.find(
  (feature) => feature.attributes.PAR_NUM === "221S280000001010000"
);

function pointInRing(point, ring) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const crosses = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function parcelPart(point) {
  const index = subjectParcel.geometry.rings.findIndex((ring) => pointInRing(point, ring));
  if (index === 0) return "LARGE";
  if (index === 1) return "SMALL";
  return null;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function tile(feature) {
  const props = feature.properties;
  const sourcePath = path.join(root, "pearson-road-map", props.thumbnail_path);
  const label = `${props.inspection_date} ${props.photo_number} ${parcelPart(feature.geometry.coordinates)} ${props.display_class}`;
  const image = await sharp(sourcePath)
    .rotate()
    .resize(320, 220, { fit: "cover", position: "attention" })
    .jpeg({ quality: 84 })
    .toBuffer();
  const caption = Buffer.from(
    `<svg width="320" height="40" xmlns="http://www.w3.org/2000/svg">
      <rect width="320" height="40" fill="#111"/>
      <text x="8" y="25" fill="#fff" font-size="17" font-family="Arial, sans-serif">${escapeXml(label)}</text>
    </svg>`
  );
  return sharp({
    create: { width: 320, height: 260, channels: 3, background: "#111" }
  })
    .composite([
      { input: image, top: 0, left: 0 },
      { input: caption, top: 220, left: 0 }
    ])
    .jpeg({ quality: 88 })
    .toBuffer();
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const subjectPhotos = photos
    .filter((feature) => parcelPart(feature.geometry.coordinates))
    .sort((a, b) => {
      const dateOrder = a.properties.inspection_date.localeCompare(b.properties.inspection_date);
      if (dateOrder) return dateOrder;
      const aNumber = Number(String(a.properties.photo_number).replace(/\D/g, "")) || 0;
      const bNumber = Number(String(b.properties.photo_number).replace(/\D/g, "")) || 0;
      return aNumber - bNumber;
    });

  const perSheet = 20;
  for (let offset = 0; offset < subjectPhotos.length; offset += perSheet) {
    const page = subjectPhotos.slice(offset, offset + perSheet);
    const buffers = await Promise.all(page.map(tile));
    const canvas = sharp({
      create: { width: 1600, height: 1040, channels: 3, background: "#242424" }
    });
    const composites = buffers.map((input, index) => ({
      input,
      left: (index % 5) * 320,
      top: Math.floor(index / 5) * 260
    }));
    const pageNumber = String(Math.floor(offset / perSheet) + 1).padStart(2, "0");
    await canvas
      .composite(composites)
      .jpeg({ quality: 90 })
      .toFile(path.join(outputDir, `subject-water-review-${pageNumber}.jpg`));
  }

  fs.writeFileSync(
    path.join(outputDir, "subject-photo-index.json"),
    JSON.stringify(
      subjectPhotos.map((feature) => ({
        photo_id: feature.properties.photo_id,
        photo_number: feature.properties.photo_number,
        date: feature.properties.inspection_date,
        parcel_part: parcelPart(feature.geometry.coordinates),
        recorded_category: feature.properties.recorded_category,
        display_class: feature.properties.display_class,
        thumbnail_path: feature.properties.thumbnail_path,
        coordinates: feature.geometry.coordinates
      })),
      null,
      2
    )
  );
  console.log(`Created ${Math.ceil(subjectPhotos.length / perSheet)} sheets for ${subjectPhotos.length} subject-parcel photos.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
