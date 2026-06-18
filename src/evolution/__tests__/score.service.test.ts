import { calculateContributionScore } from '../score.service';
import { ContributionMetrics } from '../types';

describe('ScoreService', () => {
  describe('calculateContributionScore', () => {
    it('should calculate score correctly with normal inputs', () => {
      const metrics: ContributionMetrics = { fgHours: 10, peerCount: 5, uptime: 80 };
      const score = calculateContributionScore(metrics);
      expect(score).toBe((10 * 40) + (5 * 20) + (80 * 40));
    });

    it('should return 0 for zero inputs', () => {
      const metrics: ContributionMetrics = { fgHours: 0, peerCount: 0, uptime: 0 };
      const score = calculateContributionScore(metrics);
      expect(score).toBe(0);
    });

    it('should return 0 for negative fgHours', () => {
      const metrics: ContributionMetrics = { fgHours: -1, peerCount: 5, uptime: 50 };
      const score = calculateContributionScore(metrics);
      expect(score).toBe(0);
    });

    it('should return 0 for negative peerCount', () => {
      const metrics: ContributionMetrics = { fgHours: 10, peerCount: -1, uptime: 50 };
      const score = calculateContributionScore(metrics);
      expect(score).toBe(0);
    });

    it('should return 0 for uptime > 100', () => {
      const metrics: ContributionMetrics = { fgHours: 10, peerCount: 5, uptime: 101 };
      const score = calculateContributionScore(metrics);
      expect(score).toBe(0);
    });

    it('should return 0 for negative uptime', () => {
      const metrics: ContributionMetrics = { fgHours: 10, peerCount: 5, uptime: -1 };
      const score = calculateContributionScore(metrics);
      expect(score).toBe(0);
    });

    it('should round the score to nearest integer', () => {
      const metrics: ContributionMetrics = { fgHours: 1.5, peerCount: 1.7, uptime: 33.3 };
      const score = calculateContributionScore(metrics);
      expect(Number.isInteger(score)).toBe(true);
    });

    it('should handle high values correctly', () => {
      const metrics: ContributionMetrics = { fgHours: 1000, peerCount: 500, uptime: 100 };
      const score = calculateContributionScore(metrics);
      expect(score).toBe((1000 * 40) + (500 * 20) + (100 * 40));
    });
  });
});
