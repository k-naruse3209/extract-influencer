'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiClient, ApiClientError } from '@/lib/api-client'

interface CreateProfileResponse {
  id: string
  username: string
  platform: string
}

function sanitizeUsername(raw: string): string {
  return raw.trim().replace(/^@/, '')
}

/**
 * Instagramユーザー名を入力してプロフィール取得・分析を開始するフォーム。
 * 取得成功時は詳細ページへ遷移する。
 * Next.js リライトプロキシ経由で apiClient を使用し、httpOnly Cookie を自動送信する。
 */
export function FetchProfileForm() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorMessage(null)

    const normalized = sanitizeUsername(username)
    if (normalized === '') {
      setErrorMessage('ユーザー名を入力してください。')
      return
    }

    setIsLoading(true)

    try {
      const profile = await apiClient<CreateProfileResponse>(
        '/api/v1/influencer-profiles',
        {
          method: 'POST',
          body: JSON.stringify({ username: normalized, platform: 'INSTAGRAM' }),
        },
      )
      router.push(`/candidates/${profile.id}`)
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage(
          'ネットワークエラーが発生しました。接続を確認してから再試行してください。',
        )
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Instagramユーザーを新規分析"
      aria-busy={isLoading}
      noValidate
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="fetch-username-input"
            className="text-xs font-medium text-gray-700"
          >
            Instagramユーザー名
          </label>
          <input
            id="fetch-username-input"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="例: example_user"
            disabled={isLoading}
            aria-describedby={
              errorMessage !== null ? 'fetch-profile-error' : undefined
            }
            aria-invalid={errorMessage !== null}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          aria-label={isLoading ? '取得中' : 'Instagramプロフィールを取得・分析する'}
          className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? '取得中...' : '取得・分析'}
        </button>
      </div>

      {errorMessage !== null && (
        <p
          id="fetch-profile-error"
          role="alert"
          className="mt-2 text-sm text-red-600"
        >
          {errorMessage}
        </p>
      )}
    </form>
  )
}
