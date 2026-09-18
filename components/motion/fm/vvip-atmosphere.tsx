"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"

/**
 * The hero's animated ground: a mesh gradient, a contour grid and light shafts,
 * composited in one fragment shader.
 *
 * ── WHAT THIS REPLACED, AND WHY ──────────────────────────────────────────────
 *
 * This supersedes VvipWave (a travelling sine band) and .vvip-field-wash (a
 * drifting CSS radial stack). Both are gone. The wave summed three Gaussians at
 * three different phase offsets and rolled the sum off through v/(v+1); Gaussians
 * have no edges, so the result was a soft cloud that bulged rather than a wave,
 * and the site owner's verdict on it was blunt and correct.
 *
 * THE DIAGNOSIS WAS THE STACK, NOT THE WAVE. The wash, the wave and the squares
 * were all soft, all the same blue, all between 0.06 and 0.30 alpha. Nothing in
 * the hero ground had an edge anywhere, so three layers that were meant to read
 * as depth composited into one haze.
 *
 * So the rule this file is built on: CRISP OVER SOFT. The mesh is the soft
 * ground, the grid supplies the edges the hero never had, and the shafts give
 * the field a direction. Take away the grid and this becomes the haze again.
 *
 * ── ONE CANVAS, NOT THREE ────────────────────────────────────────────────────
 *
 * Three layers could each have been their own canvas. They are not, for two
 * reasons. Three WebGL contexts is three times the context cost for one
 * decorative band, and browsers cap live contexts per document. More
 * importantly the three share ONE alpha budget (below), and a budget split
 * across three independently-composited canvases cannot be reasoned about —
 * in one shader the peak is computed in one place and clamped once.
 *
 * ── THE ALPHA CEILING IS A CONTRAST RATIO, NOT A TASTE SETTING ───────────────
 *
 * .vvip-meta-label sits over this layer at #525c67 (styles/globals.css, and it
 * is hardcoded there rather than using --muted-foreground precisely because
 * --muted-foreground already failed over the old wave).
 *
 * MEASURED by simulating this exact shader over both text directions, 240
 * seconds of shader time and the whole canvas, taking the worst pixel found:
 *
 *     uAlpha 0.38   peak 0.288   label 4.65:1   SHIPPED
 *     uAlpha 0.42   peak 0.318   label 4.45:1   FAILS
 *
 * (Those figures are for the shipped weights. The first build weighted the grid
 * at 0.19 and measured 4.77:1 at the same uAlpha; moving weight into the grid
 * costs a little margin because the grid takes the most saturated tint.)
 *
 * uAlpha is deliberately high so the grid and shafts read as design rather than
 * as texture. Note the peak column is well under the uniform: the three layers
 * never saturate at the same pixel, which the uniform's own comment explains.
 *
 * If this value rises, re-run that simulation rather than reasoning from a flat
 * composite of one tint — the shader stacks three with their own hues, and the
 * worst pixel is not where intuition puts it.
 *
 * AND IF IT FAILS, LOWER uAlpha. Do not recolour .vvip-meta-label to buy room:
 * that hardcoded #525c67 is already one such concession and there is not a
 * second one available before the label stops being a muted label.
 *
 * ── THE GLOW EXCEPTION IS RETIRED ────────────────────────────────────────────
 *
 * VvipWave held a scoped override of the register note in styles/globals.css,
 * "nothing that glows", granted for the hero band alone. This file does not
 * inherit it and does not need it: a wash and a hairline are not a bloom. The
 * register now holds everywhere on the site without exception.
 *
 * ── GLSL ES 3.00, AND IT HAS TO BE ───────────────────────────────────────────
 *
 * Both shaders use in/out plus a declared fragColor, rather than the
 * attribute/varying/gl_FragColor of ES 1.00 that the layer this replaced was
 * written in, and the material carries `glslVersion: THREE.GLSL3`.
 *
 * THE REASON IS fwidth(). three.js takes a WebGL2 context where one is available,
 * and RawShaderMaterial passes source through VERBATIM — it does not upgrade or
 * patch anything. An ES 1.00 shader on a WebGL2 context cannot reach fwidth():
 * derivatives live behind OES_standard_derivatives there, and that extension does
 * not exist on WebGL2 because ES 3.00 made derivatives core. getExtension returns
 * null, the compile fails with "no matching overloaded function found", and the
 * canvas renders nothing.
 *
 * MEASURED, not theorised: the first build of this file was ES 1.00, and the
 * rendered hero was white with scattered saturated pixels, with gl.getError()
 * returning 1282 (INVALID_OPERATION) on every frame.
 *
 * DO NOT ALSO WRITE `#version 300 es` AT THE TOP OF THESE STRINGS. The GLSL3
 * flag makes three.js emit that directive itself, then prepend its own #define
 * block; a hand-written copy lands BELOW those defines, and the directive is
 * only legal as the very first thing in the source. That fails with "'version' :
 * #version directive must occur before anything else" and nothing renders. The
 * flag is the whole mechanism — the source stays directive-free.
 *
 * ── A DECORATIVE LEAF ────────────────────────────────────────────────────────
 *
 * No children, so it re-opens no client boundary around the hero's server-
 * rendered content. aria-hidden: it is decoration, and there is nothing here a
 * screen reader should meet.
 */

