'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { apiClient, ApiClientError } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import type {
  AdminUser,
  CreateUserRequest,
  UpdateUserRequest,
} from '@/types/api'

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const createUserSchema = z.object({
  name: z.string().min(1, '名前を入力してください').max(100),
  email: z.string().email('有効なメールアドレスを入力してください'),
  password: z
    .string()
    .min(8, 'パスワードは8文字以上で入力してください')
    .max(100),
  role: z.enum(['ADMIN', 'ANALYST', 'VIEWER']),
})

type CreateUserFieldErrors = Partial<
  Record<'name' | 'email' | 'password' | 'role', string>
>

// ---------------------------------------------------------------------------
// Role badge
// ---------------------------------------------------------------------------

export function RoleBadge({ role }: { role: AdminUser['role'] }) {
  const config = {
    ADMIN: { label: 'ADMIN', className: 'bg-red-100 text-red-800' },
    ANALYST: { label: 'ANALYST', className: 'bg-blue-100 text-blue-800' },
    VIEWER: { label: 'VIEWER', className: 'bg-gray-100 text-gray-800' },
  } as const

  const { label, className } = config[role]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        className,
      )}
    >
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Create user modal
// ---------------------------------------------------------------------------

interface CreateUserModalProps {
  onClose: () => void
  onCreated: () => void
}

function CreateUserModal({ onClose, onCreated }: CreateUserModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<CreateUserFieldErrors>({})

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setServerError(null)
    setFieldErrors({})

    const formData = new FormData(event.currentTarget)
    const raw = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      password: formData.get('password') as string,
      role: formData.get('role') as string,
    }

    const parsed = createUserSchema.safeParse(raw)
    if (!parsed.success) {
      const errors: CreateUserFieldErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof CreateUserFieldErrors
        errors[field] = issue.message
      }
      setFieldErrors(errors)
      return
    }

    setIsLoading(true)
    try {
      await apiClient<{ user: AdminUser }>('/api/v1/admin/users', {
        method: 'POST',
        body: JSON.stringify(parsed.data as CreateUserRequest),
      })
      onCreated()
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            新規ユーザー作成
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
              htmlFor="name"
              className="block text-sm font-medium text-gray-700"
            >
              名前
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
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
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              メールアドレス
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className={cn(
                'mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm',
                'focus:outline-none focus:ring-2 focus:ring-blue-500',
                fieldErrors.email
                  ? 'border-red-300 focus:ring-red-500'
                  : 'border-gray-300',
              )}
            />
            {fieldErrors.email !== undefined && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              パスワード
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className={cn(
                'mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm',
                'focus:outline-none focus:ring-2 focus:ring-blue-500',
                fieldErrors.password
                  ? 'border-red-300 focus:ring-red-500'
                  : 'border-gray-300',
              )}
            />
            {fieldErrors.password !== undefined && (
              <p className="mt-1 text-xs text-red-600">
                {fieldErrors.password}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="role"
              className="block text-sm font-medium text-gray-700"
            >
              ロール
            </label>
            <select
              id="role"
              name="role"
              defaultValue="VIEWER"
              className={cn(
                'mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm',
                'focus:outline-none focus:ring-2 focus:ring-blue-500',
                fieldErrors.role
                  ? 'border-red-300 focus:ring-red-500'
                  : 'border-gray-300',
              )}
            >
              <option value="VIEWER">VIEWER</option>
              <option value="ANALYST">ANALYST</option>
              <option value="ADMIN">ADMIN</option>
            </select>
            {fieldErrors.role !== undefined && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.role}</p>
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
              {isLoading ? '作成中...' : '作成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// User table row actions
// ---------------------------------------------------------------------------

interface UserRowActionsProps {
  user: AdminUser
  onUpdated: () => void
  onDeleted: () => void
}

export function UserRowActions({
  user,
  onUpdated,
  onDeleted,
}: UserRowActionsProps) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleToggleActive() {
    setIsUpdating(true)
    setError(null)
    try {
      await apiClient<{ user: AdminUser }>(`/api/v1/admin/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !user.isActive } as UpdateUserRequest),
      })
      onUpdated()
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '更新に失敗しました')
    } finally {
      setIsUpdating(false)
    }
  }

  async function handleRoleChange(
    event: React.ChangeEvent<HTMLSelectElement>,
  ) {
    const newRole = event.target.value as AdminUser['role']
    setIsUpdating(true)
    setError(null)
    try {
      await apiClient<{ user: AdminUser }>(`/api/v1/admin/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole } as UpdateUserRequest),
      })
      onUpdated()
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '更新に失敗しました')
    } finally {
      setIsUpdating(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm(`ユーザー「${user.name}」を削除しますか？この操作は取り消せません。`)) {
      return
    }
    setIsDeleting(true)
    setError(null)
    try {
      await apiClient<void>(`/api/v1/admin/users/${user.id}`, {
        method: 'DELETE',
      })
      onDeleted()
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
      <select
        value={user.role}
        onChange={handleRoleChange}
        disabled={isUpdating}
        className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 disabled:opacity-50"
        aria-label="ロール変更"
      >
        <option value="VIEWER">VIEWER</option>
        <option value="ANALYST">ANALYST</option>
        <option value="ADMIN">ADMIN</option>
      </select>

      <button
        type="button"
        onClick={handleToggleActive}
        disabled={isUpdating}
        className={cn(
          'rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-50',
          user.isActive
            ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
            : 'bg-green-50 text-green-700 hover:bg-green-100',
        )}
      >
        {user.isActive ? '無効化' : '有効化'}
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

// ---------------------------------------------------------------------------
// Create user button (triggers modal)
// ---------------------------------------------------------------------------

export function CreateUserButton() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)

  function handleCreated() {
    setIsOpen(false)
    router.refresh()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        + 新規ユーザー
      </button>
      {isOpen && (
        <CreateUserModal
          onClose={() => setIsOpen(false)}
          onCreated={handleCreated}
        />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Refresh-aware row wrapper for user table rows
// ---------------------------------------------------------------------------

export function UserTableRow({ user }: { user: AdminUser }) {
  const router = useRouter()

  return (
    <tr className="hover:bg-gray-50">
      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
        {user.name}
      </td>
      <td className="hidden whitespace-nowrap px-6 py-4 text-sm text-gray-600 sm:table-cell">
        {user.email}
      </td>
      <td className="hidden whitespace-nowrap px-6 py-4 md:table-cell">
        <RoleBadge role={user.role} />
      </td>
      <td className="hidden whitespace-nowrap px-6 py-4 text-sm md:table-cell">
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
            user.isActive
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-500',
          )}
        >
          {user.isActive ? '有効' : '無効'}
        </span>
      </td>
      <td className="hidden whitespace-nowrap px-6 py-4 text-sm text-gray-500 lg:table-cell">
        {user.lastLoginAt !== null
          ? new Date(user.lastLoginAt).toLocaleString('ja-JP')
          : <span className="text-gray-400">—</span>}
      </td>
      <td className="hidden whitespace-nowrap px-6 py-4 text-sm text-gray-500 lg:table-cell">
        {new Date(user.createdAt).toLocaleDateString('ja-JP')}
      </td>
      <td className="whitespace-nowrap px-6 py-4 text-right">
        <UserRowActions
          user={user}
          onUpdated={() => router.refresh()}
          onDeleted={() => router.refresh()}
        />
      </td>
    </tr>
  )
}
