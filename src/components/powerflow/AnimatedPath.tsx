import { useMemo, useId } from 'react'

interface Props {
  d: string
  color: string
  watts: number
  width?: number
  arrows?: number  // staggered arrowheads visible at once (default 3)
  small?: boolean  // smaller arrowhead for tight/short paths
}

// Faster at higher watts, slower at low watts
function animDuration(watts: number): number {
  if (watts <= 0) return 0
  const clamped = Math.min(Math.max(watts, 50), 5000)
  return Math.max(1.0, 4.5 - (clamped / 5000) * 3.5)
}

// Two arrowhead sizes – shape points in +X so rotate="auto" aligns it to path direction
const ARROW_LG = 'M -5,-3 L 5,0 L -5,3 Z'
const ARROW_SM = 'M -3.5,-2 L 3.5,0 L -3.5,2 Z'

export function AnimatedPath({ d, color, watts, width = 3, arrows = 5, small = false }: Props) {
  const rawId  = useId()
  const pathId = `ap${rawId.replace(/[^a-z0-9]/gi, '')}`
  const dur    = useMemo(() => animDuration(Math.abs(watts)), [watts])
  const flowing = Math.abs(watts) > 5
  const arrowShape = small ? ARROW_SM : ARROW_LG

  // evenly-spaced phase offsets: 3 arrows → [0, 1/3, 2/3] of the period
  const phases = Array.from({ length: arrows }, (_, i) => i / arrows)

  return (
    <g>
      {/* Faint static track – always shows the connection */}
      <path d={d} stroke={color} strokeWidth={width - 1} strokeOpacity={0.12} fill="none" strokeLinecap="round" />

      {flowing && (
        <>
          {/* Register the path so animateMotion can reference it by id */}
          <defs>
            <path id={pathId} d={d} />
          </defs>

          {phases.map((phase, i) => (
            <path key={i} d={arrowShape} fill={color} fillOpacity={0.9}>
              {/*
                rotate="auto" aligns the arrowhead to the path tangent at the current position.
                The path string is always written in the intended travel direction (callers that
                need reversal pass an already-reversed path), so rotate="auto" is always correct.
                keyPoints / calcMode keep the motion linear end-to-end.
              */}
              <animateMotion
                dur={`${dur}s`}
                repeatCount="indefinite"
                begin={`${-(phase * dur).toFixed(2)}s`}
                rotate="auto"
                keyPoints="0;1"
                keyTimes="0;1"
                calcMode="linear"
              >
                {/* @ts-expect-error – mpath is valid SVG/SMIL but absent from React's JSX types */}
                <mpath href={`#${pathId}`} />
              </animateMotion>
            </path>
          ))}
        </>
      )}
    </g>
  )
}
