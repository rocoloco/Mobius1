/**
 * MinIO Storage Service for Document Management
 * 
 * Handles secure document storage with workspace isolation and encryption
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import * as crypto from 'crypto';
import { StorageConfig, ProcessingError } from './types.js';

export class StorageService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(config: StorageConfig) {
    this.s3Client = new S3Client({
      endpoint: `${config.useSSL ? 'https' : 'http'}://${config.endpoint}:${config.port}`,
      region: 'us-east-1', // MinIO requires a region
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
      forcePathStyle: true, // Required for MinIO
    });
    this.bucketName = config.bucketName;
  }

  /**
   * Upload document to MinIO with workspace isolation
   */
  async uploadDocument(
    workspaceId: string,
    documentId: string,
    buffer: Buffer,
    contentType: string,
    originalName: string
  ): Promise<{ key: string; contentHash: string }> {
    try {
      // Generate content hash for integrity verification
      const contentHash = crypto.createHash('sha256').update(buffer).digest('hex');
      
      // Create workspace-isolated key
      const key = this.generateDocumentKey(workspaceId, documentId, originalName);
      
      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.bucketName,
          Key: key,
          Body: buffer,
          ContentType: contentType,
          Metadata: {
            'workspace-id': workspaceId,
            'document-id': documentId,
            'original-name': originalName,
            'content-hash': contentHash,
            'upload-timestamp': new Date().toISOString(),
          },
          // Server-side encryption
          ServerSideEncryption: 'AES256',
        },
      });

      await upload.done();
      
      return { key, contentHash };
    } catch (error) {
      throw new Error(`Failed to upload document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve document from MinIO
   */
  async getDocument(workspaceId: string, documentId: string): Promise<{ buffer: Buffer; metadata: Record<string, string> }> {
    try {
      const key = this.findDocumentKey(workspaceId, documentId);
      
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      
      if (!response.Body) {
        throw new Error('Document not found');
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      const stream = response.Body as any;
      
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      
      const buffer = Buffer.concat(chunks);
      const metadata = response.Metadata || {};

      // Verify workspace isolation
      if (metadata['workspace-id'] !== workspaceId) {
        throw new Error('Access denied: Document belongs to different workspace');
      }

      return { buffer, metadata };
    } catch (error) {
      throw new Error(`Failed to retrieve document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete document from MinIO
   */
  async deleteDocument(workspaceId: string, documentId: string): Promise<void> {
    try {
      const key = this.findDocumentKey(workspaceId, documentId);
      
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
    } catch (error) {
      throw new Error(`Failed to delete document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if document exists
   */
  async documentExists(workspaceId: string, documentId: string): Promise<boolean> {
    try {
      const key = this.findDocumentKey(workspaceId, documentId);
      
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate workspace-isolated document key
   */
  private generateDocumentKey(workspaceId: string, documentId: string, originalName: string): string {
    const sanitizedName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return `workspaces/${workspaceId}/documents/${timestamp}/${documentId}/${sanitizedName}`;
  }

  /**
   * Find document key (simplified for this implementation)
   * In production, this would query MinIO or maintain an index
   */
  private findDocumentKey(workspaceId: string, documentId: string): string {
    // For now, we'll construct the key pattern
    // In production, this should be stored in the database or indexed
    return `workspaces/${workspaceId}/documents/*/${documentId}/*`;
  }

  /**
   * Verify document integrity
   */
  async verifyDocumentIntegrity(workspaceId: string, documentId: string, expectedHash: string): Promise<boolean> {
    try {
      const { buffer } = await this.getDocument(workspaceId, documentId);
      const actualHash = crypto.createHash('sha256').update(buffer).digest('hex');
      return actualHash === expectedHash;
    } catch (error) {
      return false;
    }
  }
}