import { getTraitsForStage, getTraitsForScore } from '../traits.service';

describe('TraitsService', () => {
  describe('getTraitsForStage', () => {
    it('should return INITIATE traits', () => {
      const traits = getTraitsForStage('INITIATE');
      expect(traits.stage).toBe('INITIATE');
      expect(traits.aura).toBe('Gray Aura');
      expect(traits.armorTier).toBe('Novice Leather');
      expect(traits.weaponTier).toBe('Wooden Staff');
      expect(traits.emoji).toBe('🌱');
    });

    it('should return AWAKENED traits', () => {
      const traits = getTraitsForStage('AWAKENED');
      expect(traits.stage).toBe('AWAKENED');
      expect(traits.aura).toBe('Blue Aura');
      expect(traits.armorTier).toBe('Apprentice Chain');
      expect(traits.weaponTier).toBe('Iron Sword');
      expect(traits.emoji).toBe('💙');
    });

    it('should return ASCENDANT traits', () => {
      const traits = getTraitsForStage('ASCENDANT');
      expect(traits.aura).toBe('Gold Aura');
      expect(traits.armorTier).toBe('Knight Plate');
    });

    it('should return GUARDIAN traits', () => {
      const traits = getTraitsForStage('GUARDIAN');
      expect(traits.aura).toBe('Plasma Aura');
      expect(traits.armorTier).toBe('Celestial Armor');
    });

    it('should return MYTHIC traits', () => {
      const traits = getTraitsForStage('MYTHIC');
      expect(traits.aura).toBe('Celestial Aura');
      expect(traits.armorTier).toBe('Legendary Divinity Plate');
      expect(traits.emoji).toBe('🔮');
    });

    it('should throw error for invalid stage', () => {
      expect(() => getTraitsForStage('INVALID' as any)).toThrow();
    });
  });

  describe('getTraitsForScore', () => {
    it('should return INITIATE traits for score 50', () => {
      const traits = getTraitsForScore(50);
      expect(traits.stage).toBe('INITIATE');
    });

    it('should return AWAKENED traits for score 150', () => {
      const traits = getTraitsForScore(150);
      expect(traits.stage).toBe('AWAKENED');
    });

    it('should return MYTHIC traits for score 1500', () => {
      const traits = getTraitsForScore(1500);
      expect(traits.stage).toBe('MYTHIC');
    });
  });
});
