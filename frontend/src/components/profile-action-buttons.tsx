'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiClient, ApiClientError } from '@/lib/api-client'
import { ReportGenerateButton } from '@/components/report-generate-button'

interface ProfileActionButtonsProps {
  profileId: string
}

/**
 * 候補詳細画面のアクションボタン群。
 * - スコア再計算
 * - データ取得（Instagram APIキューへ追加）
 * - レポート生成
 */
export function ProfileActionButtons({ profileId }: ProfileActionButtonsProps) {
  const router = useRouter()

  const [isScoreLoading, setIsScoreLoading] = useState(false)
  const [scoreMessage, setScoreMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  const [isFetchLoading, setIsFetchLoading] = useState(false)
  const [fetchMessage, setFetchMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  async function handleRecalculateScore() {
    setIsScoreLoading(true)
    setScoreMessage(null)
    try {
      await apiClient<unknown>(
        `/api/v1/influencer-profiles/${profileId}/scores`,
        { method: 'POST' },
      )
      setScoreMessage({ type: 'success', text: 'スコアの再計算をキューに追加しました。' })
      router.refresh()
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : 'スコア計算のリクエストに失敗しました。'
      setScoreMessage({ type: 'error', text: message })
    } finally {
      setIsScoreLoading(false)
    }
  }

  async function handleFetchData() {
    setIsFetchLoading(true)
    setFetchMessage(null)
    try {
      await apiClient<unknown>(
        `/api/v1/influencer-profiles/${profileId}/fetch`,
        { method: 'POST' },
      )
      setFetchMessage({ type: 'success', text: 'データ取得をキューに追加しました。' })
      router.refresh()
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : 'データ取得のリクエストに失敗しました。'
      setFetchMessage({ type: 'error', text: message })
    } finally {
      setIsFetchLoading(false)
    }
  }

  return (
    <div className="flex flex-wrap items-start gap-4">
      <div>
        <button
          type="button"
          onClick={handleRecalculateScore}
          disabled={isScoreLoading}
          className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isScoreLoading ? '処理中...' : 'スコア再計算'}
        </button>
        {scoreMessage !== null && (
          <p
            className={`mt-1 text-xs ${scoreMessage.type === 'success' ? 'text-green-700' : 'text-red-600'}`}
          >
            {scoreMessage.text}
          </p>
        )}
      </div>

      <div>
        <button
          type="button"
          onClick={handleFetchData}
          disabled={isFetchLoading}
          className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isFetchLoading ? '処理中...' : 'データ取得'}
        </button>
        {fetchMessage !== null && (
          <p
            className={`mt-1 text-xs ${fetchMessage.type === 'success' ? 'text-green-700' : 'text-red-600'}`}
          >
            {fetchMessage.text}
          </p>
        )}
      </div>

      <ReportGenerateButton profileIds={[profileId]} />
    </div>
  )
}
