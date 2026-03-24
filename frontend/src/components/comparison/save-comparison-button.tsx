'use client'

import { useState } from 'react'
import { apiClient, ApiClientError } from '@/lib/api-client'
import type { ComparisonSession } from '@/types/api'

interface SaveComparisonButtonProps {
  profileIds: string[]
}

type SaveState = 'idle' | 'saving' | 'success' | 'error'

/**
 * 現在表示中の比較をセッションとして保存するボタン。
 * 1. POST /api/v1/comparison-sessions でセッション作成
 * 2. 各 profileId を POST /api/v1/comparison-sessions/:id/items で追加
 * 保存に成功したら成功メッセージを表示する。
 */
export function SaveComparisonButton({ profileIds }: SaveComparisonButtonProps) {
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSave() {
    setSaveState('saving')
    setErrorMessage(null)

    try {
      await apiClient<ComparisonSession>(
        '/api/v1/comparison-sessions',
        {
          method: 'POST',
          body: JSON.stringify({ profileIds }),
        },
      )

      setSaveState('success')
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : '比較の保存に失敗しました。'
      setErrorMessage(message)
      setSaveState('error')
    }
  }

  if (saveState === 'success') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700 dark:border-green-700 dark:bg-green-900/30 dark:text-green-300"
      >
        比較を保存しました。
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleSave}
        disabled={saveState === 'saving' || profileIds.length === 0}
        aria-busy={saveState === 'saving'}
        aria-describedby={saveState === 'error' && errorMessage !== null ? 'save-comparison-error' : undefined}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
      >
        {saveState === 'saving' ? '保存中...' : 'この比較を保存'}
      </button>
      {saveState === 'error' && errorMessage !== null && (
        <p id="save-comparison-error" role="alert" className="text-xs text-red-600 dark:text-red-400">{errorMessage}</p>
      )}
    </div>
  )
}
