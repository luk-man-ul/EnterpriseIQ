import { vi, describe, it, expect, beforeEach } from "vitest";
import { searchService } from "./search-service";
import { requestWithAuth } from "../../../services/authenticated-request";

vi.mock("../../../services/authenticated-request", () => ({
  requestWithAuth: vi.fn(),
}));

describe("Search Service Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should dispatch search POST requests with correct path and query body", async () => {
    vi.mocked(requestWithAuth).mockResolvedValue({
      success: true,
      data: { query: "test", results: [] },
    });

    await searchService.search({ query: "cloud data" });

    expect(requestWithAuth).toHaveBeenCalledWith(
      "search",
      expect.objectContaining({
        method: "POST",
        body: { query: "cloud data" },
      })
    );
  });

  it("should parse optional limit parameters", async () => {
    vi.mocked(requestWithAuth).mockResolvedValue({
      success: true,
      data: { query: "test", results: [] },
    });

    await searchService.search({ query: "limits", limit: 12 });

    expect(requestWithAuth).toHaveBeenCalledWith(
      "search",
      expect.objectContaining({
        body: { query: "limits", limit: 12 },
      })
    );
  });

  it("should parse optional threshold parameters", async () => {
    vi.mocked(requestWithAuth).mockResolvedValue({
      success: true,
      data: { query: "test", results: [] },
    });

    await searchService.search({ query: "thresh", threshold: 0.35 });

    expect(requestWithAuth).toHaveBeenCalledWith(
      "search",
      expect.objectContaining({
        body: { query: "thresh", threshold: 0.35 },
      })
    );
  });

  it("should propagate AbortSignal option boundaries", async () => {
    vi.mocked(requestWithAuth).mockResolvedValue({
      success: true,
      data: { query: "test", results: [] },
    });

    const signal = new AbortController().signal;
    await searchService.search({ query: "abort" }, signal);

    expect(requestWithAuth).toHaveBeenCalledWith(
      "search",
      expect.objectContaining({ signal })
    );
  });

  it("should propagate network failure exceptions directly", async () => {
    vi.mocked(requestWithAuth).mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(searchService.search({ query: "fail" })).rejects.toThrow(TypeError);
  });
});