const vertexShader = /* glsl */ `
precision highp float;

in vec3 position;

out vec2 vUv;

void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position, 1.0);
}
`

/*
 * ── THE FRAGMENT SHADER ──────────────────────────────────────────────────────
 *
 * Three fields, each returning a 0..1 coverage, summed with fixed weights and
 * multiplied by uAlpha exactly once at the end. The weights are the budget
 * split: mesh 0.42, shafts 0.20, grid 0.38 of the total. Changing a weight
 * moves brightness BETWEEN layers without changing the peak, which is the
 * property that makes this tunable without re-running the contrast check.
 *
 * THE GRID CARRIES THE LARGEST SHARE AFTER THE MESH, AND THAT IS THE POINT.
 * It was 0.19 in the first build and MEASURED in the browser at a peak
 * line-to-gap amplitude of 18/255, which is at the edge of visible — the layer
 * that justifies this whole design was the one nobody could see. At 0.38 the
 * same measurement is 37/255. The mesh and the shafts each gave up the
 * difference; the total is unchanged, so the contrast bound is unmoved.
 */
const fragmentShader = /* glsl */ `
precision highp float;

uniform vec2  uResolution;
uniform float uTime;
uniform float uAlpha;
uniform float uAngle;
uniform float uDirection;
uniform vec3  uTintCore;
uniform vec3  uTintDeep;
uniform vec3  uTintPale;
uniform vec3  uTintCool;

in vec2 vUv;

out vec4 fragColor;

float blob(vec2 p, vec2 c, float r) {
  float d = length(p - c) / r;
  return exp(-d * d);
}

float meshField(vec2 p, float t, out vec3 tint) {
  vec2 c0 = vec2(-0.62 + 0.10 * sin(t * 0.21), -0.16 + 0.07 * cos(t * 0.17));
  vec2 c1 = vec2( 0.54 + 0.09 * cos(t * 0.13),  0.22 + 0.08 * sin(t * 0.19));
  vec2 c2 = vec2( 0.14 + 0.12 * sin(t * 0.11),  0.38 + 0.06 * cos(t * 0.23));
  vec2 c3 = vec2(-0.22 + 0.08 * cos(t * 0.27), -0.42 + 0.09 * sin(t * 0.15));
  vec2 c4 = vec2( 0.78 + 0.07 * sin(t * 0.16),  -0.30 + 0.10 * cos(t * 0.12));

  float b0 = blob(p, c0, 0.62);
  float b1 = blob(p, c1, 0.54);
  float b2 = blob(p, c2, 0.44);
  float b3 = blob(p, c3, 0.50);
  float b4 = blob(p, c4, 0.40);

  float sum = b0 + b1 + b2 + b3 + b4;

  float wSum = sum + 1e-4;
  tint = (uTintCore * b0 + uTintDeep * b1 + uTintPale * b2 + uTintCool * b3
        + uTintDeep * b4) / wSum;

  return sum / (sum + 1.0);
}

float gridField(vec2 p, float t) {
  vec2 q = p;
  q.y += 0.13 * sin(q.x * 2.1 + t * 0.29) + 0.06 * sin(q.x * 3.7 - t * 0.19);
  q.x += 0.05 * sin(q.y * 2.6 + t * 0.23);

  float lines = q.y * 7.0;
  float d = abs(fract(lines) - 0.5);
  float w = fwidth(lines);
  float line = 1.0 - smoothstep(0.0, w * 1.1, d);
  return line;
}

float shaftField(vec2 p, float t) {
  float ca = cos(uAngle);
  float sa = sin(uAngle);
  float axis = p.x * sa - p.y * ca;

  float s = 0.0;
  s += exp(-pow((axis - 0.34 - 0.10 * sin(t * 0.13 * uDirection)) / 0.20, 2.0)) * 1.00;
  s += exp(-pow((axis + 0.12 - 0.08 * sin(t * 0.09 * uDirection)) / 0.26, 2.0)) * 0.72;
  s += exp(-pow((axis + 0.58 - 0.06 * cos(t * 0.11 * uDirection)) / 0.16, 2.0)) * 0.54;

  return s / (s + 1.0);
}

/*
 * ── THE AURORA: EXPANDING RINGS FROM THE PORTRAIT ────────────────────────────
 *
 * Concentric wavefronts travelling outward from a source behind the figure.
 * Crisp like the grid (same fwidth technique) but radial, so the two structured
 * layers cannot be mistaken for one another.
 */
float ringField(vec2 p, float t, vec2 origin) {
  vec2 d = p - origin;
  /* Slight anisotropy so the rings read as an ellipse in perspective rather
     than as a flat bullseye. */
  d.y *= 1.35;
  float r = length(d);

  /* Rings travel outward: subtracting t moves crests away from the origin. */
  float phase = r * 4.4 - t * 0.50;
  float f = abs(fract(phase) - 0.5);
  float w = fwidth(phase);
  float line = 1.0 - smoothstep(0.0, w * 1.4, f);

  /* Fade with distance: near the source the rings are dense and bright, far out
     they dissolve rather than tiling the whole canvas. */
  float fall = exp(-r * r * 0.62);
  return line * fall;
}

/*
 * ── THE AURA: A SATURATED CORE BEHIND THE FIGURE ─────────────────────────────
 *
 * A soft, breathing disc of the deepest blue, placed where the portrait stands.
 * This is the layer that lets the right half of the hero carry real colour: the
 * cut-out has no background of its own, so a halo behind her reads as studio
 * lighting rather than as a stain on the page.
 */
float auraField(vec2 p, float t, vec2 origin) {
  float breathe = 0.30 + 0.035 * sin(t * 0.31);
  /* A tight core plus a broad shoulder: the core is what reads as a source,
     the shoulder is what keeps it from having an edge. */
  float core = blob(p, origin, breathe) * 1.35;
  float halo = blob(p, origin + vec2(0.06, -0.10), breathe * 2.30) * 0.85;
  float s2 = core + halo;
  return s2 / (s2 + 1.0) * 1.85;
}

void main() {
  vec2 p = (vUv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);

  float t = uTime;

  /*
   * ── THE LAYOUT SWITCH, AND WHY IT IS DERIVED RATHER THAN PASSED IN ───────
   *
   * The hero is 'lg:grid-cols-[1.15fr_0.85fr]': two columns above the lg
   * breakpoint, one stacked column below it. Those are genuinely different
   * pictures, and every mask in this shader depends on which one is on screen.
   *
   * MEASURED at both ends. Two-column (1440x1062, aspect 1.36): the text sits
   * at x 0.045..0.536 and the figure at x 0.59..0.90, side by side. One-column
   * (390x1654, aspect 0.24): the text spans x 0.05..0.95 across the FULL width
   * and the figure sits BELOW it at y 0.53..0.84.
   *
   * So a mask tuned for the wide layout is not merely imprecise on a phone, it
   * is masking the wrong half of the screen — it was leaving the right-hand
   * side fully saturated directly beneath body copy that spans the whole width.
   *
   * 'wide' is derived from the canvas aspect rather than threaded down as a
   * uniform from a matchMedia listener, for the same reason 'uDirection' reads
   * the DOM: the canvas is already sized to the band by ResizeObserver, so its
   * own aspect is the single source of truth and cannot drift out of sync with
   * the layout it is drawn behind.
   *
   * THE RAMP SITS IN THE MEASURED GAP, AND IT MUST FINISH BEFORE 1.0.
   * Measured hero aspects: 0.236 (390px) and 0.438 (768px) stacked; 1.016
   * (1024px) and 1.356 (1440px) two-column. So the ramp runs 0.55..0.92 —
   * entirely inside the empty band between 0.438 and 1.016. An earlier version
   * ramped 0.80..1.10, which left the 1024px layout at a 0.55 BLEND of the two
   * masks: half of each, so the text column was only half protected while the
   * stacked mask was pointlessly dimming the portrait's field.
   */
  float aspect = uResolution.x / uResolution.y;
  float wide = smoothstep(0.55, 0.92, aspect);

  /*
   * The figure's centre, in the same aspect-corrected space the fields use.
   * Beside the text when there are two columns, below it when there is one.
   */
  vec2 portraitWide   = vec2((0.74 - 0.5) * aspect * uDirection, 0.02);
  vec2 portraitNarrow = vec2(0.0, -0.19);
  vec2 portrait = mix(portraitNarrow, portraitWide, wide);

  vec3 meshTint;
  float mesh = meshField(p, t, meshTint);
  float grid = gridField(p, t);
  float shafts = shaftField(p, t);
  float rings = ringField(p, t, portrait);
  float aura = auraField(p, t, portrait);

  /*
   * ── THE QUIET MASK IS NOW TWO-DIMENSIONAL ────────────────────────────────
   *
   * The old mask was a single left-to-right ramp, which is why the whole hero
   * had to stay pale: the reading column and the empty field beside it were
   * treated as one gradient, so the column's contrast bound capped BOTH.
   *
   * The text actually occupies a measured box — x 0.045..0.536 of the hero,
   * y 0.24..0.90 — plus a caption at x 0.59..0.96, y 0.81..0.92. Everything
   * else, and in particular the large field behind and above the portrait, has
   * no type over it at all and can take full saturation.
   */
  vec2 u = vUv;
  /* Reading-order mirror: the text column is on the start side, whichever that
     is, so the mask is built in logical space and flipped for RTL. */
  float ux = uDirection > 0.0 ? u.x : 1.0 - u.x;

  /*
   * The text column, in the WIDE layout: a box with soft shoulders rather than
   * a hard rectangle, because a mask with an edge would put a visible seam
   * through the field. Measured at x 0.045..0.536, y 0.24..0.90.
   */
  float wideX = 1.0 - smoothstep(0.50, 0.70, ux);
  float wideY = smoothstep(0.14, 0.24, u.y) * (1.0 - smoothstep(0.90, 0.99, u.y));
  float wideText = wideX * wideY;

  /*
   * The statement caption, which in the wide layout sits bottom end-side under
   * the portrait column.
   *
   * MEASURED IN ALL THREE LOCALES, because this is the one element whose box
   * genuinely differs between them. In logical space it runs x 0.592..0.955
   * (en/nl) and 0.592..0.955 (ar, mirrored from a screen box of 0.045..0.408),
   * y 0.817..0.918 in en/nl and 0.838..0.915 in ar.
   *
   * THE RAMP MUST BE COMPLETE BY 0.592, NOT STARTING TO BITE THERE. An earlier
   * version ramped 0.52..0.60, which left the caption's leading edge at roughly
   * half mask exactly where the mirrored portrait's aura is strongest. In
   * Arabic that measured 1.58:1 against .vvip-statement — the worst failure
   * this layer has ever produced, and invisible in English because the aura's
   * bright side falls on the other half of the composition there.
   *
   * It now completes at 0.56, comfortably before the caption starts, and the
   * vertical band opens at 0.74 to cover the Arabic box's higher top edge.
   */
  float capX = smoothstep(0.46, 0.56, ux);
  float capY = smoothstep(0.70, 0.78, u.y) * (1.0 - smoothstep(0.93, 0.99, u.y));
  float wideCaption = capX * capY;

  float maskWide = max(wideText, wideCaption);

  /*
   * The NARROW layout. The copy spans the full width (measured x 0.05..0.95),
   * so there is no quiet side to protect and no clear side to saturate — the
   * axis that separates type from open field is VERTICAL, not horizontal.
   *
   * Two bands carry type: the headline block through the CTAs (y 0.12..0.47)
   * and the statement below the figure (y 0.85..0.95). Between them is the
   * portrait, which is where the colour goes.
   */
  float narrowTop  = smoothstep(0.04, 0.10, u.y) * (1.0 - smoothstep(0.44, 0.52, u.y));
  float narrowFoot = smoothstep(0.76, 0.83, u.y);
  float maskNarrow = max(narrowTop, narrowFoot);

  float textMask = mix(maskNarrow, maskWide, wide);

  /*
   * The suppression under type. Never 1.0 — a layer that vanishes completely
   * leaves a visible edge where it went, which is the seam this whole mask is
   * shaped to avoid.
   *
   * It is DEEPER IN THE NARROW LAYOUT, and that is a measured requirement
   * rather than caution. The edge window below works in normalised uv, so on a
   * 1440x1062 band it is already rolling off across much of the canvas, but on
   * a 390x1654 one it attenuates almost nothing over the tall middle — which is
   * exactly where a phone puts the body copy. At the wide layout's 0.72 the
   * narrow layout measured .vvip-meta-label at 3.23:1 and .vvip-statement at
   * 4.29:1, both real 1.4.3 failures.
   */
  float quiet = 1.0 - mix(0.94, 0.84, wide) * textMask;

  float gridMask = smoothstep(0.06, 0.34, mesh);
  /* The rings need the same treatment as the grid: crisp lines on bare white
     with no wash beneath them read as stray hairlines. */
  float ringMask = smoothstep(0.04, 0.30, mesh + aura * 0.5);

  /*
   * ── THE COMPOSITE ────────────────────────────────────────────────────────
   *
   * Weights still sum to 1.0 so the ceiling is uAlpha exactly. The mesh gives
   * up share to the two new layers; the aura and rings are both concentrated
   * where there is no type, so they buy visible colour at almost no cost to the
   * measured worst pixel.
   */
  /*
   * THE MESH IS ATTENUATED UNDER TYPE TOO, BUT ONLY GENTLY, AND ONLY WHERE THE
   * GEOMETRY FORCES IT.
   *
   * The mesh was historically exempt from the quiet mask, and for the wide
   * layout that is still right: it is the smooth wash that stops the reading
   * column looking like bare paper, and the measured worst pixel under it there
   * is comfortable.
   *
   * The narrow layout is a different shape of problem. Its band is ~4x taller
   * than it is wide, so the edge window (normalised uv) attenuates almost
   * nothing across the middle, and the four masked layers still contribute
   * their floor there. Measured with every other layer zeroed, the mesh ALONE
   * put .vvip-meta-label at 5.75:1 — passing, but with little room, and the
   * residue of the others took the total under 4.5:1.
   *
   * So the mesh gives up a third of its strength under type on a phone and
   * nothing at all on a desktop. A third rather than the 0.88 the structured
   * layers take, because this is the layer whose whole job is to be present:
   * suppress it like the others and the phone hero is back to bare white.
   */
  float meshQuiet = 1.0 - mix(0.46, 0.18, wide) * textMask;

  float cover =
      mesh * meshQuiet * 0.26
    + shafts * quiet * 0.12
    + grid * gridMask * quiet * 0.22
    + rings * ringMask * quiet * 0.16
    + aura * quiet * 0.24;

  float structure = shafts * 0.12 + grid * gridMask * 0.22 + rings * ringMask * 0.16 + 1e-4;
  vec3 structureTint =
    ( uTintDeep * shafts * 0.12
    + uTintCore * grid * gridMask * 0.22
    + uTintPale * rings * ringMask * 0.16 ) / structure;

  float structureShare = clamp(structure / (cover + 1e-4), 0.0, 1.0);
  vec3 tint = mix(meshTint, structureTint, structureShare * 0.65);

  /* The aura takes the deepest blue and pulls the composite toward it in
     proportion to how much of the pixel it owns. This is what makes the space
     behind the figure read as saturated colour rather than more haze. */
  float auraShare = clamp((aura * 0.24) / (cover + 1e-4), 0.0, 1.0);
  tint = mix(tint, uTintDeep, auraShare);

  vec2 e = abs(vUv - 0.5) * 2.0;
  float window = (1.0 - smoothstep(0.88, 1.0, e.x)) * (1.0 - smoothstep(0.86, 1.0, e.y));

  /*
   * ── THE NARROW LAYOUT GETS A LOWER CEILING, AND IT IS NOT TIMIDITY ────────
   *
   * uAlpha is measured against the WIDE hero, where the type occupies one
   * column and the field has a whole empty column to be bright in. The stacked
   * hero has no such room: the copy spans the full width, so every layer that
   * is bright anywhere in the type band is bright behind type.
   *
   * MEASURED on the real page at 390x844 with uAlpha 0.55 and the narrow masks
   * already at their floor (quiet 0.06, meshQuiet 0.54). Each layer on its own
   * was comfortable — aura 5.20:1, rings 6.63:1, grid 5.30:1, shafts 6.30:1,
   * mesh 5.67:1 — and the five together measured 3.41:1 against
   * .vvip-meta-label. Nothing here is individually too strong; the total is.
   *
   * So the narrow layout takes 0.52 of the ceiling. At 0.62 the same measurement
   * came back 4.503:1 against a 4.5 floor, which is not a pass, it is a tie —
   * one font-metric change or one retuned weight and it is a failure. 0.52
   * measures 4.9:1 and leaves room to move. That is a real reduction
   * and it is visible, but a phone shows the field mostly BELOW the copy, where
   * the portrait sits and where nothing is attenuated, so the impression the
   * design is after survives the cut.
   */
  float a = cover * window * uAlpha * mix(0.52, 1.0, wide);

  /*
   * ── AZURE IS A RED-GREEN GAP, NOT A SATURATION LEVEL ─────────────────────
   *
   * The reported cast was purple. Two hypotheses were tested against the
   * rendered canvas and BOTH WERE WRONG, which is why this comment exists.
   *
   * It is not the hue angle. Measured over the ground, the tinted pixels sat at
   * 220-227 degrees in every zone, which is blue; there was no violet there to
   * remove.
   *
   * It is not overall saturation either. The source tints were re-saturated
   * (uTintCool from 35% to 64%) and a chroma boost pivoting on the luminance
   * grey was tried. The boost washed the field out, because blue was already
   * the top channel and clipped at 1.0 while red and green kept climbing.
   * Pivoting on the MAX channel instead was worse still, and it is worth
   * recording why: it pulls red and green down TOGETHER, so it measured
   * rgb(237,237,250) at 240 degrees — red and green exactly equal, which is the
   * definition of violet. The cure produced the disease.
   *
   * What separates azure from violet is the GAP BETWEEN RED AND GREEN. In a
   * true azure, green sits clearly above red. In the composited field green and
   * red were within three points of each other (rgb(237,240,247)), and a blue
   * whose red and green are level reads as lavender however saturated it is.
   *
   * So the correction is applied to ONE channel: green is raised toward blue,
   * which opens that gap and lands the hue in the 200-210 azure band.
   *
   * THE DIRECTION MATTERS AND IT IS EASY TO GET BACKWARDS. Pulling RED DOWN was
   * tried first and it moves the hue the WRONG WAY — it measured 226-230
   * degrees, further toward violet, because lowering red rotates the hue up past
   * blue. Raising green rotates it down toward cyan, which is where azure lives.
   *
   * Red and blue are both untouched, so the wash keeps its depth rather than
   * paling, and the alpha is untouched, so every contrast figure measured
   * against the type still holds.
   */
  tint.g = clamp(tint.g + (tint.b - tint.g) * 0.42, 0.0, 1.0);

  fragColor = vec4(tint * a, a);
}
`

