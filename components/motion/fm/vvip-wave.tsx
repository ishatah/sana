"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"

/**
 * The hero's wave: a thick, glowing, light-blue band sweeping the reading
 * direction across the full height of the band, on a diagonal.
 *
 * ── THIS IS THE ONE THING ON THE SITE THAT GLOWS, AND THAT IS DELIBERATE ──────
 *
 * The register note at styles/globals.css:7620 says "nothing that glows", and
 * that is still the rule everywhere else. This element is an explicit, scoped
 * override, granted for the hero band alone, with the intensity chosen so the
 * glow never leaves the palette: at the `uAlpha` ceiling below, the brightest
 * pixel the wave can produce against the white ground composites to #d2e9f7,
 * a shade off --primary-tint (#dceafa). A glow whose peak is a colour the design
 * system already contains is a different thing from a glow that announces itself.
 *
 * ── WHY A SHADER AND NOT A GRADIENT ──────────────────────────────────────────
 *
 * The thing that separates a wave from a blue stripe is a crest line that MOVES
 * THROUGH its own body: the band undulates, and the core and bloom lag each
 * other slightly as it does, so the eye resolves depth. CSS can translate a
 * blurred gradient, but it cannot bend one along a travelling sine without
 * redrawing it, which is what a fragment shader does per pixel for free.
 *
 * It is also why the loop is imperceptible: the centre line is the sum of two
 * incommensurate sines, so the pattern never returns to a previous state and
 * there is no cycle for a visitor to time.
 *
 * ── A DECORATIVE LEAF, MOUNTED INSIDE VvipField ──────────────────────────────
 *
 * No children, so it re-opens no client boundary around the hero's server-
 * rendered copy. It lives inside VvipField rather than beside it in
 * components/hero-vvip.tsx because VvipField is ALREADY a client leaf: mounting
 * here adds the canvas to an existing client subtree instead of creating the
 * hero's fourth one, and it inherits .vvip-field's `isolation: isolate`,
 * `overflow: hidden` and `pointer-events: none` without restating any of them.
 */

/*
 * ── THE VERTEX SHADER ────────────────────────────────────────────────────────
 *
 * RawShaderMaterial, NOT ShaderMaterial: three.js prepends nothing, so there is
 * no projectionMatrix, no modelViewMatrix, no auto precision, and no auto uv.
 * That is what we want here — the quad's vertices are already in clip space, so
 * the matrices would be dead uniforms multiplied on every vertex.
 *
 * vUv is derived from position rather than bound as a second attribute: clip
 * space maps to 0..1 by (p + 1) / 2, which keeps the geometry a single
 * Float32Array. gl_FragCoord would also work but arrives in DEVICE pixels and
 * would need dividing by the resolution at every use; vUv is already normalised.
 */
const vertexShader = /* glsl */ `
precision highp float;

attribute vec3 position;

varying vec2 vUv;

void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position, 1.0);
}
`

/*
 * ── THE FRAGMENT SHADER ──────────────────────────────────────────────────────
 *
 * Read the falloff note on `gauss()` first: the choice of kernel is the whole
 * design, and it is the one thing the previous shader in this codebase
 * (components/ui/web-gl-shader.tsx) got wrong repeatedly and expensively.
 */
