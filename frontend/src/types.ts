export type OrgType = 'startup' | 'university' | 'ngo' | 'government' | 'consortium' | 'research_centre' | 'other'

export interface Organisation {
  id: string
  name: string
  org_type: OrgType | null
  sector: string | null
  state_territory: string | null
  website: string | null
  abn: string | null
  notes: string | null
  created_at: string
}

export interface Pitch {
  id: number
  title: string
  short_description?: string
  source?: string
  funding_pathway?: string
  domain_tags?: string
  is_confidential?: boolean
  submission_date?: string
  current_stage: string
  lead_id?: number
}

export interface User {
  id: number
  email: string
  display_name: string
  role: 'admin' | 'assessor' | 'viewer'
  is_active: boolean
}

export interface AuthContextType {
  user: User | null
  token: string | null
  loading: boolean
  login: (token: string, user: User) => void
  logout: () => void
}

export interface ApiError {
  response?: {
    data?: {
      detail?: string
    }
    status?: number
  }
}
