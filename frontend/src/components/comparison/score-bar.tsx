import { cn } from '@/lib/utils'

interface ScoreBarProps {
  score: number | null
  /**
   * true のとき: 低いほど良い（リスクスコア用）。
   * false (既定) のとき: 高いほど良い。
   */
  isInverted?: boolean
  /**
   * スクリーンリーダー向けのラベル。省略時は汎用ラベルを使用する。
   */
  label?: string
}

/**
 * 0〜100 のスコアを横棒グラフで表示する。
 * isInverted=true のときは低いほど緑（リスクスコア表示に使用）。
 * スコアが null の場合は "—" を表示する。
 */
export function ScoreBar({ score, isInverted = false, label }: ScoreBarProps) {
  if (score === null) {
    return <span className="text-sm text-gray-500 dark:text-gray-400" aria-label="スコアなし">—</span>
  }

  const barColor = isInverted
    ? score <= 30
      ? 'bg-green-500'
      : score <= 60
        ? 'bg-yellow-500'
        : 'bg-red-500'
    : score >= 70
      ? 'bg-green-500'
      : score >= 40
        ? 'bg-yellow-500'
        : 'bg-red-500'

  const textColor = isInverted
    ? score <= 30
      ? 'text-green-700 dark:text-green-300'
      : score <= 60
        ? 'text-yellow-700 dark:text-yellow-300'
        : 'text-red-700 dark:text-red-300'
    : score >= 70
      ? 'text-green-700 dark:text-green-300'
      : score >= 40
        ? 'text-yellow-700 dark:text-yellow-300'
        : 'text-red-700 dark:text-red-300'

  const ariaLabel = label !== undefined ? `${label}: ${score}` : `スコア: ${score}`

  return (
    <div className="flex min-w-[6rem] flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <div
          role="meter"
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={ariaLabel}
          className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700"
        >
          <div
            aria-hidden="true"
            className={cn('h-full rounded-full transition-all', barColor)}
            style={{ width: `${score}%` }}
          />
        </div>
        <span aria-hidden="true" className={cn('w-8 text-right text-xs font-medium tabular-nums', textColor)}>
          {score}
        </span>
      </div>
    </div>
  )
}
