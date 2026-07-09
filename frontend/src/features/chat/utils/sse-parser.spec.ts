import { describe, it, expect } from "vitest";
import { SSEParser } from "./sse-parser";
import { ChatStreamEvent } from "../types/chat-types";

describe("SSE Parser Unit Tests", () => {
  it("should parse a single complete message event", () => {
    const events: ChatStreamEvent[] = [];
    const parser = new SSEParser((e) => events.push(e));

    const encoder = new TextEncoder();
    const payload = "event: message\ndata: {\"token\":\"hello\"}\n\n";
    parser.feed(encoder.encode(payload));

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: "message", token: "hello" });
  });

  it("should parse multiple events in one chunk", () => {
    const events: ChatStreamEvent[] = [];
    const parser = new SSEParser((e) => events.push(e));

    const encoder = new TextEncoder();
    const payload =
      "event: message\ndata: {\"token\":\"hello\"}\n\n" +
      "event: citation\ndata: {\"documentId\":\"1\",\"filename\":\"a.pdf\",\"page\":2}\n\n";
    parser.feed(encoder.encode(payload));

    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ type: "message", token: "hello" });
    expect(events[1]).toEqual({
      type: "citation",
      citation: { documentId: "1", filename: "a.pdf", page: 2 },
    });
  });

  it("should handle event split across multiple feed calls", () => {
    const events: ChatStreamEvent[] = [];
    const parser = new SSEParser((e) => events.push(e));

    const encoder = new TextEncoder();
    parser.feed(encoder.encode("event: message\n"));
    expect(events).toHaveLength(0);

    parser.feed(encoder.encode("data: {\"token\":\"world\"}\n\n"));
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: "message", token: "world" });
  });

  it("should handle multi-byte UTF-8 character splits safely across chunk boundaries", () => {
    const events: ChatStreamEvent[] = [];
    const parser = new SSEParser((e) => events.push(e));

    // "⚡" symbol: bytes 226, 154, 161
    const prefixStr = 'event: message\ndata: {"token":"';
    const suffixStr = '"}\n\n';

    const encoder = new TextEncoder();
    const prefixBytes = encoder.encode(prefixStr);
    const suffixBytes = encoder.encode(suffixStr);
    const charBytes = new Uint8Array([226, 154, 161]);

    // Feed prefix and first 2 bytes of the character
    const chunk1 = new Uint8Array(prefixBytes.length + 2);
    chunk1.set(prefixBytes);
    chunk1.set(charBytes.subarray(0, 2), prefixBytes.length);
    parser.feed(chunk1);
    expect(events).toHaveLength(0);

    // Feed last byte and suffix
    const chunk2 = new Uint8Array(1 + suffixBytes.length);
    chunk2.set([charBytes[2]]);
    chunk2.set(suffixBytes, 1);
    parser.feed(chunk2);

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: "message", token: "⚡" });
  });

  it("should support both CRLF and LF delimiters", () => {
    const events: ChatStreamEvent[] = [];
    const parser = new SSEParser((e) => events.push(e));

    const encoder = new TextEncoder();
    const payload = "event: message\r\ndata: {\"token\":\"crlf\"}\r\n\r\n";
    parser.feed(encoder.encode(payload));

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: "message", token: "crlf" });
  });

  it("should quietly skip unknown event types or malformed JSON payloads", () => {
    const events: ChatStreamEvent[] = [];
    const parser = new SSEParser((e) => events.push(e));

    const encoder = new TextEncoder();
    parser.feed(
      encoder.encode(
        "event: unknown\ndata: {}\n\n" +
          "event: message\ndata: {invalid-json}\n\n" +
          "event: message\ndata: {\"token\":\"valid\"}\n\n"
      )
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: "message", token: "valid" });
  });

  it("should process trailing partial buffers during a flush call", () => {
    const events: ChatStreamEvent[] = [];
    const parser = new SSEParser((e) => events.push(e));

    const encoder = new TextEncoder();
    parser.feed(encoder.encode("event: complete\ndata: {\"chatSessionId\":\"session-1\"}"));
    expect(events).toHaveLength(0);

    parser.flush();
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: "complete", chatSessionId: "session-1" });
  });
});
