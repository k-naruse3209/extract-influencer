'use client'

import { useState } from 'react'
import { apiClient, ApiClientError } from '@/lib/api-client'
import type { SavedCandidate } from '@/types/api'

interface SaveCandidateButtonProps {
  profileId: string
}

/**
 * インフルエンサー候補を保存済みリストに追加するボタン。
 * 二重送信防止のため保存後は非活性にする。
 */
export function SaveCandidateButton({ profileId }: SaveCandidateButtonProps) {
  const [isSaved, setIsSaved] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSave() {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      await apiClient<SavedCandidate>('/api/v1/saved-candidates', {
        method: 'POST',
        body: JSON.stringify({ profileId }),
      })
      setIsSaved(true)
    } catch (err) {
      if (err instanceof ApiClientError) {
        // 既に保存済みの場合はその旨を伝える
        if (err.code === 'ALREADY_EXISTS') {
          setIsSaved(true)
        } else {
          setErrorMessage(err.message)
        }
      } else {
        setErrorMessage('保存に失敗しました。')
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (isSaved) {
    return (
      <span className="inline-flex items-center rounded-md bg-green-50 px-2.5 py-1.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-200">
        保存済み
      </span>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleSave}
        disabled={isLoading}
        className="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? '保存中...' : '保存'}
      </button>
      {errorMessage !== null && (
        <p className="mt-1 text-xs text-red-600">{errorMessage}</p>
      )}
    </div>
  )
}
