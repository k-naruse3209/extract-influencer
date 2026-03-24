import type { InfluencerProfile } from '@/types/api'
import { DataStatusBadge } from '@/components/data-status-badge'
import { ConfidenceBadge } from '@/components/confidence-badge'
import { ScoreBar } from '@/components/comparison/score-bar'
import { formatFollowerCount, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

interface ComparisonTableProps {
  profiles: InfluencerProfile[]
}

/**
 * 最大10件のインフルエンサープロフィールを横並びで比較するテーブル。
 * - 横スクロール対応
 * - 事実データは DataStatusBadge で種別を明示
 * - 総合スコア最高・フォロワー最多の列をハイライト
 * - 推定値が含まれる場合は注記を表示
 */
export function ComparisonTable({ profiles }: ComparisonTableProps) {
  const scores = profiles.map((p) => p.latestScore?.totalScore ?? null)
  const followerCounts = profiles.map(
    (p) => p.latestSnapshot?.followerCount.value ?? null,
  )

  const maxScore = scores.reduce<number | null>((acc, s) => {
    if (s === null) return acc
    if (acc === null) return s
    return s > acc ? s : acc
  }, null)

  const maxFollower = followerCounts.reduce<number | null>((acc, f) => {
    if (f === null) return acc
    if (acc === null) return f
    return f > acc ? f : acc
  }, null)

  const hasEstimated = profiles.some((p) => {
    if (p.latestSnapshot === null) return false
    return (
      p.latestSnapshot.engagementRate.status === 'ESTIMATED' ||
      p.latestSnapshot.followerCount.status === 'ESTIMATED'
    )
  })

  /**
   * breakdowns から指定カテゴリのスコアを取得するヘルパー。
   * 存在しない場合は null を返す。
   */
  function getBreakdownScore(
    profile: InfluencerProfile,
    category: string,
  ): number | null {
    const found = profile.latestScore?.breakdowns.find(
      (b) => b.category === category,
    )
    return found?.score ?? null
  }

  const SCORE_COLOR_CLASSES = (score: number | null) => {
    if (score === null) return 'text-gray-500 dark:text-gray-400'
    if (score >= 70) return 'text-green-600 dark:text-green-400'
    if (score >= 40) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-600 dark:text-red-400'
  }

  return (
    <div className="flex flex-col gap-3">
      {hasEstimated && (
        <p role="status" className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-2 text-xs text-yellow-800 dark:border-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">
          このグラフには推定値が含まれています。推定値は「推定」バッジで区別されています。
        </p>
      )}

      {/* 横スクロールコンテナ */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
          <caption className="sr-only">インフルエンサー比較テーブル</caption>
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-10 min-w-[10rem] bg-gray-50 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:bg-gray-700 dark:text-gray-400"
              >
                指標
              </th>
              {profiles.map((profile, idx) => {
                const isBestScore =
                  maxScore !== null &&
                  profile.latestScore?.totalScore === maxScore
                const isMostFollowers =
                  maxFollower !== null &&
                  profile.latestSnapshot?.followerCount.value === maxFollower

                return (
                  <th
                    key={profile.id}
                    scope="col"
                    className={cn(
                      'min-w-[10rem] px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-700 dark:text-gray-300',
                      idx % 2 === 0 ? 'bg-gray-50 dark:bg-gray-700' : 'bg-gray-100 dark:bg-gray-600',
                      (isBestScore || isMostFollowers) &&
                        'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
                    )}
                  >
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold">{profile.username}</span>
                      {isBestScore && (
                        <span className="inline-block rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-medium text-white dark:bg-indigo-500">
                          最高スコア
                        </span>
                      )}
                      {isMostFollowers && (
                        <span className="inline-block rounded-full bg-purple-600 px-2 py-0.5 text-xs font-medium text-white dark:bg-purple-500">
                          最多フォロワー
                        </span>
                      )}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {/* プラットフォーム */}
            <tr>
              <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-4 py-3 text-sm font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                プラットフォーム
              </td>
              {profiles.map((profile, idx) => (
                <td
                  key={profile.id}
                  className={cn(
                    'whitespace-nowrap px-4 py-3 text-sm',
                    idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700',
                  )}
                >
                  <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-600 dark:text-gray-300">
                    {profile.platform}
                  </span>
                </td>
              ))}
            </tr>

            {/* フォロワー数 */}
            <tr>
              <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-4 py-3 text-sm font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                フォロワー数
              </td>
              {profiles.map((profile, idx) => {
                const field = profile.latestSnapshot?.followerCount
                return (
                  <td
                    key={profile.id}
                    className={cn(
                      'whitespace-nowrap px-4 py-3 text-sm',
                      idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700',
                    )}
                  >
                    {field !== undefined ? (
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                          {field.value !== null ? formatFollowerCount(field.value) : '—'}
                        </span>
                        <DataStatusBadge status={field.status} />
                      </div>
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400" aria-label="データなし">—</span>
                    )}
                  </td>
                )
              })}
            </tr>

            {/* エンゲージメント率 */}
            <tr>
              <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-4 py-3 text-sm font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                エンゲージメント率
              </td>
              {profiles.map((profile, idx) => {
                const field = profile.latestSnapshot?.engagementRate
                return (
                  <td
                    key={profile.id}
                    className={cn(
                      'whitespace-nowrap px-4 py-3 text-sm',
                      idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700',
                    )}
                  >
                    {field !== undefined ? (
                      <div className="flex flex-col gap-1">
                        <span
                          className={cn(
                            'font-semibold tabular-nums',
                            field.status === 'ESTIMATED'
                              ? 'text-gray-500 dark:text-gray-400'
                              : 'text-gray-900 dark:text-gray-100',
                          )}
                        >
                          {field.value !== null ? `${(field.value * 100).toFixed(2)}%` : '—'}
                        </span>
                        <DataStatusBadge status={field.status} />
                      </div>
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400" aria-label="データなし">—</span>
                    )}
                  </td>
                )
              })}
            </tr>

            {/* 総合スコア */}
            <tr>
              <td className="sticky left-0 z-10 whitespace-nowrap bg-gray-50 px-4 py-3 text-sm font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                総合スコア
              </td>
              {profiles.map((profile, idx) => {
                const score = profile.latestScore?.totalScore ?? null
                return (
                  <td
                    key={profile.id}
                    className={cn(
                      'whitespace-nowrap px-4 py-3',
                      idx % 2 === 0 ? 'bg-gray-50 dark:bg-gray-700' : 'bg-gray-100 dark:bg-gray-600',
                    )}
                  >
                    {score !== null ? (
                      <span
                        className={cn(
                          'text-2xl font-bold tabular-nums',
                          SCORE_COLOR_CLASSES(score),
                        )}
                      >
                        {score}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-500 dark:text-gray-400" aria-label="スコアなし">—</span>
                    )}
                  </td>
                )
              })}
            </tr>

            {/* 信頼度 */}
            <tr>
              <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-4 py-3 text-sm font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                信頼度
              </td>
              {profiles.map((profile, idx) => (
                <td
                  key={profile.id}
                  className={cn(
                    'whitespace-nowrap px-4 py-3',
                    idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700',
                  )}
                >
                  {profile.latestScore !== null ? (
                    <ConfidenceBadge confidence={profile.latestScore.confidence} />
                  ) : (
                    <span className="text-sm text-gray-500 dark:text-gray-400" aria-label="信頼度なし">—</span>
                  )}
                </td>
              ))}
            </tr>

            {/* ブランド適合 */}
            <tr>
              <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-4 py-3 text-sm font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                ブランド適合
              </td>
              {profiles.map((profile, idx) => (
                <td
                  key={profile.id}
                  className={cn(
                    'px-4 py-3',
                    idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700',
                  )}
                >
                  <ScoreBar score={getBreakdownScore(profile, 'BRAND_FIT')} />
                </td>
              ))}
            </tr>

            {/* リスク（逆色: 低いほど良い） */}
            <tr>
              <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-4 py-3 text-sm font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                リスク
                <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">（低いほど良）</span>
              </td>
              {profiles.map((profile, idx) => (
                <td
                  key={profile.id}
                  className={cn(
                    'px-4 py-3',
                    idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700',
                  )}
                >
                  <ScoreBar
                    score={getBreakdownScore(profile, 'RISK')}
                    isInverted
                  />
                </td>
              ))}
            </tr>

            {/* 疑似アクティブ度 */}
            <tr>
              <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-4 py-3 text-sm font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                疑似アクティブ度
              </td>
              {profiles.map((profile, idx) => (
                <td
                  key={profile.id}
                  className={cn(
                    'px-4 py-3',
                    idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700',
                  )}
                >
                  <ScoreBar
                    score={getBreakdownScore(profile, 'PSEUDO_ACTIVITY')}
                  />
                </td>
              ))}
            </tr>

            {/* エンゲージメント */}
            <tr>
              <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-4 py-3 text-sm font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                エンゲージメント
              </td>
              {profiles.map((profile, idx) => (
                <td
                  key={profile.id}
                  className={cn(
                    'px-4 py-3',
                    idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700',
                  )}
                >
                  <ScoreBar
                    score={getBreakdownScore(profile, 'ENGAGEMENT')}
                  />
                </td>
              ))}
            </tr>

            {/* 成長率 */}
            <tr>
              <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-4 py-3 text-sm font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                成長率
              </td>
              {profiles.map((profile, idx) => (
                <td
                  key={profile.id}
                  className={cn(
                    'px-4 py-3',
                    idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700',
                  )}
                >
                  <ScoreBar score={getBreakdownScore(profile, 'GROWTH')} />
                </td>
              ))}
            </tr>

            {/* データ取得日 */}
            <tr>
              <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-4 py-3 text-sm font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                データ取得日
              </td>
              {profiles.map((profile, idx) => (
                <td
                  key={profile.id}
                  className={cn(
                    'whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-400',
                    idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700',
                  )}
                >
                  {formatDate(profile.latestSnapshot?.fetchedAt ?? null)}
                </td>
              ))}
            </tr>

            {/* スコア算出日 */}
            <tr>
              <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-4 py-3 text-sm font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                スコア算出日
              </td>
              {profiles.map((profile, idx) => (
                <td
                  key={profile.id}
                  className={cn(
                    'whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-400',
                    idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700',
                  )}
                >
                  {formatDate(profile.latestScore?.scoredAt ?? null)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
