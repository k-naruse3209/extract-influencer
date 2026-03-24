/**
 * フォロワー数を日本語表記にフォーマットする。
 * null は "—" を返す。
 * 1万未満はカンマ区切り、1万以上は「X.X万」、100万以上は「X.XM」で返す。
 */
export function formatFollowerCount(count: number | null): string {
  if (count === null) return '—'

  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`
  }
  if (count >= 10_000) {
    return `${(count / 10_000).toFixed(1)}万`
  }
  return count.toLocaleString('ja-JP')
}

/**
 * スコアを小数点1桁の文字列にフォーマットする。
 * null は "—" を返す。
 */
export function formatScore(score: number | null): string {
  if (score === null) return '—'
  return score.toFixed(1)
}

/**
 * ISO 日付文字列を「YYYY年M月D日」形式にフォーマットする。
 * null は "—" を返す。
 */
export function formatDate(dateStr: string | null): string {
  if (dateStr === null) return '—'

  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return '—'

  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Tokyo',
  })
}
