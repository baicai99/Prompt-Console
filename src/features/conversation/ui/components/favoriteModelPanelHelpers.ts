import { filterModelsByTag } from '../../domain/modelCatalogDomain'
import { inferModelShortcutTokens } from '../../domain/modelShortcuts'
import type { ModelSpec } from '../../../../types/model'

export function resolveVisibleModelsForPicker(input: {
  models: ModelSpec[]
  providerFilter?: string
  trainerTagFilter?: string
  search: string
}): ModelSpec[] {
  const normalizedQuery = normalizeSearchText(input.search)
  return input.models.filter((model) => {
    if (input.providerFilter && getModelProviderLabel(model) !== input.providerFilter) {
      return false
    }
    if (input.trainerTagFilter && filterModelsByTag([model], input.trainerTagFilter, '__all__').length === 0) {
      return false
    }
    if (!normalizedQuery) {
      return true
    }
    return matchesModelSearch(model, normalizedQuery)
  })
}

export function splitModelLabel(model: Pick<ModelSpec, 'name' | 'sourceName'> | null): { primary: string; secondary: string } {
  if (!model) {
    return { primary: '', secondary: '' }
  }

  const normalized = model.name.trim()
  const parentheticalMatch = normalized.match(/\s*[(（](https?:\/\/[^)）\s]+|[^)）]+)[)）]\s*$/i)
  const parentheticalValue = parentheticalMatch?.[1]?.trim() ?? ''

  const primary = parentheticalMatch
    ? normalized.slice(0, normalized.length - parentheticalMatch[0].length).trimEnd()
    : normalized
  const secondaryCandidate = model.sourceName?.trim() || parentheticalValue

  return {
    primary,
    secondary: formatSecondaryLabel(secondaryCandidate),
  }
}

function matchesModelSearch(model: ModelSpec, query: string): boolean {
  return buildSearchTokens(model).some((token) => {
    if (token.includes(query)) {
      return true
    }
    const compactToken = compactSearchText(token)
    const compactQuery = compactSearchText(query)
    if (!compactToken || !compactQuery) {
      return false
    }
    return compactToken.includes(compactQuery) || isSubsequenceMatch(compactQuery, compactToken)
  })
}

function buildSearchTokens(model: ModelSpec): string[] {
  return inferModelShortcutTokens(model).flatMap((token) => {
    const normalizedToken = normalizeSearchText(token)
    const compactToken = compactSearchText(token)
    return compactToken && compactToken !== normalizedToken
      ? [normalizedToken, compactToken]
      : [normalizedToken]
  })
}

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase()
}

function compactSearchText(value: string): string {
  return normalizeSearchText(value).replace(/[^a-z0-9\u4e00-\u9fff]/g, '')
}

function isSubsequenceMatch(query: string, target: string): boolean {
  let queryIndex = 0
  for (const char of target) {
    if (char === query[queryIndex]) {
      queryIndex += 1
      if (queryIndex === query.length) {
        return true
      }
    }
  }
  return queryIndex === query.length
}

function getModelProviderLabel(model: Pick<ModelSpec, 'name' | 'sourceName'>): string {
  return splitModelLabel(model).secondary
}

function formatSecondaryLabel(value: string): string {
  if (!value) {
    return ''
  }
  const normalized = value.trim()
  const withoutBrackets = normalized.replace(/^[（(]\s*/, '').replace(/\s*[）)]$/, '')
  const urlMatch = withoutBrackets.match(/^https?:\/\/([^/]+)(?:\/.*)?$/i)
  if (urlMatch) {
    return urlMatch[1]
  }
  return withoutBrackets
}
