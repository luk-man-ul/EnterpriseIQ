import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { chatStreamService } from "./chat-stream-service";
import { getAccessToken, setAccessToken } from "../../../services/auth-token-store";
import { executeRefresh } from "../../../services/auth-refresh";
import { ApiError } from "../../../services/api-transport";

// Mock the auth store and refresh modules
vi.mock("../../../services/auth-token-store", () => ({
  getAccessToken: vi.fn(),
  setAccessToken: vi.fn(),
}));

vi.mock("../../../services/auth-refresh", () => ({
  executeRefresh: vi.fn(),
}));

describe("Chat Stream Service Handshake and Retry Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set default api URL for tests
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:3000/api/v1";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return stream directly if response is 200 with no retry required", async () => {
    vi.mocked(getAccessToken).mockReturnValue("valid-token");
    const mockStream = {};
    const mockResponse = {
      ok: true,
      status: 200,
      body: mockStream,
      headers: new Headers(),
    } as unknown as Response;

    const mockFetch = vi.fn().mockResolvedValue(mockResponse);
    vi.stubGlobal("fetch", mockFetch);

    const stream = await chatStreamService.connectStream("hello");

    expect(stream).toBe(mockStream);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const callArgs = mockFetch.mock.calls[0];
    const headers = callArgs[1]?.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer valid-token");
    expect(headers.get("Accept")).toBe("text/event-stream");
  });

  it("should refresh and retry once if initial handshake throws a 401", async () => {
    vi.mocked(getAccessToken).mockReturnValue("expired-token");
    vi.mocked(executeRefresh).mockResolvedValue("new-token");

    const mockStream = {};
    const mock401 = { ok: false, status: 401, headers: new Headers() } as Response;
    const mock200 = { ok: true, status: 200, body: mockStream, headers: new Headers() } as Response;

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(mock401)
      .mockResolvedValueOnce(mock200);
    vi.stubGlobal("fetch", mockFetch);

    const stream = await chatStreamService.connectStream("retry query");

    expect(stream).toBe(mockStream);
    expect(executeRefresh).toHaveBeenCalledTimes(1);
    expect(setAccessToken).toHaveBeenCalledWith("new-token");
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Assert second request carried correct new token
    const secondCallHeaders = mockFetch.mock.calls[1][1]?.headers as Headers;
    expect(secondCallHeaders.get("Authorization")).toBe("Bearer new-token");
  });

  it("should terminate if the refreshed retry returns 401 again", async () => {
    vi.mocked(getAccessToken).mockReturnValue("expired-token");
    vi.mocked(executeRefresh).mockResolvedValue("new-token");

    const mock401 = { ok: false, status: 401, headers: new Headers() } as Response;
    const mockFetch = vi.fn().mockResolvedValue(mock401);
    vi.stubGlobal("fetch", mockFetch);

    await expect(chatStreamService.connectStream("bad credentials")).rejects.toThrow(ApiError);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(executeRefresh).toHaveBeenCalledTimes(1);
  });

  it("should propagate refresh failures directly if token rotation fails", async () => {
    vi.mocked(getAccessToken).mockReturnValue("expired-token");
    vi.mocked(executeRefresh).mockRejectedValue(new ApiError(401, "Unauthorized", "Refresh expired"));

    const mock401 = { ok: false, status: 401, headers: new Headers() } as Response;
    const mockFetch = vi.fn().mockResolvedValue(mock401);
    vi.stubGlobal("fetch", mockFetch);

    await expect(chatStreamService.connectStream("terminal refresh")).rejects.toThrow(ApiError);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(executeRefresh).toHaveBeenCalledTimes(1);
  });

  it("should propagate AbortSignal option boundaries", async () => {
    vi.mocked(getAccessToken).mockReturnValue("token");
    const mockResponse = { ok: true, status: 200, body: {}, headers: new Headers() } as Response;
    const mockFetch = vi.fn().mockResolvedValue(mockResponse);
    vi.stubGlobal("fetch", mockFetch);

    const controller = new AbortController();
    await chatStreamService.connectStream("abort", undefined, controller.signal);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: controller.signal })
    );
  });
});
