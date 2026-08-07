import { describe, it, expect } from 'vitest'
import {
  CRITERIA,
  SCORE_LABELS,
  RECOMMENDATION_OPTIONS,
} from '../AssessmentConfig'

describe('AssessmentConfig', () => {
  it('defines six scoring criteria', () => {
    expect(CRITERIA).toHaveLength(6)
  })

  it('gives every criterion a key, label, and description', () => {
    for (const c of CRITERIA) {
      expect(c.key).toBeTruthy()
      expect(c.label).toBeTruthy()
      expect(c.description).toBeTruthy()
    }
  })

  it('uses unique criterion keys', () => {
    const keys = CRITERIA.map(c => c.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('includes the expected criterion keys', () => {
    expect(CRITERIA.map(c => c.key)).toEqual([
      'national_impact',
      'translation_readiness',
      'team_capability',
      'ecosystem_fit',
      'funding_pathway_clarity',
      'masterplan_alignment',
    ])
  })

  it('maps scores 1–5 to ascending labels', () => {
    expect(SCORE_LABELS).toEqual({
      1: 'Very Low',
      2: 'Low',
      3: 'Moderate',
      4: 'High',
      5: 'Very High',
    })
  })

  it('defines proceed, park, and decline recommendations', () => {
    expect(RECOMMENDATION_OPTIONS.map(o => o.value)).toEqual([
      'proceed',
      'park',
      'decline',
    ])
  })

  it('gives every recommendation a label and color', () => {
    for (const o of RECOMMENDATION_OPTIONS) {
      expect(o.label).toBeTruthy()
      expect(o.color).toBeTruthy()
    }
  })
})
