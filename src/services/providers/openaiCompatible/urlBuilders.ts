export function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '')
}

export function buildGenerationUrl(baseUrl: string): string {
  const normalized = normalizeBaseUrl(baseUrl)
  const lower = normalized.toLowerCase()

  if (lower.endsWith('/v1/images/generations') || lower.endsWith('/v1/image/generations')) {
    return normalized
  }

  if (lower.endsWith('/v1/images') || lower.endsWith('/v1/image')) {
    return `${normalized}/generations`
  }

  if (lower.endsWith('/v1')) {
    return `${normalized}/images/generations`
  }

  return `${normalized}/v1/images/generations`
}

export function buildEditUrl(baseUrl: string): string {
  const normalized = normalizeBaseUrl(baseUrl)
  const lower = normalized.toLowerCase()

  if (lower.endsWith('/v1/images/edits') || lower.endsWith('/v1/image/edits')) {
    return normalized
  }

  if (lower.endsWith('/v1/images') || lower.endsWith('/v1/image')) {
    return `${normalized}/edits`
  }

  if (lower.endsWith('/v1')) {
    return `${normalized}/images/edits`
  }

  return `${normalized}/v1/images/edits`
}

export function buildChatCompletionsUrl(baseUrl: string): string {
  const normalized = normalizeBaseUrl(baseUrl)
  const lower = normalized.toLowerCase()

  if (lower.endsWith('/v1/chat/completions')) {
    return normalized
  }
  if (lower.endsWith('/chat/completions')) {
    return normalized
  }
  if (lower.endsWith('/v1/chat')) {
    return `${normalized}/completions`
  }
  if (lower.endsWith('/v1')) {
    return `${normalized}/chat/completions`
  }
  return `${normalized}/v1/chat/completions`
}

export function buildGenerationUrlCandidates(baseUrl: string): string[] {
  const normalized = normalizeBaseUrl(baseUrl)
  const lower = normalized.toLowerCase()
  const candidates: string[] = []

  const pushUnique = (value: string) => {
    if (!candidates.includes(value)) {
      candidates.push(value)
    }
  }

  const primary = buildGenerationUrl(baseUrl)
  pushUnique(primary)

  if (primary.includes('/images/generations')) {
    pushUnique(primary.replace('/images/generations', '/image/generations'))
  } else if (primary.includes('/image/generations')) {
    pushUnique(primary.replace('/image/generations', '/images/generations'))
  }

  if (lower.endsWith('/volcv/v1')) {
    pushUnique(`${normalized}/images/generations`)
  } else {
    pushUnique(`${normalized}/volcv/v1/images/generations`)
  }

  if (lower.endsWith('/kling/v1')) {
    pushUnique(`${normalized}/images/generations`)
  } else {
    pushUnique(`${normalized}/kling/v1/images/generations`)
  }

  return candidates
}

export function buildEditUrlCandidates(baseUrl: string): string[] {
  const candidates: string[] = []
  const pushUnique = (value: string) => {
    if (!candidates.includes(value)) {
      candidates.push(value)
    }
  }
  const primary = buildEditUrl(baseUrl)
  pushUnique(primary)
  if (primary.includes('/images/edits')) {
    pushUnique(primary.replace('/images/edits', '/image/edits'))
  } else if (primary.includes('/image/edits')) {
    pushUnique(primary.replace('/image/edits', '/images/edits'))
  }
  return candidates
}

export function toOriginLabel(baseUrl: string): string {
  try {
    const parsed = new URL(baseUrl)
    return parsed.origin
  } catch {
    return baseUrl
  }
}
