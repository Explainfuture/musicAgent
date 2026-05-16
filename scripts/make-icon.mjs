import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import pngToIco from "png-to-ico";
import sharp from "sharp";

const root = process.cwd();
const buildDir = path.join(root, "build");
const source = path.join(buildDir, "icon.png");
const sizes = [16, 24, 32, 48, 64, 128, 256];

await mkdir(buildDir, { recursive: true });

const pngBuffers = await Promise.all(
  sizes.map((size) =>
    sharp(source)
      .resize(size, size, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toBuffer(),
  ),
);

const ico = await pngToIco(pngBuffers);
await writeFile(path.join(buildDir, "icon.ico"), ico);
