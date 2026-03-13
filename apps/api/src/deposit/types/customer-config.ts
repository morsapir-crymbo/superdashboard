import { CUSTOMER_CREDENTIALS, getCustomerCredentials } from '../../config/customer-credentials.config';

export type DecimalStrategy = 'power' | 'fixed';

export interface CustomerQueryFilter {
  column: string;
  operator: '=' | '<>' | 'IN' | 'NOT IN';
  value: string | string[];
}

export interface CustomerDbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface CustomerVolumeConfig {
  id: string;
  displayName: string;
  startDate: Date;
  db: CustomerDbConfig;
  decimalStrategy: DecimalStrategy;
  fixedDecimals?: number;
  filters: CustomerQueryFilter[];
}

function buildCustomerConfig(
  id: string,
  displayName: string,
  startDate: Date,
  decimalStrategy: DecimalStrategy,
  filters: CustomerQueryFilter[],
  fixedDecimals?: number,
): CustomerVolumeConfig {
  const creds = getCustomerCredentials(id);
  return {
    id,
    displayName,
    startDate,
    db: creds ? {
      host: creds.host,
      port: creds.port,
      user: creds.user,
      password: creds.password,
      database: creds.database,
    } : {
      host: '',
      port: 3306,
      user: '',
      password: '',
      database: '',
    },
    decimalStrategy,
    fixedDecimals,
    filters,
  };
}

/**
 * Customer configurations.
 * 
 * BASE FILTERS (applied to ALL customers automatically in deposit-query.builder.ts):
 * - d.to_address <> 'INTERNAL_TRANSFER'
 * - d.status IN ('CONFIRMED', 'COMPLETED')
 * 
 * Customer-specific filters below are ADDITIONAL filters on top of base filters.
 */
const ALL_CUSTOMER_CONFIGS: CustomerVolumeConfig[] = [
  buildCustomerConfig(
    'digiblox',
    'Digiblox',
    new Date('2026-02-01'),
    'power',
    [], // Base filters apply automatically
  ),
  buildCustomerConfig(
    'coincashy',
    'Coincashy',
    new Date('2025-01-01'),
    'power',
    [], // Base filters apply automatically
  ),
  buildCustomerConfig(
    'orocalab',
    'Orocalab',
    new Date('2025-01-01'),
    'fixed',
    [], // Base filters apply automatically
    2,
  ),
  buildCustomerConfig(
    'bnp',
    'BNP',
    new Date('2024-01-01'),
    'power',
    [], // Base filters apply automatically
  ),
  buildCustomerConfig(
    'javashk',
    'Javashk',
    new Date('2025-07-01'),
    'power',
    [], // Base filters apply automatically
  ),
];

let configsLogged = false;

export function getCustomerConfigs(): CustomerVolumeConfig[] {
  const configured = ALL_CUSTOMER_CONFIGS.filter((c) => c.db.host && c.db.database);
  
  if (!configsLogged) {
    configsLogged = true;
    const allIds = ALL_CUSTOMER_CONFIGS.map((c) => c.id);
    const configuredIds = configured.map((c) => c.id);
    const missingIds = allIds.filter((id) => !configuredIds.includes(id));
    
    console.log('[CustomerConfig] All defined customers:', allIds.join(', '));
    console.log('[CustomerConfig] Configured customers (with DB creds):', configuredIds.join(', ') || '(none)');
    console.log('[CustomerConfig] Credentials source: customer-credentials.config.ts (committed file)');
    if (missingIds.length > 0) {
      console.warn('[CustomerConfig] Missing credentials for:', missingIds.join(', '));
    }
  }
  
  return configured;
}

export function getCustomerConfig(customerId: string): CustomerVolumeConfig | undefined {
  return getCustomerConfigs().find((c) => c.id === customerId);
}

export function getAllDefinedCustomerIds(): string[] {
  return ALL_CUSTOMER_CONFIGS.map((c) => c.id);
}

export function getMissingCustomerConfigs(): string[] {
  const configured = new Set(getCustomerConfigs().map((c) => c.id));
  return ALL_CUSTOMER_CONFIGS.filter((c) => !configured.has(c.id)).map((c) => c.id);
}
