/**
 * @typedef {('COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'MYTHIC')} GuardianTier
 */

/**
 * @typedef {Object} Guardian
 * @property {string} id - Zero-padded ID from "001" to "500"
 * @property {string} name - Guardian name (e.g., "Aegis")
 * @property {string} title - Descriptive title based on tier
 * @property {GuardianTier} tier - Rarity tier
 * @property {string} lore - 1-2 sentence flavor text
 * @property {string} image - Emoji or placeholder
 * @property {boolean} allocated - Whether this guardian is allocated
 * @property {string} [owner] - Optional Usernode address (for PR8)
 */

/**
 * @typedef {Object} GuardianMetadata
 * @property {string} id
 * @property {string} name
 * @property {GuardianTier} tier
 * @property {number} fgHours - Foreground runtime in hours
 * @property {number} peerCount - Number of peers
 * @property {number} createdAt - Timestamp when allocated
 */

/**
 * @typedef {Object} UserNodeContext
 * @property {number} fgHours - Foreground runtime in hours
 * @property {number} peerCount - Number of connected peers
 */

module.exports = {};
