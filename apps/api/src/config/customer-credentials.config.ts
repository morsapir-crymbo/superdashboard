/**
 * Customer Database Credentials Configuration
 * 
 * This file contains the database credentials for all customer environments.
 * These credentials are used to connect to customer MySQL databases for
 * fetching real-time volume data.
 * 
 * IMPORTANT: This file is committed to the repository and deployed with the app.
 * The credentials are for internal production databases on AWS RDS.
 */

export interface CustomerCredentials {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export const CUSTOMER_CREDENTIALS: Record<string, CustomerCredentials> = {
  digiblox: {
    host: 'crymbo-global-prod-stack-shared-db.cito9agxnlww.eu-central-1.rds.amazonaws.com',
    port: 3306,
    user: 'digiblox_app',
    password: 'qLpCEgkwcPNC0JDHiz0phves044tLBDW',
    database: 'digiblox_app',
  },
  javashk: {
    host: 'crymbo-global-prod-stack-shared-db.cito9agxnlww.eu-central-1.rds.amazonaws.com',
    port: 3306,
    user: 'javas_app',
    password: 'qdRAJN0o4CwIre00oNNpf3XbmCSUXI98',
    database: 'javas_app',
  },
  montrex: {
    host: 'crymbo-global-prod-stack-shared-db.cito9agxnlww.eu-central-1.rds.amazonaws.com',
    port: 3306,
    user: 'montrex_app',
    password: 'TaPgZ0QkP1kW9A1cr2gb2UBnsSFTrpJu',
    database: 'montrex_app',
  },
  orocalab: {
    host: 'crymbo-global-prod-stack-shared-db.cito9agxnlww.eu-central-1.rds.amazonaws.com',
    port: 3306,
    user: 'orocalab_app',
    password: 'sGo75165jp1zfkYcMYtxKW16eJbC3ieR',
    database: 'orocalab_app',
  },
  bnp: {
    host: 'crymbo-global-prod-stack-shared-db.cito9agxnlww.eu-central-1.rds.amazonaws.com',
    port: 3306,
    user: 'bnp_app',
    password: 'na6QL48StdjLvcVxQuh5p5kB5P5vgPPvnDsttfWqUJftgad9KYMAuvgte9WbZGUa',
    database: 'bnp_app',
  },
};

export function getCustomerCredentials(customerId: string): CustomerCredentials | undefined {
  return CUSTOMER_CREDENTIALS[customerId];
}

export function getAllCustomerIds(): string[] {
  return Object.keys(CUSTOMER_CREDENTIALS);
}
