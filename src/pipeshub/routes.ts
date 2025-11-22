/**
 * PipesHub API Routes
 * 
 * RESTful API endpoints for document upload, processing, and management
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as multer from 'multer';
import { DocumentTypeEnum, DocumentCategory, ProcessingStatus } from '@prisma/client';
import { PipesHubService } from './service.js';
import { DocumentUploadRequest, DocumentProcessingOptions } from './types.js';

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Accept images and PDFs
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/tiff',
      'image/bmp',
      'application/pdf'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images and PDFs are allowed.'));
    }
  }
});

export async function pipesHubRoutes(fastify: FastifyInstance) {
  const pipesHub = fastify.pipesHub as PipesHubService;

  // Upload document endpoint
  fastify.post('/documents/upload', {
    preHandler: [
      fastify.authenticate,
      async (request: FastifyRequest, reply: FastifyReply) => {
        return new Promise((resolve, reject) => {
          upload.single('document')(request.raw as any, reply.raw as any, (err) => {
            if (err) {
              reject(err);
            } else {
              resolve(undefined);
            }
          });
        });
      }
    ],
    schema: {
      consumes: ['multipart/form-data'],
      description: 'Upload a document for processing',
      tags: ['PipesHub'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                originalName: { type: 'string' },
                processingStatus: { type: 'string' },
                uploadedAt: { type: 'string' }
              }
            }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request: any, reply) => {
    try {
      const file = request.file;
      const { workspaceId, userId } = request.user;
      
      if (!file) {
        return reply.code(400).send({
          success: false,
          error: 'No file uploaded'
        });
      }

      // Parse processing options from form data
      const options: DocumentProcessingOptions = {
        enableOCR: request.body?.enableOCR !== 'false',
        ocrLanguage: request.body?.ocrLanguage || 'spa',
        classificationThreshold: parseFloat(request.body?.classificationThreshold || '0.3')
      };

      const uploadRequest: DocumentUploadRequest = {
        workspaceId,
        userId,
        originalName: file.originalname,
        contentType: file.mimetype,
        buffer: file.buffer
      };

      const document = await pipesHub.uploadDocument(uploadRequest, options);

      reply.send({
        success: true,
        data: {
          id: document.id,
          originalName: document.originalName,
          processingStatus: document.processingStatus,
          uploadedAt: document.uploadedAt.toISOString()
        }
      });
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      });
    }
  });

  // Get document by ID
  fastify.get('/documents/:documentId', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get document metadata by ID',
      tags: ['PipesHub'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          documentId: { type: 'string', format: 'uuid' }
        },
        required: ['documentId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                originalName: { type: 'string' },
                type: { type: 'string' },
                category: { type: 'string' },
                processingStatus: { type: 'string' },
                ocrConfidence: { type: 'number', nullable: true },
                extractedData: { type: 'object', nullable: true },
                processingErrors: { type: 'array', nullable: true },
                uploadedAt: { type: 'string' },
                processedAt: { type: 'string', nullable: true }
              }
            }
          }
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request: any, reply) => {
    try {
      const { documentId } = request.params;
      const { workspaceId } = request.user;

      const document = await pipesHub.getDocument(workspaceId, documentId);

      if (!document) {
        return reply.code(404).send({
          success: false,
          error: 'Document not found'
        });
      }

      reply.send({
        success: true,
        data: document
      });
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get document'
      });
    }
  });

  // List documents with filtering
  fastify.get('/documents', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'List documents with optional filtering',
      tags: ['PipesHub'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: Object.values(DocumentTypeEnum) },
          category: { type: 'string', enum: Object.values(DocumentCategory) },
          status: { type: 'string', enum: Object.values(ProcessingStatus) },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'integer', minimum: 0, default: 0 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                documents: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      originalName: { type: 'string' },
                      type: { type: 'string' },
                      category: { type: 'string' },
                      processingStatus: { type: 'string' },
                      uploadedAt: { type: 'string' }
                    }
                  }
                },
                total: { type: 'integer' },
                limit: { type: 'integer' },
                offset: { type: 'integer' }
              }
            }
          }
        }
      }
    }
  }, async (request: any, reply) => {
    try {
      const { workspaceId } = request.user;
      const { type, category, status, limit, offset } = request.query;

      const result = await pipesHub.listDocuments(workspaceId, {
        type: type as DocumentTypeEnum,
        category: category as DocumentCategory,
        status: status as ProcessingStatus,
        limit,
        offset
      });

      reply.send({
        success: true,
        data: {
          documents: result.documents,
          total: result.total,
          limit: limit || 50,
          offset: offset || 0
        }
      });
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list documents'
      });
    }
  });

  // Delete document
  fastify.delete('/documents/:documentId', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Delete document and associated data',
      tags: ['PipesHub'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          documentId: { type: 'string', format: 'uuid' }
        },
        required: ['documentId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request: any, reply) => {
    try {
      const { documentId } = request.params;
      const { workspaceId, userId } = request.user;

      await pipesHub.deleteDocument(workspaceId, documentId, userId);

      reply.send({
        success: true,
        message: 'Document deleted successfully'
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return reply.code(404).send({
          success: false,
          error: 'Document not found'
        });
      }

      reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete document'
      });
    }
  });

  // Reprocess document
  fastify.post('/documents/:documentId/reprocess', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Reprocess document with new options',
      tags: ['PipesHub'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          documentId: { type: 'string', format: 'uuid' }
        },
        required: ['documentId']
      },
      body: {
        type: 'object',
        properties: {
          enableOCR: { type: 'boolean', default: true },
          ocrLanguage: { type: 'string', default: 'spa' },
          classificationThreshold: { type: 'number', minimum: 0, maximum: 1, default: 0.3 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                processingStatus: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, async (request: any, reply) => {
    try {
      const { documentId } = request.params;
      const { workspaceId, userId } = request.user;
      const options = request.body as DocumentProcessingOptions;

      const document = await pipesHub.reprocessDocument(workspaceId, documentId, userId, options);

      reply.send({
        success: true,
        data: {
          id: document.id,
          processingStatus: document.processingStatus
        }
      });
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reprocess document'
      });
    }
  });

  // Get processing statistics
  fastify.get('/documents/stats', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get document processing statistics for workspace',
      tags: ['PipesHub'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                total: { type: 'integer' },
                byStatus: { type: 'object' },
                byType: { type: 'object' },
                averageConfidence: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request: any, reply) => {
    try {
      const { workspaceId } = request.user;
      const stats = await pipesHub.getProcessingStats(workspaceId);

      reply.send({
        success: true,
        data: stats
      });
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get statistics'
      });
    }
  });
}