import type {
  InstagramProviderVariant,
  InstagramSubjectType,
} from '../instagram.constants'

export const INSTAGRAM_FETCH_QUEUE = 'instagram-fetch'

export type ProfileFetchJob = {
  type: 'PROFILE'
  profileId: string
  requestedByUserId: string
  targetUsername: string
  providerVariant: InstagramProviderVariant
  priority: 1
}

export type MediaInsightsJob = {
  type: 'MEDIA_INSIGHTS'
  profileId: string
  requestedByUserId: string
  targetAccountId: string
  subjectType: InstagramSubjectType
  providerVariant: InstagramProviderVariant
  priority: 5
}

export type TokenRefreshJob = {
  type: 'TOKEN_REFRESH'
  userId: string
  providerVariant: InstagramProviderVariant
  priority: 3
}

export type InstagramFetchJobData =
  | ProfileFetchJob
  | MediaInsightsJob
  | TokenRefreshJob
