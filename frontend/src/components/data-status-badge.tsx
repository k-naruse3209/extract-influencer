import { cn } from '@/lib/utils'

interface DataStatusBadgeProps {
  status: string
  className?: string
}

/**
 * データの種別（FACT / ESTIMATED / UNAVAILABLE）を色付きバッジで表示する。
 * データ分離原則に基づき、推定値・取得不可を視覚的に区別する。
 */
export function DataStatusBadge({ status, className }: DataStatusBadgeProps) {
  const normalized = status.toUpperCase()

  const label =
    normalized === 'FACT'
      ? '確実'
      : normalized === 'ESTIMATED'
        ? '推定'
        : '取得不可'

  const colorClass =
    normalized === 'FACT'
      ? 'bg-green-100 text-green-800 ring-green-200 dark:bg-green-900/30 dark:text-green-300 dark:ring-green-700'
      : normalized === 'ESTIMATED'
        ? 'bg-yellow-100 text-yellow-800 ring-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:ring-yellow-700'
        : 'bg-gray-100 text-gray-600 ring-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:ring-gray-600'

  const ariaLabel =
    normalized === 'FACT'
      ? 'データ種別: 確実なデータ'
      : normalized === 'ESTIMATED'
        ? 'データ種別: 推定値'
        : 'データ種別: 取得不可'

  return (
    <span
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        colorClass,
        className,
      )}
    >
      {label}
    </span>
  )
}
