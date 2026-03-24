import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ClaudeApiClient } from './claude-api.client'
import { LlmParseException } from './exceptions/llm-parse.exception'

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------

function makeTextResponse(text: string) {
  return {
    content: [{ type: 'text', text }],
  }
}

function makeJsonResponse(obj: unknown) {
  return makeTextResponse(JSON.stringify(obj))
}

// ---------------------------------------------------------------------------
// テスト対象
// ---------------------------------------------------------------------------

describe('ClaudeApiClient', () => {
  let client: ClaudeApiClient
  let mockCreate: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockCreate = vi.fn()
    // ESM モジュールモックの代わりに、インスタンスの内部クライアントを直接置き換える
    client = new ClaudeApiClient()
    ;(client as unknown as Record<string, unknown>)['client'] = {
      messages: { create: mockCreate },
    }
  })

  describe('generateStructuredOutput', () => {
    it('正常なJSONレスポンスをパースして返す', async () => {
      const expected = { score: 75, confidence: 'medium', rationale: 'テスト' }
      mockCreate.mockResolvedValueOnce(makeJsonResponse(expected))

      const result = await client.generateStructuredOutput<typeof expected>(
        'systemPrompt',
        'userPrompt',
      )

      expect(result).toEqual(expected)
      expect(mockCreate).toHaveBeenCalledOnce()
    })

    it('マークダウンコードブロックで囲まれたJSONも正常にパースする', async () => {
      const expected = { score: 60, confidence: 'low' }
      const markdownWrapped = '```json\n' + JSON.stringify(expected) + '\n```'
      mockCreate.mockResolvedValueOnce(makeTextResponse(markdownWrapped))

      const result = await client.generateStructuredOutput<typeof expected>(
        'systemPrompt',
        'userPrompt',
      )

      expect(result).toEqual(expected)
      expect(mockCreate).toHaveBeenCalledOnce()
    })

    it('1回目のパース失敗後にリトライし、2回目が成功した場合は結果を返す', async () => {
      const expected = { score: 50, confidence: 'high' }

      mockCreate
        .mockResolvedValueOnce(makeTextResponse('これはJSONではありません'))
        .mockResolvedValueOnce(makeJsonResponse(expected))

      const result = await client.generateStructuredOutput<typeof expected>(
        'systemPrompt',
        'userPrompt',
      )

      expect(result).toEqual(expected)
      expect(mockCreate).toHaveBeenCalledTimes(2)
    })

    it('2回ともパース失敗したとき LlmParseException を投げる', async () => {
      mockCreate
        .mockResolvedValueOnce(makeTextResponse('不正なJSON1'))
        .mockResolvedValueOnce(makeTextResponse('不正なJSON2'))

      await expect(
        client.generateStructuredOutput('systemPrompt', 'userPrompt'),
      ).rejects.toThrow(LlmParseException)

      expect(mockCreate).toHaveBeenCalledTimes(2)
    })

    it('APIがエラーをスローした場合はそのままエラーが伝播する', async () => {
      const apiError = new Error('Anthropic API connection error')
      mockCreate.mockRejectedValueOnce(apiError)

      await expect(
        client.generateStructuredOutput('systemPrompt', 'userPrompt'),
      ).rejects.toThrow('Anthropic API connection error')
    })

    it('コンテンツタイプが text 以外の場合は LlmParseException を投げる', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'tool_use', id: 'tool-1', name: 'get_weather', input: {} }],
      })

      await expect(
        client.generateStructuredOutput('systemPrompt', 'userPrompt'),
      ).rejects.toThrow(LlmParseException)
    })

    it('カスタムモデルを指定した場合はそのモデルでAPIを呼び出す', async () => {
      const expected = { value: 42 }
      mockCreate.mockResolvedValueOnce(makeJsonResponse(expected))

      await client.generateStructuredOutput('sys', 'user', 'claude-opus-4-5')

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'claude-opus-4-5' }),
      )
    })

    it('temperature=0 で呼び出す（再現性の確保）', async () => {
      mockCreate.mockResolvedValueOnce(makeJsonResponse({ ok: true }))

      await client.generateStructuredOutput('sys', 'user')

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ temperature: 0 }),
      )
    })
  })

  describe('getModel', () => {
    it('環境変数が未設定の場合はデフォルトモデルを返す', () => {
      const model = client.getModel()
      expect(typeof model).toBe('string')
      expect(model.length).toBeGreaterThan(0)
    })
  })
})
