'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { apiClient, ApiClientError } from '@/lib/api-client'
import type { InstagramConnectionStatus } from '@/types/api'

/**
 * Instagram連携設定画面。
 *
 * URLクエリパラメータ:
 *   ?connected=true  — OAuth完了後のリダイレクトで成功を表示する
 *   ?error=...       — OAuth失敗後のリダイレクトでエラーを表示する
 */
export default function InstagramSettingsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [status, setStatus] = useState<InstagramConnectionStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const connectedParam = searchParams.get('connected')
  const errorParam = searchParams.get('error')

  const loadStatus = useCallback(async () => {
    setIsLoading(true)
    setFetchError(null)
    try {
      const data = await apiClient<InstagramConnectionStatus>(
        '/api/v1/instagram/status',
      )
      setStatus(data)
    } catch (error) {
      if (error instanceof ApiClientError) {
        setFetchError(error.message)
      } else {
        setFetchError('連携状態の取得に失敗しました。ページを再読み込みしてください。')
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  function handleConnect() {
    window.location.href = '/api/v1/auth/instagram'
  }

  async function handleDisconnect() {
    const confirmed = window.confirm(
      'Instagram連携を解除しますか？解除後はInstagramデータの取得ができなくなります。',
    )
    if (!confirmed) return

    setIsDisconnecting(true)
    try {
      await apiClient<{ message: string }>('/api/v1/instagram/disconnect', {
        method: 'DELETE',
      })
      setStatus({ connected: false })
      router.replace('/settings/instagram')
    } catch (error) {
      if (error instanceof ApiClientError) {
        setFetchError(error.message)
      } else {
        setFetchError('連携解除に失敗しました。しばらく経ってから再試行してください。')
      }
    } finally {
      setIsDisconnecting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Instagram 連携</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Instagram アカウントを連携してプロフィールデータを取得できます
        </p>
      </div>

      {connectedParam === 'true' && (
        <div
          role="alert"
          className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-700 dark:bg-green-900/30 dark:text-green-300"
        >
          Instagram アカウントが正常に連携されました
        </div>
      )}

      {errorParam !== null && errorParam.length > 0 && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300"
        >
          連携に失敗しました: {decodeURIComponent(errorParam)}
        </div>
      )}

      {fetchError !== null && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300"
        >
          {fetchError}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">連携状態</h2>

        {isLoading ? (
          <div
            aria-busy="true"
            aria-label="連携状態を読み込んでいます"
            className="mt-4 flex flex-col gap-3"
          >
            <div aria-hidden="true" className="h-5 w-64 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
            <div aria-hidden="true" className="h-9 w-28 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
          </div>
        ) : status?.connected === true ? (
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="inline-flex h-2 w-2 rounded-full bg-green-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                <span className="font-medium">@{status.username}</span> で連携中
              </span>
            </div>
            {status.connectedAt !== undefined && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                連携日時:{' '}
                {new Date(status.connectedAt).toLocaleString('ja-JP', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}
            <button
              type="button"
              onClick={() => void handleDisconnect()}
              disabled={isDisconnecting}
              aria-busy={isDisconnecting}
              className="inline-flex w-full items-center justify-center rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors dark:border-red-700 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-900/20 sm:w-fit sm:justify-start"
            >
              {isDisconnecting ? '解除中...' : '連携解除'}
            </button>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="inline-flex h-2 w-2 rounded-full bg-gray-300" />
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Instagram アカウントが連携されていません
              </span>
            </div>
            <button
              type="button"
              onClick={handleConnect}
              className="inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 transition-colors sm:w-fit sm:justify-start"
            >
              連携する
            </button>
          </div>
        )}
      </div>

      <div className="rounded-md border border-gray-100 bg-gray-50 p-4 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
        <p className="font-medium text-gray-600 dark:text-gray-300">連携についての注意事項</p>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>
            連携には Instagram の公式 OAuth 認証を使用します
          </li>
          <li>
            取得するスコープ: instagram_basic, instagram_content_publish
          </li>
          <li>
            個人アカウントの場合、フォロワー数などの一部データは API の仕様上取得できません
          </li>
          <li>
            アクセストークンは暗号化して保存されます
          </li>
        </ul>
      </div>
    </div>
  )
}
