/**
 * API response shape for a Report record.
 *
 * Follows the project data-separation principle:
 *   - status tracks the async lifecycle of file generation
 *   - filePath is omitted from the API surface (internal path only)
 *   - downloadUrl is provided once status === 'COMPLETED'
 */
export interface ReportResponse {
  id: string
  userId: string
  reportType: string
  format: string
  title: string
  status: string
  fileSize: number | null
  errorMessage: string | null
  generatedAt: string | null
  expiresAt: string | null
  createdAt: string
  updatedAt: string
}
