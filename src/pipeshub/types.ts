/**
 * Type definitions for PipesHub document processing system
 */

import { DocumentTypeEnum, DocumentCategory, ProcessingStatus } from '@prisma/client';

export interface DocumentUploadRequest {
  workspaceId: string;
  userId: string;
  originalName: string;
  contentType: string;
  buffer: Buffer;
}

export interface DocumentMetadata {
  id: string;
  workspaceId: string;
  originalName: string;
  contentHash: string;
  type: DocumentTypeEnum;
  category: DocumentCategory;
  processingStatus: ProcessingStatus;
  ocrConfidence?: number;
  extractedData?: any;
  processingErrors?: any;
  uploadedAt: Date;
  processedAt?: Date;
}

export interface DocumentClassificationResult {
  type: DocumentTypeEnum;
  category: DocumentCategory;
  confidence: number;
  features: ClassificationFeature[];
}

export interface ClassificationFeature {
  name: string;
  value: string | number;
  confidence: number;
}

export interface OCRResult {
  text: string;
  confidence: number;
  blocks: OCRBlock[];
  extractedData: ExtractedDocumentData;
}

export interface OCRBlock {
  text: string;
  confidence: number;
  bbox: BoundingBox;
  type: 'text' | 'number' | 'date' | 'signature';
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExtractedDocumentData {
  documentNumber?: string;
  fullName?: string;
  dateOfBirth?: string;
  nationality?: string;
  expiryDate?: string;
  issueDate?: string;
  placeOfBirth?: string;
  address?: string;
  // Tax document specific fields
  taxPeriod?: string;
  vatAmount?: number;
  totalAmount?: number;
  // Additional fields based on document type
  [key: string]: any;
}

export interface DocumentProcessingOptions {
  enableOCR: boolean;
  ocrLanguage: string;
  classificationThreshold: number;
  extractionRules?: ExtractionRule[];
}

export interface ExtractionRule {
  field: string;
  pattern: RegExp;
  required: boolean;
  validator?: (value: string) => boolean;
}

export interface StorageConfig {
  endpoint: string;
  port: number;
  accessKey: string;
  secretKey: string;
  useSSL: boolean;
  bucketName: string;
}

export interface ProcessingError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
}

// Spanish document specific types
export interface DNIData extends ExtractedDocumentData {
  dni: string;
  fullName: string;
  dateOfBirth: string;
  placeOfBirth: string;
  nationality: string;
  sex: string;
  expiryDate: string;
}

export interface NIETIEData extends ExtractedDocumentData {
  nieNumber: string;
  fullName: string;
  dateOfBirth: string;
  nationality: string;
  expiryDate: string;
  cardType: 'NIE' | 'TIE';
}

export interface PassportData extends ExtractedDocumentData {
  passportNumber: string;
  fullName: string;
  dateOfBirth: string;
  placeOfBirth: string;
  nationality: string;
  sex: string;
  issueDate: string;
  expiryDate: string;
  issuingAuthority: string;
}

export interface Modelo303Data extends ExtractedDocumentData {
  taxPeriod: string;
  nif: string;
  companyName?: string;
  vatBase: number;
  vatAmount: number;
  totalAmount: number;
  paymentMethod: string;
}