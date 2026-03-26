import { describe, expect, it } from 'vitest'
import { classifyFailure, classifyFailureFromError } from '../failureClassifier'

describe('failureClassifier', () => {
  it('classifies billing and balance exhaustion messages as insufficient balance', () => {
    expect(classifyFailure('insufficient_quota: credits have run out')).toBe('insufficient_balance')
    expect(classifyFailure('billing required before requesting more images')).toBe('insufficient_balance')
    expect(classifyFailure('账户余额不足，请充值后重试')).toBe('insufficient_balance')
  })

  it('prefers explicit provider error codes when available', () => {
    const error = Object.assign(new Error('HTTP 402'), {
      code: 'insufficient_balance' as const,
      providerId: 'openai-compatible',
    })

    expect(classifyFailureFromError(error)).toBe('insufficient_balance')
  })
})
