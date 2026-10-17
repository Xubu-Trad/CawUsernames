import { expect } from 'chai'
import { getActionCost } from '../../../src/utils/cawActionCosts'

describe('cawActionCosts / getActionCost — fixed protocol costs', () => {
  it('returns the published baseline costs and splits', () => {
    expect(getActionCost('CAW')).to.deep.equal({ spend: 5000n, communal: 5000n, receive: 0n })
    expect(getActionCost('LIKE')).to.deep.equal({ spend: 2000n, communal: 400n, receive: 1600n })
    expect(getActionCost('RECAW')).to.deep.equal({ spend: 4000n, communal: 2000n, receive: 2000n })
    expect(getActionCost('FOLLOW')).to.deep.equal({ spend: 30000n, communal: 6000n, receive: 24000n })
  })

  it('ignores a fresh non-zero cap ratio', () => {
    const ratio = 6790207473144214254423584n
    const lastUpdated = 1788397800n
    const now = 1788397920n

    expect(getActionCost('CAW', ratio, lastUpdated, now).spend).to.equal(5000n)
    expect(getActionCost('LIKE', ratio, lastUpdated, now).spend).to.equal(2000n)
    expect(getActionCost('RECAW', ratio, lastUpdated, now).spend).to.equal(4000n)
    expect(getActionCost('FOLLOW', ratio, lastUpdated, now).spend).to.equal(30000n)
  })

  it('is invariant across arbitrary oracle timestamps and ratios', () => {
    const cases = [
      [1n, 1n, 1n],
      [10n ** 30n, 0n, 0n],
      [123456789n, 100n, 10_000_000n],
    ] as const

    for (const [ratio, updated, now] of cases) {
      expect(getActionCost('LIKE', ratio, updated, now)).to.deep.equal({
        spend: 2000n,
        communal: 400n,
        receive: 1600n,
      })
    }
  })
})
