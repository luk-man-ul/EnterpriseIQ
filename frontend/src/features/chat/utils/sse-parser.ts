import { ChatStreamEvent } from "../types/chat-types";

export class SSEParser {
  private decoder = new TextDecoder("utf-8");
  private buffer = "";

  constructor(private onEvent: (event: ChatStreamEvent) => void) {}

  public feed(chunk: Uint8Array) {
    const text = this.decoder.decode(chunk, { stream: true });
    this.buffer += text;

    // Normalize CRLF to LF
    this.buffer = this.buffer.replace(/\r\n/g, "\n");

    while (true) {
      const eventBoundary = this.buffer.indexOf("\n\n");
      if (eventBoundary === -1) {
        break;
      }

      const eventString = this.buffer.substring(0, eventBoundary);
      this.buffer = this.buffer.substring(eventBoundary + 2);

      this.parseEvent(eventString);
    }
  }

  public flush() {
    const text = this.decoder.decode();
    if (text) {
      this.buffer += text.replace(/\r\n/g, "\n");
    }

    if (this.buffer.trim()) {
      this.parseEvent(this.buffer);
      this.buffer = "";
    }
  }

  private parseEvent(eventString: string) {
    const lines = eventString.split("\n");
    let eventType = "";
    let dataString = "";

    for (const line of lines) {
      if (line.startsWith("event:")) {
        eventType = line.substring(6).trim();
      } else if (line.startsWith("data:")) {
        dataString = line.substring(5).trim();
      }
    }

    if (!eventType || !dataString) {
      return;
    }

    try {
      const dataJson = JSON.parse(dataString);
      if (eventType === "message") {
        this.onEvent({ type: "message", token: String(dataJson.token) });
      } else if (eventType === "citation") {
        this.onEvent({
          type: "citation",
          citation: {
            documentId: String(dataJson.documentId),
            filename: String(dataJson.filename),
            ...(dataJson.page !== undefined ? { page: Number(dataJson.page) } : {}),
          },
        });
      } else if (eventType === "complete") {
        this.onEvent({
          type: "complete",
          chatSessionId: String(dataJson.chatSessionId),
        });
      } else if (eventType === "error") {
        this.onEvent({
          type: "error",
          code: String(dataJson.code),
          message: String(dataJson.message),
        });
      }
    } catch {
      // Ignore parse failure on malformed JSON
    }
  }
}
