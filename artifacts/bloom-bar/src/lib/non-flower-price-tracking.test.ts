import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  calculateNonFlowerAllocationCost,
  calculateNonFlowerAllocationPercentage,
  calculateNonFlowerCostPerPiece,
} from './non-flower-price-tracking';

describe('non-flower purchase calculations', () => {
  it('recalculates cost per piece from the edited total and quantity', () => {
    assert.equal(calculateNonFlowerCostPerPiece(24, 6), 4);
    assert.equal(calculateNonFlowerCostPerPiece(25, 4), 6.25);
  });

  it('does not produce an invalid value while a quantity is being edited', () => {
    assert.equal(calculateNonFlowerCostPerPiece(25, 0), 0);
  });

  it('calculates allocated cost from either quantity or percentage', () => {
    assert.equal(calculateNonFlowerAllocationPercentage(10, 3, null), 30);
    assert.equal(calculateNonFlowerAllocationCost(40, 10, 3, null), 12);
    assert.equal(calculateNonFlowerAllocationCost(40, 10, null, 25), 10);
  });
});