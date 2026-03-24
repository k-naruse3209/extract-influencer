'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { SavedCandidate } from '@/types/api'
import { apiClient, ApiClientError } from '@/lib/api-client'
import { cn } from '@/lib/utils'

interface SavedCandidatesListProps {
  candidates: SavedCandidate[]
}

const MAX_COMPARE = 10

/**
 * 保存済み候補一覧の表示と操作。
 * - 削除ボタン
 * - 比較選択（最大10件）→ /compare へ遷移
 */
export function SavedCandidatesList({ candidates }: SavedCandidatesListProps) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [errorMessages, setErrorMessages] = useState<Record<string, string>>({})

  function toggleSelect(savedId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(savedId)) {
        next.delete(savedId)
      } else if (next.size < MAX_COMPARE) {
        next.add(savedId)
      }
      return next
    })
  }

  async function handleDelete(savedId: string) {
    setDeletingIds((prev) => new Set(prev).add(savedId))
    setErrorMessages((prev) => {
      const next = { ...prev }
      delete next[savedId]
      return next
    })

    try {
      await apiClient<unknown>(`/api/v1/saved-candidates/${savedId}`, {
        method: 'DELETE',
      })
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(savedId)
        return next
      })
      router.refresh()
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : '削除に失敗しました。'
      setErrorMessages((prev) => ({ ...prev, [savedId]: message }))
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev)
        next.delete(savedId)
        return next
      })
    }
  }

  function handleCompare() {
    const profileIds = candidates
      .filter((c) => selectedIds.has(c.id))
      .map((c) => c.profileId)
    router.push(`/compare?profileIds=${profileIds.join(',')}`)
  }

  if (candidates.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800">
        <p className="text-gray-500 dark:text-gray-400">保存済みの候補がありません。</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          候補検索から候補を保存できます。
        </p>
        <Link
          href="/candidates"
          className="mt-4 inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:bg-indigo-500 dark:hover:bg-indigo-400"
        >
          候補検索へ
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {selectedIds.size > 0 && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 dark:border-indigo-700 dark:bg-indigo-900/30"
        >
          <p className="text-sm text-indigo-700 dark:text-indigo-300">
            {selectedIds.size} 件選択中（最大 {MAX_COMPARE} 件）
          </p>
          <button
            type="button"
            onClick={handleCompare}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            比較する
          </button>
        </div>
      )}

      {/* モバイル: カード表示 */}
      <div className="flex flex-col gap-3 md:hidden">
        {candidates.map((saved) => {
          const isSelected = selectedIds.has(saved.id)
          const isDeleting = deletingIds.has(saved.id)
          const deleteError = errorMessages[saved.id]
          const deleteErrorId = `delete-error-${saved.id}`

          return (
            <div
              key={saved.id}
              className={cn(
                'rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800',
                isSelected && 'border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-900/30',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id={`select-card-${saved.id}`}
                    checked={isSelected}
                    onChange={() => toggleSelect(saved.id)}
                    disabled={!isSelected && selectedIds.size >= MAX_COMPARE}
                    aria-label={`${saved.profile.username} を比較対象に選択`}
                    className="mt-0.5 rounded border-gray-300 text-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {saved.profile.username}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {saved.profile.platform}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  {saved.profile.latestScore !== null ? (
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {saved.profile.latestScore.totalScore}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-500 dark:text-gray-400" aria-label="スコアなし">—</span>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-400">総合スコア</p>
                </div>
              </div>

              {saved.note !== null && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{saved.note}</p>
              )}

              {saved.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {saved.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-3 flex items-center justify-end gap-3 border-t border-gray-100 pt-3 dark:border-gray-700">
                <Link
                  href={`/candidates/${saved.profileId}`}
                  className="text-xs text-indigo-600 hover:text-indigo-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 rounded dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  詳細
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(saved.id)}
                  disabled={isDeleting}
                  aria-busy={isDeleting}
                  aria-label={`${saved.profile.username} を削除`}
                  aria-describedby={deleteError !== undefined ? deleteErrorId : undefined}
                  className="rounded text-xs text-red-600 hover:text-red-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
                >
                  {isDeleting ? '削除中...' : '削除'}
                </button>
              </div>
              {deleteError !== undefined && (
                <p id={deleteErrorId} role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {deleteError}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* デスクトップ: テーブル表示 */}
      <div className="hidden overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 md:block">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <caption className="sr-only">保存済みインフルエンサー候補一覧</caption>
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th scope="col" className="w-10 px-4 py-3">
                <span className="sr-only">比較選択</span>
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                ユーザー名
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                プラットフォーム
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                総合スコア
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                メモ
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                タグ
              </th>
              <th scope="col" className="px-6 py-3">
                <span className="sr-only">操作</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
            {candidates.map((saved) => {
              const isSelected = selectedIds.has(saved.id)
              const isDeleting = deletingIds.has(saved.id)
              const deleteError = errorMessages[saved.id]
              const deleteErrorId = `delete-error-table-${saved.id}`

              return (
                <tr
                  key={saved.id}
                  className={cn(
                    'hover:bg-gray-50 dark:hover:bg-gray-700',
                    isSelected && 'bg-indigo-50 dark:bg-indigo-900/30',
                  )}
                >
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      id={`select-${saved.id}`}
                      checked={isSelected}
                      onChange={() => toggleSelect(saved.id)}
                      disabled={
                        !isSelected && selectedIds.size >= MAX_COMPARE
                      }
                      aria-label={`${saved.profile.username} を比較対象に選択`}
                      className="rounded border-gray-300 text-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600"
                    />
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {saved.profile.username}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                    {saved.profile.platform}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {saved.profile.latestScore !== null
                      ? saved.profile.latestScore.totalScore
                      : <span className="text-gray-500 dark:text-gray-400" aria-label="スコアなし">—</span>}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {saved.note !== null ? saved.note : <span className="text-gray-500 dark:text-gray-400" aria-label="メモなし">—</span>}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {saved.tags.length > 0 ? (
                        saved.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                          >
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-500 dark:text-gray-400" aria-label="タグなし">—</span>
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/candidates/${saved.profileId}`}
                        className="rounded text-xs text-indigo-600 hover:text-indigo-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 dark:text-indigo-400 dark:hover:text-indigo-300"
                        aria-label={`${saved.profile.username} の詳細を見る`}
                      >
                        詳細
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(saved.id)}
                        disabled={isDeleting}
                        aria-busy={isDeleting}
                        aria-label={`${saved.profile.username} を削除`}
                        aria-describedby={deleteError !== undefined ? deleteErrorId : undefined}
                        className="rounded text-xs text-red-600 hover:text-red-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
                      >
                        {isDeleting ? '削除中...' : '削除'}
                      </button>
                    </div>
                    {deleteError !== undefined && (
                      <p id={deleteErrorId} role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">{deleteError}</p>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
