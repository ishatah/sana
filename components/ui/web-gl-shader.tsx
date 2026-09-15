"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"

/**
 * An animated WebGL ground: soft light rays bent by a chromatic-dispersion term.
 *
 * ── WHAT CHANGED FROM THE SOURCE COMPONENT, AND WHY ────────────────────────────
 *
 * The upstream version is a `fixed inset-0` canvas that clears to pure black and
 * splits the rays into full-saturation red/green/blue. Three things about that do
 * not survive contact with this site:
 *
 *   1. `fixed` MEANS THE WHOLE PAGE, NOT THE HERO. A fixed canvas ignores its
 *      parent's bounds and its clear colour paints over every section below the
 *      fold. This one is `absolute inset-0`, so it fills whatever positioned
 *      ancestor it is dropped into, here, the hero <section>, and the sizing
 *      reads that element rather than `window.inner*`.
 *
 *   2. THE CLEAR COLOUR IS NOW TRANSPARENT, NOT BLACK. `HeroBackdrop` already owns
 *      this band's ground: four tuned gradient passes plus a hairline horizon. A
 *      shader that clears to black would erase all of it. With `alpha: true` and a
 *      zero-alpha clear, the rays composite ON TOP of that ground, the backdrop
 *      still lights the band, and this adds movement over it.
 *
 *   3. THE RGB SPLIT IS TINTED, NOT RAW. Literal red/green/blue rays would be the
 *      only saturated colour on a page whose entire palette is charcoal and one
 *      gold. The three dispersion samples are kept, they are what makes the effect
 *      read as refracted light rather than a plain glow, but each is multiplied
 *      through a colour ramp centred on `--primary`, so the split shows as warm-to-
 *      cool variation within the gold rather than as a rainbow.
 *
 * ── REDUCED MOTION ─────────────────────────────────────────────────────────────
 *
 * Checked before the loop starts and watched afterwards. When the visitor has asked
 * for less motion the scene still renders ONE frame, a static field of rays, which
 * is a finished-looking ground, and `requestAnimationFrame` is never scheduled.
 * Toggling the OS setting starts or stops the loop live.
 *
 * ── CONTEXT LOSS ───────────────────────────────────────────────────────────────
 *
 * A WebGL context can be taken away by the browser (tab backgrounded on a low-end
 * device, GPU reset). Unhandled, the canvas goes black and stays black, which here
 * would mean a hole in the hero. `webglcontextlost` is caught, the loop stopped,
 * and the default prevented so the browser will issue `webglcontextrestored`.
 */
