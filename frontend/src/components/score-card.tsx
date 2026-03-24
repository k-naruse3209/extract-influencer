import type { LatestScoreResponse } from '@/types/api'
import { ConfidenceBadge } from '@/components/confidence-badge'
import { cn } from '@/lib/utils'

interface ScoreCardProps {
  score: LatestScoreResponse | null
}

/**
 * 総合スコア・サブスコア・信頼度を1枚のカードで表示する。
 * スコアが null（未算出）の場合は空状態を表示する。
 */
export function ScoreCard({ score }: ScoreCardProps) {
  if (score === null) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-gray-900">スコア</h3>
        <p className="mt-4 text-sm text-gray-500">
          スコアはまだ算出されていません。「スコア再計算」を実行してください。
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">スコア</h3>
        <ConfidenceBadge confidence={score.confidence} />
      </div>

      <div className="mt-4 flex items-end gap-2">
        <span
          className={cn(
            'text-4xl font-bold tabular-nums',
            score.totalScore >= 70
              ? 'text-green-600'
              : score.totalScore >= 40
                ? 'text-yellow-600'
                : 'text-red-600',
          )}
        >
          {score.totalScore}
        </span>
        <span className="mb-1 text-sm text-gray-500">/ 100</span>
      </div>

      {score.breakdowns.length > 0 && (
        <div className="mt-6 space-y-3">
          <p className="text-xs font-medium text-gray-700">内訳</p>
          {score.breakdowns.map((breakdown) => (
            <div key={breakdown.category}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">{breakdown.category}</span>
                <div className="flex items-center gap-2">
                  <ConfidenceBadge confidence={breakdown.confidence} />
                  <span className="font-medium tabular-nums text-gray-900">
                    {breakdown.score}
                  </span>
                </div>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    breakdown.score >= 70
                      ? 'bg-green-500'
                      : breakdown.score >= 40
                        ? 'bg-yellow-500'
                        : 'bg-red-500',
                  )}
                  style={{ width: `${breakdown.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-xs text-gray-400">
        算出日時:{' '}
        {new Date(score.scoredAt).toLocaleString('ja-JP', {
          timeZone: 'Asia/Tokyo',
        })}
      </p>
    </div>
  )
}
