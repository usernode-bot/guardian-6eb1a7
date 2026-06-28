import { calculateStage, getStageThreshold, checkStageProgression } from '../stages.service';

describe('StagesService', () => {
  describe('calculateStage', () => {
    it('should return INITIATE for score 0-100', () => {
      expect(calculateStage(0)).toBe('INITIATE');
      expect(calculateStage(50)).toBe('INITIATE');
      expect(calculateStage(100)).toBe('INITIATE');
    });

    it('should return AWAKENED for score 101-250', () => {
      expect(calculateStage(101)).toBe('AWAKENED');
      expect(calculateStage(175)).toBe('AWAKENED');
      expect(calculateStage(250)).toBe('AWAKENED');
    });

    it('should return ASCENDANT for score 251-500', () => {
      expect(calculateStage(251)).toBe('ASCENDANT');
      expect(calculateStage(375)).toBe('ASCENDANT');
      expect(calculateStage(500)).toBe('ASCENDANT');
    });

    it('should return MYTHIC for score 1001+', () => {
      expect(calculateStage(1001)).toBe('MYTHIC');
      expect(calculateStage(10000)).toBe('MYTHIC');
    });

    it('should throw error for negative score', () => {
      expect(() => calculateStage(-1)).toThrow();
    });
  });

  describe('getStageThreshold', () => {
    it('should return correct threshold for INITIATE', () => {
      const threshold = getStageThreshold('INITIATE');
      expect(threshold.minScore).toBe(0);
      expect(threshold.maxScore).toBe(100);
    });

    it('should return correct threshold for MYTHIC', () => {
      const threshold = getStageThreshold('MYTHIC');
      expect(threshold.minScore).toBe(1001);
      expect(threshold.maxScore).toBe(Infinity);
    });

    it('should throw error for invalid stage', () => {
      expect(() => getStageThreshold('INVALID' as any)).toThrow();
    });
  });

  describe('checkStageProgression', () => {
    it('should detect no stage change', () => {
      const result = checkStageProgression(50, 100);
      expect(result.stageChanged).toBe(false);
      expect(result.oldStage).toBe('INITIATE');
      expect(result.newStage).toBe('INITIATE');
    });

    it('should detect stage change from INITIATE to AWAKENED', () => {
      const result = checkStageProgression(100, 101);
      expect(result.stageChanged).toBe(true);
      expect(result.oldStage).toBe('INITIATE');
      expect(result.newStage).toBe('AWAKENED');
    });

    it('should detect multi-stage progression', () => {
      const result = checkStageProgression(0, 500);
      expect(result.stageChanged).toBe(true);
      expect(result.oldStage).toBe('INITIATE');
      expect(result.newStage).toBe('ASCENDANT');
    });
  });
});
