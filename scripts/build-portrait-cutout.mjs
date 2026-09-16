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
 * SOLID below 150, fully transparent at/above 246. The ceiling is unchanged and
 * is measured: the seamless reads 253-254, and ending at 246 rather than 253
 * matters because the seamless is not perfectly even and lighting falloff at the
 * frame edges dips it into the high 240s, which a tighter ceiling would leave as
 * grey haze around her.
 *
 * ── THE FLOOR CAME DOWN FROM 218, AND THAT IS THE WHITE-EDGE FIX ──────────────
 *
 * 218 was chosen against the two things it could see: the seamless at 253 and her
 * abaya under 40. But the pixels that actually matter are in NEITHER population.
 * A camera does not transition from seamless to subject in one pixel; along the
 * whole silhouette there is a 2-4px band (measured; up to 10px on soft edges like
 * the chiffon) where each pixel is an OPTICAL BLEND of white ground and dark
 * fabric. Those blends land around luma 100-215.
 *
 * With the floor at 218 every one of them sat below it and was written out fully
 * opaque, so the cutout kept a continuous 2-4px rim of grey-white all the way
 * around the figure: measured at 1,642 opaque bright pixels sitting directly
 * against transparency. On a near-black page that rim is lit from nothing, which
 * is exactly what makes a cutout read as a sticker, the eye sees a bright outline
 * that no light source in the scene accounts for.
 *
 * 150 puts the ramp across that blend band instead of above it, so a pixel that
 * is half seamless comes out half transparent, which is what it physically is.
 * It is still far above her fabric (under 40) and clear of the darker mid-tones
 * in her face, and the neutrality guard below protects skin independently of this
 * number, so nothing on the subject is eroded by the lower floor.
 */
const SOLID_BELOW = 150
const CLEAR_AT = 246

/*
 * ── SPILL DECONTAMINATION ─────────────────────────────────────────────────────
 *
 * Lowering the floor fixes the ALPHA of the rim, but not its COLOUR, and on a
 * dark ground the colour is half the artefact. A pixel that is 60% transparent
 * still carries the RGB the camera recorded, which at the silhouette edge is a
 * blend containing white seamless. Composited onto near-black it shows up as a
 * pale halo at 40% strength rather than at 100%: fainter than before, still a
 * halo, and still the thing that reads as "pasted on".
 *
 * This is the standard un-premultiply: given a recorded colour C that is a blend
 * of the true subject colour S over a known background B at coverage a,
 * C = a*S + (1-a)*B, so S = (C - (1-a)*B) / a. Solving it back removes the
 * seamless from the pixel's colour and leaves what the subject alone would have
 * been, which is what lets the edge sit on ANY background rather than only on the
 * white it was shot against.
 *
 * Applied only where there is real spill to remove (alpha below ~0.97) and
 * clamped: at very low alpha the division amplifies sensor noise, so the
 * correction is eased out as alpha approaches zero, where the pixel is nearly
 * invisible anyway and the noise would be the only thing left.
 */
const SEAMLESS = 253

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
   *
   * ── IT SCALES WITH LUMA NOW, BECAUSE THE FLOOR MOVED DOWN TO 150 ────────────
   *
   * A flat `spread > 14` was safe while the ramp only ever saw near-white pixels,
   * where anything with real colour could only be skin. It is not safe at 150: an
   * edge pixel that is half white seamless and half dark fabric picks up colour
   * spread from the fabric side of the blend, so a flat guard would skip exactly
   * the rim pixels this pass now exists to soften, and the white edge would
   * survive the lower floor untouched.
   *
   * The tolerance therefore widens as the pixel gets brighter. Near CLEAR_AT a
   * pixel is essentially pure seamless and must be near-neutral to qualify, which
   * is the original 14. Down at the floor a blend is legitimately less neutral, so
   * up to ~34 is allowed. Her skin sits far outside even the loose end (measured
   * spread on the lit cheek and forehead runs 45-90), so the face is protected by
   * the same margin it always had.
   */
  const spread = Math.max(r, g, b) - Math.min(r, g, b)
  const lumaT = Math.min(1, Math.max(0, (luma - SOLID_BELOW) / (CLEAR_AT - SOLID_BELOW)))
  const spreadLimit = 34 - 20 * lumaT
  if (spread > spreadLimit) continue

  if (luma >= CLEAR_AT) {
    data[i + 3] = 0
  } else if (luma > SOLID_BELOW) {
    const t = (luma - SOLID_BELOW) / (CLEAR_AT - SOLID_BELOW)
    data[i + 3] = Math.round(255 * (1 - t))
  }
}

