import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import Link from 'next/link'
import type { InfluencerProfile } from '@/types/api'
import { DataStatusBadge } from '@/components/data-status-badge'
import { ScoreCard } from '@/components/score-card'
import { SaveCandidateButton } from '@/components/save-candidate-button'
import { ProfileActionButtons } from '@/components/profile-action-buttons'

interface CandidateDetailPageProps {
  params: Promise<{ id: string }>
}

async function fetchProfile(id: string): Promise<InfluencerProfile | null> {
  const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:3001'
  const cookieStore = await cookies()

  const response = await fetch(
    `${backendUrl}/api/v1/influencer-profiles/${id}`,
    {
      headers: { Cookie: cookieStore.toString() },
      cache: 'no-store',
    },
  )

  if (response.status === 404) return null

  if (!response.ok) {
    throw new Error(`プロフィールの取得に失敗しました (${response.status})`)
  }

  const body: unknown = await response.json()
  return body as InfluencerProfile
}

function formatNumber(value: number): string {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}万`
  }
  return value.toLocaleString('ja-JP')
}

export default async function CandidateDetailPage({
  params,
}: CandidateDetailPageProps) {
  const { id } = await params

  let profile: InfluencerProfile | null
  try {
    profile = await fetchProfile(id)
  } catch {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        データの取得に失敗しました。しばらく待ってから再読み込みしてください。
      </div>
    )
  }

  if (profile === null) {
    notFound()
  }

  const snap = profile.latestSnapshot

  return (
    <div className="flex flex-col gap-6">
      {/* パンくず */}
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/candidates" className="hover:text-gray-900">
          候補検索
        </Link>
        <span>/</span>
        <span className="text-gray-900">{profile.username}</span>
      </nav>

      {/* ヘッダー */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {profile.username}
          </h1>
          {profile.displayName !== null && (
            <p className="mt-0.5 text-sm text-gray-500">{profile.displayName}</p>
          )}
          <p className="mt-1 text-xs text-gray-400">{profile.platform}</p>
        </div>
        <SaveCandidateButton profileId={profile.id} />
      </div>

      {/* アクションボタン */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="mb-3 text-xs font-medium text-gray-700">アクション</p>
        <ProfileActionButtons profileId={profile.id} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* プロフィール情報 */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-gray-900">プロフィール情報</h2>

          {snap === null ? (
            <p className="mt-4 text-sm text-gray-500">
              このデータは取得できません。「データ取得」を実行してください。
            </p>
          ) : (
            <dl className="mt-4 space-y-4">
              <ProfileDataRow
                label="フォロワー数"
                displayValue={snap.followerCount.value !== null ? formatNumber(snap.followerCount.value) : '—'}
                dataStatus={snap.followerCount.status}
              />
              <ProfileDataRow
                label="フォロー数"
                displayValue={snap.followingCount.value !== null ? formatNumber(snap.followingCount.value) : '—'}
                dataStatus={snap.followingCount.status}
              />
              <ProfileDataRow
                label="投稿数"
                displayValue={snap.mediaCount.value !== null ? snap.mediaCount.value.toLocaleString('ja-JP') : '—'}
                dataStatus={snap.mediaCount.status}
              />
              <ProfileDataRow
                label="エンゲージメント率"
                displayValue={snap.engagementRate.value !== null ? `${(snap.engagementRate.value * 100).toFixed(2)}%` : '—'}
                dataStatus={snap.engagementRate.status}
              />
              {snap.biography.value !== null && snap.biography.value !== '' && (
                <div>
                  <dt className="text-xs font-medium text-gray-500">自己紹介</dt>
                  <dd className="mt-1 flex items-start gap-2">
                    <p className="text-sm text-gray-900 whitespace-pre-line break-words">
                      {snap.biography.value}
                    </p>
                    <DataStatusBadge
                      status={snap.biography.status}
                      className="mt-0.5 shrink-0"
                    />
                  </dd>
                </div>
              )}
              <p className="text-xs text-gray-400">
                取得日時:{' '}
                {new Date(snap.fetchedAt).toLocaleString('ja-JP', {
                  timeZone: 'Asia/Tokyo',
                })}
              </p>
            </dl>
          )}
        </div>

        {/* スコアカード */}
        <ScoreCard score={profile.latestScore} />
      </div>
    </div>
  )
}

interface ProfileDataRowProps {
  label: string
  displayValue: string
  dataStatus: string
}

function ProfileDataRow({ label, displayValue, dataStatus }: ProfileDataRowProps) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-900">
          {displayValue}
        </span>
        <DataStatusBadge status={dataStatus} />
      </dd>
    </div>
  )
}
