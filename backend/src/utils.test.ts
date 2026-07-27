import { calculateAvoidedEmissions } from './utils';

describe('Calculation Logic', () => {
  it('should calculate avoided emissions correctly when actual < baseline', () => {
    const result = calculateAvoidedEmissions(1000, 800, 0.5);
    expect(result).toBe(100);
  });

  it('should return 0 when actual >= baseline', () => {
    const result = calculateAvoidedEmissions(1000, 1200, 0.5);
    expect(result).toBe(0);
  });

  it('should return 0 when actual == baseline', () => {
    const result = calculateAvoidedEmissions(1000, 1000, 0.5);
    expect(result).toBe(0);
  });
});