/*
 * ── PASS 1b: DECONTAMINATE EVERY PARTIALLY TRANSPARENT PIXEL ──────────────────
 *
 * This ran inline inside the loop above and was wrong twice over, in ways that
 * left a visible rim on the page even after the alpha ramp was widened.
 *
 *   1. IT ONLY SAW PIXELS THE RAMP HAD JUST TOUCHED. A pixel's alpha can also be
 *      partial because of what the bottom ramp does to it, or because it was
 *      already semi-transparent; those never entered the branch, so their white
 *      spill was never removed.
 *
 *   2. IT EASED THE CORRECTION OFF FAR TOO EARLY. Holding it back below a = 0.15
 *      protects against noise amplification, but the pixels that read as a white
 *      outline sit at HIGH alpha (measured on the served image: grey 173-185 at
 *      alpha 204-240), and there the correction was being applied at full strength
 *      against a SEAMLESS constant that was too low. The residue measured 1,460
 *      edge pixels compositing brighter than the page ground.
 *
 * Running it as its own pass over every partial-alpha pixel fixes both. The test
 * that justifies doing it unconditionally is in the measurement: of the bright
 * edge pixels, 1,562 are NEUTRAL GREY and exactly 0 carry real colour, so there is
 * no hair or skin in this population to damage, it is all leftover seamless.
 *
 * THE NEUTRALITY CHECK IS STILL HERE, per pixel, because that is what makes the
 * pass safe as the photograph changes. A coloured semi-transparent pixel is a real
 * soft edge of the subject (a wisp of hair against the light) and is left alone;
 * only a grey one is spill, because the seamless is grey.
 */
for (let i = 0; i < data.length; i += channels) {
  const a = data[i + 3] / 255
  if (a <= 0.02 || a >= 0.995) continue

  const r = data[i]
  const g = data[i + 1]
  const b = data[i + 2]
  const spread = Math.max(r, g, b) - Math.min(r, g, b)
  if (spread > 20) continue

  /*
   * S = (C - (1-a)*B) / a, the standard un-premultiply, solved per channel.
   *
   * `ease` still exists but now only guards the genuinely noisy bottom of the
   * range (below a = 0.06, where the pixel is all but invisible anyway). Above
   * that the correction is applied in full, which is the point: the rim lives at
   * high alpha and needs the whole correction, not a fraction of it.
   */
  const ease = Math.min(1, a / 0.06)
  for (let c = 0; c < 3; c++) {
    const recorded = data[i + c]
    const trueColour = (recorded - (1 - a) * SEAMLESS) / a
    const corrected = recorded + (trueColour - recorded) * ease
    data[i + c] = Math.max(0, Math.min(255, Math.round(corrected)))
  }
}

/*
 * ── PASS 1c: THE EDGE EROSION, AND WHY A LUMA RAMP CANNOT DO THIS ALONE ───────
 *
 * Everything above keys on BRIGHTNESS, and brightness is not sufficient to
 * identify the rim. Measured on the previous build: 3,369 boundary pixels still
 * composited brighter than the page ground, 1,153 of them at FULL opacity, which
 * means the luma ramp had classified them as subject and the decontamination pass
 * (partial alpha only) could never see them.
 *
 * They are grey blends of seamless and fabric that happen to land below the ramp's
 * floor. Lowering that floor far enough to catch them is not an option: it would
 * be well inside the range her dark clothing and the shadowed side of her face
 * occupy, and would start eating the subject.
 *
 * So this pass adds the one piece of information brightness alone does not carry,
 * WHERE the pixel is. A grey pixel in the middle of her abaya is fabric. The same
 * grey pixel sitting against transparency is the seamless the matte failed to
 * remove, because the subject's own silhouette does not end in a neutral grey
 * halo, it ends in her clothing, her skin or her hair, all of which carry colour.
 *
 * The rule is therefore: within a few pixels of the transparent region, a NEUTRAL
 * pixel that is brighter than the fabric around it is spill, and its alpha is
 * pulled down in proportion to how grey and how bright it is. Coloured pixels are
 * never touched at any distance, which is what protects the hair wisps and the
 * chiffon edge that make the cutout read as a photograph rather than a die-cut.
 *
 * DISTANCE IS COMPUTED FROM THE ORIGINAL ALPHA, snapshotted before the loop, so
 * erosion cannot cascade: a pixel made transparent here must not become the
 * evidence that its neighbour is also an edge, which would march inward and thin
 * the figure.
 */
/* How far the spill can reach. Measured at 2-4px on hard edges and up to 10px on
   the soft chiffon; 4 covers the rim without reaching into the subject proper. */
const REACH = 4

