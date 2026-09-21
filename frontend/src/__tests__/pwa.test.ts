// tsconfig's `types` omits node so browser source stays honest about what it
// can reach; this test reads static assets off disk, so it opts itself in.
/// <reference types="node" />
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// cwd, not import.meta.url: the jsdom environment rewrites the latter to http.
const frontendRoot = process.cwd();
const publicDir = path.join(frontendRoot, "public");

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}

interface Manifest {
  name: string;
  short_name: string;
  start_url: string;
  display: string;
  theme_color: string;
  background_color: string;
  icons: ManifestIcon[];
}

const manifest = JSON.parse(
  readFileSync(path.join(publicDir, "manifest.webmanifest"), "utf8"),
) as Manifest;

const indexHtml = readFileSync(path.join(frontendRoot, "index.html"), "utf8");

// PNG stores width and height as big-endian uint32s at a fixed IHDR offset.
function pngSize(file: string): { width: number; height: number } {
  const bytes = readFileSync(file);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe("web app manifest", () => {
  it("names the app Rozetta on the home screen", () => {
    expect(manifest.name).toBe("Rozetta PMS");
    expect(manifest.short_name).toBe("Rozetta");
  });

  it("launches standalone on the dashboard", () => {
    expect(manifest.start_url).toBe("/");
    expect(manifest.display).toBe("standalone");
  });

  it("launches in the brand colours", () => {
    expect(manifest.theme_color).toBe("#102a43");
    expect(manifest.background_color).toBe("#ffffff");
  });

  it("declares the 192px and 512px icons Chrome requires to install", () => {
    const any = manifest.icons.filter((i) => i.purpose !== "maskable");
    expect(any.map((i) => i.sizes).sort()).toEqual(["192x192", "512x512"]);
  });

  it("declares a 512px maskable icon so Android does not crop the mark", () => {
    const maskable = manifest.icons.filter((i) => i.purpose === "maskable");
    expect(maskable.map((i) => i.sizes)).toEqual(["512x512"]);
  });

  // DigitalOcean's `catchall_document` serves index.html with a 200 for a path
  // that does not exist, so a typo here would fail silently in production.
  it.each(manifest.icons)("serves $src as declared", (icon) => {
    const file = path.join(publicDir, icon.src);
    expect(existsSync(file)).toBe(true);

    const [width, height] = icon.sizes.split("x").map(Number);
    expect(pngSize(file)).toEqual({ width, height });
    expect(icon.type).toBe("image/png");
  });
});

describe("index.html", () => {
  it("links the manifest", () => {
    expect(indexHtml).toMatch(
      /rel="manifest"[^>]*href="\/manifest\.webmanifest"/,
    );
  });

  it("declares the same theme colour as the manifest", () => {
    expect(indexHtml).toMatch(
      new RegExp(`name="theme-color"[^>]*content="${manifest.theme_color}"`),
    );
  });

  it("opts the viewport into safe-area insets", () => {
    expect(indexHtml).toMatch(/name="viewport"[^>]*viewport-fit=cover/s);
  });
});
