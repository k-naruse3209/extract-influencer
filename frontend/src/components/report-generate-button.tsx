'use client'

import { useState } from 'react'
import { apiClient, ApiClientError } from '@/lib/api-client'
import type { CreateReportRequest, Report } from '@/types/api'
import { cn } from '@/lib/utils'

interface ReportGenerateButtonProps {
  profileIds: string[]
  className?: string
}

/**
 * PDF または CSV レポートの生成をトリガーするボタン。
 * 生成リクエスト送信中はローディング状態を表示する。
 * 生成後はレポート一覧へ誘導するメッセージを表示する。
 */
export function ReportGenerateButton({
  profileIds,
  className,
}: ReportGenerateButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleGenerate(format: 'PDF' | 'CSV') {
    setIsLoading(true)
    setSuccessMessage(null)
    setErrorMessage(null)

    try {
      const payload: CreateReportRequest = {
        format,
        reportType: profileIds.length > 1 ? 'COMPARISON' : 'SINGLE_PROFILE',
        profileIds,
        title: `インフルエンサー分析レポート (${format})`,
      }

      await apiClient<Report>('/api/v1/reports', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      setSuccessMessage(
        `${format} レポートのキューに追加しました。レポート一覧で確認できます。`,
      )
      setIsOpen(false)
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage('レポートの生成リクエストに失敗しました。')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={isLoading || profileIds.length === 0}
        className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        レポート生成
      </button>

      {isOpen && (
        <div className="absolute right-0 z-10 mt-2 w-44 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5">
          <div className="py-1">
            <button
              type="button"
              onClick={() => handleGenerate('PDF')}
              disabled={isLoading}
              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              PDF で生成
            </button>
            <button
              type="button"
              onClick={() => handleGenerate('CSV')}
              disabled={isLoading}
              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              CSV で生成
            </button>
          </div>
        </div>
      )}

      {isLoading && (
        <p className="mt-2 text-xs text-gray-500">リクエスト送信中...</p>
      )}
      {successMessage !== null && (
        <p className="mt-2 text-xs text-green-700">{successMessage}</p>
      )}
      {errorMessage !== null && (
        <p className="mt-2 text-xs text-red-600">{errorMessage}</p>
      )}
    </div>
  )
}