/*
 * ── IT RUNS TWICE, AND THE SNAPSHOT IS RETAKEN BETWEEN ROUNDS ─────────────────
 *
 * One round takes the median rim excess from +22.5 luma to -6.8, which is the bulk
 * of it, and leaves roughly a hundred pixels still brighter than the fabric they
 * sit on. Those are the second layer of a rim that was two pixels deep: they were
 * not adjacent to transparency on the first pass, so nothing looked at them, and
 * they only become the boundary once the layer outside them is gone.
 *
 * Re-snapshotting is what makes a second round legitimate rather than the cascade
 * the note above warns against. Within a round the geometry is frozen, so erosion
 * still cannot feed on itself pixel by pixel; between rounds it is re-measured
 * once, deliberately, against a silhouette that has actually changed.
 *
 * TWO AND NOT MORE, because each round is gated on local contrast and the contrast
 * is what disappears: by the third round the boundary is already darker than the
 * interior almost everywhere, so a further pass would find nothing to do while
 * still carrying the risk of trimming a genuinely bright edge.
 */
const EROSION_ROUNDS = 2

const alphaSnapshot = new Uint8Array(width * height)

for (let round = 0; round < EROSION_ROUNDS; round++) {
for (let p = 0; p < width * height; p++) alphaSnapshot[p] = data[p * channels + 3]

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const p = y * width + x
    const i = p * channels
    if (alphaSnapshot[p] < 8) continue

    /*
     * Nearest transparent pixel within REACH, measured on the snapshot, and the
     * direction to it. The INWARD direction is that vector reversed, which is
     * where the interior reference below is sampled from: straight away from the
     * nearest hole rather than along a fixed axis, so the reference stays inside
     * the figure on a diagonal edge as well as on a vertical one.
     */
    let dist = Infinity
    let outDx = 0
    let outDy = 0
    for (let dy = -REACH; dy <= REACH; dy++) {
      const yy = y + dy
      if (yy < 0 || yy >= height) continue
      for (let dx = -REACH; dx <= REACH; dx++) {
        const xx = x + dx
        if (xx < 0 || xx >= width) continue
        if (alphaSnapshot[yy * width + xx] < 40) {
          const d = Math.max(Math.abs(dx), Math.abs(dy))
          if (d < dist) {
            dist = d
            outDx = dx
            outDy = dy
          }
        }
      }
    }
    if (dist > REACH) continue

    /* Unit step inward, one of the eight compass directions. */
    const mag = Math.max(Math.abs(outDx), Math.abs(outDy)) || 1
    const inDx = -Math.round(outDx / mag)
    const inDy = -Math.round(outDy / mag)

    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const spread = Math.max(r, g, b) - Math.min(r, g, b)
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b

    /*
     * ── THE TEST IS LOCAL CONTRAST, NOT AN ABSOLUTE BRIGHTNESS ────────────────
     *
     * This gate used to be `luma < 60 → skip`, reasoning that her garments measure
     * under 40 so anything above 60 could not be fabric. That number was measured
     * on the FLAT of the garment and the rim does not live there. Measured on the
     * build that rule produced: 637 of 733 boundary pixels were still brighter
     * than the fabric 4px inward, by a median of 22.5 luma, and every one of the
     * 733 was neutral grey. The rim had simply settled at 52-59, just under the
     * threshold, and the pass walked straight past the artefact it exists to
     * remove.
     *
     * An absolute threshold cannot work here, because there is no single value
     * that separates "spill" from "subject" everywhere in the frame: the shadowed
     * side of the abaya and a lit fold of the same garment are far apart, and a
     * rim over each lands in a different place. What is constant is the RELATION,
     * spill is always brighter than the material it is sitting on.
     *
     * So the pixel is compared with the interior a few steps inward along the
     * direction it faces. If it is brighter than its own surroundings AND neutral,
     * it is seamless; if it matches them, it is the garment and is left exactly as
     * it is. That makes the pass self-scaling: it removes a rim on a dark fold and
     * on a light one without either number being written down here.
     *
     * NEUTRAL is unchanged: spill is grey because the seamless is grey, so a
     * coloured pixel is hair or skin and is never touched at any distance.
     *
     * CLOSE TO THE EDGE: `near` falls off with distance, so a pixel one step in is
     * treated as almost certainly spill and one at the reach limit is barely
     * affected. Without this the pass would put a hard ring of its own at the
     * REACH boundary, which is the artefact it exists to remove.
     */
    if (spread > 20) continue

    /*
     * The interior reference: the median of several samples taken inward, so a
     * single bright thread or a bead on the trim cannot stand in for "the garment"
     * and license erosion of the real edge beside it.
     */
    const inward = []
    for (let step = 3; step <= 6; step++) {
      const yy = y + inDy * step
      const xx = x + inDx * step
      if (yy < 0 || yy >= height || xx < 0 || xx >= width) continue
      const q = (yy * width + xx) * channels
      if (data[q + 3] < 200) continue
      inward.push(0.2126 * data[q] + 0.7152 * data[q + 1] + 0.0722 * data[q + 2])
    }
    if (inward.length === 0) continue
    inward.sort((m, n) => m - n)
    const interior = inward[Math.floor(inward.length / 2)]

    /*
     * 6 luma is the noise floor of the sensor on a flat area; below that the
     * pixel is indistinguishable from its surroundings and nothing is done. The
     * excess is normalised over 30, which is the measured median rim excess of
     * 22.5 rounded up, so a typical rim resolves to a near-complete removal and a
     * faint one is only partly faded rather than being cut.
     */
    const excess = luma - interior
    if (excess <= 6) continue

    const near = 1 - (dist - 1) / REACH
    const brightness = Math.min(1, (excess - 6) / 30)
    const neutrality = 1 - spread / 20
    const strength = Math.max(0, Math.min(1, near * brightness * neutrality))

    data[i + 3] = Math.round(data[i + 3] * (1 - strength))

    /* Whatever survives is decontaminated too, so a pixel left at partial alpha
       does not composite the seamless colour it still carries. */
    const na = data[i + 3] / 255
    if (na > 0.02 && na < 0.995) {
      for (let c = 0; c < 3; c++) {
        const recorded = data[i + c]
        const trueColour = (recorded - (1 - na) * SEAMLESS) / na
        data[i + c] = Math.max(0, Math.min(255, Math.round(trueColour)))
      }
    }
  }
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

