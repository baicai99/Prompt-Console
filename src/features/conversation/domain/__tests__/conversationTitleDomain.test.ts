import { describe, expect, it } from 'vitest'
import {
  buildConversationTitleGenerationMessages,
  cleanGeneratedConversationTitle,
  finalizeConversationTitleDisplay,
} from '../conversationTitleDomain'

describe('conversationTitleDomain', () => {
  it('builds a system prompt that requires title-only output', () => {
    const messages = buildConversationTitleGenerationMessages('请帮我规划一次东京赏樱旅行')

    expect(messages).toHaveLength(2)
    expect(messages[0]?.role).toBe('system')
    expect(messages[0]?.content).toContain('只能包含标题文本本身')
    expect(messages[0]?.content).toContain('最终返回必须是一个普通字符串')
    expect(messages[0]?.content).toContain('不要输出 JSON、Markdown、列表、代码块')
    expect(messages[0]?.content).toContain('不要回答问题')
    expect(messages[1]).toEqual({
      role: 'user',
      content: '请帮我规划一次东京赏樱旅行',
    })
  })

  it('cleans generated titles by removing prefixes, quotes, blank lines, and extra spaces', () => {
    expect(cleanGeneratedConversationTitle('\n\n标题："  东京赏樱 行程规划  "\n补充说明')).toBe('东京赏樱 行程规划')
  })

  it('finalizes display titles with fallback and length policy', () => {
    expect(finalizeConversationTitleDisplay('')).toBe('未命名')
    expect(finalizeConversationTitleDisplay('东京赏樱 行程规划')).toBe('东京赏樱 行程规划')
  })

  it('keeps cleaning separate from final truncation policy', () => {
    const cleaned = cleanGeneratedConversationTitle('标题：React19升级迁移检查清单与兼容性风险排查方案详细版AlphaBetaGamma')
    expect(cleaned).toBe('React19升级迁移检查清单与兼容性风险排查方案详细版AlphaBetaGamma')
    expect(finalizeConversationTitleDisplay(cleaned)).toContain('...')
  })
})
