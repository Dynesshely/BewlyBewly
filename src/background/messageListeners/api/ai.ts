import type { APIMAP } from '../../utils'

interface CardMeta {
  id: string
  title: string
  author?: string
  duration?: string
  view?: string
  reason?: string
}

interface AiFilterMessage {
  baseURL: string
  apiKey: string
  model: string
  cards: CardMeta[]
  userPrompt?: string
}

const SYSTEM_PROMPT = `你是 B 站首页视频信息初筛助手。用户会给出若干视频卡片（标题、UP 主、时长、播放量、推荐原因）。
请判断每个视频是否值得优先观看，返回严格 JSON：
{"results":[{"id":"<视频 id>","score":0-100,"category":"推荐|普通|广告|低质|重复","reason":"一句话理由"}]}
只返回 JSON，不要输出其他内容。评分依据：内容信息量、标题质量、是否标题党/广告、与用户偏好的相关性。`

function buildUserPrompt(cards: CardMeta[], userPrompt?: string): string {
  const lines = cards.map((card) => {
    const parts = [
      `id=${card.id}`,
      `标题=${card.title.slice(0, 80)}`,
      card.author
        ? `UP=${card.author}`
        : '',
      card.duration
        ? `时长=${card.duration}`
        : '',
      card.view
        ? `播放=${card.view}`
        : '',
      card.reason
        ? `推荐原因=${card.reason}`
        : '',
    ].filter(Boolean)
    return parts.join(' | ')
  })
  const preference = userPrompt
    ? `\n用户偏好：${userPrompt}`
    : ''
  return `请初筛以下 ${cards.length} 个视频：\n${lines.join('\n')}${preference}`
}

const API_AI: APIMAP = {
  aiFilterCards: async (message, sender, sendResponse) => {
    const msg = message as unknown as AiFilterMessage
    try {
      if (!msg.baseURL || !msg.model || !Array.isArray(msg.cards) || !msg.cards.length) {
        sendResponse?.({ ok: false, error: 'missing config or cards' })
        return
      }
      const url = `${msg.baseURL.replace(/\/+$/, '')}/chat/completions`
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(msg.apiKey
            ? { Authorization: `Bearer ${msg.apiKey}` }
            : {}),
        },
        body: JSON.stringify({
          model: msg.model,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: buildUserPrompt(msg.cards, msg.userPrompt),
            },
          ],
        }),
      })
      if (!response.ok) {
        sendResponse?.({ ok: false, error: `HTTP ${response.status}` })
        return
      }
      const data = await response.json() as any
      const content = data?.choices?.[0]?.message?.content ?? ''
      sendResponse?.({ ok: true, content })
    }
    catch (e) {
      sendResponse?.({
        ok: false,
        error: String(e),
      })
    }
  },
}

export default API_AI
