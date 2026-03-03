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

const ALL_CUSTOMER_CONFIGS: CustomerVolumeConfig[] = [
  {
    id: 'orocalab',
    displayName: 'Orocalab',
    startDate: new Date('2025-01-01'),
    db: {
      host: process.env.OROCALAB_DB_HOST || '',
      port: parseInt(process.env.OROCALAB_DB_PORT || '3306', 10),
      user: process.env.OROCALAB_DB_USER || '',
      password: process.env.OROCALAB_DB_PASSWORD || '',
      database: process.env.OROCALAB_DB_DATABASE || '',
    },
    decimalStrategy: 'fixed',
    fixedDecimals: 2,
    filters: [],
  },
  {
    id: 'montrex',
    displayName: 'Montrex',
    startDate: new Date('2025-01-01'),
    db: {
      host: process.env.MONTREX_DB_HOST || '',
      port: parseInt(process.env.MONTREX_DB_PORT || '3306', 10),
      user: process.env.MONTREX_DB_USER || '',
      password: process.env.MONTREX_DB_PASSWORD || '',
      database: process.env.MONTREX_DB_DATABASE || '',
    },
    decimalStrategy: 'power',
    filters: [{ column: 'd.currency_type', operator: '=', value: 'FIAT' }],
  },
  {
    id: 'wyrei',
    displayName: 'Wyrei',
    startDate: new Date('2024-01-01'),
    db: {
      host: process.env.WYREI_DB_HOST || '',
      port: parseInt(process.env.WYREI_DB_PORT || '3306', 10),
      user: process.env.WYREI_DB_USER || '',
      password: process.env.WYREI_DB_PASSWORD || '',
      database: process.env.WYREI_DB_DATABASE || '',
    },
    decimalStrategy: 'power',
    filters: [],
  },
  {
    id: 'bnp',
    displayName: 'BNP',
    startDate: new Date('2024-01-01'),
    db: {
      host: process.env.BNP_DB_HOST || '',
      port: parseInt(process.env.BNP_DB_PORT || '3306', 10),
      user: process.env.BNP_DB_USER || '',
      password: process.env.BNP_DB_PASSWORD || '',
      database: process.env.BNP_DB_DATABASE || '',
    },
    decimalStrategy: 'power',
    filters: [],
  },
  {
    id: 'javashk',
    displayName: 'Javashk',
    startDate: new Date('2025-07-01'),
    db: {
      host: process.env.JAVASHK_DB_HOST || '',
      port: parseInt(process.env.JAVASHK_DB_PORT || '3306', 10),
      user: process.env.JAVASHK_DB_USER || '',
      password: process.env.JAVASHK_DB_PASSWORD || '',
      database: process.env.JAVASHK_DB_DATABASE || '',
    },
    decimalStrategy: 'power',
    filters: [],
  },
  {
    id: 'digiblox',
    displayName: 'Digiblox',
    startDate: new Date('2026-02-01'),
    db: {
      host: process.env.DIGIBLOX_DB_HOST || '',
      port: parseInt(process.env.DIGIBLOX_DB_PORT || '3306', 10),
      user: process.env.DIGIBLOX_DB_USER || '',
      password: process.env.DIGIBLOX_DB_PASSWORD || '',
      database: process.env.DIGIBLOX_DB_DATABASE || '',
    },
    decimalStrategy: 'power',
    filters: [{ column: 'd.to_address', operator: '<>', value: 'INTERNAL_TRANSFER' }],
  },
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
    if (missingIds.length > 0) {
      console.warn('[CustomerConfig] Missing DB credentials for:', missingIds.join(', '));
      console.warn('[CustomerConfig] Required env vars per customer: <NAME>_DB_HOST, <NAME>_DB_DATABASE, <NAME>_DB_USER, <NAME>_DB_PASSWORD');
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
