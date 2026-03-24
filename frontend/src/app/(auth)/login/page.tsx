import { LoginForm } from './login-form'

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-900">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Influencer Discovery Platform
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            アカウントにサインインしてください
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm sm:p-8 dark:border-gray-700 dark:bg-gray-800">
          <LoginForm />
        </div>
      </div>
    </main>
  )
}
