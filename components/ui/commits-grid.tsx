"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import type { CSSProperties } from "react"

/**
 * A word rendered as lit cells on a GitHub-contribution-style grid.
 *
 * THE PALETTE IS THE SITE'S, NOT GITHUB'S. The upstream component hard-codes the
 * three contribution greens. Those are borrowed equity, they read as "GitHub" to
 * anyone who has seen the profile page, which is a different brand speaking on a
 * page that belongs to one principal. The colours are `--commit-1..3` instead, set
 * in globals.css to three steps of the champagne gold, so the grid lights up in
 * the same accent as every other mark on the site.
 *
 * THE RANDOMNESS IS DEFERRED TO AN EFFECT, and that is not a style preference.
 * `Math.random()` called during render runs once on the server and again on the
 * client with different results, so every cell's colour, delay and flash flag
 * disagree between the two passes, React 19 discards the server HTML for the
 * whole subtree and warns. Generating them in `useEffect` means the first paint is
 * deterministic (unlit cells, which is also the animation's from-state) and the
 * decoration is applied once the client owns the tree. This also gives the entry
 * animation a real trigger: before the effect runs there are no `animate-*`
 * classes at all, so the letters light up on arrival rather than having already
 * finished during hydration.
 */

type Decoration = {
  delay: string
  color: string
  flash: boolean
}

export const CommitsGrid = ({ text, className }: { text: string; className?: string }) => {
  const cleanString = (str: string): string => {
    const upperStr = str.toUpperCase()

    const withoutAccents = upperStr.normalize("NFD").replace(/[̀-ͯ]/g, "")

    const allowedChars = Object.keys(letterPatterns)
    return withoutAccents
      .split("")
      .filter((char) => allowedChars.includes(char))
      .join("")
  }

  const generateHighlightedCells = (text: string) => {
    const cleanedText = cleanString(text)

    const width = Math.max(cleanedText.length * 6, 6) + 1

    let currentPosition = 1 // we start at 1 to leave space for the top border
    const highlightedCells: number[] = []

    cleanedText
      .toUpperCase()
      .split("")
      .forEach((char) => {
        if (letterPatterns[char]) {
          const pattern = letterPatterns[char].map((pos) => {
            const row = Math.floor(pos / 50)
            const col = pos % 50
            return (row + 1) * width + col + currentPosition
          })
          highlightedCells.push(...pattern)
        }
        currentPosition += 6
      })

    return {
      // A Set, not the array: `includes` inside the cell loop is O(cells × lit),
      // which for a five-letter word is ~90 lit cells scanned per cell across ~280
      // cells. The membership test is the whole use, so the Set costs nothing and
      // keeps the render linear as the text grows.
      cells: new Set(highlightedCells),
      width,
      height: 9, // 7+2 for the top and bottom borders
    }
  }

  const {
    cells: highlightedCells,
    width: gridWidth,
    height: gridHeight,
  } = React.useMemo(() => generateHighlightedCells(text), [text])

  const total = gridWidth * gridHeight

  const [decorations, setDecorations] = React.useState<Decoration[] | null>(null)

  React.useEffect(() => {
    const commitColors = ["var(--commit-1)", "var(--commit-2)", "var(--commit-3)"]

    setDecorations(
      Array.from({ length: total }, () => ({
        delay: `${(Math.random() * 0.6).toFixed(1)}s`,
        color: commitColors[Math.floor(Math.random() * commitColors.length)],
        flash: Math.random() < 0.3,
      })),
    )
  }, [total])

  return (
    <section
      className={cn(
        "grid w-full max-w-xl gap-0.5 rounded-[10px] border bg-card p-1.5 sm:gap-1 sm:rounded-[15px] sm:p-3",
        className,
      )}
      style={{
        gridTemplateColumns: `repeat(${gridWidth}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${gridHeight}, minmax(0, 1fr))`,
      }}
      // The grid spells a word, but it does so as texture, a screen reader
      // walking 280 empty divs learns nothing. The word is announced once here and
      // the cells are hidden, so the decoration stays decoration.
      role="img"
      aria-label={text}
    >
      {Array.from({ length: total }).map((_, index) => {
        const isHighlighted = highlightedCells.has(index)
        const decoration = decorations?.[index]
        const shouldFlash = !isHighlighted && decoration?.flash

        return (
          <div
            key={index}
            aria-hidden="true"
            className={cn(
              "aspect-square h-full w-full rounded-[4px] border sm:rounded-[3px]",
              // Until the effect lands every cell is an unlit card, the same
              // state the highlight animation starts from, so there is no flash of
              // finished artwork before the animation begins.
              decoration && isHighlighted ? "animate-highlight" : "",
              shouldFlash ? "animate-flash" : "",
              !isHighlighted && !shouldFlash ? "bg-card" : "",
            )}
            style={
              {
                animationDelay: decoration?.delay,
                "--highlight": decoration?.color,
              } as CSSProperties
            }
          />
        )
      })}
    </section>
  )
}

