// Regenerates the PWA icons in frontend/public/icons (services.yaml: generate-icons).
// The mark is drawn from its geometry rather than cropped out of the Rozetta
// wordmark: the only copy of the wordmark is 191px across, and an upscale to
// 512 would be visibly soft. This reproduces 99.6% of the original's pixels.
import { deflateSync, crc32 } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

// Sampled from the wordmark, and deliberately not the UI palette — the mark's
// navy is #033047 where Tailwind's navy-900 is #102a43.
const MARK_NAVY = [3, 48, 71];
const MARK_TEAL = [28, 159, 189];
const MARK_LIGHT_BLUE = [143, 203, 232];
const WHITE = [255, 255, 255];

const TAU = Math.PI * 2;
const FIRST_DIVIDER = Math.PI / 6; // 30° clockwise from 3 o'clock
// Lobe colours in divider order, starting at FIRST_DIVIDER.
const LOBES = [MARK_LIGHT_BLUE, MARK_NAVY, MARK_TEAL];

const DIVIDERS = [0, 1, 2].map((k) => {
  const angle = FIRST_DIVIDER + (k * TAU) / 3;
  return { x: (Math.cos(angle) * 2) / 3, y: (Math.sin(angle) * 2) / 3 };
});

// The mark is a triskelion of circles: a rim at radius 1, a concentric white
// hole at 1/3, and three divider circles of radius 1/3 centred 2/3 out, each
// tangent to both. x and y are mark-space, origin at the centre, y pointing
// down to match image coordinates.
function markColour(x, y) {
  const radius = Math.hypot(x, y);
  if (radius > 1 || radius < 1 / 3) return WHITE;

  const fromFirstDivider = (Math.atan2(y, x) - FIRST_DIVIDER + TAU * 2) % TAU;
  let lobe = Math.floor(fromFirstDivider / (TAU / 3));

  for (const [k, divider] of DIVIDERS.entries()) {
    // Half of each divider disc spills into the preceding lobe, which is what
    // gives the lobes their comma tails; the cross product picks that half out.
    const spill = divider.x * y - divider.y * x > 0;
    if (spill && Math.hypot(x - divider.x, y - divider.y) < 1 / 3) {
      lobe = (k + 2) % 3;
    }
  }
  return LOBES[lobe];
}

const SAMPLES_PER_AXIS = 4; // 4x4 supersampling, to antialias the curves

// Renders the mark centred on a white square, covering `coverage` of its width.
function renderIcon(size, coverage) {
  const rgb = Buffer.alloc(size * size * 3);
  const markRadius = (size * coverage) / 2;
  const centre = size / 2;
  const step = 1 / SAMPLES_PER_AXIS;
  const samples = SAMPLES_PER_AXIS * SAMPLES_PER_AXIS;

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const total = [0, 0, 0];
      for (let sy = 0; sy < SAMPLES_PER_AXIS; sy++) {
        for (let sx = 0; sx < SAMPLES_PER_AXIS; sx++) {
          const x = (col + (sx + 0.5) * step - centre) / markRadius;
          const y = (row + (sy + 0.5) * step - centre) / markRadius;
          const colour = markColour(x, y);
          total[0] += colour[0];
          total[1] += colour[1];
          total[2] += colour[2];
        }
      }
      const offset = (row * size + col) * 3;
      rgb[offset] = Math.round(total[0] / samples);
      rgb[offset + 1] = Math.round(total[1] / samples);
      rgb[offset + 2] = Math.round(total[2] / samples);
    }
  }
  return rgb;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, checksum]);
}

function encodePng(rgb, size) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bits per channel
  header[9] = 2; // truecolour, no alpha — the mark sits on an opaque white square

  // Each scanline is prefixed with its filter type; 0 means "none".
  const stride = size * 3 + 1;
  const raw = Buffer.alloc(size * stride);
  for (let row = 0; row < size; row++) {
    rgb.copy(raw, row * stride + 1, row * size * 3, (row + 1) * size * 3);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const ICONS = [
  // Android shows these as-is, so the mark nearly fills the square.
  { file: "icon-192.png", size: 192, coverage: 0.96 },
  { file: "icon-512.png", size: 512, coverage: 0.96 },
  // A maskable icon is cropped to an unknown shape and only the centred circle
  // of 80% diameter is guaranteed to survive, so stay just inside that.
  { file: "icon-maskable-512.png", size: 512, coverage: 0.76 },
];

const outDir = path.join(
  import.meta.dirname,
  "..",
  "frontend",
  "public",
  "icons",
);
mkdirSync(outDir, { recursive: true });
for (const { file, size, coverage } of ICONS) {
  const target = path.join(outDir, file);
  writeFileSync(target, encodePng(renderIcon(size, coverage), size));
  console.log(`wrote ${path.relative(process.cwd(), target)}`);
}
