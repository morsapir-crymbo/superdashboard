import { CustomerApiConfig } from './types';

const CUSTOMER_IDS = ['digiblox', 'coincashy', 'bnp', 'orocalab', 'javashk'] as const;

function envKey(id: string, suffix: string): string {
  return `CUSTOMER_${id.toUpperCase().replace(/-/g, '_')}_API_${suffix}`;
}

export function getCustomerApiConfigs(): CustomerApiConfig[] {
  const configs: CustomerApiConfig[] = [];
  for (const id of CUSTOMER_IDS) {
    const baseUrl = process.env[envKey(id, 'BASE_URL')];
    const apiKey = process.env[envKey(id, 'KEY')];
    const apiSecret = process.env[envKey(id, 'SECRET')];
    const username = process.env[envKey(id, 'USERNAME')];
    const displayName = process.env[envKey(id, 'DISPLAY_NAME')] || id;
    if (baseUrl && apiKey && apiSecret && username) {
      configs.push({
        id,
        displayName,
        baseUrl: baseUrl.replace(/\/$/, ''),
        apiKey,
        apiSecret,
        username,
      });
    }
  }
  return configs;
}
