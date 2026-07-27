export const calculateAvoidedEmissions = (baseline: number, actual: number, factor: number): number => {
  if (actual >= baseline) return 0;
  return (baseline - actual) * factor;
};