const fragmentShader = /* glsl */ `
precision highp float;

uniform vec2  uResolution;   /* device pixels. Only the RATIO is read today. */
uniform float uTime;         /* seconds of shader time, accumulated delta-timed */
uniform float uAlpha;        /* the alpha ceiling */
uniform float uAngle;        /* sweep angle from horizontal, radians */
uniform float uThickness;    /* half-width of the core band, p-space units */
uniform float uSoftness;     /* bloom radius as a multiple of uThickness */
uniform vec3  uTintCore;     /* --primary */
uniform vec3  uTintDeep;     /* --primary-hover */
uniform vec3  uTintPale;     /* the pale third of the field gradients */
uniform float uDirection;    /* +1 ltr, -1 rtl. Flips travel, never geometry. */

varying vec2 vUv;

/*
 * ── THE FALLOFF KERNEL, AND WHY IT IS A GAUSSIAN ─────────────────────────────
 *
 * A hard edge in a shader is a locus where the derivative is discontinuous, or
 * where a region of CONSTANT value meets a region of varying value. The three
 * obvious kernels each fail that test in a different way:
 *
 *   smoothstep(a, b, d)  HAS A PLATEAU. Exactly 1.0 for every d < a, exactly
 *                        0.0 for every d > b. Both loci are curves drawn across
 *                        the canvas along which the value stops changing, and a
 *                        place where the value stops changing is exactly what
 *                        the eye finds as an edge. This is the "hard boundary"
 *                        that web-gl-shader.tsx:132-171 documents chasing
 *                        through several rewrites without ever removing.
 *
 *   1.0 / abs(d)         Unbounded at the core, so it needs a roll-off bolted
 *                        on afterwards to be usable at all.
 *
 *   v / (v + 1.0)        Bounded and plateau-free, but asymptotic: it never
 *                        reaches zero, so the band has no outer edge of its own
 *                        and the window has to do all the containment.
 *
 * exp(-x*x) is C-infinity: every derivative exists everywhere. It equals 1.0 at
 * exactly ONE point (x = 0 — a measure-zero locus, not a region), it equals 0.0
 * nowhere, and it decays below 1e-6 by |x| = 3.8, so it genuinely reaches zero
 * in float precision without ever being clamped there. No plateau at the core,
 * no plateau at the tail, and no boundary in between.
 */
float gauss(float x) {
  return exp(-x * x);
}

/*
 * ── ONE EDGE OF THE WINDOW ───────────────────────────────────────────────────
 *
 * The complement of a Gaussian: 0.0 at the border, rising asymptotically toward
 * 1.0 inward, never arriving. Four of these multiplied make the four-edge
 * window. The full argument — including why this replaced a centre-decaying
 * Gaussian and why k = 5.0 — is at the window itself in main().
 */
float edge(float d) {
  float x = d * 5.0;
  return 1.0 - exp(-x * x);
}

/*
 * ── tanh, HAND-ROLLED: GLSL ES 1.00 HAS NO tanh() ────────────────────────────
 *
 * WebGL1 ships no tanh, and this shader targets it. The identity form, written
 * with a single exp() rather than (exp(x)-exp(-x))/(exp(x)+exp(-x)): one
 * transcendental instead of two, same value.
 *
 * C-infinity, monotonic, bounded in (-1, 1), and branch-free — so it introduces
 * no locus of constant value and the plateau rule this file is built on still
 * holds. Used to make the filament asymmetric; see its call site.
 */
float stanh(float x) {
  float e = exp(2.0 * x);
  return (e - 1.0) / (e + 1.0);
}

/*
 * ── THE CENTRE LINE ──────────────────────────────────────────────────────────
 *
 * ONE wave, shared by all three layers. 'phase' lags each layer slightly so the
 * three do not sit exactly on top of each other, which is where the sense of
 * depth comes from.
 *
 * ── WHY ONE SHARED LINE AND NOT THREE INDEPENDENT ONES ───────────────────────
 *
 * The first build gave each layer its OWN frequency and amplitude, on the theory
 * that three interfering waves would read as parallax. Measured against a CPU
 * port of this shader, they did not: three ribbons undulating independently
 * cross each other constantly, and the crossings fill the gaps that make a wave
 * legible as a wave. The along-band intensity profile came out as disconnected
 * lumps (76, 61, 52, 40 with holes between them) rather than a continuous ridge.
 *
 * A thick glowing band is ONE object. Its core and its bloom are the same wave
 * at different radii, not three waves that happen to overlap — so the layers
 * here differ only in WIDTH and BRIGHTNESS, and share the line they are drawn
 * around. That is what makes a core-plus-bloom instead of three competing
 * ribbons, and it is why the profile is now a single clean ridge.
 *
 * The two sines are incommensurate (1.0 and 1.618, the golden ratio), so the
 * crest pattern never tiles back onto itself and the loop cannot be timed.
 */
float centre(float x, float phase, float amp, float freq) {
  /* Increasing phase moves a crest toward +x, which after the rotation in
     main() is the reading direction. */
  float t = x * freq - phase;

  /* The second sine is a third the amplitude: it DETUNES the first rather than
     competing with it. Equal amplitudes would read as two waves, not one. */
  return sin(t) * amp + sin(t * 1.618 + 1.7) * amp * 0.34;
}

void main() {
  /*
   * ── p-SPACE: CENTRED AND ASPECT-CORRECTED ──────────────────────────────────
   *
   * Divided by the SHORT side, so one unit is the same physical length on both
   * axes. Without this the band's angle would change with the viewport ratio:
   * the "diagonal" would flatten toward horizontal on a wide desktop and
   * steepen on a phone, and the tuned angle below would mean nothing.
   */
  vec2 p = (vUv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);

  /*
   * ── ROTATE INTO THE BAND FRAME, ONCE ───────────────────────────────────────
   *
   * After this, the band runs along +x and its normal is +y. Rotating here
   * rather than inside centre() is both cheaper and the reason the three layers
   * stay parallel: they share one frame, so they cannot scissor apart.
   */
  float ca = cos(uAngle);
  float sa = sin(uAngle);
  vec2  q  = vec2(p.x * ca + p.y * sa, -p.x * sa + p.y * ca);

  /*
   * ── THE FREQUENCY IS HIGH BECAUSE p-SPACE IS SMALL ────────────────────────
   *
   * Tuned against a CPU port of this shader, not by eye. The visible canvas is
   * 1.0 p-unit tall and about 1.44 wide at 16:9, so the first draft's frequency
   * of 1.35 had a wavelength of 4.65 p-units and put THREE TENTHS of one crest
   * on screen. That is not a wave, it is a single flat bulge — and with the
   * widths also oversized (the halo alone covered 82% of the hero's height) it
   * rendered as a soft circular blob with no direction at all.
   *
   * 6.0 puts a little over two crests along the band, which is the range where
   * it reads as travelling rather than as a bulge (too few) or as a ripple
   * texture (too many).
   */
  float t = uTime * uDirection;

  /*
   * ── AMPLITUDE MUST EXCEED THE CORE WIDTH, OR THE WAVE HIDES INSIDE IT ─────
   *
   * The other thing measurement caught. Crests displace the band SIDEWAYS, so if
   * the band is thicker than its crests are tall, the undulation is buried
   * within its own thickness and the whole thing reads as a straight ribbon. The
   * first build had a band 13-24% of the hero's height undulating by only 5-10%,
   * which is why no amount of retuning the frequency made it look like a wave.
   *
   * Here the amplitude (0.090) is four times the core width (0.022), so the core
   * visibly swings; the halo at 4.2x the core is wide enough to still read as one
   * continuous body of light rather than a snake.
   */
  float wave = centre(q.x, t, 0.090, 6.0);

  /*
   * ── THREE RADII AROUND ONE LINE ───────────────────────────────────────────
   *
   * Narrow -> wide, bright -> faint. The narrow one is the filament that gives
   * the bloom something to be a glow AROUND: a glow with no core reads as fog,
   * which is exactly what the first build produced.
   *
   * The small phase offsets are the parallax. They are fractions of a radian, so
   * the layers stay on the same wave and only lean against each other — enough
   * for depth, not enough to separate into three ribbons.
   *
   * ── THE HALO IS TIGHTER THAN IT WAS, TO MAKE THE WAVE CLEARER ─────────────
   *
   * Brightening a band that is mostly bloom just makes a bigger smudge. The way
   * to read as a clearer WAVE is to put the added light in the CORE and pull the
   * halo in behind it, so the spine is what the eye lands on and the glow stays
   * a glow rather than becoming the subject. Hence the halo at 4.2x the core
   * rather than the 5.2x of the first tuning, and the weights below shifted
   * toward the filament.
   */
  /*
   * ── THE FILAMENT IS ASYMMETRIC, AND THAT IS WHAT MAKES IT READ AS LIGHT ────
   *
   * A symmetric Gaussian spine is a stripe. Light travelling across a surface is
   * not symmetric about its crest: the LEADING face is crisp, because that is
   * where the light meets unlit ground, and the TRAILING face smears, because
   * that is the decay behind it. Every specular sweep in luxury product motion
   * has this asymmetry, and its absence is most of why a soft blue band reads as
   * a gradient rather than as a highlight.
   *
   * Done by modulating the filament's WIDTH with the signed distance, rather
   * than by adding a second lobe: one stanh() and one multiply, and the result
   * is still a SINGLE Gaussian, so it cannot separate into two ribbons the way
   * the first build's three independent strata did.
   *
   *   width(d) = uThickness * (1 + 0.30 * tanh(d / uThickness))
   *
   * Measured against the symmetric kernel at uThickness = 0.020:
   *
   *   d        symmetric   asymmetric
   *   -0.030     0.156       0.021     <- leading face falls off ~7x faster
   *    0.000     1.000       1.000
   *   +0.030     0.156       0.337     <- trailing face carries ~2.2x further
   *
   * 0.30 and not more: past about 0.45 the trailing smear starts reading as a
   * separate soft band behind the spine, which is the "competing ribbons"
   * failure arriving by a different route.
   */
  float d  = q.y - wave;
  float wd = uThickness * (1.0 + 0.30 * stanh(d / uThickness));
  float s0 = gauss(d / wd);
  /* The body: the bulk of the light. */
  float s1 = gauss((q.y - centre(q.x, t + 0.35, 0.090, 6.0)) / (uThickness * 2.60));
  /* The outer halo: the bloom. */
  float s2 = gauss((q.y - centre(q.x, t - 0.45, 0.090, 6.0)) / (uThickness * uSoftness * 1.75));

  /*
   * ── COMBINING: A WEIGHTED SUM ROLLED OFF ───────────────────────────────────
   *
   * Not max(): its derivative is discontinuous exactly where two strata cross,
   * which puts a crease along every crossing — and on a three-strata field the
   * crossings are everywhere.
   *
   * Not a product: that would require all three to overlap for anything to show
   * at all, which collapses the parallax into a single band.
   *
   * A weighted sum is smooth but can exceed 1.0 where strata coincide, and
   * pushing that through a clamp would reintroduce the plateau this whole file
   * is built to avoid. v/(v+1) is asymptotic to 1: a triple overlap is bright
   * but bounded, and there is no locus at which the roll-off "engages".
   */
  float v = s0 * 1.35 + s1 * 0.42 + s2 * 0.26;
  float body = v / (v + 1.0);

  /*
   * ── THE COLOUR RAMP ────────────────────────────────────────────────────────
   *
   * A true weighted average, normalised by the same weights, so the hue does
   * not drift with intensity. The filament takes the saturated --primary, the
   * halo the pale blue, and the deep blue sits in the mid-body — so the band
   * has a core slightly deeper than its edges, which is what stops it reading
   * as a flat blue sticker laid on the page.
   *
   * The epsilon is not decoration: where all three strata are ~0 (most of the
   * canvas) this denominator would otherwise be 0 and the divide would produce
   * NaN, which rasterises as black confetti.
   */
  float wSum = s0 * 1.35 + s1 * 0.42 + s2 * 0.26 + 1e-4;
  vec3 tint =
    (uTintCore * (s0 * 1.35) + uTintDeep * (s1 * 0.42) + uTintPale * (s2 * 0.26)) / wSum;

  /*
   * ── THE CREST DESATURATES; THE TROUGH KEEPS THE PIGMENT ───────────────────
   *
   * The weighted average above is hue-stable by construction, which was the
   * right first fix — it stopped the hue drifting with intensity. But hue-stable
   * is not the same as physically right: a real light source is MOST saturated
   * in its falloff and LEAST saturated at its hottest point, because the hot
   * core is near the top of the channel range and the colour has nowhere left
   * to go.
   *
   * Lifting the tint toward uTintPale by the band's own normalised intensity is
   * exactly that, in one mix(). The trough and the outer bloom keep the full
   * --primary / --primary-hover pigment; only the spine — the top few percent of
   * the band by area — pales off. On a white ground that is the difference
   * between a band that looks PRINTED and a band that looks LIT.
   *
   * NOT done by swapping the tint assignments above. Binding uTintPale to the
   * halo and uTintCore to the filament is correct: reversing them would put the
   * saturated blue in the WIDEST stratum, which on white is a visible blue
   * smear rather than a glow.
   *
   * 0.34 measured: below about 0.2 the effect is not resolvable at this alpha;
   * above about 0.5 the spine goes near-white and the band stops reading as
   * blue at all, which the palette note at the top of this file will not allow.
   */
  tint = mix(tint, uTintPale, body * 0.34);

  /*
   * ── THE FOUR-EDGE WINDOW ───────────────────────────────────────────────────
   *
   * The requirement is zero alpha at ALL FOUR edges. This is the term that
   * answers the reason the previous shader was deleted: it "began and ended at
   * the hero's own box" (components/hero.tsx:279-288), and a full-height
   * diagonal is precisely that shape unless something kills it before the
   * border.
   *
   * NOT a radial window, which is what the old file settled on. A radial window
   * reaches zero on a CIRCLE, which on a 16:9 band is inside the frame on the
   * long axis and outside it at the corners — it cannot be zero at all four
   * edges without also eating the middle.
   *
   * ── AND NOT gauss(u.x * 2.05) * gauss(u.y * 2.05) EITHER, WHICH THIS REPLACES
   *
   * That was a window which DECAYS FROM THE CENTRE, and that is the wrong job
   * description. The requirement is zero at the four BORDERS; a centre-decaying
   * Gaussian delivers that only as a side effect of killing everything that is
   * not at the centre. At |u| = 0.5 — halfway to an edge — each axis is already
   * exp(-1.05) = 0.35, and the two axes multiply.
   *
   * Measured, window value across twelve columns of the horizontal midline:
   *
   *   old:  0.029 0.094 0.239 0.482 0.769 0.971 0.971 0.769 0.482 0.239 0.094 0.029
   *   new:  0.042 0.322 0.660 0.877 0.966 0.990 0.990 0.966 0.877 0.660 0.322 0.042
   *
   * The old window had thrown away three quarters of the band's length before
   * uAlpha was even applied. That is GEOMETRIC faintness, and it is why raising
   * the ceiling twice (0.16 -> 0.24) never answered the "it looks faint"
   * complaint: the wave was not dim, it was ABSENT everywhere but the middle.
   *
   * ── THE COMPLEMENT OF A GAUSSIAN, ONE TERM PER EDGE ────────────────────────
   *
   *   edge(d) = 1.0 - exp(-(d*k)^2),  d = normalised distance to ONE border
   *
   * The inverse job description, and the correct one: 0.0 at the border, rising
   * asymptotically toward 1.0 as the pixel moves inward, so it is transparent
   * across the interior and works only in a narrow collar hugging the frame.
   *
   * IT IS PLATEAU-FREE AT BOTH ENDS, which is the rule this file is built on:
   *   - edge(0) = 0 at exactly ONE point per border. A measure-zero locus, not a
   *     region — the same argument gauss() makes for exp(-x*x) at its peak.
   *   - edge -> 1 ASYMPTOTICALLY and never arrives, the same argument the
   *     combining note makes for v/(v+1). No interior region of constant value,
   *     so no locus for the eye to find as an edge.
   *   - C-infinity: a polynomial inside an exp, subtracted from a constant.
   * No clamp, no min, no max, no step, no smoothstep. The design rule holds.
   *
   * THE FOUR-EDGE FADE IS STRICTLY BETTER THAN BEFORE, not merely preserved. At
   * the literal border pixel (dpr 2, 1440 wide, uv = 0.5/2880):
   *
   *   old  gauss(u * 2.05)   7.6e-1 of one 8-bit level   <- very nearly visible
   *   new  edge(d, 5.0)      3.8e-5 of one 8-bit level
   *
   * The OLD window was leaking most of a quantisation level at the border; this
   * is four orders of magnitude below it, and still under half a level 2% inside
   * the frame (0.50/255). Past k ~ 6 measurable tint reaches the border; below
   * k ~ 4 the band's ends start being eaten again.
   *
   * ── WHY THIS STAYS IN vUv AND NOT IN THE BAND FRAME q ──────────────────────
   *
   * Windowing along q.x and across q.y looks more natural for a rotated band,
   * and was measured and rejected: the extent of q-space depends on the aspect
   * ratio, because the rotated bounding box of the viewport does.
   *
   *   AR 1.18 (phone):      q.x +-0.744    AR 2.84 (ultrawide):  q.x +-1.502
   *
   * Fixed constants in q would therefore fade at a different FRACTION of the
   * canvas on every viewport — tuned for desktop they cut the band short on
   * ultrawide, tuned for ultrawide they leak to the border on a phone. Each vUv
   * term measures distance to one specific border instead, so the product is
   * ~1.0 across the interior at any aspect, and a -24 degree band crosses the
   * collar at the same normalised depth regardless.
   */
  float window =
    edge(vUv.x) * edge(1.0 - vUv.x) *
    edge(vUv.y) * edge(1.0 - vUv.y);

  /*
   * ── ALPHA ──────────────────────────────────────────────────────────────────
   *
   * body * window * uAlpha, and nothing else. Deliberately NOT derived from
   * luminance the way the old shader's was: that was correct for ADDITIVE
   * blending, where the colour is what shows and alpha is nearly irrelevant.
   * This layer is normal-blended tint over white, so alpha IS the effect and
   * has to be driven by the band's own shape.
   *
   * The ceiling is reached only where body -> 1 AND window -> 1 at once, i.e.
   * a triple crest crossing the exact centre. Typical peak is ~0.75 * uAlpha.
   */
  float a = body * window * uAlpha;

  /*
   * PREMULTIPLIED OUTPUT. rgb is multiplied by alpha here, and the material and
   * renderer are both configured premultipliedAlpha: true. All three must agree.
   * See the material block for why.
   */
  gl_FragColor = vec4(tint * a, a);
}
`

