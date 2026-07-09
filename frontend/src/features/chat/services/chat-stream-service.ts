import { getAccessToken, setAccessToken } from "../../../services/auth-token-store";
import { executeRefresh } from "../../../services/auth-refresh";
import { ApiError } from "../../../services/api-transport";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;
if (!BASE_URL) {
  throw new Error("NEXT_PUBLIC_API_URL is undefined.");
}

function getFullUrl(path: string): string {
  const normalizedBase = BASE_URL!.replace(/\/+$/, "");
  const normalizedPath = path.replace(/^\/+/, "");
  return `${normalizedBase}/${normalizedPath}`;
}

export const chatStreamService = {
  async connectStream(
    message: string,
    chatSessionId?: string,
    signal?: AbortSignal
  ): Promise<ReadableStream<Uint8Array>> {
    const url = getFullUrl("chat");
    const payload = { message, chatSessionId };

    const executeRequest = async (token: string | null): Promise<Response> => {
      const headers = new Headers();
      headers.set("Content-Type", "application/json");
      headers.set("Accept", "text/event-stream");
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }

      return fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal,
      });
    };

    const token = getAccessToken();
    let response = await executeRequest(token);

    if (response.status === 401) {
      let newToken: string;
      try {
        newToken = await executeRefresh();
      } catch (refreshErr) {
        // Propagate refresh errors directly
        throw refreshErr;
      }

      setAccessToken(newToken);
      response = await executeRequest(newToken);

      if (response.status === 401) {
        throw new ApiError(401, "Unauthorized", "Session expired.");
      }
    }

    if (!response.ok) {
      let errorResponse: Record<string, unknown> | null = null;
      try {
        const contentType = response.headers.get("Content-Type");
        if (contentType && contentType.includes("application/json")) {
          const text = await response.text();
          if (text) {
            errorResponse = JSON.parse(text);
          }
        }
      } catch {
        // Ignore parse failure
      }

      const statusCode = response.status;
      const errorName =
        errorResponse && typeof errorResponse.error === "string"
          ? errorResponse.error
          : response.statusText || "HTTP Error";

      const messageVal =
        errorResponse && typeof errorResponse.message === "string"
          ? errorResponse.message
          : `Request failed with status code ${statusCode}`;

      throw new ApiError(statusCode, errorName, messageVal);
    }

    if (!response.body) {
      throw new ApiError(500, "InternalServerError", "Response body stream unavailable.");
    }

    return response.body;
  },
};
