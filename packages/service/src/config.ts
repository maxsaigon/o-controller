import { z } from 'zod';

/**
 * Service configuration schema with env validation.
 */
export const configSchema = z.object({
  ONKYO_HOST: z.string().min(1).default('192.168.1.50'),
  ONKYO_PORT: z.coerce.number().int().positive().default(60128),
  O_CONTROL_PORT: z.coerce.number().int().positive().default(8787),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  MOCK_MODE: z
    .string()
    .transform((v) => v === 'true' || v === '1')
    .default('false'),
});

export type ServiceConfig = z.infer<typeof configSchema>;

/**
 * Load and validate configuration from environment variables.
 */
export function loadConfig(): ServiceConfig {
  return configSchema.parse(process.env);
}
