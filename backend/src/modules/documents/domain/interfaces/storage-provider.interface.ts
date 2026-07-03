export const STORAGE_PROVIDER_TOKEN = 'IStorageProvider';

export interface IStorageProvider {
  /**
   * Saves a file to the storage medium.
   * @param fileKey The unique identifier or key for the file (e.g. UUID with extension).
   * @param fileBuffer The binary data buffer of the file.
   * @param mimeType The file MIME type context.
   * @returns A promise that resolves to a storage-agnostic identifier, path, or URL.
   */
  saveFile(
    fileKey: string,
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<string>;

  /**
   * Deletes a file from the storage medium.
   * @param fileIdentifier The storage path, URL, or identifier returned by saveFile.
   */
  deleteFile(fileIdentifier: string): Promise<void>;

  /**
   * Checks if a file exists on the storage medium.
   * @param fileIdentifier The storage path, URL, or identifier.
   */
  exists(fileIdentifier: string): Promise<boolean>;

  /**
   * Retrieves a file's binary buffer from the storage medium.
   * @param fileIdentifier The storage path, URL, or identifier.
   */
  getFileBuffer(fileIdentifier: string): Promise<Buffer>;
}
