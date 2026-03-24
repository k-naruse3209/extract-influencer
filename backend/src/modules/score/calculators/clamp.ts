/**
 * Clamp a numeric value into the [min, max] range.
 *
 * Pure utility -- no side-effects.
 */
export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}
