import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiClient, ApiClientError } from '../api-client'

describe('apiClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('正常レスポンスのとき parsed body を返す', async () => {
    const mockData = { id: '1', email: 'test@example.com' }
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), { status: 200 }),
    )

    const result = await apiClient<typeof mockData>('/api/v1/auth/me')
    expect(result).toEqual(mockData)
  })

  it('エラーレスポンスのとき ApiClientError をスローする', async () => {
    const errorBody = {
      error: { code: 'UNAUTHORIZED', message: '認証が必要です' },
    }
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(errorBody), { status: 401 }),
    )

    await expect(apiClient('/api/v1/auth/me')).rejects.toThrow(ApiClientError)
  })

  it('エラーレスポンスのとき code と message を保持する', async () => {
    const errorBody = {
      error: { code: 'UNAUTHORIZED', message: '認証が必要です' },
    }
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(errorBody), { status: 401 }),
    )

    let caught: unknown
    try {
      await apiClient('/api/v1/auth/me')
    } catch (e) {
      caught = e
    }

    expect(caught).toBeInstanceOf(ApiClientError)
    const error = caught as ApiClientError
    expect(error.code).toBe('UNAUTHORIZED')
    expect(error.message).toBe('認証が必要です')
  })

  it('エラーボディが ApiError 形式でないとき UNKNOWN_ERROR をスローする', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ unexpected: true }), { status: 500 }),
    )

    let caught: unknown
    try {
      await apiClient('/api/v1/auth/me')
    } catch (e) {
      caught = e
    }

    expect(caught).toBeInstanceOf(ApiClientError)
    const error = caught as ApiClientError
    expect(error.code).toBe('UNKNOWN_ERROR')
  })

  it('credentials: include でfetchを呼び出す', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 200 }),
    )

    await apiClient('/api/v1/auth/me')

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/auth/me'),
      expect.objectContaining({ credentials: 'include' }),
    )
  })
})
