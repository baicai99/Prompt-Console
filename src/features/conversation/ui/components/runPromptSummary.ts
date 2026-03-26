export const PROMPT_SUMMARY_MAX_CHARS = 100

export function summarizeRunPrompt(prompt: string, maxChars = PROMPT_SUMMARY_MAX_CHARS): string {
  const normalizedPrompt = prompt.trim()
  if (!normalizedPrompt) {
    return '无'
  }

  if (normalizedPrompt.length <= maxChars) {
    return normalizedPrompt
  }

  return `${normalizedPrompt.slice(0, maxChars).trimEnd()}…`
}
