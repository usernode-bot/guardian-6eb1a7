# Guardian Allocation & Reservation Engine (PR8)

Complete service layer for Guardian allocation, reservation, ownership, and audit logging.

## Service Layer Architecture

### Core Services

#### `allocation.service.ts`
Manages Guardian assignment with pluggable allocation strategies.

**Strategies:**
- `RandomStrategy` - Random selection from available Guardians
- `BalancedTierStrategy` - Prefer higher rarity tiers

**Key Functions:**
- `assignGuardian()` - Assign a Guardian to a wallet with 1-hour reservation
- `listReservationsByWallet()` - Get active reservations for a wallet

#### `reservation.service.ts`
Manages time-bound Guardian reservations (1-hour holds).

**Key Functions:**
- `getActiveReservation()` - Fetch active reservation for a Guardian
- `getRemainingTime()` - Get milliseconds until expiry
- `cleanupExpiredReservations()` - Delete stale reservations and log events
- `cancelReservation()` - Manually release a reservation
- `createReservationExpiresAt()` - Generate 1-hour-future expiry date

#### `ownership.service.ts`
Manages Guardian ownership records (permanent, on-chain ready).

**Key Functions:**
- `getGuardianByWallet()` - Get Guardian owned or reserved by wallet (with lazy cleanup)
- `getOwnershipByWallet()` - Get ownership record
- `recordOwnership()` - Create ownership record
- `isMinted()` - Check if Guardian has been on-chain minted
- `listOwnedGuardians()` - Get all Guardians minted by wallet

#### `supply.service.ts`
Tracks Guardian pool supply and availability.

**Key Functions:**
- `getSupplyStats()` - Get counts by status and tier (with lazy cleanup)
- `getAvailableGuardians()` - Get Guardians with AVAILABLE status

#### `audit.service.ts`
Immutable audit log of all allocation events.

**Events:**
- `ASSIGNED` - Guardian assigned to wallet
- `RESERVED` - Reservation created
- `MINTED` - On-chain mint confirmed (PR9)
- `EXPIRED` - Reservation expired
- `RELEASED` - Guardian released back to AVAILABLE

**Key Functions:**
- `logEvent()` - Record an allocation event
- `getGuardianHistory()` - Get all events for a Guardian
- `getUserHistory()` - Get all events for a wallet

#### `wallet-registry.service.ts`
Wallet validation with dependency injection for future custom implementations.

**Interface:**
```typescript
interface WalletRegistry {
  isValid(wallet: string): Promise<boolean>;
  getUser(wallet: string): Promise<UserInfo | null>;
  hasMinimumFG(wallet: string, minutes: number): Promise<boolean>;
}
```

**Default Implementation:**
- Validates Usernode wallet addresses (`ut1...`)
- Mocks FG hour checks (always returns true if wallet valid)

## Database Schema

### `guardian` table
500 Guardian pool with status tracking.

- `id` (INTEGER PRIMARY KEY, 1-500)
- `name`, `title`, `tier`, `lore`, `image`
- `status` (AVAILABLE | RESERVED | MINTED | EXPIRED)

### `guardian_ownership` table
One-to-one mapping of Guardian → wallet (immutable once minted).

- `guardian_id` (UNIQUE, FK)
- `wallet_address` (UNIQUE)
- `user_id`, `username`
- `minted_at` (NULL until on-chain, set by PR9)

### `guardian_reservation` table
Temporary 1-hour holds on Guardians.

- `guardian_id` (UNIQUE, FK)
- `wallet_address`
- `user_id`, `username`
- `expires_at` (TIMESTAMPTZ)

### `guardian_audit_log` table
Immutable event log.

- `guardian_id` (FK)
- `wallet_address`, `user_id`, `username`
- `event` (ASSIGNED | RESERVED | MINTED | EXPIRED | RELEASED)
- `metadata` (JSONB)

## Cleanup Strategy

### Scheduled Cleanup
Runs every 60 minutes (configurable). Deletes expired reservations and updates Guardian status.

### Lazy Cleanup
Called before:
- `assignGuardian()` - Ensure no stale holds block assignment
- `getSupplyStats()` - Return accurate available count
- `getGuardianByWallet()` - Avoid returning expired reservation

## API Endpoints

### `POST /api/guardian/assign`
Assign a Guardian to authenticated user.

**Request:**
```json
{ "strategy": "random" | "balanced-tier" }
```

**Response:**
```json
{
  "success": true,
  "guardian": { "id": 42, "name": "Aegis", "tier": "RARE", "lore": "...", "image": "🗡️" },
  "reservation": {
    "expiresAt": "2026-06-18T15:30:00Z",
    "expiresIn": 3599
  }
}
```

### `GET /api/guardian/current`
Get current Guardian + reservation + ownership for user.

**Response:**
```json
{
  "guardian": { ... } | null,
  "status": "RESERVED" | "MINTED" | null,
  "reservation": { "expiresAt": "...", "expiresIn": 3599 } | null,
  "ownership": { "guardian_id": 42, "wallet_address": "...", "minted_at": null } | null
}
```

### `GET /api/supply/stats`
Get supply statistics (with lazy cleanup side effect).

**Response:**
```json
{
  "total": 500,
  "available": 245,
  "reserved": 23,
  "minted": 232,
  "byTier": {
    "COMMON": { "available": 150, "reserved": 15, "minted": 135 },
    ...
  }
}
```

### `GET /api/guardian/history`
Get audit log for authenticated user.

**Response:**
```json
{
  "events": [
    { "event": "ASSIGNED", "guardian": { "id": 42, "name": "Aegis" }, "createdAt": "...", "metadata": {...} }
  ]
}
```

### `POST /api/guardian/cleanup` (admin only)
Manually trigger cleanup (for testing).

**Response:**
```json
{ "released": 5 }
```

## Lifecycle States

```
AVAILABLE
  ↓ (assignGuardian called)
RESERVED (1-hour countdown)
  ↓ (expires_at < NOW() and cleanup runs)
AVAILABLE (reverts)
  
OR

RESERVED
  ↓ (mint transaction succeeds in PR9)
MINTED (permanent)
```

## Design Principles

1. **Separation of Concerns** - Allocation, ownership, reservation are separate concerns. PR4 eligibility is external.
2. **Dependency Injection** - WalletRegistry is injected, allowing PR9+ to swap implementations without touching allocation logic.
3. **Lazy Cleanup** - Expired reservations are cleaned up on every relevant API call, ensuring consistency even if scheduled cleanup is missed.
4. **Audit Trail** - All events are logged immutably for debugging and compliance.
5. **Type Safety** - Full TypeScript with strict type checking for safety.

## Testing

Unit tests in `__tests__/` directory covering:
- Allocation strategies
- Reservation expiry
- Ownership tracking
- Supply counting
- Audit logging

All tests use a real PostgreSQL database (from `process.env.DATABASE_URL`).

## Future Work (PR9+)

1. **On-chain Minting** - Set `minted_at` when blockchain transaction confirms
2. **Custom WalletRegistry** - Inject FG/wallet validation logic
3. **Tier-weighted Strategies** - Weighted allocation favoring rare Guardians
4. **Admin Dashboard** - View allocation history, manually manage reservations
