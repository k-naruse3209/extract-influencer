import { redirect } from 'next/navigation'

/**
 * ルート `/` へのアクセスはダッシュボードへリダイレクトする。
 * 未認証の場合はダッシュボードレイアウトがloginへさらにリダイレクトする。
 */
export default function RootPage() {
  redirect('/dashboard')
}
