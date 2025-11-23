/**
 * Document Encryption Service for Mobius 1 Platform
 * Handles column-level encryption for PII data in documents
 */

import { PrismaClient } from '@prisma/client';
import { encryptJSON, decryptJSON, hashData } from './encryption.js';
import { KeyManager } from './key-manager.js';

/**
 * Document encryption service with workspace isolation
 */
export class DocumentEncryptionService {
  private db: PrismaClient;
  private keyManager: KeyManager;

  constructor(db: PrismaClient, keyManager: KeyManager) {
    this.db = db;
    this.keyManager = keyManager;
  }

  /**
   * Encrypt document extracted data before storage
   */
  async encryptDocumentData(
    workspaceId: string,
    extractedData: any
  ): Promise<{ encrypted: string; contentHash: string }> {
    const context = await this.keyManager.getWorkspaceContext(workspaceId);
    const encrypted = encryptJSON(extractedData, context);
    const contentHash = hashData(JSON.stringify(extractedData));

    return { encrypted, contentHash };
  }

  /**
   * Decrypt document extracted data
   */
  async decryptDocumentData<T = any>(
    workspaceId: string,
    encryptedData: string
  ): Promise<T> {
    const context = await this.keyManager.getWorkspaceContext(workspaceId);
    return decryptJSON<T>(encryptedData, context);
  }

  /**
   * Re-encrypt document data after key rotation
   */
  async reencryptDocument(documentId: string, workspaceId: string): Promise<void> {
    const document = await this.db.document.findUnique({
      where: { id: documentId },
      select: { extractedData: true },
    });

    if (!document || !document.extractedData) {
      throw new Error(`Document not found or has no extracted data: ${documentId}`);
    }

    // Decrypt with old context (this assumes we still have access to it)
    const oldContext = await this.keyManager.getWorkspaceContext(workspaceId);
    const decrypted = decryptJSON(document.extractedData, oldContext);

    // Encrypt with new context
    const { encrypted } = await this.encryptDocumentData(workspaceId, decrypted);

    // Update document
    await this.db.document.update({
      where: { id: documentId },
      data: { extractedData: encrypted },
    });
  }

  /**
   * Re-encrypt all documents in workspace after key rotation
   */
  async reencryptWorkspaceDocuments(workspaceId: string): Promise<{
    total: number;
    reencrypted: number;
    failed: number;
    errors: Array<{ documentId: string; error: string }>;
  }> {
    const documents = await this.db.document.findMany({
      where: { workspaceId, extractedData: { not: null } },
      select: { id: true },
    });

    const results = {
      total: documents.length,
      reencrypted: 0,
      failed: 0,
      errors: [] as Array<{ documentId: string; error: string }>,
    };

    for (const doc of documents) {
      try {
        await this.reencryptDocument(doc.id, workspaceId);
        results.reencrypted++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          documentId: doc.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Verify document encryption integrity
   */
  async verifyDocumentEncryption(documentId: string, workspaceId: string): Promise<{
    valid: boolean;
    error?: string;
  }> {
    try {
      const document = await this.db.document.findUnique({
        where: { id: documentId },
        select: { extractedData: true, contentHash: true },
      });

      if (!document || !document.extractedData) {
        return { valid: false, error: 'Document not found or has no extracted data' };
      }

      // Decrypt and verify hash
      const decrypted = await this.decryptDocumentData(workspaceId, document.extractedData);
      const computedHash = hashData(JSON.stringify(decrypted));

      if (computedHash !== document.contentHash) {
        return { valid: false, error: 'Content hash mismatch - data may be corrupted' };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Decryption failed',
      };
    }
  }
}
