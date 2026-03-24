'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { apiClient, ApiClientError } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import type { AuthLoginResponse } from '@/types/api'

const loginSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
  password: z.string().min(1, 'パスワードを入力してください'),
})

type FieldErrors = Partial<Record<'email' | 'password', string>>

export function LoginForm() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setServerError(null)
    setFieldErrors({})

    const formData = new FormData(event.currentTarget)
    const raw = {
      email: formData.get('email') as string,
      password: formData.get('password') as string,
    }

    const parsed = loginSchema.safeParse(raw)
    if (!parsed.success) {
      const errors: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof FieldErrors
        errors[field] = issue.message
      }
      setFieldErrors(errors)
      return
    }

    setIsLoading(true)
    try {
      await apiClient<AuthLoginResponse>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      })
      router.push('/dashboard')
      router.refresh()
    } catch (error) {
      if (error instanceof ApiClientError) {
        setServerError(error.message)
      } else {
        setServerError('予期しないエラーが発生しました。しばらく経ってから再試行してください。')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {serverError !== null && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {serverError}
        </div>
      )}

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
          autoComplete="email"
          required
          aria-describedby={fieldErrors.email ? 'email-error' : undefined}
          aria-invalid={fieldErrors.email ? true : undefined}
          className={cn(
            'mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm',
            'placeholder-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
            fieldErrors.email
              ? 'border-red-300 focus-visible:ring-red-500'
              : 'border-gray-300',
          )}
          placeholder="example@company.com"
        />
        {fieldErrors.email && (
          <p id="email-error" role="alert" className="mt-1 text-xs text-red-600">
            {fieldErrors.email}
          </p>
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
          autoComplete="current-password"
          required
          aria-describedby={fieldErrors.password ? 'password-error' : undefined}
          aria-invalid={fieldErrors.password ? true : undefined}
          className={cn(
            'mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm',
            'placeholder-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
            fieldErrors.password
              ? 'border-red-300 focus-visible:ring-red-500'
              : 'border-gray-300',
          )}
          placeholder="••••••••"
        />
        {fieldErrors.password && (
          <p id="password-error" role="alert" className="mt-1 text-xs text-red-600">
            {fieldErrors.password}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isLoading}
        aria-busy={isLoading}
        className={cn(
          'w-full rounded-md px-4 py-2 text-sm font-semibold text-white',
          'bg-blue-600 hover:bg-blue-700 focus:outline-none focus-visible:ring-2',
          'focus-visible:ring-indigo-500 focus-visible:ring-offset-2 transition-colors',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        {isLoading ? 'サインイン中...' : 'サインイン'}
      </button>
    </form>
  )
}
