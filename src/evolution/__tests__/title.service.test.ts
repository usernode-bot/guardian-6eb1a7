import { calculateTitle, getTitleThreshold } from '../title.service';

describe('TitleService', () => {
  describe('calculateTitle', () => {
    it('should return Node Wanderer for score 0-100', () => {
      expect(calculateTitle(0)).toBe('Node Wanderer');
      expect(calculateTitle(50)).toBe('Node Wanderer');
      expect(calculateTitle(100)).toBe('Node Wanderer');
    });

    it('should return Network Scout for score 101-250', () => {
      expect(calculateTitle(101)).toBe('Network Scout');
      expect(calculateTitle(175)).toBe('Network Scout');
      expect(calculateTitle(250)).toBe('Network Scout');
    });

    it('should return Protocol Guardian for score 251-500', () => {
      expect(calculateTitle(251)).toBe('Protocol Guardian');
      expect(calculateTitle(375)).toBe('Protocol Guardian');
      expect(calculateTitle(500)).toBe('Protocol Guardian');
    });

    it('should return Core Defender for score 501-1000', () => {
      expect(calculateTitle(501)).toBe('Core Defender');
      expect(calculateTitle(750)).toBe('Core Defender');
      expect(calculateTitle(1000)).toBe('Core Defender');
    });

    it('should return Legend Keeper for score 1001+', () => {
      expect(calculateTitle(1001)).toBe('Legend Keeper');
      expect(calculateTitle(10000)).toBe('Legend Keeper');
    });

    it('should return empty string for negative score', () => {
      expect(calculateTitle(-10)).toBe('');
    });
  });

  describe('getTitleThreshold', () => {
    it('should return correct threshold for Node Wanderer', () => {
      const threshold = getTitleThreshold('Node Wanderer');
      expect(threshold).not.toBeNull();
      expect(threshold?.minScore).toBe(0);
      expect(threshold?.maxScore).toBe(100);
    });

    it('should return null for invalid title', () => {
      const threshold = getTitleThreshold('Invalid Title');
      expect(threshold).toBeNull();
    });
  });
});
