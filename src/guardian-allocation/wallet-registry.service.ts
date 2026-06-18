export interface UserInfo {
  wallet_address: string;
  username: string;
  user_id: number;
}

export interface WalletRegistry {
  isValid(wallet: string): Promise<boolean>;
  getUser(wallet: string): Promise<UserInfo | null>;
  hasMinimumFG(wallet: string, minutes: number): Promise<boolean>;
}

class DefaultWalletRegistry implements WalletRegistry {
  async isValid(wallet: string): Promise<boolean> {
    if (!wallet || typeof wallet !== 'string') return false;
    return wallet.startsWith('ut1');
  }

  async getUser(wallet: string): Promise<UserInfo | null> {
    const isValid = await this.isValid(wallet);
    if (!isValid) return null;
    return {
      wallet_address: wallet,
      username: 'user-' + wallet.slice(-8),
      user_id: Math.abs(wallet.split('').reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0), 0)),
    };
  }

  async hasMinimumFG(wallet: string, minutes: number): Promise<boolean> {
    const isValid = await this.isValid(wallet);
    if (!isValid) return false;
    return minutes >= 60;
  }
}

let walletRegistry: WalletRegistry = new DefaultWalletRegistry();

export function setWalletRegistry(registry: WalletRegistry): void {
  walletRegistry = registry;
}

export function getWalletRegistry(): WalletRegistry {
  return walletRegistry;
}

export function createDefaultRegistry(): WalletRegistry {
  return new DefaultWalletRegistry();
}
