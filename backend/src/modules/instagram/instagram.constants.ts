export const INSTAGRAM_PROVIDER_VARIANT = 'INSTAGRAM_LOGIN' as const

export const INSTAGRAM_SUBJECT_TYPES = {
  CONNECTED_ACCOUNT: 'CONNECTED_ACCOUNT',
  TARGET_PROFILE: 'TARGET_PROFILE',
} as const

export const INSTAGRAM_TOKEN_STATUSES = {
  ACTIVE: 'ACTIVE',
  REAUTH_REQUIRED: 'REAUTH_REQUIRED',
  ERROR: 'ERROR',
} as const

export type InstagramProviderVariant = typeof INSTAGRAM_PROVIDER_VARIANT
export type InstagramSubjectType =
  (typeof INSTAGRAM_SUBJECT_TYPES)[keyof typeof INSTAGRAM_SUBJECT_TYPES]
export type InstagramTokenStatus =
  (typeof INSTAGRAM_TOKEN_STATUSES)[keyof typeof INSTAGRAM_TOKEN_STATUSES]
