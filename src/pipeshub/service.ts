/**
 * PipesHub Main Service
 * 
 * Orchestrates document ingestion, classification, OCR processing, and storage
 * with comprehensive audit logging and error handling
 */

import { PrismaClient, DocumentTypeEnum, DocumentCategory, ProcessingStatus, AuditEventType } from '@prisma/client';
import * as crypto from 'crypto';
import { 
  DocumentUploadRequest, 
  DocumentMetadata, 
  DocumentProcessingOptions,
  ProcessingError,
  StorageConfig
} from './types.js';
import { StorageService } from './storage.js';
import { DocumentClassifier } from './classifier.js';
import { OCRProcessor } from './ocr.js';

export class PipesHubService {
  private readonly prisma: PrismaClient;
  private readonly storageService: StorageService;
  private readonly classifier: DocumentClassifier;
  private readonly ocrProcessor: OCRProcessor;

  constructor(
    prisma: PrismaClient,
    storageConfig: StorageConfig
  ) {
    this.prisma = prisma;
    this.storageService = new StorageService(storageConfig);
    this.classifier = new DocumentClassifier();
    this.ocrProcessor = new OCRProcessor();
  }

  /**
   * Upload and process document with full pipeline
   */
  async uploadDocument(
    request: DocumentUploadRequest,
    options: DocumentProcessingOptions = {
      enableOCR: true,
      ocrLanguage: 'spa',
      classificationThreshold: 0.3
    }
  ): Promise<DocumentMetadata> {
    const correlationId = crypto.randomUUID();
    
    try {
      // Generate document ID and content hash
      const documentId = crypto.randomUUID();
      const contentHash = crypto.createHash('sha256').update(request.buffer).digest('hex');
      
      // Log document upload start
      await this.logAuditEvent({
        workspaceId: request.workspaceId,
        userId: request.userId,
        eventType: AuditEventType.DOCUMENT_UPLOAD,
        resourceId: documentId,
        action: 'upload_start',
        metadata: {
          originalName: request.originalName,
          contentType: request.contentType,
          fileSize: request.buffer.length,
          correlationId
        },
        correlationId
      });

      // Create initial document record
      const document = await this.prisma.document.create({
        data: {
          id: documentId,
          workspaceId: request.workspaceId,
          originalName: request.originalName,
          contentHash,
          type: DocumentTypeEnum.OTHER, // Will be updated after classification
          category: DocumentCategory.OTHER,
          processingStatus: ProcessingStatus.PROCESSING,
          uploadedAt: new Date()
        }
      });

      // Upload to storage
      const { key } = await this.storageService.uploadDocument(
        request.workspaceId,
        documentId,
        request.buffer,
        request.contentType,
        request.originalName
      );

      // Start background processing
      this.processDocumentAsync(document, request.buffer, options, correlationId)
        .catch(error => {
          console.error(`Background processing failed for document ${documentId}:`, error);
        });

      return this.mapToDocumentMetadata(document);
    } catch (error) {
      // Log processing error
      await this.logAuditEvent({
        workspaceId: request.workspaceId,
        userId: request.userId,
        eventType: AuditEventType.SYSTEM_ERROR,
        resourceId: 'unknown',
        action: 'upload_failed',
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          correlationId
        },
        correlationId
      });

      throw new Error(`Document upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get document metadata by ID
   */
  async getDocument(workspaceId: string, documentId: string): Promise<DocumentMetadata | null> {
    const document = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        workspaceId
      }
    });

    return document ? this.mapToDocumentMetadata(document) : null;
  }

  /**
   * List documents for workspace with filtering
   */
  async listDocuments(
    workspaceId: string,
    filters: {
      type?: DocumentTypeEnum;
      category?: DocumentCategory;
      status?: ProcessingStatus;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ documents: DocumentMetadata[]; total: number }> {
    const where = {
      workspaceId,
      ...(filters.type && { type: filters.type }),
      ...(filters.category && { category: filters.category }),
      ...(filters.status && { processingStatus: filters.status })
    };

    const [documents, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        orderBy: { uploadedAt: 'desc' },
        take: filters.limit || 50,
        skip: filters.offset || 0
      }),
      this.prisma.document.count({ where })
    ]);

    return {
      documents: documents.map(doc => this.mapToDocumentMetadata(doc)),
      total
    };
  }

  /**
   * Delete document and associated storage
   */
  async deleteDocument(workspaceId: string, documentId: string, userId: string): Promise<void> {
    const correlationId = crypto.randomUUID();

    try {
      // Verify document exists and belongs to workspace
      const document = await this.prisma.document.findFirst({
        where: { id: documentId, workspaceId }
      });

      if (!document) {
        throw new Error('Document not found');
      }

      // Delete from storage
      await this.storageService.deleteDocument(workspaceId, documentId);

      // Delete from database
      await this.prisma.document.delete({
        where: { id: documentId }
      });

      // Log deletion
      await this.logAuditEvent({
        workspaceId,
        userId,
        eventType: AuditEventType.DOCUMENT_PROCESS,
        resourceId: documentId,
        action: 'document_deleted',
        metadata: {
          originalName: document.originalName,
          correlationId
        },
        correlationId
      });
    } catch (error) {
      throw new Error(`Document deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Reprocess document with new options
   */
  async reprocessDocument(
    workspaceId: string,
    documentId: string,
    userId: string,
    options: DocumentProcessingOptions
  ): Promise<DocumentMetadata> {
    const correlationId = crypto.randomUUID();

    try {
      // Get document
      const document = await this.prisma.document.findFirst({
        where: { id: documentId, workspaceId }
      });

      if (!document) {
        throw new Error('Document not found');
      }

      // Get document buffer from storage
      const { buffer } = await this.storageService.getDocument(workspaceId, documentId);

      // Update status to processing
      await this.prisma.document.update({
        where: { id: documentId },
        data: { 
          processingStatus: ProcessingStatus.PROCESSING,
          processingErrors: undefined
        }
      });

      // Start reprocessing
      await this.processDocumentAsync(document, buffer, options, correlationId);

      // Get updated document
      const updatedDocument = await this.prisma.document.findUnique({
        where: { id: documentId }
      });

      return this.mapToDocumentMetadata(updatedDocument!);
    } catch (error) {
      throw new Error(`Document reprocessing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Background document processing pipeline
   */
  private async processDocumentAsync(
    document: any,
    buffer: Buffer,
    options: DocumentProcessingOptions,
    correlationId: string
  ): Promise<void> {
    const processingErrors: ProcessingError[] = [];
    let extractedData: any = null;
    let ocrConfidence: number | null = null;
    let documentType: DocumentTypeEnum = DocumentTypeEnum.OTHER;
    let documentCategory: DocumentCategory = DocumentCategory.OTHER;

    try {
      // Step 1: Document Classification
      const classificationResult = await this.classifier.classifyDocument(
        '', // We'll get text from OCR first
        document.originalName,
        buffer
      );

      documentType = classificationResult.type;
      documentCategory = classificationResult.category;

      // Step 2: OCR Processing (if enabled)
      if (options.enableOCR) {
        try {
          const ocrResult = await this.ocrProcessor.processDocument(
            buffer,
            documentType,
            { language: options.ocrLanguage }
          );

          // Re-classify with OCR text for better accuracy
          const improvedClassification = await this.classifier.classifyDocument(
            ocrResult.text,
            document.originalName,
            buffer
          );

          // Use improved classification if confidence is higher
          if (improvedClassification.confidence > classificationResult.confidence) {
            documentType = improvedClassification.type;
            documentCategory = improvedClassification.category;
          }

          extractedData = ocrResult.extractedData;
          ocrConfidence = ocrResult.confidence;

          // Validate extraction quality
          const validation = this.ocrProcessor.validateExtractionQuality(ocrResult, documentType);
          if (!validation.isValid) {
            processingErrors.push(...validation.errors);
          }
        } catch (ocrError) {
          processingErrors.push({
            code: 'OCR_PROCESSING_FAILED',
            message: `OCR processing failed: ${ocrError instanceof Error ? ocrError.message : 'Unknown error'}`,
            timestamp: new Date()
          });
        }
      }

      // Step 3: Update document with results
      const finalStatus = processingErrors.length > 0 
        ? ProcessingStatus.REQUIRES_REVIEW 
        : ProcessingStatus.COMPLETED;

      await this.prisma.document.update({
        where: { id: document.id },
        data: {
          type: documentType,
          category: documentCategory,
          processingStatus: finalStatus,
          ocrConfidence,
          extractedData: extractedData ? JSON.stringify(extractedData) : null,
          processingErrors: processingErrors.length > 0 ? JSON.stringify(processingErrors) : undefined,
          processedAt: new Date()
        }
      });

      // Log successful processing
      await this.logAuditEvent({
        workspaceId: document.workspaceId,
        userId: null, // Background processing
        eventType: AuditEventType.DOCUMENT_PROCESS,
        resourceId: document.id,
        action: 'processing_completed',
        metadata: {
          documentType,
          documentCategory,
          ocrConfidence,
          processingErrors: processingErrors.length,
          correlationId
        },
        correlationId
      });

    } catch (error) {
      // Update document with error status
      await this.prisma.document.update({
        where: { id: document.id },
        data: {
          processingStatus: ProcessingStatus.FAILED,
          processingErrors: JSON.stringify([{
            code: 'PROCESSING_FAILED',
            message: error instanceof Error ? error.message : 'Unknown processing error',
            timestamp: new Date()
          }])
        }
      });

      // Log processing failure
      await this.logAuditEvent({
        workspaceId: document.workspaceId,
        userId: null,
        eventType: AuditEventType.SYSTEM_ERROR,
        resourceId: document.id,
        action: 'processing_failed',
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          correlationId
        },
        correlationId
      });
    }
  }

  /**
   * Log audit event
   */
  private async logAuditEvent(event: {
    workspaceId: string;
    userId: string | null;
    eventType: AuditEventType;
    resourceId: string;
    action: string;
    metadata: any;
    correlationId: string;
  }): Promise<void> {
    try {
      await this.prisma.auditEvent.create({
        data: {
          workspaceId: event.workspaceId,
          userId: event.userId,
          eventType: event.eventType,
          resourceId: event.resourceId,
          action: event.action,
          metadata: event.metadata,
          correlationId: event.correlationId,
          timestamp: new Date()
        }
      });
    } catch (error) {
      console.error('Failed to log audit event:', error);
      // Don't throw - audit logging failure shouldn't break main functionality
    }
  }

  /**
   * Map database document to metadata interface
   */
  private mapToDocumentMetadata(document: any): DocumentMetadata {
    return {
      id: document.id,
      workspaceId: document.workspaceId,
      originalName: document.originalName,
      contentHash: document.contentHash,
      type: document.type,
      category: document.category,
      processingStatus: document.processingStatus,
      ocrConfidence: document.ocrConfidence,
      extractedData: document.extractedData ? JSON.parse(document.extractedData) : null,
      processingErrors: document.processingErrors ? JSON.parse(document.processingErrors) : null,
      uploadedAt: document.uploadedAt,
      processedAt: document.processedAt
    };
  }

  /**
   * Get processing statistics for workspace
   */
  async getProcessingStats(workspaceId: string): Promise<{
    total: number;
    byStatus: Record<ProcessingStatus, number>;
    byType: Record<DocumentTypeEnum, number>;
    averageConfidence: number;
  }> {
    const documents = await this.prisma.document.findMany({
      where: { workspaceId },
      select: {
        processingStatus: true,
        type: true,
        ocrConfidence: true
      }
    });

    const stats = {
      total: documents.length,
      byStatus: {} as Record<ProcessingStatus, number>,
      byType: {} as Record<DocumentTypeEnum, number>,
      averageConfidence: 0
    };

    // Initialize counters
    Object.values(ProcessingStatus).forEach(status => {
      stats.byStatus[status] = 0;
    });
    Object.values(DocumentTypeEnum).forEach(type => {
      stats.byType[type] = 0;
    });

    // Calculate statistics
    let totalConfidence = 0;
    let confidenceCount = 0;

    documents.forEach(doc => {
      stats.byStatus[doc.processingStatus]++;
      stats.byType[doc.type]++;
      
      if (doc.ocrConfidence !== null) {
        totalConfidence += doc.ocrConfidence;
        confidenceCount++;
      }
    });

    stats.averageConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;

    return stats;
  }
}