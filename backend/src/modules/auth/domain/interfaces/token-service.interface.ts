import { IJwtPayload, IRefreshPayload } from './jwt-payload.interface';

export const TOKEN_SERVICE_TOKEN = 'ITokenService';

export interface ITokenService {
  generateAccessToken(payload: IJwtPayload): Promise<string>;
  generateRefreshToken(payload: IRefreshPayload): Promise<string>;
  verifyAccessToken(token: string): Promise<IJwtPayload>;
  verifyRefreshToken(token: string): Promise<IRefreshPayload>;
}