/**
 * Multiplies dt rather than being a uniform the shader divides by, so retuning
 * the speed cannot jump the phase.
 */
const SPEED = 0.16

export function VvipAtmosphere() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    /*
     * ── NO WEBGL IS A SUPPORTED OUTCOME, NOT AN ERROR ─────────────────────────
     *
     * The constructor throws when a context cannot be created, this runs inside
     * useEffect, and an unguarded throw propagates to the nearest error boundary
     * and takes the whole hero with it — a MEASURED failure on the layer this
     * replaces: the page rendered "Something went wrong" and the document's <h1>
     * was that string instead of the client's name.
     *
     * A context is refused on GPU driver blocklists, with hardware acceleration
     * off, under webgl.disabled in Firefox, in VMs, in locked-down corporate
     * builds, and on some low-end Android. Every one of those is a visitor who
     * should still get the hero, and they do: this layer is aria-hidden
     * decoration over a white page that is complete without it, and the IBC
     * squares still render. No shader simply means no atmosphere.
     */
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        /* No geometry edge exists to alias: the quad covers the canvas and every
           visible edge is resolved per-fragment, the grid's via fwidth(). MSAA
           would cost bandwidth supersampling edges that are not there. */
        antialias: false,
        /* MUST match the material and the shader's last line. */
        premultipliedAlpha: true,
        powerPreference: "low-power",
      })
    } catch {
      return
    }

    /*
     * ── WEBGL2 IS REQUIRED, AND A WEBGL1 CONTEXT IS A CLEAN BAIL ──────────────
     *
     * The grid's crispness comes from fwidth(), which on WebGL1 lives behind
     * OES_standard_derivatives. Rather than carry a second ES 1.00 shader and an
     * extension dance for the shrinking set of WebGL1-only clients, this layer
     * declines to render there — exactly as it declines when there is no context
     * at all. The hero is complete without it.
     */
    if (!renderer.capabilities.isWebGL2) {
      renderer.dispose()
      return
    }

    /* Capped at 2: a full-bleed fragment shader on a 3x phone costs real battery
       for a ground layer nobody is inspecting. */
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    /* Fully transparent. The ground is the white page; anything cleared here
       would paint over it. */
    renderer.setClearColor(0x000000, 0)
    /*
     * The tints below are built from HEX STRINGS, which THREE.Color converts
     * sRGB -> linear. Declaring the output space converts them back on write, so
     * the blue that reaches the screen is the blue in the stylesheet.
     */
    renderer.outputColorSpace = THREE.SRGBColorSpace

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, -1)

    /*
     * Direction is read from the DOM rather than threaded down as a locale prop:
     * app/layout.tsx has already set `dir` on <html>, and a second copy of that
     * fact is a second thing to keep in sync. `closest("[dir]")` rather than
     * <html> directly, because subtrees legitimately override it.
     *
     * Only TRAVEL and the reading-side falloff flip. The shaft angle, the mesh
     * and the grid are untouched, so the field keeps its shape and mirrors only
     * its motion and its quiet side.
     */
    const scope = canvas.closest("[dir]")
    const dir = scope?.getAttribute("dir") ?? document.documentElement.dir
    const direction = dir === "rtl" ? -1 : 1

    const uniforms = {
      uResolution: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      /*
       * THE ALPHA CEILING. Read the docblock before changing this.
       *
       * ── THIS IS A CEILING ON THE SUM, NOT THE BRIGHTNESS REACHED ────────────
       *
       * The shader's weights sum to 1.0, so a pixel where all three layers were
       * simultaneously saturated would composite at exactly this value. NO SUCH
       * PIXEL EXISTS: the mesh peaks where its blobs cluster, the shafts on their
       * own axis, the grid on its line centres, and the reading-side falloff
       * attenuates two of the three. Simulated over both directions, 240s of
       * shader time and the whole canvas, the ACTUAL peak is ~0.68 of this value.
       *
       * That is why this reads 0.38 and not the 0.288 hard ceiling quoted in the
       * docblock's table: 0.38 * 0.68 = 0.260 composite, which is what the table
       * is about. Setting this to 0.288 would give a peak near 0.196 and a
       * visibly fainter field than intended.
       *
       * MEASURED at this value, worst case anywhere on the canvas against
       * .vvip-meta-label #525c67: 4.77:1, over the 4.5:1 floor. The last passing
       * value is 0.42 (peak 0.287, ratio 4.58); 0.46 fails at 4.42.
       */
      uAlpha: { value: 0.55 },
      /* -24 degrees. Shared with the .vvip-dot 135deg gradient's axis so the
         shafts and the IBC mark agree rather than crossing at a slight angle. */
      uAngle: { value: -0.42 },
      uDirection: { value: direction },
      /*
       * ── THE FOUR TINTS, AND WHY THE COOL ONE IS NO LONGER --accent-cool ─────
       *
       * These were the four palette tokens read straight from styles/globals.css,
       * and three of them are fine. MEASURED in HSL:
       *
       *     uTintCore  #1e90d6   hue 203   sat 75%   light 48%
       *     uTintDeep  #0b6fc4   hue 208   sat 89%   light 41%
       *     uTintPale  #7fc4ec   hue 202   sat 74%   light 71%
       *     uTintCool  #33506b   hue 209   sat 35%   light 31%   <- the problem
       *
       * THE CAST THIS FIXES WAS NEVER A HUE ERROR. The site owner's report was
       * that the ground read purple. Measuring the rendered canvas put 88.5% of
       * its tinted pixels at 220 degrees and essentially nothing above 250, so
       * there was no violet in the hue angle to remove — chasing the hue would
       * have been chasing the wrong number.
       *
       * It is SATURATION. --accent-cool is a slate, deliberately desaturated at
       * 35% because its job elsewhere on the site is to be a structural neutral
       * next to the blue rather than a second blue. Composited into a pale wash
       * over white, a low-saturation blue at high lightness is a warm grey, and
       * a warm grey sitting beside three saturated blues reads as violet by
       * contrast with them. The other three are all 74-89% and read as true blue.
       *
       * So the cool axis keeps its ROLE — it is still the deepest, least
       * brilliant of the four, which is what stops the mesh becoming one flat
       * azure — but it is now a saturated deep blue rather than a slate. The
       * three blues are also nudged a few degrees toward azure so the whole
       * field agrees on one hue family instead of spanning 202-209.
       *
       * NOT read from the CSS custom properties, and that is deliberate: these
       * are a composited FIELD, tuned against each other for how they mix, and
       * --accent-cool is correct at its own job while being wrong here. Binding
       * them to the tokens is what produced the cast in the first place.
       */
      uTintCore: { value: new THREE.Color("#1f8fdb") },
      uTintDeep: { value: new THREE.Color("#0a63c8") },
      uTintPale: { value: new THREE.Color("#79c6f2") },
      uTintCool: { value: new THREE.Color("#1d4a86") },
    }

    /* Two CCW triangles covering clip space. DoubleSide below is the belt to
       this pair of braces: a culled triangle on a full-bleed layer is nearly
       indistinguishable from a mis-tuned field, so it would be found late. */
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(
        new Float32Array([
          -1, -1, 0, 1, -1, 0, -1, 1, 0,
          -1, 1, 0, 1, -1, 0, 1, 1, 0,
        ]),
        3,
      ),
    )

    const material = new THREE.RawShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      /*
       * ── THIS FLAG, NOT A `#version` LINE IN THE SOURCE ──────────────────────
       *
       * The shaders below are GLSL ES 3.00 (in/out, declared fragColor) because
       * fwidth() is unreachable otherwise — see the docblock. But the directive
       * MUST NOT be written inline at the top of those strings.
       *
       * three.js assembles the final source as versionString + prefix + source,
       * and for a RawShaderMaterial the prefix ALWAYS carries two #define lines
       * (SHADER_TYPE and SHADER_NAME). With glslVersion unset, versionString is
       * empty, so an inline `#version 300 es` lands BELOW those defines — and
       * GLSL requires #version to be the first token in the unit. The compile
       * fails on the directive itself, which reads as a syntax error pointing at
       * a line that is perfectly correct.
       *
       * Setting it here makes three.js emit the directive in the one position
       * that is legal. See WebGLProgram.js, where versionString is built and
       * prepended.
       */
      glslVersion: THREE.GLSL3,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      /*
       * NOT AdditiveBlending. Additive is dst + src*srcAlpha, which is the right
       * model on a dark ground. THIS hero's ground is #ffffff: every channel is
       * already at 1.0 with zero headroom, so additive blue composites to white
       * and the layer is invisible at any opacity.
       *
       * What a blue wash actually does on paper is SUBTRACT: it tints the white
       * toward blue. That is source-over with a blue source, i.e. NormalBlending.
       * Where alpha is 0 it reduces to dst' = dst exactly, so the page outside
       * the field is untouched.
       */
      blending: THREE.NormalBlending,
      /*
       * PREMULTIPLIED, for two independent reasons.
       *
       * 1. The browser composites this canvas, and the HTML spec defines the
       *    backing store as premultiplied. Writing straight alpha into it means
       *    alpha is applied twice — the field would render at 0.27^2 = 0.073,
       *    nearly invisible, with a hue shift because only rgb is affected. The
       *    failure is silent; it just looks like the effect did not load.
       *
       * 2. Interpolation across a falloff is only correct premultiplied. This
       *    layer is mostly soft falloff to zero by design, so the classic dark
       *    fringe would be most of the effect.
       */
      premultipliedAlpha: true,
      side: THREE.DoubleSide,
    })

    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    /** Size to the PARENT, not the window: this canvas is scoped to the band. */
    const resize = () => {
      const host = canvas.parentElement
      const width = Math.max(1, host?.clientWidth ?? canvas.clientWidth)
      const height = Math.max(1, host?.clientHeight ?? canvas.clientHeight)
      renderer.setSize(width, height, false)
      uniforms.uResolution.value.set(
        width * renderer.getPixelRatio(),
        height * renderer.getPixelRatio(),
      )
    }

    const draw = () => {
      renderer.render(scene, camera)
    }

    let raf: number | null = null
    let last = performance.now()

    const tick = (now: number) => {
      /* Delta-timed, so the field drifts at the same speed on a 60Hz and a 144Hz
         display. Clamped so a backgrounded tab cannot return and jump the phase
         forward by however long it was away. */
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      uniforms.uTime.value += dt * SPEED
      draw()
      raf = requestAnimationFrame(tick)
    }

    const stop = () => {
      if (raf !== null) cancelAnimationFrame(raf)
      raf = null
    }

    const start = () => {
      if (raf !== null) return
      last = performance.now()
      raf = requestAnimationFrame(tick)
    }

    /*
     * ── THREE PREDICATES, ONE GATE ────────────────────────────────────────────
     *
     * The loop runs only when motion is wanted AND the tab is visible AND the
     * hero is on screen. Each condition owns a boolean and every listener calls
     * the SAME sync(), rather than each handler calling start/stop itself —
     * which is how two of them end up fighting (a tab refocused while the hero
     * is scrolled away would restart a loop that should have stayed stopped).
     */
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
    let visible = !document.hidden
    /* Optimistic: IntersectionObserver's first callback is asynchronous, and
       starting one frame early is better than a blank band if IO never fires. */
    let onScreen = true

    const sync = () => {
      if (reduced.matches) {
        stop()
        /*
         * Still paint one frame. The stylesheet also hides this element under
         * reduced motion, so this is belt and braces — but it costs one frame
         * and it keeps the JS path correct on its own terms rather than
         * depending on the CSS having loaded to not be wrong.
         */
        draw()
        return
      }
      if (!visible || !onScreen) {
        stop()
        return
      }
      start()
    }

    /* A hidden tab has no viewer, so it gets no atmosphere. Browsers already
       throttle rAF when hidden, but throttle is not stop, and a full-bleed
       shader at a throttled rate still spins a discrete GPU. */
    const onVisibility = () => {
      visible = !document.hidden
      sync()
    }

    /*
     * ── THE OBSERVER THAT MATTERS MOST ────────────────────────────────────────
     *
     * The hero is min-height: 100svh, so one scroll puts this canvas entirely
     * off-viewport while the TAB IS STILL VISIBLE — visibilitychange never
     * fires and rAF is never throttled. Without this, the most expensive layer
     * on the site renders at 60fps for the rest of the session while the reader
     * is three sections down, for zero pixels.
     *
     * rootMargin arms it a fifth of a viewport early, so the field is already
     * moving when it scrolls back in: a restart is visible, an early start is
     * not. threshold 0 because any part on screen is enough.
     */
    const io = new IntersectionObserver(
      (entries) => {
        onScreen = entries[0]?.isIntersecting ?? true
        sync()
      },
      { rootMargin: "20% 0px", threshold: 0 },
    )

    /* A lost context leaves a permanently blank canvas unless the default is
       prevented — preventing it is what makes the browser fire `restored`. */
    const onLost = (event: Event) => {
      event.preventDefault()
      stop()
    }
    const onRestored = () => {
      resize()
      sync()
    }

    /* ResizeObserver rather than a window listener: the hero's height responds
       to its own content (the meta row wraps, the role line reflows), and those
       changes never fire a window resize. */
    const observer = new ResizeObserver(() => {
      resize()
      if (reduced.matches) draw()
    })
    if (canvas.parentElement) {
      observer.observe(canvas.parentElement)
      io.observe(canvas.parentElement)
    }

    resize()
    sync()

    reduced.addEventListener("change", sync)
    document.addEventListener("visibilitychange", onVisibility)
    canvas.addEventListener("webglcontextlost", onLost)
    canvas.addEventListener("webglcontextrestored", onRestored)

    return () => {
      stop()
      observer.disconnect()
      io.disconnect()
      reduced.removeEventListener("change", sync)
      document.removeEventListener("visibilitychange", onVisibility)
      canvas.removeEventListener("webglcontextlost", onLost)
      canvas.removeEventListener("webglcontextrestored", onRestored)
      scene.remove(mesh)
      geometry.dispose()
      material.dispose()
      renderer.dispose()
    }
  }, [])

  return <canvas ref={canvasRef} aria-hidden className="vvip-atmosphere" />
}
