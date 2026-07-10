import { describe, it, expect, beforeEach } from "vitest";
import { handoffStore } from "./handoff-store";

describe("HandoffStore Unit Tests", () => {
  beforeEach(() => {
    handoffStore.clear();
  });

  it("should trim and accept a valid input message", () => {
    const result = handoffStore.setMessage("  hello world  ");
    expect(result).toEqual({ accepted: true });
    expect(handoffStore.consumeMessage()).toBe("hello world");
  });

  it("should return null on second consumeMessage call", () => {
    handoffStore.setMessage("test message");
    expect(handoffStore.consumeMessage()).toBe("test message");
    expect(handoffStore.consumeMessage()).toBeNull();
  });

  it("should clear previous message when set with whitespace-only input", () => {
    handoffStore.setMessage("valid message");
    const result = handoffStore.setMessage("   ");
    expect(result).toEqual({ accepted: false, reason: "empty" });
    expect(handoffStore.consumeMessage()).toBeNull();
  });

  it("should return empty reason for empty input", () => {
    const result = handoffStore.setMessage("");
    expect(result).toEqual({ accepted: false, reason: "empty" });
  });

  it("should reject input longer than 500 characters", () => {
    const longMsg = "a".repeat(501);
    const result = handoffStore.setMessage(longMsg);
    expect(result).toEqual({ accepted: false, reason: "too_long" });
    expect(handoffStore.consumeMessage()).toBeNull();
  });

  it("should clear previous valid message on oversized input set attempt", () => {
    handoffStore.setMessage("valid message");
    const longMsg = "a".repeat(501);
    handoffStore.setMessage(longMsg);
    expect(handoffStore.consumeMessage()).toBeNull();
  });

  it("should retain only the latest message when set is called sequentially", () => {
    handoffStore.setMessage("msg1");
    handoffStore.setMessage("msg2");
    expect(handoffStore.consumeMessage()).toBe("msg2");
  });

  it("should remove pending message when clear is called", () => {
    handoffStore.setMessage("message");
    handoffStore.clear();
    expect(handoffStore.consumeMessage()).toBeNull();
  });

  it("should accept exactly 500 characters", () => {
    const exactMsg = "a".repeat(500);
    const result = handoffStore.setMessage(exactMsg);
    expect(result).toEqual({ accepted: true });
    expect(handoffStore.consumeMessage()).toBe(exactMsg);
  });

  it("should reject exactly 501 characters", () => {
    const exactMsg = "a".repeat(501);
    const result = handoffStore.setMessage(exactMsg);
    expect(result).toEqual({ accepted: false, reason: "too_long" });
    expect(handoffStore.consumeMessage()).toBeNull();
  });
});
