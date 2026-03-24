export interface ApiError {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

export interface User {
  id: string
  email: string
  role: 'ADMIN' | 'ANALYST' | 'VIEWER'
  createdAt: string
}

export interface AuthLoginRequest {
  email: string
  password: string
}

export interface AuthLoginResponse {
  user: User
}

/**
 * データ分離原則に基づく型定義。
 * 事実データ・推定値・LLM生成コメントをフィールドレベルで分離する。
 */
export type DataFieldStatus = 'FACT' | 'ESTIMATED' | 'UNAVAILABLE'
export type Confidence = 'LOW' | 'MEDIUM' | 'HIGH'

export interface DataField<T> {
  value: T | null
  status: DataFieldStatus
  source?: string
  confidence?: Confidence
}

export interface InfluencerProfile {
  id: string
  platform: string
  username: string
  displayName: string | null
  latestSnapshot: {
    followerCount: DataField<number>
    followingCount: DataField<number>
    mediaCount: DataField<number>
    engagementRate: DataField<number>
    biography: DataField<string>
    fetchedAt: string
  } | null
  latestScore: {
    totalScore: number
    confidence: string
    breakdowns: Array<{
      category: string
      score: number
      confidence: string
    }>
    scoredAt: string
  } | null
  createdAt: string
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

export interface SavedCandidate {
  id: string
  profileId: string
  profile: InfluencerProfile
  note: string | null
  tags: string[]
  createdAt: string
}

export interface Report {
  id: string
  reportType: string
  format: string
  title: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  fileSize: number | null
  errorMessage: string | null
  generatedAt: string | null
  createdAt: string
}

export interface LatestScoreResponse {
  totalScore: number
  confidence: string
  breakdowns: Array<{
    category: string
    score: number
    confidence: string
  }>
  scoredAt: string
}

export interface CreateReportRequest {
  format: 'PDF' | 'CSV'
  reportType: string
  profileIds: string[]
  title?: string
}

export interface ComparisonItem {
  id: string
  profileId: string
  displayOrder: number
  profile: InfluencerProfile
}

export interface ComparisonSession {
  id: string
  name: string | null
  items: ComparisonItem[]
  createdAt: string
}

export interface InstagramConnectionStatus {
  connected: boolean
  username?: string
  connectedAt?: string
}

export interface DashboardRecentSaved {
  id: string
  profileId: string
  username: string
  displayName: string | null
  savedAt: string
}

export interface DashboardRecentReport {
  id: string
  title: string
  format: string
  status: string
  createdAt: string
}

export interface DashboardStats {
  totalProfiles: number
  savedCandidates: number
  totalReports: number
  averageScore: number | null
  recentSaved: DashboardRecentSaved[]
  recentReports: DashboardRecentReport[]
}

// ---------------------------------------------------------------------------
// Admin — User management
// ---------------------------------------------------------------------------

export interface AdminUser {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'ANALYST' | 'VIEWER'
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
}

export interface CreateUserRequest {
  name: string
  email: string
  password: string
  role: 'ADMIN' | 'ANALYST' | 'VIEWER'
}

export interface UpdateUserRequest {
  role?: 'ADMIN' | 'ANALYST' | 'VIEWER'
  isActive?: boolean
}

// ---------------------------------------------------------------------------
// Admin — API key management
// ---------------------------------------------------------------------------

export type ApiKeyPermission = 'read' | 'write' | 'admin'

export interface AdminApiKey {
  id: string
  userId: string
  name: string
  prefix: string
  lastUsedAt: string | null
  expiresAt: string | null
  isRevoked: boolean
  createdAt: string
}

export interface CreateApiKeyRequest {
  name: string
  permissions: ApiKeyPermission[]
  expiresAt?: string
}

export interface CreateApiKeyResponse {
  apiKey: AdminApiKey
  rawKey: string
}
