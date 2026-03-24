'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { apiClient, ApiClientError } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import type {
  AdminApiKey,
  CreateApiKeyRequest,
  CreateApiKeyResponse,
  ApiKeyPermission,
} from '@/types/api'

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const createApiKeySchema = z.object({
  name: z.string().min(1, 'キー名を入力してください').max(100),
  permissions: z
    .array(z.enum(['read', 'write', 'admin']))
    .min(1, '1つ以上の権限を選択してください'),
  expiresAt: z.string().optional(),
})

type CreateApiKeyFieldErrors = Partial<
  Record<'name' | 'permissions' | 'expiresAt', string>
>

// ---------------------------------------------------------------------------
// Raw key display — shown once after creation
// ---------------------------------------------------------------------------

interface RawKeyDisplayProps {
  rawKey: string
  onClose: () => void
}

function RawKeyDisplay({ rawKey, onClose }: RawKeyDisplayProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(rawKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-lg">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            APIキーが生成されました
          </h2>
          <p className="mt-1 text-sm text-amber-700 bg-amber-50 rounded-md px-3 py-2 border border-amber-200">
            このキーは一度しか表示されません。今すぐコピーして安全な場所に保管してください。
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 p-3">
          <code className="flex-1 break-all text-xs font-mono text-gray-800">
            {rawKey}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            className={cn(
              'shrink-0 rounded-md px-3 py-1.5 text-xs font-medium',
              copied
                ? 'bg-green-100 text-green-700'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50',
            )}
          >
            {copied ? 'コピー済み' : 'コピー'}
          </button>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Create API key modal
// ---------------------------------------------------------------------------

interface CreateApiKeyModalProps {
  onClose: () => void
  onCreated: (rawKey: string) => void
}

function CreateApiKeyModal({ onClose, onCreated }: CreateApiKeyModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<CreateApiKeyFieldErrors>({})

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setServerError(null)
    setFieldErrors({})

    const formData = new FormData(event.currentTarget)
    const permissions = formData.getAll('permissions') as ApiKeyPermission[]
    const expiresAtValue = formData.get('expiresAt') as string | null

    const raw = {
      name: formData.get('name') as string,
      permissions,
      expiresAt: expiresAtValue !== null && expiresAtValue !== '' ? expiresAtValue : undefined,
    }

    const parsed = createApiKeySchema.safeParse(raw)
    if (!parsed.success) {
      const errors: CreateApiKeyFieldErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof CreateApiKeyFieldErrors
        errors[field] = issue.message
      }
      setFieldErrors(errors)
      return
    }

    setIsLoading(true)
    try {
      const result = await apiClient<CreateApiKeyResponse>(
        '/api/v1/admin/api-keys',
        {
          method: 'POST',
          body: JSON.stringify(parsed.data as CreateApiKeyRequest),
        },
      )
      onCreated(result.rawKey)
    } catch (error) {
      if (error instanceof ApiClientError) {
        setServerError(error.message)
      } else {
        setServerError('予期しないエラーが発生しました。')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const permissionOptions: { value: ApiKeyPermission; label: string }[] = [
    { value: 'read', label: '読み取り (read)' },
    { value: 'write', label: '書き込み (write)' },
    { value: 'admin', label: '管理者 (admin)' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            新規APIキー生成
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="閉じる"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {serverError !== null && (
          <div
            role="alert"
            className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label
              htmlFor="key-name"
              className="block text-sm font-medium text-gray-700"
            >
              キー名
            </label>
            <input
              id="key-name"
              name="name"
              type="text"
              required
              placeholder="例: 本番環境用APIキー"
              className={cn(
                'mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm',
                'focus:outline-none focus:ring-2 focus:ring-blue-500',
                fieldErrors.name
                  ? 'border-red-300 focus:ring-red-500'
                  : 'border-gray-300',
              )}
            />
            {fieldErrors.name !== undefined && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>
            )}
          </div>

          <div>
            <span className="block text-sm font-medium text-gray-700">
              権限
            </span>
            <div className="mt-2 space-y-2">
              {permissionOptions.map(({ value, label }) => (
                <label key={value} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="permissions"
                    value={value}
                    defaultChecked={value === 'read'}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>
            {fieldErrors.permissions !== undefined && (
              <p className="mt-1 text-xs text-red-600">
                {fieldErrors.permissions}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="expires-at"
              className="block text-sm font-medium text-gray-700"
            >
              有効期限（任意）
            </label>
            <input
              id="expires-at"
              name="expiresAt"
              type="datetime-local"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {fieldErrors.expiresAt !== undefined && (
              <p className="mt-1 text-xs text-red-600">
                {fieldErrors.expiresAt}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                'rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white',
                'hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              {isLoading ? '生成中...' : 'キーを生成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Create API key button (triggers modal + shows raw key once)
// ---------------------------------------------------------------------------

export function CreateApiKeyButton() {
  const router = useRouter()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [generatedRawKey, setGeneratedRawKey] = useState<string | null>(null)

  function handleCreated(rawKey: string) {
    setIsCreateOpen(false)
    setGeneratedRawKey(rawKey)
    router.refresh()
  }

  function handleCloseRawKey() {
    setGeneratedRawKey(null)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsCreateOpen(true)}
        className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        + 新規キー生成
      </button>
      {isCreateOpen && (
        <CreateApiKeyModal
          onClose={() => setIsCreateOpen(false)}
          onCreated={handleCreated}
        />
      )}
      {generatedRawKey !== null && (
        <RawKeyDisplay rawKey={generatedRawKey} onClose={handleCloseRawKey} />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// API key table row actions
// ---------------------------------------------------------------------------

interface ApiKeyRowActionsProps {
  apiKey: AdminApiKey
}

export function ApiKeyRowActions({ apiKey }: ApiKeyRowActionsProps) {
  const router = useRouter()
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleToggleRevoked() {
    setIsUpdating(true)
    setError(null)
    try {
      await apiClient<{ apiKey: AdminApiKey }>(
        `/api/v1/admin/api-keys/${apiKey.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ isRevoked: !apiKey.isRevoked }),
        },
      )
      router.refresh()
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '更新に失敗しました')
    } finally {
      setIsUpdating(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm(`APIキー「${apiKey.name}」を削除しますか？この操作は取り消せません。`)) {
      return
    }
    setIsDeleting(true)
    setError(null)
    try {
      await apiClient<void>(`/api/v1/admin/api-keys/${apiKey.id}`, {
        method: 'DELETE',
      })
      router.refresh()
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '削除に失敗しました')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error !== null && (
        <span className="text-xs text-red-600">{error}</span>
      )}
      <button
        type="button"
        onClick={handleToggleRevoked}
        disabled={isUpdating}
        className={cn(
          'rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-50',
          apiKey.isRevoked
            ? 'bg-green-50 text-green-700 hover:bg-green-100'
            : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100',
        )}
      >
        {apiKey.isRevoked ? '有効化' : '無効化'}
      </button>

      <button
        type="button"
        onClick={handleDelete}
        disabled={isDeleting}
        className="rounded-md bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
      >
        {isDeleting ? '削除中...' : '削除'}
      </button>
    </div>
  )
}
