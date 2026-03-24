export default function CandidateDetailLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-2">
        <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
        <div className="h-4 w-4 animate-pulse rounded bg-gray-100" />
        <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
      </div>

      <div>
        <div className="h-8 w-56 animate-pulse rounded bg-gray-200" />
        <div className="mt-2 h-4 w-32 animate-pulse rounded bg-gray-100" />
      </div>

      <div className="h-16 animate-pulse rounded-lg bg-gray-100" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-72 animate-pulse rounded-lg bg-gray-100" />
        <div className="h-72 animate-pulse rounded-lg bg-gray-100" />
      </div>
    </div>
  )
}
