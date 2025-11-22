/**
 * PipesHub - Document Ingestion and Processing System
 * 
 * This module handles document upload, storage, classification, and OCR processing
 * for the Mobius 1 platform, ensuring compliance with Spain residency requirements.
 */

export { PipesHubService } from './service.js';
export { DocumentClassifier } from './classifier.js';
export { OCRProcessor } from './ocr.js';
export { StorageService } from './storage.js';
export * from './types.js';
export * from './routes.js';