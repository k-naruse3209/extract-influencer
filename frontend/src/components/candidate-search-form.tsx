'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useTransition } from 'react'
import { cn } from '@/lib/utils'

const PLATFORMS = [
  { value: '', label: 'すべて' },
  { value: 'INSTAGRAM', label: 'Instagram' },
  { value: 'TIKTOK', label: 'TikTok' },
]

/**
 * 候補一覧画面の検索フォーム。
 * URL クエリパラメータ（username, platform, page）を更新することで
 * Server Component 側のデータ取得を再実行させる。
 */
export function CandidateSearchForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const currentUsername = searchParams.get('username') ?? ''
  const currentPlatform = searchParams.get('platform') ?? ''

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value === '') {
          params.delete(key)
        } else {
          params.set(key, value)
        }
      }
      // 検索条件変更時はページを1に戻す
      params.delete('page')
      startTransition(() => {
        router.push(`/candidates?${params.toString()}`)
      })
    },
    [router, searchParams],
  )

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label
          htmlFor="username-input"
          className="text-xs font-medium text-gray-700"
        >
          ユーザー名
        </label>
        <input
          id="username-input"
          type="text"
          defaultValue={currentUsername}
          placeholder="例: example_user"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              updateParams({ username: e.currentTarget.value })
            }
          }}
          onBlur={(e) => {
            if (e.currentTarget.value !== currentUsername) {
              updateParams({ username: e.currentTarget.value })
            }
          }}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="platform-select"
          className="text-xs font-medium text-gray-700"
        >
          プラットフォーム
        </label>
        <select
          id="platform-select"
          defaultValue={currentPlatform}
          onChange={(e) => updateParams({ platform: e.target.value })}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          {PLATFORMS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {isPending && (
        <span className="text-xs text-gray-500">検索中...</span>
      )}

      <span className={cn('text-xs text-gray-400', isPending && 'opacity-0')}>
        Enter または選択で検索
      </span>
    </div>
  )
}
