export interface IJwtPayload {
  sub: string;
  email: string;
  role: string;
}

export interface IRefreshPayload {
  sub: string;
}
