import { authService } from "../features/auth/services/auth-service";
import { setAccessToken, clearAccessToken } from "./auth-token-store";
import { ApiError } from "./api-transport";

type ExpiryListener = () => void;
const expiredListeners = new Set<ExpiryListener>();

export const onSessionExpired = (listener: ExpiryListener): (() => void) => {
  expiredListeners.add(listener);
  return () => {
    expiredListeners.delete(listener);
  };
};

export function notifySessionExpired(): void {
  expiredListeners.forEach((listener) => listener());
}

let activeRefreshPromise: Promise<string> | null = null;

export async function executeRefresh(): Promise<string> {
  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  activeRefreshPromise = authService
    .refresh()
    .then((res) => {
      const token = res.data.accessToken;
      setAccessToken(token);
      return token;
    })
    .catch((err) => {
      // Classification of failures: only terminal 401 clears local state
      if (err instanceof ApiError && err.statusCode === 401) {
        clearAccessToken();
        notifySessionExpired();
      }
      throw err;
    })
    .finally(() => {
      activeRefreshPromise = null;
    });

  return activeRefreshPromise;
}
