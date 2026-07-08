import { vi, describe, it, expect, beforeEach } from "vitest";
import { executeRefresh, onSessionExpired } from "./auth-refresh";
import { getAccessToken, setAccessToken, clearAccessToken } from "./auth-token-store";
import { requestWithAuth } from "./authenticated-request";
import { authService } from "../features/auth/services/auth-service";
import { request, ApiError } from "./api-transport";

vi.mock("./api-transport", async () => {
  const actual = await vi.importActual<typeof import("./api-transport")>("./api-transport");
  return {
    ...actual,
    request: vi.fn(),
  };
});

describe("Authentication Session Architecture Tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    clearAccessToken();
  });

  // 1. Concurrent refresh callers share one refresh request
  it("should share one in-flight refresh request among concurrent callers", async () => {
    let resolveRefresh: (value: unknown) => void = () => {};
    const refreshPromise = new Promise((resolve) => {
      resolveRefresh = resolve;
    });

    vi.mocked(request).mockImplementation((path) => {
      if (path === "auth/refresh") {
        return refreshPromise;
      }
      return Promise.resolve({});
    });

    const call1 = executeRefresh();
    const call2 = executeRefresh();

    expect(vi.mocked(request)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(request)).toHaveBeenCalledWith("auth/refresh", expect.any(Object));

    resolveRefresh({
      success: true,
      message: "Refreshed",
      data: { accessToken: "shared-token" },
      timestamp: "",
    });

    const token1 = await call1;
    const token2 = await call2;

    expect(token1).toBe("shared-token");
    expect(token2).toBe("shared-token");
    expect(getAccessToken()).toBe("shared-token");
  });

  // 2. Refresh success updates in-memory token
  it("should update in-memory access token on refresh success", async () => {
    vi.mocked(request).mockResolvedValue({
      success: true,
      message: "Refreshed",
      data: { accessToken: "fresh-success-token" },
      timestamp: "",
    });

    const token = await executeRefresh();
    expect(token).toBe("fresh-success-token");
    expect(getAccessToken()).toBe("fresh-success-token");
  });

  // 3. Refresh HTTP 401 clears token and notifies terminal session invalidation
  it("should clear access token and notify invalidation on refresh 401 error", async () => {
    vi.mocked(request).mockRejectedValue(
      new ApiError(401, "Unauthorized", "Session expired")
    );

    let expiredCalled = false;
    const unsubscribe = onSessionExpired(() => {
      expiredCalled = true;
    });

    setAccessToken("stale-token");

    await expect(executeRefresh()).rejects.toThrow(ApiError);
    expect(getAccessToken()).toBeNull();
    expect(expiredCalled).toBe(true);

    unsubscribe();
  });

  // 4. Refresh network TypeError does not notify session expiration
  it("should not clear token or notify invalidation on network TypeError", async () => {
    vi.mocked(request).mockRejectedValue(
      new TypeError("Failed to fetch")
    );

    let expiredCalled = false;
    const unsubscribe = onSessionExpired(() => {
      expiredCalled = true;
    });

    setAccessToken("existing-token");

    await expect(executeRefresh()).rejects.toThrow(TypeError);
    expect(getAccessToken()).toBe("existing-token");
    expect(expiredCalled).toBe(false);

    unsubscribe();
  });

  // 5. Refresh HTTP 5xx does not notify session expiration
  it("should not clear token or notify invalidation on HTTP 5xx errors", async () => {
    vi.mocked(request).mockRejectedValue(
      new ApiError(500, "InternalServerError", "Database down")
    );

    let expiredCalled = false;
    const unsubscribe = onSessionExpired(() => {
      expiredCalled = true;
    });

    setAccessToken("existing-token");

    await expect(executeRefresh()).rejects.toThrow(ApiError);
    expect(getAccessToken()).toBe("existing-token");
    expect(expiredCalled).toBe(false);

    unsubscribe();
  });

  // 6. Eligible protected request HTTP 401 refreshes and retries once
  it("should refresh and retry eligible requests exactly once on 401 error", async () => {
    vi.mocked(request).mockImplementation(async (path) => {
      if (path === "documents/upload") {
        const uploadCallsCount = vi.mocked(request).mock.calls.filter(c => c[0] === "documents/upload").length;
        if (uploadCallsCount === 1) {
          throw new ApiError(401, "Unauthorized", "Token expired");
        }
        return "success-response";
      }
      if (path === "auth/refresh") {
        return {
          success: true,
          message: "Refreshed",
          data: { accessToken: "retried-fresh-token" },
          timestamp: "",
        };
      }
      return {};
    });

    setAccessToken("old-stale-token");

    const result = await requestWithAuth("documents/upload");
    expect(result).toBe("success-response");
    expect(getAccessToken()).toBe("retried-fresh-token");

    const refreshCall = vi.mocked(request).mock.calls.some(c => c[0] === "auth/refresh");
    expect(refreshCall).toBe(true);

    const uploadCalls = vi.mocked(request).mock.calls.filter(c => c[0] === "documents/upload");
    expect(uploadCalls.length).toBe(2);
    expect(uploadCalls[1][1]).toEqual(expect.objectContaining({ token: "retried-fresh-token" }));
  });

  // 7. Retried request HTTP 401 propagates and does not refresh again
  it("should propagate error on failed retry and not trigger infinite loops", async () => {
    vi.mocked(request).mockImplementation(async (path) => {
      if (path === "documents/upload") {
        throw new ApiError(401, "Unauthorized", "Token expired");
      }
      if (path === "auth/refresh") {
        return {
          success: true,
          message: "Refreshed",
          data: { accessToken: "retry-token" },
          timestamp: "",
        };
      }
      return {};
    });

    setAccessToken("old-token");

    await expect(requestWithAuth("documents/upload")).rejects.toThrow(ApiError);
    
    const refreshCalls = vi.mocked(request).mock.calls.filter(c => c[0] === "auth/refresh");
    expect(refreshCalls.length).toBe(1);
  });

  // 8. Auth endpoint exclusions
  it("should not trigger auto-refresh for excluded auth endpoints", async () => {
    vi.mocked(request).mockRejectedValue(
      new ApiError(401, "Unauthorized", "Invalid credentials")
    );

    await expect(requestWithAuth("auth/login")).rejects.toThrow(ApiError);
    await expect(requestWithAuth("/auth/refresh")).rejects.toThrow(ApiError);
    await expect(requestWithAuth("auth/logout")).rejects.toThrow(ApiError);

    const refreshCalls = vi.mocked(request).mock.calls.filter(c => c[0] === "auth/refresh");
    expect(refreshCalls.length).toBe(0);
  });

  // 9. Startup success sequence
  it("should perform startup refresh and fetch user profile successfully", async () => {
    vi.mocked(request).mockImplementation(async (path) => {
      if (path === "auth/refresh") {
        return {
          success: true,
          message: "Refreshed",
          data: { accessToken: "token-abc" },
          timestamp: "",
        };
      }
      if (path === "auth/me") {
        return {
          success: true,
          message: "Profile",
          data: {
            userId: "user-123",
            email: "test@enterprise.com",
            firstName: "Alice",
            lastName: "Smith",
            roleId: "admin",
            departmentId: "engineering",
          },
          timestamp: "",
        };
      }
      return {};
    });

    const token = await executeRefresh();
    expect(token).toBe("token-abc");

    const profileRes = await authService.getCurrentUser(token);
    expect(profileRes.data.userId).toBe("user-123");
    expect(profileRes.data.email).toBe("test@enterprise.com");
  });

  // 10. auth/me 401 after successful startup refresh terminates local session directly
  it("should not auto-retry auth/me startup path call and terminate directly on 401", async () => {
    vi.mocked(request).mockRejectedValue(
      new ApiError(401, "Unauthorized", "Me failed")
    );

    await expect(authService.getCurrentUser("some-token")).rejects.toThrow(ApiError);
    
    const refreshCalls = vi.mocked(request).mock.calls.filter(c => c[0] === "auth/refresh");
    expect(refreshCalls.length).toBe(0);
  });

  // 11. Network error not misclassified as HTTP 401
  it("should propagate network type errors without triggering refresh", async () => {
    vi.mocked(request).mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(requestWithAuth("documents")).rejects.toThrow(TypeError);
    
    const refreshCalls = vi.mocked(request).mock.calls.filter(c => c[0] === "auth/refresh");
    expect(refreshCalls.length).toBe(0);
  });

  // 12. Terminal refresh failure can transition provider state
  it("should broadcast session expired to allow React state transition away from authenticated", async () => {
    vi.mocked(request).mockRejectedValue(
      new ApiError(401, "Unauthorized", "Invalid session")
    );

    let sessionState = "authenticated";
    const unsubscribe = onSessionExpired(() => {
      sessionState = "unauthenticated";
    });

    await expect(executeRefresh()).rejects.toThrow(ApiError);
    expect(sessionState).toBe("unauthenticated");

    unsubscribe();
  });
});
