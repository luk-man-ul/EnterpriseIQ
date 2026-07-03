import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { IStorageProvider } from '../../domain/interfaces/storage-provider.interface';

@Injectable()
export class LocalStorageProvider implements IStorageProvider {
  private readonly logger = new Logger(LocalStorageProvider.name);
  private readonly uploadDir: string;

  constructor(private readonly configService: ConfigService) {
    const relativeOrAbsolutePath =
      this.configService.get<string>('UPLOAD_STORAGE_DIR') || 'storage/uploads';

    this.uploadDir = path.isAbsolute(relativeOrAbsolutePath)
      ? relativeOrAbsolutePath
      : path.resolve(process.cwd(), relativeOrAbsolutePath);

    this.ensureDirectoryExistsSync();
  }

  private ensureDirectoryExistsSync() {
    try {
      if (!fsSync.existsSync(this.uploadDir)) {
        fsSync.mkdirSync(this.uploadDir, { recursive: true });
        this.logger.log(`Created local storage directory: ${this.uploadDir}`);
      }
    } catch (err) {
      this.logger.error(`Failed to create directory at ${this.uploadDir}`, err);
    }
  }

  async saveFile(
    fileKey: string,
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    this.logger.debug(`Saving file ${fileKey} with MIME type ${mimeType}`);
    const fullPath = path.join(this.uploadDir, fileKey);
    await fs.writeFile(fullPath, fileBuffer);
    return path.relative(process.cwd(), fullPath);
  }

  async deleteFile(fileIdentifier: string): Promise<void> {
    const fullPath = path.resolve(process.cwd(), fileIdentifier);

    if (!fullPath.startsWith(this.uploadDir)) {
      throw new Error(
        'Directory traversal attempt blocked in storage deletion.',
      );
    }

    try {
      await fs.unlink(fullPath);
    } catch (err: unknown) {
      const error = err as NodeJS.ErrnoException;
      if (error.code !== 'ENOENT') {
        this.logger.error(`Failed to delete file at ${fullPath}`, error);
        throw error;
      }
    }
  }

  async exists(fileIdentifier: string): Promise<boolean> {
    const fullPath = path.resolve(process.cwd(), fileIdentifier);
    if (!fullPath.startsWith(this.uploadDir)) {
      return false;
    }
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async getFileBuffer(fileIdentifier: string): Promise<Buffer> {
    const fullPath = path.resolve(process.cwd(), fileIdentifier);

    if (!fullPath.startsWith(this.uploadDir)) {
      throw new Error('Directory traversal attempt blocked in storage read.');
    }

    return fs.readFile(fullPath);
  }
}
