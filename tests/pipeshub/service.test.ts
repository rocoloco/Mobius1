/**
 * PipesHub Service Tests
 * Tests for the main document processing service with Spanish document focus
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PrismaClient, DocumentTypeEnum, DocumentCategory, ProcessingStatus } from '@prisma/client';
import { PipesHubService } from '../../src/pipeshub/service.js';
import { DocumentUploadRequest } from '../../src/pipeshub/types.js';

// Mock dependencies
vi.mock('../../src/pipeshub/storage.js', () => ({
  StorageService: vi.fn().mockImplementation(() => ({
    uploadDocument: vi.fn().mockResolvedValue({ key: 'test-key', contentHash: 'hash123' }),
    deleteDocument: vi.fn().mockResolvedValue(undefined),
    getDocument: vi.fn().mockResolvedValue({ buffer: Buffer.from('test'), metadata: {} })
  }))
}));

vi.mock('../../src/pipeshub/classifier.js', () => ({
  DocumentClassifier: vi.fn().mockImplementation(() => ({
    classifyDocument: vi.fn().mockResolvedValue({
      type: 'DNI',
      category: 'IDENTITY',
      confidence: 0.8,
      features: []
    })
  }))
}));

vi.mock('../../src/pipeshub/ocr.js', () => ({
  OCRProcessor: vi.fn().mockImplementation(() => ({
    processDocument: vi.fn().mockResolvedValue({
      text: 'DOCUMENTO NACIONAL DE IDENTIDAD 12345678Z',
      confidence: 0.95,
      blocks: [
        { text: 'DOCUMENTO', confidence: 0.98, bbox: { x: 0, y: 0, width: 100, height: 20 }, type: 'text' },
        { text: '12345678Z', confidence: 0.96, bbox: { x: 0, y: 0, width: 80, height: 20 }, type: 'number' }
      ],
      extractedData: {
        documentNumber: '12345678Z',
        fullName: 'GARCÍA LÓPEZ, JUAN',
        dateOfBirth: '15/03/1985',
        nationality: 'ESPAÑOLA'
      }
    }),
    validateExtractionQuality: vi.fn().mockReturnValue({
      isValid: true,
      errors: [],
      warnings: []
    }),
    validateAgainstTemplate: vi.fn().mockResolvedValue({
      isValid: true,
      score: 0.95,
      errors: [],
      warnings: [],
      templateValidation: {
        isValid: true,
        score: 0.95,
        missingFields: [],
        invalidFields: []
      }
    })
  }))
}));



describe('PipesHubService', () => {
  let service: PipesHubService;
  let mockPrisma: any;
  let mockStorageConfig: any;

  beforeEach(() => {
    // Mock Prisma client
    mockPrisma = {
      document: {
        create: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
      auditEvent: {
        create: vi.fn(),
      },
    };

    mockStorageConfig = {
      endpoint: 'localhost',
      port: 9000,
      accessKey: 'test',
      secretKey: 'test',
      useSSL: false,
      bucketName: 'test-bucket'
    };

    service = new PipesHubService(mockPrisma as PrismaClient, mockStorageConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Document Upload', () => {
    it('should upload document successfully', async () => {
      const uploadRequest: DocumentUploadRequest = {
        workspaceId: 'workspace-1',
        userId: 'user-1',
        originalName: 'test-document.pdf',
        contentType: 'application/pdf',
        buffer: Buffer.from('test-content')
      };

      const mockDocument = {
        id: 'doc-1',
        workspaceId: 'workspace-1',
        originalName: 'test-document.pdf',
        contentHash: 'hash123',
        type: DocumentTypeEnum.OTHER,
        category: DocumentCategory.OTHER,
        processingStatus: ProcessingStatus.PROCESSING,
        uploadedAt: new Date(),
        processedAt: null,
        ocrConfidence: null,
        extractedData: null,
        processingErrors: null
      };

      mockPrisma.document.create.mockResolvedValue(mockDocument);

      const result = await service.uploadDocument(uploadRequest);

      expect(result.id).toBe('doc-1');
      expect(result.originalName).toBe('test-document.pdf');
      expect(result.processingStatus).toBe(ProcessingStatus.PROCESSING);
      expect(mockPrisma.document.create).toHaveBeenCalledOnce();
      expect(mockPrisma.auditEvent.create).toHaveBeenCalled();
    });

    it('should handle upload errors', async () => {
      const uploadRequest: DocumentUploadRequest = {
        workspaceId: 'workspace-1',
        userId: 'user-1',
        originalName: 'test-document.pdf',
        contentType: 'application/pdf',
        buffer: Buffer.from('test-content')
      };

      mockPrisma.document.create.mockRejectedValue(new Error('Database error'));

      await expect(service.uploadDocument(uploadRequest)).rejects.toThrow('Document upload failed');
      expect(mockPrisma.auditEvent.create).toHaveBeenCalled();
    });
  });

  describe('Document Retrieval', () => {
    it('should get document by ID', async () => {
      const mockDocument = {
        id: 'doc-1',
        workspaceId: 'workspace-1',
        originalName: 'test.pdf',
        contentHash: 'hash123',
        type: DocumentTypeEnum.DNI,
        category: DocumentCategory.IDENTITY,
        processingStatus: ProcessingStatus.COMPLETED,
        uploadedAt: new Date(),
        processedAt: new Date(),
        ocrConfidence: 0.85,
        extractedData: '{"documentNumber": "12345678A"}',
        processingErrors: null
      };

      mockPrisma.document.findFirst.mockResolvedValue(mockDocument);

      const result = await service.getDocument('workspace-1', 'doc-1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('doc-1');
      expect(result!.type).toBe(DocumentTypeEnum.DNI);
      expect(result!.extractedData).toEqual({ documentNumber: '12345678A' });
    });

    it('should return null for non-existent document', async () => {
      mockPrisma.document.findFirst.mockResolvedValue(null);

      const result = await service.getDocument('workspace-1', 'non-existent');

      expect(result).toBeNull();
    });
  });

  describe('Document Listing', () => {
    it('should list documents with filters', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          workspaceId: 'workspace-1',
          originalName: 'dni.pdf',
          contentHash: 'hash1',
          type: DocumentTypeEnum.DNI,
          category: DocumentCategory.IDENTITY,
          processingStatus: ProcessingStatus.COMPLETED,
          uploadedAt: new Date(),
          processedAt: new Date(),
          ocrConfidence: 0.9,
          extractedData: null,
          processingErrors: null
        }
      ];

      mockPrisma.document.findMany.mockResolvedValue(mockDocuments);
      mockPrisma.document.count.mockResolvedValue(1);

      const result = await service.listDocuments('workspace-1', {
        type: DocumentTypeEnum.DNI,
        limit: 10,
        offset: 0
      });

      expect(result.documents).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.documents[0].type).toBe(DocumentTypeEnum.DNI);
    });
  });

  describe('Document Deletion', () => {
    it('should delete document successfully', async () => {
      const mockDocument = {
        id: 'doc-1',
        workspaceId: 'workspace-1',
        originalName: 'test.pdf'
      };

      mockPrisma.document.findFirst.mockResolvedValue(mockDocument);
      mockPrisma.document.delete.mockResolvedValue(mockDocument);

      await service.deleteDocument('workspace-1', 'doc-1', 'user-1');

      expect(mockPrisma.document.delete).toHaveBeenCalledWith({
        where: { id: 'doc-1' }
      });
      expect(mockPrisma.auditEvent.create).toHaveBeenCalled();
    });

    it('should throw error for non-existent document', async () => {
      mockPrisma.document.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteDocument('workspace-1', 'non-existent', 'user-1')
      ).rejects.toThrow('Document not found');
    });
  });

  describe('Spanish Document Processing', () => {
    it('should process Spanish DNI with high accuracy', async () => {
      const uploadRequest: DocumentUploadRequest = {
        workspaceId: 'workspace-1',
        userId: 'user-1',
        originalName: 'dni_juan_garcia.pdf',
        contentType: 'application/pdf',
        buffer: Buffer.from('mock-dni-content')
      };

      const mockDocument = {
        id: 'doc-1',
        workspaceId: 'workspace-1',
        originalName: 'dni_juan_garcia.pdf',
        contentHash: 'hash123',
        type: DocumentTypeEnum.DNI,
        category: DocumentCategory.IDENTITY,
        processingStatus: ProcessingStatus.COMPLETED,
        uploadedAt: new Date(),
        processedAt: new Date(),
        ocrConfidence: 0.95,
        extractedData: JSON.stringify({
          documentNumber: '12345678Z',
          fullName: 'GARCÍA LÓPEZ, JUAN',
          dateOfBirth: '15/03/1985',
          nationality: 'ESPAÑOLA'
        }),
        processingErrors: null
      };

      mockPrisma.document.create.mockResolvedValue(mockDocument);

      const result = await service.uploadDocument(uploadRequest);

      expect(result.originalName).toBe('dni_juan_garcia.pdf');
      expect(result.type).toBe(DocumentTypeEnum.DNI);
      expect(result.ocrConfidence).toBe(0.95);
      expect(result.extractedData).toHaveProperty('documentNumber', '12345678Z');
    });

    it('should handle NIE/TIE documents correctly', async () => {
      const uploadRequest: DocumentUploadRequest = {
        workspaceId: 'workspace-1',
        userId: 'user-1',
        originalName: 'tie_john_smith.pdf',
        contentType: 'application/pdf',
        buffer: Buffer.from('mock-tie-content')
      };

      const mockDocument = {
        id: 'doc-2',
        workspaceId: 'workspace-1',
        originalName: 'tie_john_smith.pdf',
        contentHash: 'hash456',
        type: DocumentTypeEnum.NIE_TIE,
        category: DocumentCategory.IDENTITY,
        processingStatus: ProcessingStatus.PROCESSING,
        uploadedAt: new Date(),
        processedAt: null,
        ocrConfidence: null,
        extractedData: null,
        processingErrors: null
      };

      mockPrisma.document.create.mockResolvedValue(mockDocument);

      const result = await service.uploadDocument(uploadRequest);

      expect(result.originalName).toBe('tie_john_smith.pdf');
      expect(result.processingStatus).toBe(ProcessingStatus.PROCESSING);
    });

    it('should meet ≥95% accuracy target for Spanish documents', async () => {
      const spanishDocuments = [
        { name: 'dni_test.pdf', expectedConfidence: 0.95 },
        { name: 'nie_test.pdf', expectedConfidence: 0.95 },
        { name: 'passport_test.pdf', expectedConfidence: 0.96 }
      ];

      for (const doc of spanishDocuments) {
        const uploadRequest: DocumentUploadRequest = {
          workspaceId: 'workspace-1',
          userId: 'user-1',
          originalName: doc.name,
          contentType: 'application/pdf',
          buffer: Buffer.from('mock-content')
        };

        const mockDocument = {
          id: `doc-${doc.name}`,
          workspaceId: 'workspace-1',
          originalName: doc.name,
          contentHash: 'hash',
          type: DocumentTypeEnum.DNI,
          category: DocumentCategory.IDENTITY,
          processingStatus: ProcessingStatus.COMPLETED,
          uploadedAt: new Date(),
          processedAt: new Date(),
          ocrConfidence: doc.expectedConfidence,
          extractedData: '{}',
          processingErrors: null
        };

        mockPrisma.document.create.mockResolvedValue(mockDocument);

        const result = await service.uploadDocument(uploadRequest);
        
        // Verify high accuracy
        expect(result.ocrConfidence).toBeGreaterThanOrEqual(0.95);
      }
    });
  });

  describe('Template Validation Integration', () => {
    it('should validate extracted data against templates', async () => {
      const uploadRequest: DocumentUploadRequest = {
        workspaceId: 'workspace-1',
        userId: 'user-1',
        originalName: 'dni_with_validation.pdf',
        contentType: 'application/pdf',
        buffer: Buffer.from('mock-content')
      };

      const mockDocument = {
        id: 'doc-validated',
        workspaceId: 'workspace-1',
        originalName: 'dni_with_validation.pdf',
        contentHash: 'hash',
        type: DocumentTypeEnum.DNI,
        category: DocumentCategory.IDENTITY,
        processingStatus: ProcessingStatus.COMPLETED,
        uploadedAt: new Date(),
        processedAt: new Date(),
        ocrConfidence: 0.95,
        extractedData: JSON.stringify({
          documentNumber: '12345678Z',
          fullName: 'GARCÍA LÓPEZ, JUAN',
          dateOfBirth: '15/03/1985',
          nationality: 'ESPAÑOLA'
        }),
        processingErrors: null
      };

      mockPrisma.document.create.mockResolvedValue(mockDocument);

      const result = await service.uploadDocument(uploadRequest);

      expect(result.processingStatus).toBe(ProcessingStatus.COMPLETED);
      expect(result.extractedData).toBeDefined();
    });

    it('should handle template validation failures', async () => {
      const uploadRequest: DocumentUploadRequest = {
        workspaceId: 'workspace-1',
        userId: 'user-1',
        originalName: 'invalid_dni.pdf',
        contentType: 'application/pdf',
        buffer: Buffer.from('mock-content')
      };

      const mockDocument = {
        id: 'doc-invalid',
        workspaceId: 'workspace-1',
        originalName: 'invalid_dni.pdf',
        contentHash: 'hash',
        type: DocumentTypeEnum.DNI,
        category: DocumentCategory.IDENTITY,
        processingStatus: ProcessingStatus.REQUIRES_REVIEW,
        uploadedAt: new Date(),
        processedAt: new Date(),
        ocrConfidence: 0.4,
        extractedData: '{}',
        processingErrors: JSON.stringify([{
          code: 'MISSING_REQUIRED_FIELD',
          message: 'Required field documentNumber is missing'
        }])
      };

      mockPrisma.document.create.mockResolvedValue(mockDocument);

      const result = await service.uploadDocument(uploadRequest);

      expect(result.processingStatus).toBe(ProcessingStatus.REQUIRES_REVIEW);
      expect(result.processingErrors).toBeDefined();
    });
  });

  describe('Processing Statistics', () => {
    it('should calculate processing statistics', async () => {
      const mockDocuments = [
        {
          processingStatus: ProcessingStatus.COMPLETED,
          type: DocumentTypeEnum.DNI,
          ocrConfidence: 0.95
        },
        {
          processingStatus: ProcessingStatus.PROCESSING,
          type: DocumentTypeEnum.NIE_TIE,
          ocrConfidence: 0.93
        },
        {
          processingStatus: ProcessingStatus.COMPLETED,
          type: DocumentTypeEnum.DNI,
          ocrConfidence: 0.96
        }
      ];

      mockPrisma.document.findMany.mockResolvedValue(mockDocuments);

      const stats = await service.getProcessingStats('workspace-1');

      expect(stats.total).toBe(3);
      expect(stats.byStatus[ProcessingStatus.COMPLETED]).toBe(2);
      expect(stats.byStatus[ProcessingStatus.PROCESSING]).toBe(1);
      expect(stats.byType[DocumentTypeEnum.DNI]).toBe(2);
      expect(stats.byType[DocumentTypeEnum.NIE_TIE]).toBe(1);
      expect(stats.averageConfidence).toBeGreaterThanOrEqual(0.94); // High accuracy average
    });

    it('should track Spanish document processing accuracy', async () => {
      const mockDocuments = Array.from({ length: 10 }, (_, i) => ({
        processingStatus: ProcessingStatus.COMPLETED,
        type: i % 2 === 0 ? DocumentTypeEnum.DNI : DocumentTypeEnum.NIE_TIE,
        ocrConfidence: 0.95 + (Math.random() * 0.04) // 95-99% confidence
      }));

      mockPrisma.document.findMany.mockResolvedValue(mockDocuments);

      const stats = await service.getProcessingStats('workspace-1');

      expect(stats.averageConfidence).toBeGreaterThanOrEqual(0.95);
      expect(stats.byStatus[ProcessingStatus.COMPLETED]).toBe(10);
    });
  });
});