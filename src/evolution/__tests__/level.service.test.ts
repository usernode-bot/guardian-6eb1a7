import { calculateLevel, getLevelThreshold, checkLevelProgression } from '../level.service';

describe('LevelService', () => {
  describe('calculateLevel', () => {
    it('should return level 1 for score 0-100', () => {
      expect(calculateLevel(0)).toBe(1);
      expect(calculateLevel(50)).toBe(1);
      expect(calculateLevel(100)).toBe(1);
    });

    it('should return level 2 for score 101-250', () => {
      expect(calculateLevel(101)).toBe(2);
      expect(calculateLevel(175)).toBe(2);
      expect(calculateLevel(250)).toBe(2);
    });

    it('should return level 3 for score 251-500', () => {
      expect(calculateLevel(251)).toBe(3);
      expect(calculateLevel(375)).toBe(3);
      expect(calculateLevel(500)).toBe(3);
    });

    it('should return level 4 for score 501-1000', () => {
      expect(calculateLevel(501)).toBe(4);
      expect(calculateLevel(750)).toBe(4);
      expect(calculateLevel(1000)).toBe(4);
    });

    it('should return level 5 for score 1001-2000', () => {
      expect(calculateLevel(1001)).toBe(5);
      expect(calculateLevel(1500)).toBe(5);
      expect(calculateLevel(2000)).toBe(5);
    });

    it('should return level 10 for high scores', () => {
      expect(calculateLevel(10001)).toBe(10);
      expect(calculateLevel(100000)).toBe(10);
    });

    it('should return level 1 for negative score', () => {
      expect(calculateLevel(-10)).toBe(1);
    });
  });

  describe('getLevelThreshold', () => {
    it('should return correct threshold for level 1', () => {
      const threshold = getLevelThreshold(1);
      expect(threshold.minScore).toBe(0);
      expect(threshold.maxScore).toBe(100);
    });

    it('should return correct threshold for level 5', () => {
      const threshold = getLevelThreshold(5);
      expect(threshold.minScore).toBe(1001);
      expect(threshold.maxScore).toBe(2000);
    });

    it('should throw error for invalid level', () => {
      expect(() => getLevelThreshold(11)).toThrow();
      expect(() => getLevelThreshold(0)).toThrow();
    });
  });

  describe('checkLevelProgression', () => {
    it('should detect no level change', () => {
      const result = checkLevelProgression(50, 100);
      expect(result.levelChanged).toBe(false);
      expect(result.oldLevel).toBe(1);
      expect(result.newLevel).toBe(1);
    });

    it('should detect level change from 1 to 2', () => {
      const result = checkLevelProgression(100, 101);
      expect(result.levelChanged).toBe(true);
      expect(result.oldLevel).toBe(1);
      expect(result.newLevel).toBe(2);
    });

    it('should detect multi-level progression', () => {
      const result = checkLevelProgression(0, 1000);
      expect(result.levelChanged).toBe(true);
      expect(result.oldLevel).toBe(1);
      expect(result.newLevel).toBe(4);
    });
  });
});
