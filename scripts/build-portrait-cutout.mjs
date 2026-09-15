/**
 * Builds the transparent hero portrait from the supplied studio photograph.
 *
 * WHY THIS EXISTS AT ALL. Both supplied photographs are studio shots on a white
 * seamless (measured: RGB 254). Dropped onto the near-black page ground inside a
 * circular frame, the white read as a bright disc with a hard edge, a sticker
 * pasted onto the page rather than a portrait belonging to it, which was the
 * single biggest reason the hero looked unfinished.
 *
 * So the white is removed here, at build time, rather than hidden behind a frame.
 *
 * IT IS A SOFT ALPHA RAMP, NOT A THRESHOLD. A hard cutoff ("anything above 240 is
 * background") produces a jagged, aliased edge, and it destroys exactly the places
 * that matter: the chiffon edge of the hijab and the wisps of hair are genuinely
 * semi-transparent against the seamless, and a binary mask turns them into a
 * cut-paper silhouette. Ramping alpha across a luminance band keeps that softness,
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
 * 246 rather than 253 matters, the seamless is not perfectly even, and lighting
 * falloff at the frame edges dips it into the high 240s, which a tighter ceiling
 * would leave as grey haze around her.
 */
const SOLID_BELOW = 218
const CLEAR_AT = 246

/*
 * THE BOTTOM RAMP, a second, GEOMETRIC pass, and it is not optional.
 *
 * The luminance ramp above removes the WHITE seamless, which is the whole
 * background in the upper two-thirds of the frame. It cannot touch the lower
 * portion, because that part of the photograph is not white: the studio floor and
 * the shadow she stands in measure around luma 50, well under SOLID_BELOW, so
 * every pixel of it is correctly kept as subject.
 *
 * The result was a full-width, fully-opaque dark BAND across the bottom ~7% of the
 * file (measured: rows below 93% are opaque edge to edge). On the page that band's
 * straight upper boundary is a hard horizontal line cutting across her forearms,
 * the photograph visibly stops rather than ends.
 *
 * No CSS mask fixes this. A mask fades a region's opacity, but the region being
 * faded is still a rectangle, so the eye reads its top edge exactly as before.
 * The rectangle has to stop existing, which means doing it here, in the alpha
 * channel, where the ramp follows the image instead of being painted over it.
 *
 * The band is removed by POSITION rather than by colour, because colour cannot
 * distinguish it: the floor and her black abaya are the same darkness. Ramping
 * from 72% to 94% of the height puts the fade across her lower body, the ramp
 * spends itself on fabric, where there is no detail to lose, and reaches full
 * transparency above where the band begins, so the band never renders at all.
 *
 * Multiplied into whatever alpha the luminance pass produced, never assigned over
 * it, so the soft edges that pass computed are preserved rather than overwritten.
 */
const FADE_START = 0.72
const FADE_END = 0.94

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
   * NEUTRALITY GUARD. The seamless is grey, R, G and B within a point or two of
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

/*
 * Pass two: the bottom ramp.
 *
 * A SEPARATE LOOP, not a branch inside the one above, because that loop's
 * neutrality guard `continue`s on any pixel with real colour spread, which is
 * most of the lower frame. Folding this in there would skip exactly the pixels it
 * exists to fade. This pass applies to every pixel without exception.
 */
const fadeStartRow = Math.round(height * FADE_START)
const fadeEndRow = Math.round(height * FADE_END)

for (let y = fadeStartRow; y < height; y++) {
  // Smoothstep rather than a straight line. A linear ramp changes slope abruptly
  // at both ends, and on a large flat area of near-black fabric that shows up as
  // two faint horizontal bands, the same artefact in gentler form. Smoothstep
  // eases in and out, so there is no row where the rate of change jumps.
  const t = Math.min(1, (y - fadeStartRow) / (fadeEndRow - fadeStartRow))
  const eased = t * t * (3 - 2 * t)
  const factor = 1 - eased

  for (let x = 0; x < width; x++) {
    const a = (y * width + x) * channels + 3
    data[a] = Math.round(data[a] * factor)
  }
}

await sharp(data, { raw: { width, height, channels } })
  .png({ compressionLevel: 9 })
  .toFile(OUT)

console.log(`wrote ${OUT} (${width}x${height})`)
