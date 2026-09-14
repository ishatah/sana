/**
 * Builds the transparent hero portrait from the supplied studio photograph.
 *
 * WHY THIS EXISTS AT ALL. Both supplied photographs are studio shots on a white
 * seamless (measured: RGB 254). Dropped onto the near-black page ground inside a
 * circular frame, the white read as a bright disc with a hard edge — a sticker
 * pasted onto the page rather than a portrait belonging to it, which was the
 * single biggest reason the hero looked unfinished.
 *
 * So the white is removed here, at build time, rather than hidden behind a frame.
 *
 * IT IS A SOFT ALPHA RAMP, NOT A THRESHOLD. A hard cutoff ("anything above 240 is
 * background") produces a jagged, aliased edge, and it destroys exactly the places
 * that matter: the chiffon edge of the hijab and the wisps of hair are genuinely
 * semi-transparent against the seamless, and a binary mask turns them into a
 * cut-paper silhouette. Ramping alpha across a luminance band keeps that softness —
 * a pixel at 248 becomes mostly transparent, one at 200 stays almost solid.
 *
 * THE OUTPUT IS PNG, DELIBERATELY. The source is JPEG and smaller, but JPEG has no
 * alpha channel at all, so re-encoding would reintroduce the white. Next's image
 * pipeline serves it as AVIF/WebP to browsers that accept them (see next.config.mjs
 * `formats`), so the PNG's size is not what ships.
 *
 * Re-run with:  node scripts/build-portrait-cutout.mjs
 * Source photographs are untouched; this only writes the -cutout file.
 */
import sharp from "sharp"
import { fileURLToPath } from "node:url"

const ROOT = fileURLToPath(new URL("..", import.meta.url))
const SRC = `${ROOT}public/assets/sanae-rakik-portrait.jpg`
const OUT = `${ROOT}public/assets/sanae-rakik-portrait-cutout.png`

/*
 * The luminance band the ramp runs across.
 *
 * SOLID below 218, fully transparent at/above 246. Both numbers come from the
 * image rather than taste: the seamless measures 253-254, and her black abaya and
 * hijab sit under 40, so there is a very wide gap to place the ramp in. Ending at
 * 246 rather than 253 matters — the seamless is not perfectly even, and lighting
 * falloff at the frame edges dips it into the high 240s, which a tighter ceiling
 * would leave as grey haze around her.
 */
const SOLID_BELOW = 218
const CLEAR_AT = 246

const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const { width, height, channels } = info

for (let i = 0; i < data.length; i += channels) {
  const r = data[i]
  const g = data[i + 1]
  const b = data[i + 2]

  // Rec. 709 luma. A plain average would read her skin tones as brighter than they
  // are relative to the seamless and start eroding the face at the ramp's edge.
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b

  /*
   * NEUTRALITY GUARD. The seamless is grey — R, G and B within a point or two of
   * each other. Warm highlights on her skin can reach a similar luminance but are
   * strongly non-neutral, so anything with real colour spread is kept fully opaque
   * no matter how bright it is. Without this, the brightest highlights on the
   * forehead and nose punch holes through the face.
   */
  const spread = Math.max(r, g, b) - Math.min(r, g, b)
  if (spread > 14) continue

  if (luma >= CLEAR_AT) {
    data[i + 3] = 0
  } else if (luma > SOLID_BELOW) {
    const t = (luma - SOLID_BELOW) / (CLEAR_AT - SOLID_BELOW)
    data[i + 3] = Math.round(255 * (1 - t))
  }
}

await sharp(data, { raw: { width, height, channels } })
  .png({ compressionLevel: 9 })
  .toFile(OUT)

console.log(`wrote ${OUT} (${width}x${height})`)
