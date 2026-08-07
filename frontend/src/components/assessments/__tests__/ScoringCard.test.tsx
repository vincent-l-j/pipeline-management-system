import { render, screen } from '@testing-library/react'
import ScoringCard from '../ScoringCard'

const baseAssessment = {
  national_impact: 4,
  translation_readiness: 3,
  team_capability: 5,
  ecosystem_fit: 4,
  funding_pathway_clarity: 3,
  masterplan_alignment: 4,
  recommendation: 'proceed',
  rationale: 'Strong team with a clear pathway to commercialisation.',
  version: 2,
  assessment_date: '2026-01-15',
}

// total = 23, avg = 23/6 = 3.8
describe('ScoringCard', () => {
  it('renders the assessment version', () => {
    render(<ScoringCard assessment={baseAssessment} assessorName="Jane Smith" />)
    expect(screen.getByText(/Assessment v2/)).toBeInTheDocument()
  })

  it('renders the assessor name', () => {
    render(<ScoringCard assessment={baseAssessment} assessorName="Jane Smith" />)
    expect(screen.getByText(/Jane Smith/)).toBeInTheDocument()
  })

  it('falls back to "Unknown assessor" when assessorName is not provided', () => {
    render(<ScoringCard assessment={baseAssessment} />)
    expect(screen.getByText(/Unknown assessor/)).toBeInTheDocument()
  })

  it('renders the calculated average score', () => {
    render(<ScoringCard assessment={baseAssessment} assessorName="Jane Smith" />)
    expect(screen.getByText('3.8')).toBeInTheDocument()
  })

  it('renders all 6 scoring criteria labels', () => {
    render(<ScoringCard assessment={baseAssessment} assessorName="Jane Smith" />)
    expect(screen.getByText('National Impact Potential')).toBeInTheDocument()
    expect(screen.getByText('Translation Readiness')).toBeInTheDocument()
    expect(screen.getByText('Team Capability')).toBeInTheDocument()
    expect(screen.getByText('Ecosystem Fit')).toBeInTheDocument()
    expect(screen.getByText('Funding Pathway Clarity')).toBeInTheDocument()
    expect(screen.getByText('Masterplan Alignment')).toBeInTheDocument()
  })

  it('renders the Proceed recommendation badge', () => {
    render(<ScoringCard assessment={baseAssessment} assessorName="Jane Smith" />)
    expect(screen.getByText('Proceed')).toBeInTheDocument()
  })

  it('renders the Park recommendation badge', () => {
    render(<ScoringCard assessment={{ ...baseAssessment, recommendation: 'park' }} assessorName="Jane" />)
    expect(screen.getByText('Park')).toBeInTheDocument()
  })

  it('renders the Decline recommendation badge', () => {
    render(<ScoringCard assessment={{ ...baseAssessment, recommendation: 'decline' }} assessorName="Jane" />)
    expect(screen.getByText('Decline')).toBeInTheDocument()
  })

  it('renders rationale text when present', () => {
    render(<ScoringCard assessment={baseAssessment} assessorName="Jane Smith" />)
    expect(screen.getByText('Strong team with a clear pathway to commercialisation.')).toBeInTheDocument()
  })

  it('does not render the rationale section when absent', () => {
    const noRationale = { ...baseAssessment, rationale: '' }
    render(<ScoringCard assessment={noRationale} assessorName="Jane Smith" />)
    expect(screen.queryByText('Rationale')).not.toBeInTheDocument()
  })

  it('renders the assessment date', () => {
    render(<ScoringCard assessment={baseAssessment} assessorName="Jane Smith" />)
    expect(screen.getByText(/2026-01-15/)).toBeInTheDocument()
  })

  it('calculates average score of 5.0 for all-perfect scores', () => {
    const perfect = {
      ...baseAssessment,
      national_impact: 5,
      translation_readiness: 5,
      team_capability: 5,
      ecosystem_fit: 5,
      funding_pathway_clarity: 5,
      masterplan_alignment: 5,
    }
    render(<ScoringCard assessment={perfect} assessorName="Jane" />)
    expect(screen.getByText('5.0')).toBeInTheDocument()
  })
})
