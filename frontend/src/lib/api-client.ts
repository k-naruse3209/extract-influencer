import type { ApiError } from '@/types/api'

/**
 * バックエンドAPIが返すエラー形式を表すクラス。
 * code と message を保持し、呼び出し元で分岐できるようにする。
 */
export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

function isApiError(body: unknown): body is ApiError {
  return (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof (body as ApiError).error === 'object'
  )
}

/**
 * バックエンドAPIへのfetchラッパー。
 * - credentials: 'include' でhttpOnly Cookieを自動送信する
 * - エラーレスポンスは { error: { code, message } } 形式を想定する
 * - 型安全なレスポンスを返す
 */
export async function apiClient<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const baseUrl =
    typeof window === 'undefined'
      ? (process.env.BACKEND_URL ?? 'http://localhost:3001')
      : ''

  const url = `${baseUrl}${path}`

  const headers: Record<string, string> = {
    ...options?.headers as Record<string, string>,
  }
  if (options?.body) {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json'
  }

  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers,
  })

  const body: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    if (isApiError(body)) {
      throw new ApiClientError(
        body.error.code,
        body.error.message,
        body.error.details,
      )
    }
    throw new ApiClientError(
      'UNKNOWN_ERROR',
      `Request failed with status ${response.status}`,
    )
  }

  return body as T
}
