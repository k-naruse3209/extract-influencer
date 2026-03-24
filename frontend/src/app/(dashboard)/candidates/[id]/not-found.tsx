import Link from 'next/link'

export default function CandidateNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <p className="text-lg font-semibold text-gray-900">
        候補が見つかりません
      </p>
      <p className="mt-2 text-sm text-gray-500">
        指定された候補は存在しないか、削除されています。
      </p>
      <Link
        href="/candidates"
        className="mt-6 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
      >
        候補一覧に戻る
      </Link>
    </div>
  )
}
