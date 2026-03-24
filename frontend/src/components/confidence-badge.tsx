import { cn } from '@/lib/utils'

interface ConfidenceBadgeProps {
  confidence: string
  className?: string
}

/**
 * 信頼度（HIGH / MEDIUM / LOW）を色付きバッジで表示する。
 * LOW の場合は赤色で警告を示す。
 */
export function ConfidenceBadge({ confidence, className }: ConfidenceBadgeProps) {
  const normalized = confidence.toUpperCase()

  const label =
    normalized === 'HIGH'
      ? '信頼度: 高'
      : normalized === 'MEDIUM'
        ? '信頼度: 中'
        : '信頼度: 低'

  const colorClass =
    normalized === 'HIGH'
      ? 'bg-green-100 text-green-800 ring-green-200 dark:bg-green-900/30 dark:text-green-300 dark:ring-green-700'
      : normalized === 'MEDIUM'
        ? 'bg-yellow-100 text-yellow-800 ring-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:ring-yellow-700'
        : 'bg-red-100 text-red-800 ring-red-200 dark:bg-red-900/30 dark:text-red-300 dark:ring-red-700'

  const isLow = normalized === 'LOW'
  const warningTooltip = isLow
    ? 'データの信頼性が低い可能性があります。根拠を確認してください。'
    : undefined

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        colorClass,
        className,
      )}
      title={warningTooltip}
      aria-label={isLow ? `${label}（注意: ${warningTooltip}）` : label}
    >
      {isLow && (
        <span aria-hidden="true" className="mr-0.5">
          ⚠
        </span>
      )}
      {label}
    </span>
  )
}
