import { Suspense } from 'react'
import Link from 'next/link'
import { cookies } from 'next/headers'
import type { InfluencerProfile, PaginatedResponse } from '@/types/api'
import { CandidateSearchForm } from '@/components/candidate-search-form'
import { FetchProfileForm } from '@/components/fetch-profile-form'
import { SaveCandidateButton } from '@/components/save-candidate-button'
import { Pagination } from '@/components/pagination'

interface SearchParams {
  username?: string
  platform?: string
  page?: string
}

interface CandidatesPageProps {
  searchParams: Promise<SearchParams>
}

async function fetchProfiles(
  params: SearchParams,
): Promise<PaginatedResponse<InfluencerProfile>> {
  const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:3001'
  const cookieStore = await cookies()

  const query = new URLSearchParams()
  if (params.username) query.set('username', params.username)
  if (params.platform) query.set('platform', params.platform)
  query.set('page', params.page ?? '1')
  query.set('limit', '20')

  const response = await fetch(
    `${backendUrl}/api/v1/influencer-profiles?${query.toString()}`,
    {
      headers: { Cookie: cookieStore.toString() },
      cache: 'no-store',
    },
  )

  if (!response.ok) {
    throw new Error(`プロフィール一覧の取得に失敗しました (${response.status})`)
  }

  const body: unknown = await response.json()
  return body as PaginatedResponse<InfluencerProfile>
}

async function ProfileList({ searchParams }: { searchParams: SearchParams }) {
  let result: PaginatedResponse<InfluencerProfile>

  try {
    result = await fetchProfiles(searchParams)
  } catch {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        データの取得に失敗しました。しばらく待ってから再読み込みしてください。
      </div>
    )
  }

  const currentPage = Number(searchParams.page ?? 1)

  if (result.data.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
        <p className="text-gray-500">条件に合う候補が見つかりませんでした。</p>
        <p className="mt-1 text-xs text-gray-400">
          検索条件を変更してお試しください。
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                ユーザー名
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                プラットフォーム
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                フォロワー数
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                総合スコア
              </th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {result.data.map((profile) => {
              const followerCount = profile.latestSnapshot?.followerCount
              const totalScore = profile.latestScore?.totalScore

              return (
                <tr key={profile.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                    {profile.username}
                    {profile.displayName !== null && (
                      <span className="ml-2 text-gray-500">
                        ({profile.displayName})
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                    {profile.platform}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-600">
                    {followerCount !== undefined && followerCount.value !== null
                      ? followerCount.value.toLocaleString('ja-JP')
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-semibold text-gray-900">
                    {totalScore !== undefined ? totalScore : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <SaveCandidateButton profileId={profile.id} />
                      <Link
                        href={`/candidates/${profile.id}`}
                        className="inline-flex items-center rounded-md bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                      >
                        詳細
                      </Link>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          全 {result.meta.total.toLocaleString('ja-JP')} 件中{' '}
          {(currentPage - 1) * result.meta.limit + 1}〜
          {Math.min(currentPage * result.meta.limit, result.meta.total)} 件表示
        </p>
        <Pagination
          currentPage={currentPage}
          totalPages={result.meta.totalPages}
          basePath="/candidates"
        />
      </div>
    </div>
  )
}

export default async function CandidatesPage({
  searchParams,
}: CandidatesPageProps) {
  const params = await searchParams

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">候補検索</h1>
        <p className="mt-1 text-sm text-gray-600">
          username・プラットフォームでインフルエンサー候補を絞り込みます
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold text-gray-800">
          Instagramユーザーを新規分析
        </h2>
        <p className="mb-3 text-xs text-gray-500">
          ユーザー名を入力するとInstagramからプロフィールを取得してスコアを算出します
        </p>
        <Suspense fallback={null}>
          <FetchProfileForm />
        </Suspense>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <Suspense fallback={null}>
          <CandidateSearchForm />
        </Suspense>
      </div>

      <Suspense
        fallback={
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-lg bg-gray-100"
              />
            ))}
          </div>
        }
      >
        <ProfileList searchParams={params} />
      </Suspense>
    </div>
  )
}