export function WebGLShader({
  className,
  /** Peak opacity of the rays. Low by default: this is ground, not subject. */
  opacity = 0.55,
  /** Horizontal frequency of the ray field. */
  xScale = 1.0,
  /** Vertical amplitude of the ray sweep. */
  yScale = 0.5,
  /** Strength of the chromatic split. 0 collapses the three samples into one. */
  distortion = 0.05,
  /** Seconds of shader time per real second. */
  speed = 0.6,
}: {
  className?: string
  opacity?: number
  xScale?: number
  yScale?: number
  distortion?: number
  speed?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  /* The animated knobs are held in a ref so a prop change retunes the live scene
     through the uniforms, instead of tearing down and rebuilding the GL context. */
  const params = useRef({ opacity, xScale, yScale, distortion, speed })
  params.current = { opacity, xScale, yScale, distortion, speed }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const vertexShader = /* glsl */ `
      attribute vec3 position;
      void main() {
        gl_Position = vec4(position, 1.0);
      }
    `

    /*
     * The fragment shader.
     *
     * `1.0 / abs(...)` is the ray: it spikes where the sampled sine crosses the
     * pixel's y, and falls off fast either side. Sampling it three times at
     * slightly different x, spread by a distance-weighted `distortion` term, is
     * the chromatic split.
     *
     * The tint is where this departs from the source. Rather than assigning the
     * three samples to the r/g/b channels, each is multiplied by its own colour
     * and the three are ADDED. Feeding all three a near-identical gold would make
     * the split invisible, so they are spread slightly along a warm→cool axis
     * through the accent: the effect stays legible as dispersion while every pixel
     * it paints is still within the site's palette.
     *
     * The result is premultiplied into alpha, so the layer composites additively
     * over `HeroBackdrop`, bright where the rays are, fully transparent elsewhere.
     */
    const fragmentShader = /* glsl */ `
      precision highp float;

      uniform vec2  resolution;
      uniform float time;
      uniform float xScale;
      uniform float yScale;
      uniform float distortion;
      uniform float opacity;
      uniform vec3  tintWarm;
      uniform vec3  tintMid;
      uniform vec3  tintCool;

      void main() {
        vec2 p = (gl_FragCoord.xy * 2.0 - resolution) / min(resolution.x, resolution.y);

        // Dispersion grows with distance from centre, so the split is tightest in
        // the middle of the band, where the headline sits, and widest at the edges.
        float d = length(p) * distortion;

        float wx = p.x * (1.0 + d);
        float mx = p.x;
        float cx = p.x * (1.0 - d);

        float w = 0.05 / abs(p.y + sin((wx + time) * xScale) * yScale);
        float m = 0.05 / abs(p.y + sin((mx + time) * xScale) * yScale);
        float c = 0.05 / abs(p.y + sin((cx + time) * xScale) * yScale);

        /*
         * ── THE RAY CORE IS ROLLED OFF, NOT CLAMPED ────────────────────────────
         *
         * This was "min(v, 1.0)", and that min() is where the diagonal "cut" came
         * from. The reciprocal is unbounded at the ray core, so across the whole
         * region where the denominator is small, EVERY sample pinned to exactly
         * 1.0, a flat-topped plateau. A plateau has a boundary: the locus where
         * the value stops being 1.0 is a sharp curve across the canvas, and that
         * curve is the bright wedge that read as a hard edge slicing the headline.
         *
         * Clamping was never about brightness for its own sake; the note here said
         * it was to stop the tint blowing out to white. "v / (v + 1)" does that
         * strictly better: it is asymptotic to 1 rather than equal to it, so the
         * core is bounded with NO plateau and therefore no boundary anywhere. The
         * curve is smooth across its entire domain, which is the property a light
         * field needs and a min() cannot provide at any threshold.
         */
        w = w / (w + 1.0);
        m = m / (m + 1.0);
        c = c / (c + 1.0);

        vec3 col = tintWarm * w + tintMid * m + tintCool * c;

        /*
         * Luminance drives alpha, so the layer is transparent between the rays and
         * the backdrop beneath shows through untouched.
         *
         * THE clamp() HERE WAS THE LAST HARD EDGE, and it is the same bug that was
         * already fixed one block above on w/m/c. Three tinted rays summed can push
         * the channel max past 1.0 over a broad region; clamp() pinned every one of
         * those samples to exactly 1.0, and the locus where it STOPPED pinning was a
         * clean curve across the canvas. Measured on the isolated shader, luminance
         * fell 31.7 to 0.0 across 24px along a straight diagonal.
         *
         * The same asymptotic roll-off used on the ray cores fixes it for the same
         * reason: v/(v+1) approaches 1 without ever reaching it, so there is no
         * plateau and therefore no boundary between "clamped" and "not clamped".
         */
        float peak = max(max(col.r, col.g), col.b);
        float a = (peak / (peak + 1.0)) * opacity;

        /*
         * ── THE FIELD IS MASKED AT ITS EDGES, AND WITHOUT THIS IT READS AS A CUT ──
         *
         * The rays are an unbounded sine field: every one of them runs straight off
         * whichever edge of the canvas it reaches, at full strength. On a band this
         * wide that produced a hard diagonal streak across the upper-left, a bright
         * wedge with a crisp boundary, which is exactly the "pasted on" artefact the
         * rest of this hero's ground was built to avoid. A ray field only reads as
         * light if it has somewhere to fall off to.
         *
         * "edge" is that falloff: a soft elliptical window, widest across the band
         * and tighter vertically, so the rays are at full strength through the
         * middle and gone before they reach any border. smoothstep rather than a
         * linear ramp because a linear fade to zero still leaves a visible line
         * where the gradient stops.
         *
         * "subject" is the second half, and it is about the photograph. The portrait
         * occupies the trailing third of the band, and rays crossing her face turned
         * the one thing this hero exists to show into part of the background. This
         * pushes the field away from that side, the light belongs behind her, not
         * over her. It is written against normalised x so it flips correctly with
         * the whole layer under RTL, which .hero-backdrop already mirrors.
         */
        vec2 q = gl_FragCoord.xy / resolution;

        /*
         * A RADIAL WINDOW, NOT FOUR AXIS-ALIGNED RAMPS.
         *
         * The first attempt multiplied four smoothsteps, one per edge. That still
         * left a faint wedge in the mid-left, because the product of two axis ramps
         * is itself a rectangle with soft sides, a ray crossing the corner region
         * exits through a straight boundary, which is exactly the shape the eye
         * picks out as "a cut".
         *
         * Distance from the centre has no preferred direction, so a ray fades the
         * same way whichever way it leaves. The ellipse is wider than it is tall to
         * match the band.
         *
         * THE FIRST TUNING OF THIS KILLED THE FIELD ENTIRELY. A window of
         * smoothstep(0.18, 0.52) with a pow(1.6) on top, multiplied by a subject
         * term that reached zero at x=0.40, drove alpha to 0 across the whole
         * canvas, measured with readPixels, every sample was 0. The rays did not
         * get softer; they stopped existing, which is worse than the artefact the
         * window was added to remove. The numbers below are the widened pass:
         * solid through the middle, at zero before any border, and still present.
         */
        /*
         * ONE WINDOW, CENTRED ON THE TEXT SIDE. There used to be a second term,
         * smoothstep(0.80, 0.46, q.x), to push the field away from the portrait.
         * It is gone, and removing it is the fix for the last visible cut.
         *
         * The reason is what a steep ramp does to a RAY rather than to a flat
         * field. The rays are long and roughly horizontal, so one of them crossing
         * a narrow vertical ramp does not dim along its length; it stops. Measured
         * on the rendered page, a ray sat at luminance 42 at x=950 and 21 by
         * x=1050 while changing by 2-3 per 50px everywhere else, a straight
         * vertical termination, which is exactly the edge the eye reads as a cut.
         *
         * The single elliptical window below has no straight boundary anywhere, so
         * a ray fades gradually along its own direction no matter where it exits.
         * Biasing the centre to x=0.34 does the portrait-side job the second term
         * was added for, without introducing a boundary to do it.
         */
        /*
         * CENTRED, AND WIDER THAN THE CANVAS ON BOTH AXES.
         *
         * The window was biased to x=0.34 to keep light off the portrait. That bias
         * is what put the falloff INSIDE the frame on the trailing side: the field
         * reached zero partway across, and a broad low-contrast falloff on a
         * near-black ground reads as a straight band edge, the "cut" that survived
         * several attempts to soften it.
         *
         * Centred at 0.5/0.5 and scaled BELOW 1.0 on both axes, the radius at the
         * furthest corner stays under the fade's end point, so the window never
         * completes anywhere on screen. There is no locus inside the canvas where
         * the light stops, which is the only way to guarantee no edge.
         *
         * Keeping the rays off the portrait is left to "opacity" and to the
         * backdrop's own warm wash, neither of which has a boundary.
         */
        vec2 fromCentre = (q - vec2(0.5, 0.5)) * vec2(0.62, 0.78);
        float r = length(fromCentre);

        /*
         * A LONG, GENTLE WINDOW. The previous 0.16-0.86 range put the whole falloff
         * inside the visible band, so the rays visibly ran out of light partway
         * across it. Starting at 0.34 leaves the middle at full strength and pushes
         * the fade out past the corners, where a ray leaving has nothing left to
         * terminate against.
         *
         * IT IS NOT CUBED, AND "edge" IS APPLIED ONCE: BOTH MATTER.
         *
         * A previous version wrote "edge = edge*edge*edge" and then multiplied it
         * into the colour AND the alpha. Under AdditiveBlending the visible result
         * is the COLOUR term, so the falloff being applied twice on top of a cube
         * made the effective curve edge^4: the field went from full strength to
         * nothing across a narrow radial band, and a narrow band on a radial
         * gradient reads as a clean curved boundary, the "cut". Measured on the
         * isolated canvas that version also dropped peak luminance from 41.8 to
         * 1.0, so it was simultaneously too hard-edged and too dim.
         *
         * Now: one smoothstep, no power, and "edge" folded into the colour only.
         * Alpha is left to the ray luminance so the layer stays transparent between
         * rays, which is what lets the gradient ground show through.
         */
        float edge = 1.0 - smoothstep(0.20, 0.95, r);

        gl_FragColor = vec4(col * opacity * edge, a * edge);
      }
    `

    /*
     * ── NO WEBGL IS A SUPPORTED OUTCOME, NOT AN ERROR ──────────────────────────
     *
     * `new THREE.WebGLRenderer()` THROWS when a context cannot be created, and this
     * runs inside useEffect, so an unguarded throw propagates to the nearest error
     * boundary and takes the WHOLE HERO with it. Measured before this guard existed:
     * the page rendered "Something went wrong" and the document's <h1> was that
     * error string instead of the client's name.
     *
     * That is not a hypothetical. A context is refused on GPU driver blocklists,
     * with hardware acceleration switched off, under `webgl.disabled` in Firefox, in
     * VMs and locked-down corporate builds, and on some low-end Android. All of them
     * are visitors who should still get the hero.
     *
     * Returning early is the correct behaviour rather than a fallback: the canvas is
     * `aria-hidden` decoration layered over `HeroBackdrop`, which is a complete,
     * deliberately-tuned ground on its own. No shader simply means the band is
     * still. Nothing else in the hero depends on this layer.
     *
     * Same reasoning as the `webglcontextlost` handler further down, a missing GL
     * layer degrades to a static ground; it never breaks the page.
     */
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: false,
        powerPreference: "low-power",
      })
    } catch {
      return
    }

    // Capped at 2: this is a full-bleed fragment shader, and on a 3x phone the
    // extra pixels cost real battery for a ground layer nobody is inspecting.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, -1)

    const uniforms = {
      resolution: { value: new THREE.Vector2(1, 1) },
      time: { value: 0 },
      xScale: { value: params.current.xScale },
      yScale: { value: params.current.yScale },
      distortion: { value: params.current.distortion },
      opacity: { value: params.current.opacity },
      // The accent, #dcb75f, spread along a warm→cool axis. Read as literals rather
      // than from `getComputedStyle` because this runs before paint on first mount;
      // they must be kept in step with --primary in styles/globals.css.
      tintWarm: { value: new THREE.Color(0.95, 0.68, 0.33) },
      tintMid: { value: new THREE.Color(0.86, 0.72, 0.37) },
      tintCool: { value: new THREE.Color(0.61, 0.63, 0.53) },
    }

    /*
     * Two triangles covering clip space. No geometry is being modelled, the whole
     * image is the fragment shader, so this is the cheapest possible carrier.
     *
     * ── THE WINDING OF THE SECOND TRIANGLE IS THE WHOLE BUG ──────────────────────
     *
     * This read `1,-1  -1,1  1,1` for the second triangle. Computing the cross
     * product of both: triangle one is counter-clockwise (+4), triangle two was
     * CLOCKWISE (-4). Three.js culls back faces by default, so the clockwise half
     * was discarded outright and only ONE triangle ever rendered, the lower-left
     * one. The quad's own hypotenuse, from (1,-1) to (-1,1), was therefore drawn
     * straight across the canvas as a hard boundary with light on one side and
     * nothing on the other.
     *
     * That is the diagonal "cut" that survived every attempt to fix it in the
     * fragment shader, and it explains why: the fragment shader was never the
     * problem. Its math is smooth everywhere, verified by reproducing it in JS,
     * where the largest step across the whole canvas was 0.0007. No amount of
     * softening a falloff can repair a triangle that is not being rasterised.
     *
     * The vertices below are both counter-clockwise, so the full quad renders.
     * `side: THREE.DoubleSide` on the material is the belt to this braces.
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
      // Belt to the winding fix above: even if a future edit reorders a vertex,
      // neither face can be culled and the quad cannot half-render again.
      side: THREE.DoubleSide,
      // Additive: rays ADD light to the backdrop rather than replacing it, which is
      // what keeps the gradient ground and the horizon visible underneath.
      blending: THREE.AdditiveBlending,
    })

    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    /** Size to the PARENT element, not the window, this canvas is scoped. */
    const resize = () => {
      const host = canvas.parentElement
      const width = Math.max(1, host?.clientWidth ?? canvas.clientWidth)
      const height = Math.max(1, host?.clientHeight ?? canvas.clientHeight)
      renderer.setSize(width, height, false)
      uniforms.resolution.value.set(
        width * renderer.getPixelRatio(),
        height * renderer.getPixelRatio(),
      )
    }

    const draw = () => {
      uniforms.xScale.value = params.current.xScale
      uniforms.yScale.value = params.current.yScale
      uniforms.distortion.value = params.current.distortion
      uniforms.opacity.value = params.current.opacity
      renderer.render(scene, camera)
    }

    let raf: number | null = null
    let last = performance.now()

    const tick = (now: number) => {
      // Delta-timed rather than a fixed += per frame, so the drift runs at the same
      // speed on a 60Hz and a 144Hz display. Clamped so a backgrounded tab does not
      // return and jump the field forward by however long it was away.
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      uniforms.time.value += dt * params.current.speed
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

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")

    const sync = () => {
      if (reduced.matches) {
        stop()
        // Still paint once. A static ray field is a finished ground; a blank canvas
        // would leave the hero looking like the effect failed to load.
        draw()
        return
      }
      start()
    }

    // A lost context leaves a permanently blank canvas unless the default is
    // prevented, preventing it is what makes the browser fire `restored`.
    const onLost = (event: Event) => {
      event.preventDefault()
      stop()
    }
    const onRestored = () => {
      resize()
      sync()
    }

    // ResizeObserver rather than a window listener: the hero's height responds to
    // its own content (the meta row wraps, the role line reflows), and those
    // changes never fire a window resize.
    const observer = new ResizeObserver(() => {
      resize()
      if (reduced.matches) draw()
    })
    if (canvas.parentElement) observer.observe(canvas.parentElement)

    resize()
    sync()

    reduced.addEventListener("change", sync)
    canvas.addEventListener("webglcontextlost", onLost)
    canvas.addEventListener("webglcontextrestored", onRestored)

    return () => {
      stop()
      observer.disconnect()
      reduced.removeEventListener("change", sync)
      canvas.removeEventListener("webglcontextlost", onLost)
      canvas.removeEventListener("webglcontextrestored", onRestored)
      scene.remove(mesh)
      geometry.dispose()
      material.dispose()
      renderer.dispose()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className ?? "pointer-events-none absolute inset-0 block h-full w-full"}
    />
  )
}
