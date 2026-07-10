import 'reflect-metadata';
import { validate } from './env.validation';

describe('Environment Variable Validation Tests', () => {
  const getValidConfig = () => ({
    NODE_ENV: 'development',
    PORT: '3000',
    DATABASE_URL: 'postgresql://postgres:pass@localhost:5432/db',
    FRONTEND_URL: 'http://localhost:3000',
    JWT_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
    JWT_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
    GEMINI_MODEL: 'gemini-pro',
  });

  it('should pass validation with valid configuration parameters', () => {
    const config = getValidConfig();
    const result = validate(config);
    expect(result).toBeDefined();
    expect(result.PORT).toBe(3000);
    expect(result.JWT_SECRET).toHaveLength(32);
  });

  it('should throw an error if JWT_SECRET and JWT_REFRESH_SECRET are identical', () => {
    const config = getValidConfig();
    config.JWT_REFRESH_SECRET = config.JWT_SECRET;
    expect(() => validate(config)).toThrow(
      'Configuration error: JWT_SECRET and JWT_REFRESH_SECRET must be distinct keys.',
    );
  });

  it('should throw an error if JWT_SECRET is less than 32 characters', () => {
    const config = getValidConfig();
    config.JWT_SECRET = 'short-secret';
    expect(() => validate(config)).toThrow(/minLength/);
  });

  it('should throw an error if FRONTEND_URL is not a valid absolute URL', () => {
    const config = getValidConfig();
    config.FRONTEND_URL = 'invalid-url';
    expect(() => validate(config)).toThrow(/isUrl/);
  });

  it('should throw an error if GEMINI_API_KEY is missing in production environment', () => {
    const config = getValidConfig();
    config.NODE_ENV = 'production';
    expect(() => validate(config)).toThrow(/isNotEmpty/);
  });

  it('should pass validation in production if GEMINI_API_KEY is defined', () => {
    const config = {
      ...getValidConfig(),
      NODE_ENV: 'production',
      GEMINI_API_KEY: 'valid-gemini-api-key',
    };
    const result = validate(config);
    expect(result).toBeDefined();
  });
});
