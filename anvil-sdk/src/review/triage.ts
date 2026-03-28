import type { Finding, TriagedFindings } from '../types.js'

/**
 * Splits findings into three buckets:
 * - autoPass: Hard Rule violations with confidence >= autoPassThreshold (certainties, no need to challenge)
 * - autoDrop: NON-Hard-Rule info-severity with confidence <= autoDropThreshold (noise)
 * - mustFalsify: everything else (goes to falsification)
 *
 * Hard Rules are NEVER auto-dropped regardless of severity or confidence.
 */
export function triage(findings: Finding[], params?: {
  autoPassThreshold?: number  // default 90
  autoDropThreshold?: number  // default 79
}): TriagedFindings {
  const autoPassAt = params?.autoPassThreshold ?? 90
  const autoDropAt = params?.autoDropThreshold ?? 79
  const autoPass: Finding[] = []
  const autoDrop: Finding[] = []
  const mustFalsify: Finding[] = []
  for (const f of findings) {
    if (f.isHardRule && f.confidence >= autoPassAt) {
      autoPass.push(f)
    } else if (!f.isHardRule && f.severity === 'info' && f.confidence <= autoDropAt) {
      autoDrop.push(f)
    } else {
      mustFalsify.push(f)
    }
  }
  return { autoPass, autoDrop, mustFalsify }
}