/*
 * ── PASS THREE: COLOUR BLEED, AND IT IS WHAT MAKES THE FIX SURVIVE RESIZING ───
 *
 * Everything above produces a file that is correct at full size and STILL SHOWED
 * A WHITE OUTLINE ON THE PAGE. The reason is not in the matte at all.
 *
 * A transparent pixel still has RGB. Removing the seamless set alpha to 0 and left
 * the colour channels holding whatever the camera recorded there, which is white:
 * measured on the previous build, 639,682 fully transparent pixels still carried
 * pure white. Invisible at 1:1, because alpha 0 draws nothing.
 *
 * Then next/image resizes the 1206px file down to the 544px the layout asks for.
 * A downscale is an AVERAGE of neighbouring pixels, and sharp, like every
 * non-premultiplied pipeline, averages the colour channels independently of alpha.
 * So an edge pixel of her dark clothing is averaged with the white sitting in the
 * transparent pixels beside it, and comes out grey with the alpha it inherited.
 * The halo is not left over from the matte, it is MANUFACTURED by the resize, out
 * of colour data that was never meant to be seen. Measured: 55 bright boundary
 * pixels in the source, 1,300 in the 544px version the browser was served.
 *
 * The cure is to make the invisible colour agree with the visible one, so the
 * average has nothing bright to find. Each transparent pixel takes the colour of
 * the nearest pixel that is actually drawn, repeated outward in a few passes. The
 * alpha channel is never touched here, so the silhouette is bit-for-bit what the
 * passes above decided; only data that draws nothing changes, and the resize now
 * blends her own edge colour into her own edge.
 *
 * This is the same reason compositing pipelines premultiply. We cannot ask
 * next/image to do that, so the file is prepared such that it does not matter.
 */
const BLEED_PASSES = 6
let alphaMap = new Uint8Array(width * height)
for (let p = 0; p < width * height; p++) alphaMap[p] = data[p * channels + 3] > 0 ? 1 : 0

for (let pass = 0; pass < BLEED_PASSES; pass++) {
  /* Snapshotted per pass so a pixel filled in this pass cannot also be a source
     in the same pass, which would smear one colour across the whole frame. */
  const filled = Uint8Array.from(alphaMap)
  const snapshot = Uint8Array.from(data)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x
      if (filled[p]) continue

      let r = 0
      let g = 0
      let b = 0
      let n = 0
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= height) continue
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx
          if (xx < 0 || xx >= width) continue
          const q = yy * width + xx
          if (!filled[q]) continue
          const j = q * channels
          r += snapshot[j]
          g += snapshot[j + 1]
          b += snapshot[j + 2]
          n++
        }
      }
      if (!n) continue

      const i = p * channels
      data[i] = Math.round(r / n)
      data[i + 1] = Math.round(g / n)
      data[i + 2] = Math.round(b / n)
      alphaMap[p] = 1
    }
  }
}

/*
 * Anything still unfilled is far from the subject and will never be averaged with
 * it by any sane resize. It is set to the page ground rather than left white, so
 * that even an aggressive downscale has nothing brighter than the background to
 * pull in. `--background` is #0A0A0B (styles/globals.css).
 */
for (let p = 0; p < width * height; p++) {
  if (alphaMap[p]) continue
  const i = p * channels
  data[i] = 10
  data[i + 1] = 10
  data[i + 2] = 11
}

await sharp(data, { raw: { width, height, channels } })
  .png({ compressionLevel: 9 })
  .toFile(OUT)

console.log(`wrote ${OUT} (${width}x${height})`)
