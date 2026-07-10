export type HandoffSetResult =
  | { accepted: true }
  | { accepted: false; reason: "empty" | "too_long" };

let transientMessage: string | null = null;

export const handoffStore = {
  setMessage(message: string): HandoffSetResult {
    transientMessage = null;

    const trimmed = message ? message.trim() : "";

    if (!trimmed) {
      return { accepted: false, reason: "empty" };
    }

    if (trimmed.length > 500) {
      return { accepted: false, reason: "too_long" };
    }

    transientMessage = trimmed;
    return { accepted: true };
  },

  consumeMessage(): string | null {
    const message = transientMessage;
    transientMessage = null;
    return message;
  },

  clear(): void {
    transientMessage = null;
  },
};
