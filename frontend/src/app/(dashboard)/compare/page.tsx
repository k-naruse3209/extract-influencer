import { cookies } from 'next/headers'
import Link from 'next/link'
import type { InfluencerProfile } from '@/types/api'
import { ComparisonTable } from '@/components/comparison/comparison-table'
import { SaveComparisonButton } from '@/components/comparison/save-comparison-button'

const MAX_COMPARE = 10

interface ComparePageProps {
  searchParams: Promise<{ profileIds?: string }>
}

async function fetchProfile(
  id: string,
  cookieHeader: string,
): Promise<InfluencerProfile> {
  const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:3001'

  const response = await fetch(
    `${backendUrl}/api/v1/influencer-profiles/${id}`,
    {
      headers: { Cookie: cookieHeader },
      cache: 'no-store',
    },
  )

  if (!response.ok) {
    throw new Error(
      `プロフィールの取得に失敗しました: id=${id} (status=${response.status})`,
    )
  }

  const body: unknown = await response.json()
  return body as InfluencerProfile
}

/**
 * インフルエンサー比較画面。
 * URLクエリパラメータ ?profileIds=id1,id2,id3 を受け取り、
 * 各プロフィールを並列フェッチして ComparisonTable に渡す。
 *
 * - profileIds が空なら空状態を表示する
 * - 10件超えの場合は先頭10件を使用し警告を表示する
 */
export default async function ComparePage({ searchParams }: ComparePageProps) {
  const params = await searchParams
  const rawIds = params.profileIds ?? ''
  const allIds = rawIds
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0)

  if (allIds.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">候補比較</h1>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800">
          <p className="text-gray-500 dark:text-gray-400">比較するプロフィールが選択されていません。</p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            保存済み候補から最大10件を選択して比較できます。
          </p>
          <Link
            href="/saved"
            className="mt-4 inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            保存済み候補へ
          </Link>
        </div>
      </div>
    )
  }

  const isExceeded = allIds.length > MAX_COMPARE
  const profileIds = isExceeded ? allIds.slice(0, MAX_COMPARE) : allIds

  const cookieStore = await cookies()
  const cookieHeader = cookieStore.toString()

  const results = await Promise.allSettled(
    profileIds.map((id) => fetchProfile(id, cookieHeader)),
  )

  const profiles: InfluencerProfile[] = []
  const fetchErrors: string[] = []

  for (const result of results) {
    if (result.status === 'fulfilled') {
      profiles.push(result.value)
    } else {
      fetchErrors.push(
        result.reason instanceof Error
          ? result.reason.message
          : 'プロフィールの取得に失敗しました。',
      )
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">候補比較</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {profiles.length} 件を比較中
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/saved"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            候補を変更
          </Link>
          {profiles.length > 0 && (
            <SaveComparisonButton profileIds={profiles.map((p) => p.id)} />
          )}
        </div>
      </div>

      {isExceeded && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">
          比較できるのは最大 {MAX_COMPARE} 件までです。先頭 {MAX_COMPARE}{' '}
          件のみ表示しています（{allIds.length} 件が選択されていました）。
        </div>
      )}

      {fetchErrors.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
          <p className="font-medium">一部のプロフィールを取得できませんでした。</p>
          <ul className="mt-1 list-inside list-disc">
            {fetchErrors.map((msg, idx) => (
              <li key={idx}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      {profiles.length > 0 ? (
        <ComparisonTable profiles={profiles} />
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800">
          <p className="text-gray-500 dark:text-gray-400">表示できるプロフィールがありませんでした。</p>
          <Link
            href="/saved"
            className="mt-4 inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            保存済み候補へ
          </Link>
        </div>
      )}
    </div>
  )
}
