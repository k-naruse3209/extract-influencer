import type { InfluencerProfileResponse } from './influencer-profile.response'

export interface ComparisonItemResponse {
  id: string
  profileId: string
  displayOrder: number
  profile: InfluencerProfileResponse
}

export interface ComparisonSessionResponse {
  id: string
  name: string | null
  items: ComparisonItemResponse[]
  createdAt: string
  updatedAt: string
}
