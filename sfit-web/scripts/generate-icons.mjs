// Genera PNGs del logo square para Android launcher icons + favicons web + Apple touch.
// Uso: node scripts/generate-icons.mjs
import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const ROOT = resolve(process.cwd(), "..");
// Fuente preferida: PNG institucional (sin filtros SVG problemáticos).
// Fallback a SVG si no existe PNG.
const SRC_PNG = join(ROOT, "sfit-web/public/logo-mark.png");
const SRC_SVG = join(ROOT, "sfit-web/public/logo-mark.svg");
const APP_ANDROID = join(ROOT, "sfit-app/android/app/src/main/res");
const WEB_PUBLIC = join(ROOT, "sfit-web/public");
const WEB_APP = join(ROOT, "sfit-web/src/app");

const ANDROID_SIZES = [
  { dir: "mipmap-mdpi", size: 48 },
  { dir: "mipmap-hdpi", size: 72 },
  { dir: "mipmap-xhdpi", size: 96 },
  { dir: "mipmap-xxhdpi", size: 144 },
  { dir: "mipmap-xxxhdpi", size: 192 },
];

const WEB_SIZES = [
  { file: "favicon-16.png", size: 16 },
  { file: "favicon-32.png", size: 32 },
  { file: "favicon-48.png", size: 48 },
  { file: "apple-touch-icon.png", size: 180 },
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
];

async function loadSource() {
  try {
    return { buf: await readFile(SRC_PNG), format: "png" };
  } catch {
    return { buf: await readFile(SRC_SVG), format: "svg" };
  }
}

async function main() {
  const { buf, format } = await loadSource();
  console.log(`Fuente: ${format === "png" ? "logo-mark.png" : "logo-mark.svg"}`);

  const pipe = () =>
    format === "svg" ? sharp(buf, { density: 512 }) : sharp(buf);

  // Android launcher icons
  for (const { dir, size } of ANDROID_SIZES) {
    const outDir = join(APP_ANDROID, dir);
    await mkdir(outDir, { recursive: true });
    const out = join(outDir, "ic_launcher.png");
    await pipe()
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(out);
    console.log(`✓ android ${dir}/ic_launcher.png (${size}x${size})`);
  }

  // Web icons
  for (const { file, size } of WEB_SIZES) {
    const out = join(WEB_PUBLIC, file);
    await pipe()
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(out);
    console.log(`✓ web public/${file} (${size}x${size})`);
  }

  // Flutter: mark PNG alta res + 1024 + 256
  const flutterAssets = join(ROOT, "sfit-app/assets/logos");
  await pipe()
    .resize(1024, 1024, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(join(flutterAssets, "sfit-mark.png"));
  console.log("✓ sfit-app/assets/logos/sfit-mark.png (1024x1024)");

  await pipe()
    .resize(256, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(join(flutterAssets, "sfit-mark-256.png"));
  console.log("✓ sfit-app/assets/logos/sfit-mark-256.png");

  await pipe()
    .resize(1024, 1024, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(join(flutterAssets, "sfit-icon-1024.png"));
  console.log("✓ sfit-app/assets/logos/sfit-icon-1024.png");

  // Next.js app router icons
  await pipe()
    .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(join(WEB_APP, "icon.png"));
  console.log("✓ sfit-web/src/app/icon.png (512x512)");

  await pipe()
    .resize(180, 180, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(join(WEB_APP, "apple-icon.png"));
  console.log("✓ sfit-web/src/app/apple-icon.png (180x180)");

  console.log("\nListo. Para ver el icono nuevo en el celular: desinstala la app → flutter clean → flutter run.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
