import { ApiValidationIssue } from "../types/api-contracts";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

if (!BASE_URL) {
  throw new Error(
    "Configuration error: NEXT_PUBLIC_API_URL environment variable is not defined.",
  );
}

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly error: string;
  public readonly validationIssues?: ApiValidationIssue[];

  constructor(
    statusCode: number,
    error: string,
    message: string,
    validationIssues?: ApiValidationIssue[],
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.error = error;
    this.validationIssues = validationIssues;

    // Restore prototype chain
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: Record<string, unknown> | FormData | string;
  token?: string;
}

function getFullUrl(path: string): string {
  const normalizedBase = BASE_URL!.replace(/\/+$/, "");
  const normalizedPath = path.replace(/^\/+/, "");
  return `${normalizedBase}/${normalizedPath}`;
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const url = getFullUrl(path);
  const headers = new Headers(options.headers);

  // Set Authorization header if Bearer token is provided
  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  let requestBody: BodyInit | undefined;

  if (options.body !== undefined) {
    if (options.body instanceof FormData) {
      requestBody = options.body;
      // Do NOT set Content-Type; let browser generate multipart/form-data boundary
    } else if (typeof options.body === "object") {
      requestBody = JSON.stringify(options.body);
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
    } else {
      requestBody = options.body;
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
    }
  }

  // Build the Fetch options
  const { token, body, ...restOptions } = options; // eslint-disable-line @typescript-eslint/no-unused-vars
  const fetchOptions: RequestInit = {
    ...restOptions,
    headers,
    body: requestBody,
  };

  const response = await fetch(url, fetchOptions);

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
      // Ignore parse failure; fallback below
    }

    const statusCode = response.status;
    const errorName =
      errorResponse &&
      typeof errorResponse.error === "string" &&
      errorResponse.error
        ? errorResponse.error
        : response.statusText || "HTTP Error";

    const message =
      errorResponse &&
      typeof errorResponse.message === "string" &&
      errorResponse.message
        ? errorResponse.message
        : `Request failed with status code ${statusCode}`;

    let validationIssues: ApiValidationIssue[] | undefined;
    if (errorResponse && Array.isArray(errorResponse.errors)) {
      validationIssues = errorResponse.errors.map((err: unknown) => {
        const entry = err as Record<string, unknown>;
        return {
          field:
            entry && typeof entry.field === "string" ? entry.field : "unknown",
          issue:
            entry && typeof entry.issue === "string"
              ? entry.issue
              : "Invalid value",
        };
      });
    }

    throw new ApiError(statusCode, errorName, message, validationIssues);
  }

  // Handle 204 No Content explicitly
  if (response.status === 204) {
    return undefined as unknown as T;
  }

  const contentType = response.headers.get("Content-Type");
  if (contentType && contentType.includes("application/json")) {
    const text = await response.text();
    if (!text) {
      return undefined as unknown as T;
    }
    return JSON.parse(text) as T;
  }

  const text = await response.text();
  return text as unknown as T;
}
