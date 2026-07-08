import { vi, describe, it, expect, beforeEach } from "vitest";
import { documentService } from "./document-service";
import { documentCapabilityService } from "./document-capability-service";
import { validateUploadFile } from "../utils/document-upload-validation";
import { requestWithAuth } from "../../../services/authenticated-request";

// Mock the authenticated-request layer
vi.mock("../../../services/authenticated-request", () => ({
  requestWithAuth: vi.fn(),
}));

describe("Document Feature Service and Validation Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. List query construction
  it("should construct document list queries correctly with paging variables", async () => {
    vi.mocked(requestWithAuth).mockResolvedValue({
      success: true,
      message: "Fetched",
      data: { documents: [], pagination: { page: 1, limit: 10, totalCount: 0 } },
    });

    await documentService.list({ page: 2, limit: 15 });

    expect(requestWithAuth).toHaveBeenCalledWith(
      "documents?page=2&limit=15",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("should append departmentId query parameter if provided", async () => {
    vi.mocked(requestWithAuth).mockResolvedValue({
      success: true,
      message: "Fetched",
      data: { documents: [], pagination: { page: 1, limit: 10, totalCount: 0 } },
    });

    await documentService.list({ page: 1, limit: 10, departmentId: "dept-123" });

    expect(requestWithAuth).toHaveBeenCalledWith(
      "documents?page=1&limit=10&departmentId=dept-123",
      expect.any(Object)
    );
  });

  // 2. Upload FormData structure
  it("should append file to FormData and send multipart without forcing Content-Type header", async () => {
    vi.mocked(requestWithAuth).mockResolvedValue({
      success: true,
      message: "Uploaded",
      data: { documentId: "123", filename: "test.pdf", status: "Pending", contentHash: "hash" },
    });

    const file = new File(["test data"], "test.pdf", { type: "application/pdf" });
    await documentService.upload(file);

    expect(requestWithAuth).toHaveBeenCalledWith(
      "documents/upload",
      expect.objectContaining({
        method: "POST",
        body: expect.any(FormData),
      })
    );

    const callArgs = vi.mocked(requestWithAuth).mock.calls[0];
    const formData = callArgs[1]?.body as FormData;
    expect(formData.get("file")).toBeInstanceOf(File);

    // Verify no manual headers are set to interfere with multi-part boundaries
    expect(callArgs[1]?.headers).toBeUndefined();
  });

  // 3. Delete path mapping
  it("should construct delete URI parameter routes correctly", async () => {
    vi.mocked(requestWithAuth).mockResolvedValue({
      success: true,
      message: "Deleted",
      data: {},
    });

    await documentService.delete("doc-uuid-123");

    expect(requestWithAuth).toHaveBeenCalledWith(
      "documents/doc-uuid-123",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  // 4. Network error propagation
  it("should propagate network type errors in service layer", async () => {
    vi.mocked(requestWithAuth).mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(documentService.delete("doc-123")).rejects.toThrow(TypeError);
  });

  // 5. Capability resolution tests
  describe("Role Capability Resolution", () => {
    const mockRoles = [
      { roleId: "r1", name: "Administrator", description: "Admin" },
      { roleId: "r2", name: "Manager", description: "Manager" },
      { roleId: "r3", name: "Employee", description: "Employee" },
    ];

    it("should resolve write/delete permission as true for Administrator", () => {
      const caps = documentCapabilityService.resolveCapabilities("r1", mockRoles);
      expect(caps.canUploadDocuments).toBe(true);
      expect(caps.canDeleteDocuments).toBe(true);
    });

    it("should resolve write/delete permission as true for Manager", () => {
      const caps = documentCapabilityService.resolveCapabilities("r2", mockRoles);
      expect(caps.canUploadDocuments).toBe(true);
      expect(caps.canDeleteDocuments).toBe(true);
    });

    it("should resolve permissions as false for Employee", () => {
      const caps = documentCapabilityService.resolveCapabilities("r3", mockRoles);
      expect(caps.canUploadDocuments).toBe(false);
      expect(caps.canDeleteDocuments).toBe(false);
    });

    it("should fail-closed if roleId is not matched in details list", () => {
      const caps = documentCapabilityService.resolveCapabilities("r-unknown", mockRoles);
      expect(caps.canUploadDocuments).toBe(false);
      expect(caps.canDeleteDocuments).toBe(false);
    });
  });

  // 6. Pre-upload file validation tests
  describe("Pre-Upload Validation", () => {
    it("should reject empty file selection", () => {
      const err = validateUploadFile(null);
      expect(err).toBe("No file selected.");
    });

    it("should reject files exceeding 50MB", () => {
      const largeFile = {
        name: "large.pdf",
        size: 52428801, // 50MB + 1 byte
      } as File;
      const err = validateUploadFile(largeFile);
      expect(err).toBe("File size exceeds the maximum limit of 50MB.");
    });

    it("should accept files exactly at or under 50MB with valid extensions", () => {
      const validPdf = { name: "test.pdf", size: 52428800 } as File;
      const validDocx = { name: "test.docx", size: 1000 } as File;
      const validTxt = { name: "test.txt", size: 123 } as File;

      expect(validateUploadFile(validPdf)).toBeNull();
      expect(validateUploadFile(validDocx)).toBeNull();
      expect(validateUploadFile(validTxt)).toBeNull();
    });

    it("should reject unsupported extensions", () => {
      const exeFile = { name: "malicious.exe", size: 1000 } as File;
      const noExtFile = { name: "no-extension", size: 1000 } as File;

      expect(validateUploadFile(exeFile)).toContain("Unsupported file extension");
      expect(validateUploadFile(noExtFile)).toContain("File has no extension");
    });

    it("should handle case-insensitive extension names correctly", () => {
      const uppercasePdf = { name: "document.PDF", size: 1000 } as File;
      expect(validateUploadFile(uppercasePdf)).toBeNull();
    });
  });
});
