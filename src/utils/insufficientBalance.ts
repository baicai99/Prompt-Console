const INSUFFICIENT_BALANCE_PATTERNS = [
  /insufficient[_\s-]?balance/i,
  /insufficient[_\s-]?credits?/i,
  /insufficient[_\s-]?quota/i,
  /quota[_\s-]?(?:exceeded|exhausted)/i,
  /billing required/i,
  /payment required/i,
  /billing hard limit/i,
  /credits?\s+(?:have\s+)?run\s+out/i,
  /credit balance/i,
  /余额不足/i,
  /可用余额不足/i,
  /账户余额不足/i,
  /额度不足/i,
  /额度已用尽/i,
  /配额不足/i,
  /配额已用尽/i,
  /请充值/i,
  /充值后重试/i,
]

export function isInsufficientBalanceMessage(value: string | null | undefined): boolean {
  if (typeof value !== 'string') {
    return false
  }

  const normalized = value.trim()
  if (!normalized) {
    return false
  }

  return INSUFFICIENT_BALANCE_PATTERNS.some((pattern) => pattern.test(normalized))
}
