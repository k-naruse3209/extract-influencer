import { cookies } from 'next/headers'
import type { SavedCandidate } from '@/types/api'
import { SavedCandidatesList } from '@/components/saved-candidates-list'

async function fetchSavedCandidates(): Promise<SavedCandidate[]> {
  const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:3001'
  const cookieStore = await cookies()

  const response = await fetch(`${backendUrl}/api/v1/saved-candidates`, {
    headers: { Cookie: cookieStore.toString() },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`保存済み候補の取得に失敗しました (${response.status})`)
  }

  const body: unknown = await response.json()
  return body as SavedCandidate[]
}

export default async function SavedPage() {
  let candidates: SavedCandidate[]

  try {
    candidates = await fetchSavedCandidates()
  } catch {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">保存済み候補</h1>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
          データの取得に失敗しました。しばらく待ってから再読み込みしてください。
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">保存済み候補</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {candidates.length.toLocaleString('ja-JP')} 件保存中 · 最大10件選択して比較できます
          </p>
        </div>
      </div>

      <SavedCandidatesList candidates={candidates} />
    </div>
  )
}
