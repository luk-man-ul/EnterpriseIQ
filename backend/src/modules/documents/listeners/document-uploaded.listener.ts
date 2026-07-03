import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { IngestionOrchestrator } from '../services/ingestion.orchestrator';

@Injectable()
export class DocumentUploadedListener {
  private readonly logger = new Logger(DocumentUploadedListener.name);

  constructor(private readonly orchestrator: IngestionOrchestrator) {}

  @OnEvent('document.uploaded', { async: true })
  async handleDocumentUploadedEvent(payload: {
    documentId: string;
  }): Promise<void> {
    this.logger.log(
      `Document uploaded event caught for: ${payload.documentId}`,
    );
    try {
      await this.orchestrator.ingest(payload.documentId);
    } catch (err) {
      this.logger.error(
        `Asynchronous event handler failed processing document: ${payload.documentId}`,
        err,
      );
    }
  }
}
