import { describe, it, expect } from 'vitest'
import {
  PIPELINE_STAGES,
  STAGE_MAP,
  SOURCE_LABELS,
  FUNDING_LABELS,
} from '../PipelineConfig'

describe('PipelineConfig', () => {
  it('defines the expected ordered set of stages', () => {
    expect(PIPELINE_STAGES.map(s => s.key)).toEqual([
      'received',
      'initial_screen',
      'discovery_meeting',
      'deep_assessment',
      'due_diligence',
      'decision_pending',
      'active_support',
      'parked',
      'declined',
      'completed',
    ])
  })

  it('gives every stage a key, label, color, and lightColor', () => {
    for (const stage of PIPELINE_STAGES) {
      expect(stage.key).toBeTruthy()
      expect(stage.label).toBeTruthy()
      expect(stage.color).toBeTruthy()
      expect(stage.lightColor).toBeTruthy()
    }
  })

  it('uses unique stage keys', () => {
    const keys = PIPELINE_STAGES.map(s => s.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('builds STAGE_MAP keyed by stage key', () => {
    expect(Object.keys(STAGE_MAP).sort()).toEqual(
      PIPELINE_STAGES.map(s => s.key).sort()
    )
    expect(STAGE_MAP.received.label).toBe('Received')
    expect(STAGE_MAP.completed).toEqual(
      PIPELINE_STAGES.find(s => s.key === 'completed')
    )
  })

  it('exposes the expected source labels', () => {
    expect(SOURCE_LABELS).toMatchObject({
      referral: 'Referral',
      website: 'Website',
      event: 'Event',
      cold_outreach: 'Cold Outreach',
      internal: 'Internal',
    })
  })

  it('exposes the expected funding labels', () => {
    expect(FUNDING_LABELS).toMatchObject({
      crc_bid: 'CRC Bid',
      rdti: 'RDTI',
      philanthropic: 'Philanthropic',
      government_grant: 'Government Grant',
      private: 'Private',
      other: 'Other',
    })
  })
})
