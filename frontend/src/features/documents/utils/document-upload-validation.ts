export function validateUploadFile(file: File | null | undefined): string | null {
  if (!file) {
    return "No file selected.";
  }

  const MAX_SIZE_BYTES = 52428800; // 50MB
  if (file.size > MAX_SIZE_BYTES) {
    return "File size exceeds the maximum limit of 50MB.";
  }

  const allowedExtensions = [".pdf", ".docx", ".txt"];
  const filename = file.name || "";
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex === -1) {
    return "File has no extension.";
  }

  const ext = filename.substring(dotIndex).toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    return `Unsupported file extension: ${ext}`;
  }

  return null;
}
