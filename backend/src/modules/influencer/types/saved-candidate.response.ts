import type { InfluencerProfileResponse } from './influencer-profile.response'

export interface SavedCandidateResponse {
  id: string
  profileId: string
  note: string | null
  tags: string[]
  profile: InfluencerProfileResponse
  createdAt: string
}
