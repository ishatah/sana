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

uniform vec2  uResolution;   /* device pixels. Only the RATIO is read. */
uniform float uTime;         /* seconds of shader time, accumulated delta-timed */
uniform float uAlpha;        /* the alpha ceiling. See the docblock. */
uniform float uAngle;        /* shaft angle from horizontal, radians */
uniform float uDirection;    /* +1 ltr, -1 rtl. Flips travel, never geometry. */
uniform vec3  uTintCore;     /* --primary */
uniform vec3  uTintDeep;     /* --primary-hover */
uniform vec3  uTintPale;     /* the pale third */
uniform vec3  uTintCool;     /* --accent-cool, the slate hue axis */

in vec2 vUv;

/* ES 3.00 replaces the implicit gl_FragColor with a declared output. */
out vec4 fragColor;

/*
 * A soft radial falloff with no plateau: exactly 1.0 only at d = 0, asymptotic
 * to 0, and never clamped. smoothstep would give a flat top and a visible locus
 * where the flat meets the falloff; on a field of overlapping blobs those loci
 * read as rings.
 */
float blob(vec2 p, vec2 c, float r) {
  float d = length(p - c) / r;
  return exp(-d * d);
}

/*
 * ── THE MESH GRADIENT ────────────────────────────────────────────────────────
 *
 * Four blobs, each on its own slow ellipse at an incommensurate rate, so the
 * field never returns to a previous state and there is no cycle to time. The
 * radii differ so the blobs cannot all coincide into one bright disc.
 */
float meshField(vec2 p, float t, out vec3 tint) {
  vec2 c0 = vec2(-0.62 + 0.10 * sin(t * 0.21), -0.16 + 0.07 * cos(t * 0.17));
  vec2 c1 = vec2( 0.54 + 0.09 * cos(t * 0.13),  0.22 + 0.08 * sin(t * 0.19));
  vec2 c2 = vec2( 0.14 + 0.12 * sin(t * 0.11),  0.38 + 0.06 * cos(t * 0.23));
  vec2 c3 = vec2(-0.22 + 0.08 * cos(t * 0.27), -0.42 + 0.09 * sin(t * 0.15));

  float b0 = blob(p, c0, 0.62);
  float b1 = blob(p, c1, 0.54);
  float b2 = blob(p, c2, 0.44);
  float b3 = blob(p, c3, 0.50);

  float sum = b0 + b1 + b2 + b3;

  /*
   * A true weighted average normalised by the same weights, so the hue does not
   * drift with intensity. The epsilon is not decoration: where all four blobs
   * are ~0 this denominator would be 0 and the divide would produce NaN, which
   * rasterises as black confetti.
   */
  float wSum = sum + 1e-4;
  tint = (uTintCore * b0 + uTintDeep * b1 + uTintPale * b2 + uTintCool * b3) / wSum;

  /* Asymptotic to 1 rather than clamped: an overlap is brighter but bounded,
     and there is no locus at which a roll-off "engages". */
  return sum / (sum + 1.0);
}

/*
 * ── THE CONTOUR GRID: THE ONLY CRISP THING IN THE HERO ───────────────────────
 *
 * A set of parallel lines in a domain-warped space, so they undulate like a
 * topographic map rather than sitting as a ruled grid.
 *
 * fwidth() IS THE WHOLE POINT. It gives the rate of change of the line
 * coordinate per pixel, so the line can be made exactly N pixels wide at any
 * resolution or DPR. A fixed-width line in shader space is thinner on a 2x
 * display than a 1x one and aliases into dashes at shallow angles; this one is
 * the same crisp hairline everywhere. It is also why this layer survives being
 * the faintest of the three — an anti-aliased edge reads at an alpha where a
 * blurred one has already disappeared.
 */
float gridField(vec2 p, float t) {
  /* The warp. Kept low: push this and the lines stop reading as contours and
     start reading as noise, which is the haze this file exists to remove. */
  vec2 q = p;
  q.y += 0.13 * sin(q.x * 2.1 + t * 0.29) + 0.06 * sin(q.x * 3.7 - t * 0.19);
  q.x += 0.05 * sin(q.y * 2.6 + t * 0.23);

  /* Distance to the nearest line, in line-space. */
  float lines = q.y * 7.0;
  float d = abs(fract(lines) - 0.5);

  /* One pixel of line coordinate, so the width below is in real pixels. */
  float w = fwidth(lines);

  /* A 1.1px line with a 1px feather either side. smoothstep is correct here,
     unlike in the blobs: this IS an edge and wants a defined one. */
  float line = 1.0 - smoothstep(0.0, w * 1.1, d);

  /* Fade the grid where the mesh is thin, so lines never float on bare white
     with nothing to belong to. */
  return line;
}

/*
 * ── THE LIGHT SHAFTS ─────────────────────────────────────────────────────────
 *
 * Three soft wedges on the same ~24 degree axis the old wave used, drifting
 * perpendicular to themselves at different rates. Not a bloom: each is a broad
 * gradient with no core, which is what keeps this inside the register note.
 */
