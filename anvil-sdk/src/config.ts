export const DEFAULT_CONFIG = {
  effort: 'high' as const,
  maxBudgetPerReviewer: 0.30,
  maxBudgetFalsification: 0.15,
  maxTurnsReviewer: 20,
  maxTurnsFalsification: 5,
  model: 'sonnet' as const,
  confidenceThreshold: 80,
  autoPassConfidence: 90,
  autoDropMaxConfidence: 79,
  patternCapCount: 3,
  signalThreshold: 0.6,
}

export type EffortLevel = 'low' | 'medium' | 'high'

export interface ReviewConfig {
  effort?: EffortLevel
  budgetUsd?: number
  hardRulesPath?: string
  noFalsification?: boolean
}

export interface ResolvedConfig {
  effort: EffortLevel
  maxBudgetPerReviewer: number
  maxBudgetFalsification: number
  maxTurnsReviewer: number
  maxTurnsFalsification: number
  model: 'sonnet' | 'opus' | 'haiku'
  confidenceThreshold: number
  autoPassConfidence: number
  autoDropMaxConfidence: number
  patternCapCount: number
  signalThreshold: number
  hardRulesPath?: string
  noFalsification?: boolean
}

export function resolveConfig(userConfig?: ReviewConfig): ResolvedConfig {
  return {
    ...DEFAULT_CONFIG,
    ...(userConfig?.effort && { effort: userConfig.effort }),
    ...(userConfig?.budgetUsd && {
      // 80% split across 3 reviewers, 20% for falsification — stays within stated total
      maxBudgetPerReviewer: (userConfig.budgetUsd * 0.8) / 3,
      maxBudgetFalsification: userConfig.budgetUsd * 0.2,
    }),
    ...(userConfig?.hardRulesPath && { hardRulesPath: userConfig.hardRulesPath }),
    ...(userConfig?.noFalsification !== undefined && { noFalsification: userConfig.noFalsification }),
  }
}
