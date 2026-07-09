import { vi, describe, it, expect } from "vitest";
import { handleRootRedirect } from "./root-redirect";

describe("Root Redirect Coordination Logic", () => {
  it("does not redirect when status is initializing", () => {
    const replaceMock = vi.fn();
    handleRootRedirect("initializing", replaceMock);
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("redirects to /app when authenticated", () => {
    const replaceMock = vi.fn();
    handleRootRedirect("authenticated", replaceMock);
    expect(replaceMock).toHaveBeenCalledWith("/app");
  });

  it("redirects to /login when unauthenticated", () => {
    const replaceMock = vi.fn();
    handleRootRedirect("unauthenticated", replaceMock);
    expect(replaceMock).toHaveBeenCalledWith("/login");
  });

  it("does not perform unexpected/opposite redirects", () => {
    const replaceMock = vi.fn();
    handleRootRedirect("initializing", replaceMock);
    expect(replaceMock).not.toHaveBeenCalled();
    
    replaceMock.mockClear();
    handleRootRedirect("authenticated", replaceMock);
    expect(replaceMock).toHaveBeenCalledWith("/app");
    expect(replaceMock).not.toHaveBeenCalledWith("/login");

    replaceMock.mockClear();
    handleRootRedirect("unauthenticated", replaceMock);
    expect(replaceMock).toHaveBeenCalledWith("/login");
    expect(replaceMock).not.toHaveBeenCalledWith("/app");
  });
});
