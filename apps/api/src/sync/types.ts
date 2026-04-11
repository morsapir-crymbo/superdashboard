export interface CustomerApiConfig {
  id: string;
  displayName: string;
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
  username: string;
}

export type SyncSource = 'deposits' | 'transfers' | 'withdrawals' | 'trades';

export interface CheckpointState {
  lastId: number | null;
  lastUpdatedAt: Date | null;
}

export interface SyncSourceRecordInput {
  sourceKey: string;
  eventDate: string;
  sourceUpdatedAt: Date | null;
  status: string | null;
  isIncluded: boolean;
  isCrypto: boolean | null;
  amountUsd: number;
  feeUsd: number;
  kytEvent: boolean;
}

export interface DailyMetricsDelta {
  cryptoDepositVolume: number;
  cryptoDepositCount: number;
  cryptoDepositFees: number;
  fiatDepositVolume: number;
  fiatDepositCount: number;
  fiatDepositFees: number;
  cryptoWithdrawalVolume: number;
  cryptoWithdrawalCount: number;
  cryptoWithdrawalFees: number;
  fiatWithdrawalVolume: number;
  fiatWithdrawalCount: number;
  fiatWithdrawalFees: number;
  transferVolume: number;
  transferCount: number;
  transferFees: number;
  tradeVolume: number;
  tradeCount: number;
  tradeFees: number;
  kytEventCount: number;
}

export interface SyncResult {
  success: boolean;
  timestamp: string;
  results: Array<{ customerId: string; success: boolean; message: string }>;
  summary: { total: number; successful: number; failed: number };
}