const letterPatterns: { [key: string]: number[] } = {
  A: [
    1, 2, 3, 50, 100, 150, 200, 250, 300, 54, 104, 154, 204, 254, 304, 151, 152,
    153,
  ],
  B: [
    0, 1, 2, 3, 4, 50, 100, 150, 151, 200, 250, 300, 301, 302, 303, 304, 54,
    104, 152, 153, 204, 254, 303,
  ],
  C: [0, 1, 2, 3, 4, 50, 100, 150, 200, 250, 300, 301, 302, 303, 304],
  D: [
    0, 1, 2, 3, 50, 100, 150, 200, 250, 300, 301, 302, 54, 104, 154, 204, 254,
    303,
  ],
  E: [0, 1, 2, 3, 4, 50, 100, 150, 200, 250, 300, 301, 302, 303, 304, 151, 152],
  F: [0, 1, 2, 3, 4, 50, 100, 150, 200, 250, 300, 151, 152, 153],
  G: [
    0, 1, 2, 3, 4, 50, 100, 150, 200, 250, 300, 301, 302, 303, 153, 204, 154,
    304, 254,
  ],
  H: [
    0, 50, 100, 150, 200, 250, 300, 151, 152, 153, 4, 54, 104, 154, 204, 254,
    304,
  ],
  I: [0, 1, 2, 3, 4, 52, 102, 152, 202, 252, 300, 301, 302, 303, 304],
  J: [0, 1, 2, 3, 4, 52, 102, 152, 202, 250, 252, 302, 300, 301],
  K: [0, 4, 50, 100, 150, 200, 250, 300, 151, 152, 103, 54, 203, 254, 304],
  L: [0, 50, 100, 150, 200, 250, 300, 301, 302, 303, 304],
  M: [
    0, 50, 100, 150, 200, 250, 300, 51, 102, 53, 4, 54, 104, 154, 204, 254, 304,
  ],
  N: [
    0, 50, 100, 150, 200, 250, 300, 51, 102, 153, 204, 4, 54, 104, 154, 204,
    254, 304,
  ],
  Ñ: [
    0, 50, 100, 150, 200, 250, 300, 51, 102, 153, 204, 4, 54, 104, 154, 204,
    254, 304,
  ],
  O: [1, 2, 3, 50, 100, 150, 200, 250, 301, 302, 303, 54, 104, 154, 204, 254],
  P: [0, 50, 100, 150, 200, 250, 300, 1, 2, 3, 54, 104, 151, 152, 153],
  Q: [
    1, 2, 3, 50, 100, 150, 200, 250, 301, 302, 54, 104, 154, 204, 202, 253, 304,
  ],
  R: [
    0, 50, 100, 150, 200, 250, 300, 1, 2, 3, 54, 104, 151, 152, 153, 204, 254,
    304,
  ],
  S: [1, 2, 3, 4, 50, 100, 151, 152, 153, 204, 254, 300, 301, 302, 303],
  T: [0, 1, 2, 3, 4, 52, 102, 152, 202, 252, 302],
  U: [0, 50, 100, 150, 200, 250, 301, 302, 303, 4, 54, 104, 154, 204, 254],
  V: [0, 50, 100, 150, 200, 251, 302, 4, 54, 104, 154, 204, 253],
  W: [
    0, 50, 100, 150, 200, 250, 301, 152, 202, 252, 4, 54, 104, 154, 204, 254,
    303,
  ],
  X: [0, 50, 203, 254, 304, 4, 54, 152, 101, 103, 201, 250, 300],
  Y: [0, 50, 101, 152, 202, 252, 302, 4, 54, 103],
  Z: [0, 1, 2, 3, 4, 54, 103, 152, 201, 250, 300, 301, 302, 303, 304],
  "0": [1, 2, 3, 50, 100, 150, 200, 250, 301, 302, 303, 54, 104, 154, 204, 254],
  "1": [1, 52, 102, 152, 202, 252, 302, 0, 2, 300, 301, 302, 303, 304],
  "2": [0, 1, 2, 3, 54, 104, 152, 153, 201, 250, 300, 301, 302, 303, 304],
  "3": [0, 1, 2, 3, 54, 104, 152, 153, 204, 254, 300, 301, 302, 303],
  "4": [0, 50, 100, 150, 4, 54, 104, 151, 152, 153, 154, 204, 254, 304],
  "5": [0, 1, 2, 3, 4, 50, 100, 151, 152, 153, 204, 254, 300, 301, 302, 303],
  "6": [
    1, 2, 3, 50, 100, 150, 151, 152, 153, 200, 250, 301, 302, 204, 254, 303,
  ],
  "7": [0, 1, 2, 3, 4, 54, 103, 152, 201, 250, 300],
  "8": [
    1, 2, 3, 50, 100, 151, 152, 153, 200, 250, 301, 302, 303, 54, 104, 204, 254,
  ],
  "9": [1, 2, 3, 50, 100, 151, 152, 153, 154, 204, 254, 304, 54, 104],
  " ": [],
}
