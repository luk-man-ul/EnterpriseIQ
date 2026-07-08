import { request, RequestOptions, ApiError } from "./api-transport";
import { getAccessToken, setAccessToken } from "./auth-token-store";
import { executeRefresh } from "./auth-refresh";

function isAuthEndpoint(path: string): boolean {
  const cleanPath = path.replace(/^\/+/, "");
  return (
    cleanPath === "auth/login" ||
    cleanPath === "auth/refresh" ||
    cleanPath === "auth/logout"
  );
}

export async function requestWithAuth<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const token = getAccessToken();

  try {
    return await request<T>(path, { ...options, token: token || undefined });
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.statusCode === 401 &&
      !isAuthEndpoint(path)
    ) {
      // Trigger single-flight refresh operation
      let newToken: string;
      try {
        newToken = await executeRefresh();
      } catch (refreshErr) {
        // If refresh fails, propagate original or refresh error
        throw refreshErr;
      }

      // Retry original request exactly once
      setAccessToken(newToken);
      return await request<T>(path, { ...options, token: newToken });
    }
    throw error;
  }
}
