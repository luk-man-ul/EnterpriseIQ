import { vi, describe, it, expect, beforeEach } from "vitest";
import { chatService } from "./chat-service";
import { requestWithAuth } from "../../../services/authenticated-request";

vi.mock("../../../services/authenticated-request", () => ({
  requestWithAuth: vi.fn(),
}));

describe("Chat REST Service Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch session list using GET requestWithAuth", async () => {
    vi.mocked(requestWithAuth).mockResolvedValue({
      success: true,
      data: [],
    });

    await chatService.list();

    expect(requestWithAuth).toHaveBeenCalledWith("chat/sessions", {
      method: "GET",
    });
  });

  it("should fetch session history messages using GET requestWithAuth with encoded ID", async () => {
    vi.mocked(requestWithAuth).mockResolvedValue({
      success: true,
      data: [],
    });

    const targetId = "sess-uuid/456";
    await chatService.getHistory(targetId);

    expect(requestWithAuth).toHaveBeenCalledWith(
      "chat/sessions/sess-uuid%2F456",
      { method: "GET" }
    );
  });

  it("should execute session delete calls with requestWithAuth and correct ID", async () => {
    vi.mocked(requestWithAuth).mockResolvedValue({
      success: true,
      data: {},
    });

    await chatService.deleteSession("delete-id");

    expect(requestWithAuth).toHaveBeenCalledWith(
      "chat/sessions/delete-id",
      { method: "DELETE" }
    );
  });

  it("should propagate service errors during network failures", async () => {
    vi.mocked(requestWithAuth).mockRejectedValue(new TypeError("Fail"));

    await expect(chatService.list()).rejects.toThrow(TypeError);
  });

  it("should forward AbortSignal when provided to list", async () => {
    vi.mocked(requestWithAuth).mockResolvedValue({
      success: true,
      data: [],
    });

    const controller = new AbortController();
    await chatService.list(controller.signal);

    expect(requestWithAuth).toHaveBeenCalledWith("chat/sessions", {
      method: "GET",
      signal: controller.signal,
    });
  });
});
