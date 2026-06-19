import type { LogLevel } from './logger.ts';

export type ProfileClass = 'production' | 'staging' | 'development' | 'preview' | 'custom';

export function logLevelForProfile(profileClass: ProfileClass): LogLevel {
  switch (profileClass) {
    case 'production':
      return 'error';
    case 'staging':
      return 'warn';
    case 'development':
    case 'preview':
      return 'debug';
    case 'custom':
    default:
      return 'info';
  }
}
