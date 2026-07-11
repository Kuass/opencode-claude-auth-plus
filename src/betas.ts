import { config, getModelOverride } from "./model-config.ts"

// Beta flags to try removing in order when "long context" errors occur
export const LONG_CONTEXT_BETAS = config.longContextBetas

function getRequiredBetas(): string[] {
  return (process.env.ANTHROPIC_BETA_FLAGS ?? config.baseBetas.join(","))
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

// Session-level cache of excluded beta flags per model (resets on process restart)
const excludedBetas: Map<string, Set<string>> = new Map()

// Track the last-seen beta flags env var and model to detect changes
let lastBetaFlagsEnv: string | undefined = process.env.ANTHROPIC_BETA_FLAGS
let lastModelId: string | undefined

export function getExcludedBetas(modelId: string): Set<string> {
  // Reset exclusions if user changed ANTHROPIC_BETA_FLAGS
  const currentBetaFlags = process.env.ANTHROPIC_BETA_FLAGS
  if (currentBetaFlags !== lastBetaFlagsEnv) {
    excludedBetas.clear()
    lastBetaFlagsEnv = currentBetaFlags
  }

  // Reset exclusions if user switched models (new model may support different betas)
  if (lastModelId !== undefined && lastModelId !== modelId) {
    excludedBetas.clear()
  }
  lastModelId = modelId

  return excludedBetas.get(modelId) ?? new Set()
}

export function addExcludedBeta(modelId: string, beta: string): void {
  const existing = excludedBetas.get(modelId) ?? new Set()
  existing.add(beta)
  excludedBetas.set(modelId, existing)
}

export function resetExcludedBetas(): void {
  excludedBetas.clear()
  lastModelId = undefined
}

export function isLongContextError(responseBody: string): boolean {
  return (
    responseBody.includes(
      "Extra usage is required for long context requests",
    ) ||
    responseBody.includes("long context beta is not yet available") ||
    responseBody.includes("You're out of extra usage")
  )
}

export function getNextBetaToExclude(modelId: string): string | null {
  const excluded = getExcludedBetas(modelId)
  for (const beta of LONG_CONTEXT_BETAS) {
    if (!excluded.has(beta)) {
      return beta
    }
  }
  return null // All long-context betas already excluded
}

export function getModelBetas(
  modelId: string,
  excluded?: Set<string>,
): string[] {
  const betas = [...getRequiredBetas()]

  // Apply per-model overrides (e.g. haiku excludes claude-code-20250219)
  const override = getModelOverride(modelId)
  if (override) {
    if (override.exclude) {
      for (const ex of override.exclude) {
        const idx = betas.indexOf(ex)
        if (idx !== -1) betas.splice(idx, 1)
      }
    }
    if (override.add) {
      for (const add of override.add) {
        if (!betas.includes(add)) betas.push(add)
      }
    }
  }

  // Filter out excluded betas (from previous failed requests due to long context errors)
  if (excluded && excluded.size > 0) {
    return betas.filter((beta) => !excluded.has(beta))
  }

  return betas
}