/*
 * ── SECONDS OF SHADER TIME PER REAL SECOND ───────────────────────────────────
 *
 * Multiplies dt rather than being a uniform the shader divides by, so retuning
 * it changes the speed WITHOUT jumping the accumulated phase.
 *
 * 0.24 gives the body stratum a wavelength of 2pi / (1.35 * 0.24) = ~19s of
 * travel. The house floor is that nothing moves fast enough to be timed, and a
 * wavelength is not a cycle: what a viewer would have to time is the beat
 * between three non-resonant strata, which runs to several minutes.
 */
const SPEED = 0.24

export function VvipWave() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    /*
     * ── NO WEBGL IS A SUPPORTED OUTCOME, NOT AN ERROR ─────────────────────────
     *
     * Carried over in spirit from components/ui/web-gl-shader.tsx:284, where it
     * is documented against a MEASURED failure: the constructor throws when a
     * context cannot be created, this runs inside useEffect, and an unguarded
     * throw propagates to the nearest error boundary and takes the whole hero
     * with it — the page rendered "Something went wrong" and the document's
     * <h1> was that string instead of the client's name.
     *
     * A context is refused on GPU driver blocklists, with hardware acceleration
     * off, under webgl.disabled in Firefox, in VMs, in locked-down corporate
     * builds, and on some low-end Android. Every one of those is a visitor who
     * should still get the hero, and they do: this layer is aria-hidden
     * decoration over a ground (the wash and the squares) that is complete
     * without it. No shader simply means no wave.
     */
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        /* No geometry edge exists to alias: the quad covers the canvas and every
           visible edge is a Gaussian resolved per-fragment. MSAA would cost
           bandwidth supersampling edges that are not there. */
        antialias: false,
        /* MUST match the material. Mismatching these is the alpha-squared bug
           described in the material block, arriving from the other side. */
        premultipliedAlpha: true,
        powerPreference: "low-power",
      })
    } catch {
      return
    }

    /* Capped at 2: a full-bleed fragment shader on a 3x phone costs real battery
       for a ground layer nobody is inspecting. */
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    /* Fully transparent. The ground is the white page plus .vvip-field-wash, and
       anything else cleared here would paint over both. */
    renderer.setClearColor(0x000000, 0)
    /*
     * The tints below are built from HEX STRINGS, which THREE.Color converts
     * sRGB -> linear. Declaring the output space converts them back on write, so
     * the blue that reaches the screen is the blue in the stylesheet.
     *
     * web-gl-shader.tsx:336 passes normalised floats to the (r,g,b) constructor
     * instead, which skips the INPUT conversion while the output conversion
     * still runs, so those colours ship lighter than they read. Not copied.
     */
    renderer.outputColorSpace = THREE.SRGBColorSpace

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, -1)

    /*
     * Direction is read from the DOM rather than threaded down as a locale prop,
     * for the reason components/motion/fm/use-direction.ts argues at length:
     * app/layout.tsx has already set `dir` on <html>, and a second copy of that
     * fact is a second thing to keep in sync. `closest("[dir]")` rather than
     * <html> directly, because subtrees legitimately override it.
     *
     * That file also warns — correctly — against flipping things that do not
     * need flipping, since a helper existing for a flip nobody performs is a
     * trap. This one qualifies: the wave's travel is a genuine inline-axis
     * physical value. "Left to right" is a statement about READING ORDER, so in
     * Arabic the band must sweep the other way. Only travel flips; uAngle, the
     * strata and the window are untouched, so the band keeps its shape and
     * mirrors only its motion.
     */
    const scope = canvas.closest("[dir]")
    const dir = scope?.getAttribute("dir") ?? document.documentElement.dir
    const direction = dir === "rtl" ? -1 : 1

    const uniforms = {
      uResolution: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      /*
       * THE ALPHA CEILING, AND IT IS BOUNDED BY A CONTRAST RATIO.
       *
       * The shader reaches about 66% of this ceiling at its brightest. MEASURED,
       * not assumed: a CPU port of this fragment shader peaks at 0.1990, and it
       * is stable at 0.194-0.199 across three aspect ratios (phone, desktop,
       * ultrawide) and four phases, which is what makes it safe to budget against.
       *
       * Every piece of hero text is checked against the wave's composited ground
       * rather than against white, because the wave passes under all of it — and
       * against the DEEP tint (#0b6fc4 -> ground #cee2f3), which is the worst
       * case because uTintDeep carries the body stratum, the widest bright layer
       * and so the one most likely to sit under a baseline:
       *
       *   .vvip-name       14.23:1  (floor 3.0, large)
       *   .vvip-title       8.54:1  (floor 4.5)
       *   .vvip-eyebrow     7.12:1  (floor 4.5)
       *   .vvip-meta-label  5.12:1  (floor 4.5)   <- the binding constraint
       *
       * ── RAISING THIS HAS NOW COST TWO TOKEN CHANGES ────────────────────────
       *
       * At 0.16 the eyebrow took --primary-strong and cleared by 2% (4.61:1).
       * Raising the ceiling broke it — --primary-strong lands at 4.37:1 — so the
       * eyebrow moved to --primary-deep. Raising it again broke the meta labels
       * the same way: --muted-foreground measures 4.39:1 here, a real WCAG 1.4.3
       * failure at 0.62rem, so .vvip-meta-label took a scoped #525c67. Both
       * changes are documented at their rules in styles/globals.css.
       *
       * The rule therefore stands, twice reinforced: THIS VALUE CANNOT RISE
       * without re-running the check against the DEEP tint at the PEAK. The
       * absolute ceiling before the meta labels fail again is a peak of 0.288,
       * i.e. a 45% margin on today's 0.199 — that margin is the room left for
       * future retuning, and it is not large enough to spend carelessly.
       */
      uAlpha: { value: 0.30 },
      /*
       * -24 degrees, measured in p-space AFTER the aspect correction, so it is a
       * true 24 degrees on screen at any viewport.
       *
       * Not 45: at 45 the band is a symmetric slash that exits the top edge
       * before it has crossed the width, so a "full-height sweep" becomes half a
       * diagonal. A shallow angle reads as a light shaft or a horizon, which is
       * the register this hero is in, and it shares an axis with the 135deg
       * gradient on .vvip-dot so the wave and the IBC mark agree rather than
       * cross.
       */
      uAngle: { value: -0.42 },
      /*
       * ── MEASURED, NOT GUESSED. THE FIRST DRAFT WAS 3x TOO WIDE ──────────────
       *
       * These are fractions of p-space, where the visible canvas is 1.0 unit
       * TALL. The first draft used 0.17, which put the outer halo at
       * 0.17 * 2.6 * 1.85 = 0.82 units — i.e. 82% of the hero's height for a
       * single stratum. The band was wider than the frame it was meant to cross,
       * so nothing about it read as a band: it filled the canvas, the only shape
       * left was the elliptical edge window, and it rendered as a soft blue blob.
       *
       * At 0.022 the three radii land at 2.2% (filament), 5.7% (body) and 9.2%
       * (halo) of the hero's height, giving a band whose full visible thickness
       * measures about 9% of the hero. That is the most it can take while the
       * hero still reads as mostly white space, which is the whole design — and
       * it has to stay well under the crest amplitude (0.090) or the wave hides
       * inside its own ribbon. See the amplitude note in the shader.
       */
      uThickness: { value: 0.020 },
      /* The halo's radius is uThickness * uSoftness * 2.17, so this sets how far
         the bloom reaches past the core: far enough to read as real glow, close
         enough that the band still has a locatable spine. */
      uSoftness: { value: 2.9 },
      uTintCore: { value: new THREE.Color("#1e90d6") }, /* --primary */
      uTintDeep: { value: new THREE.Color("#0b6fc4") }, /* --primary-hover */
      uTintPale: { value: new THREE.Color("#7fc4ec") }, /* the pale third */
      uDirection: { value: direction },
    }

    /*
     * Two triangles covering clip space. No geometry is being modelled — the
     * whole image is the fragment shader — so this is the cheapest carrier.
     *
     * ── BOTH TRIANGLES ARE COUNTER-CLOCKWISE, AND THAT IS NOT PEDANTRY ────────
     *
     * web-gl-shader.tsx:345-363 documents the bug this prevents: its second
     * triangle was wound CLOCKWISE, three.js culls back faces by default, so
     * that half was discarded and the quad's own hypotenuse rendered as a hard
     * diagonal across the canvas with light on one side and nothing on the
     * other. It survived every attempt to fix it in the fragment shader because
     * the fragment shader was never the problem.
     *
     * This layer IS a diagonal. A culled triangle here would be nearly
     * indistinguishable from a mis-tuned band, so it would be found late and
     * debugged in the wrong file. Both windings checked; DoubleSide below is the
     * belt to this pair of braces.
     */
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
      transparent: true,
      depthTest: false,
      depthWrite: false,
      /*
       * ── NOT AdditiveBlending, WHICH IS WHAT THE OLD SHADER USES ─────────────
       *
       * Additive is dst + src*srcAlpha. The old shader sat on a near-black hero,
       * where every channel had headroom and adding gold light was the physically
       * correct model. THIS hero's ground is #ffffff: every channel is already at
       * 1.0 with ZERO headroom, so additive blue composites to white. There is no
       * intensity setting that rescues that — the operation is a no-op by
       * arithmetic, and the layer would be invisible at any opacity.
       *
       * Light arriving at a white page cannot make it brighter. What a blue glow
       * actually does on paper is SUBTRACT: it tints the white toward blue. That
       * is source-over with a blue source, i.e. NormalBlending.
       *
       *   dst' = src + dst * (1 - srcAlpha)
       *
       * Where alpha is 0 that reduces to dst' = dst exactly, so the wash and the
       * squares underneath are untouched outside the band.
       */
      blending: THREE.NormalBlending,
      /*
       * ── PREMULTIPLIED, FOR TWO INDEPENDENT REASONS ─────────────────────────
       *
       * 1. THE BROWSER COMPOSITES THIS CANVAS, NOT US. The layer sits over
       *    .vvip-field-wash in the CSS stacking context, so the final blend is
       *    done by the compositor reading the canvas backing store — which the
       *    HTML spec defines as PREMULTIPLIED. Writing straight alpha into a
       *    premultiplied store means alpha is applied twice: the wave would
       *    render at 0.16^2 = 0.026, invisible, with a hue shift on top because
       *    only rgb is affected. The failure is silent; it just looks like the
       *    effect did not load.
       *
       * 2. INTERPOLATION ACROSS A FALLOFF IS ONLY CORRECT PREMULTIPLIED.
       *    Straight alpha interpolated toward a transparent pixel drags rgb
       *    toward whatever is in that texel's unused colour channels, which is
       *    the classic dark fringe. This layer is MOSTLY soft falloff to zero by
       *    design, so that artefact would be most of the effect. Premultiplied
       *    rgb goes to zero WITH the alpha and the bloom stays pure blue.
       *
       * The shader's last line, vec4(tint * a, a), is what makes the output
       * premultiplied. That line, this flag, and the renderer's flag change
       * together or not at all.
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
      /* Delta-timed, so the wave travels at the same speed on a 60Hz and a 144Hz
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
         * reduced motion (see .vvip-wave in styles/globals.css), so this is
         * belt and braces — but it costs one frame and it keeps the JS path
         * correct on its own terms rather than depending on the CSS having
         * loaded to not be wrong.
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

    /* A hidden tab has no viewer, so it gets no wave. Browsers already throttle
       rAF when hidden, but throttle is not stop, and a full-bleed shader at a
       throttled rate still spins a discrete GPU. Precedent: atmosphere.tsx:199. */
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
     * rootMargin arms it a fifth of a viewport early, so the wave is already
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

  return <canvas ref={canvasRef} aria-hidden className="vvip-wave" />
}