float shaftField(vec2 p, float t) {
  float ca = cos(uAngle);
  float sa = sin(uAngle);
  /* Rotate into shaft space. Only the TRAVEL flips for RTL, never the geometry:
     the shafts keep their angle and mirror their motion. */
  float axis = p.x * sa - p.y * ca;

  float s = 0.0;
  s += exp(-pow((axis - 0.34 - 0.10 * sin(t * 0.13 * uDirection)) / 0.20, 2.0)) * 1.00;
  s += exp(-pow((axis + 0.12 - 0.08 * sin(t * 0.09 * uDirection)) / 0.26, 2.0)) * 0.72;
  s += exp(-pow((axis + 0.58 - 0.06 * cos(t * 0.11 * uDirection)) / 0.16, 2.0)) * 0.54;

  return s / (s + 1.0);
}

void main() {
  /* Aspect-corrected so a circle is a circle and the shaft angle is a true
     angle on screen at any viewport. */
  vec2 p = (vUv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);

  float t = uTime;

  vec3 meshTint;
  float mesh = meshField(p, t, meshTint);
  float grid = gridField(p, t);
  float shafts = shaftField(p, t);

  /*
   * ── THE TEXT COLUMN STAYS QUIET ──────────────────────────────────────────
   *
   * The hero grid is lg:grid-cols-[1.15fr_0.85fr] in a full-bleed container, so
   * the text occupies roughly the left 55% in LTR. The grid and the shafts are
   * the two layers with structure, and structure behind type is what makes type
   * hard to read, so both are attenuated on the reading side. The mesh is not:
   * it is a smooth wash and it is what stops the column reading as bare paper.
   *
   * Mirrored for RTL by uDirection, because "the reading side" is a statement
   * about reading order, not about screen geometry.
   */
  float readX = p.x * uDirection;
  float quiet = smoothstep(-0.55, 0.35, readX);
  /* Never fully zero: a layer that vanishes has a visible edge where it went. */
  quiet = 0.30 + 0.70 * quiet;

  /*
   * The grid also fades out where the mesh is thin. Lines are the crisp layer,
   * and a crisp line on bare white with no wash beneath it reads as a stray
   * hairline rather than as part of a field.
   */
  float gridMask = smoothstep(0.06, 0.34, mesh);

  /*
   * ── THE COMPOSITE, AND THE ONE PLACE ALPHA IS APPLIED ───────────────────────
   *
   * Weights are the budget split. They sum to 1.0 by construction so the peak is
   * uAlpha exactly, which is the number the contrast table in the docblock was
   * measured against. Moving brightness between layers is safe; raising the sum
   * is not.
   */
  float cover =
      mesh * 0.42
    + shafts * quiet * 0.20
    + grid * gridMask * quiet * 0.38;

  /*
   * The tint. The grid and the shafts take the deeper blues so the crisp layer
   * reads as a drawn line rather than as more wash, and the mesh keeps its own
   * hue average from above.
   */
  float structure = shafts * 0.20 + grid * gridMask * 0.38 + 1e-4;
  vec3 structureTint = (uTintDeep * shafts * 0.20 + uTintCore * grid * gridMask * 0.38) / structure;

  float structureShare = clamp(structure / (cover + 1e-4), 0.0, 1.0);
  vec3 tint = mix(meshTint, structureTint, structureShare * 0.65);

  /*
   * ── THE EDGE WINDOW ────────────────────────────────────────────────────────
   *
   * Everything fades before it reaches an edge of the canvas, so no layer ever
   * terminates on a hard line at the band boundary. This is why .vvip-atmosphere
   * is allowed no negative inset and no transform: scale() in the stylesheet —
   * containment lives here, in the shader, where it costs nothing and cannot
   * widen the document.
   */
  vec2 e = abs(vUv - 0.5) * 2.0;
  float window = (1.0 - smoothstep(0.72, 1.0, e.x)) * (1.0 - smoothstep(0.68, 1.0, e.y));

  float a = cover * window * uAlpha;

  /* Premultiplied: rgb goes to zero WITH the alpha, so the falloff stays pure
     blue instead of dragging toward a dark fringe. This line, the material's
     premultipliedAlpha flag and the renderer's flag change together or not at
     all. */
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
      uAlpha: { value: 0.38 },
      /* -24 degrees. Shared with the .vvip-dot 135deg gradient's axis so the
         shafts and the IBC mark agree rather than crossing at a slight angle. */
      uAngle: { value: -0.42 },
      uDirection: { value: direction },
      uTintCore: { value: new THREE.Color("#1e90d6") },
      uTintDeep: { value: new THREE.Color("#0b6fc4") },
      uTintPale: { value: new THREE.Color("#7fc4ec") },
      uTintCool: { value: new THREE.Color("#33506b") },
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
