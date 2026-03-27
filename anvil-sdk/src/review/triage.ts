import type { Finding, TriagedFindings } from '../types.js'

/**
 * Splits findings into three buckets:
 * - autoPass: Hard Rule violations with confidence >= 90 (certainties, no need to challenge)
 * - autoDrop: info-severity with confidence <= 79 (noise)
 * - mustFalsify: everything else (goes to falsification)
 *
 * Note: autoPass takes priority — a Hard Rule info finding with confidence >= 90
 * goes to autoPass, not autoDrop.
 */
export function triage(findings: Finding[]): TriagedFindings {
  return {
    autoPass: findings.filter(f => f.isHardRule && f.confidence >= 90),
    autoDrop: findings.filter(f => !(f.isHardRule && f.confidence >= 90) && f.severity === 'info' && f.confidence <= 79),
    mustFalsify: findings.filter(
      f => !(f.isHardRule && f.confidence >= 90) && !(f.severity === 'info' && f.confidence <= 79)
    ),
  }
}
