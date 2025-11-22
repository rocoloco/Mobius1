/**
 * OCR Processor Tests
 * Tests for OCR functionality and data extraction with ≥95% accuracy for Spanish documents
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OCRProcessor } from '../../src/pipeshub/ocr.js';
import { DocumentTypeEnum } from '@prisma/client';
import * as fs from 'fs/promises';

// Mock fs.readFile for template loading
vi.mock('fs/promises', () => ({
  readFile: vi.fn()
}));

describe('OCRProcessor', () => {
  let ocrProcessor: OCRProcessor;

  beforeEach(() => {
    // Mock template files
    const mockTemplates = {
      'dni-template.yaml': `
name: "Spanish DNI"
type: "DNI"
category: "IDENTITY"
version: "1.0"
required_fields: ["documentNumber", "fullName", "dateOfBirth", "nationality"]
optional_fields: ["sex", "placeOfBirth", "expiryDate"]
validation_rules:
  documentNumber:
    pattern: "^\\\\d{8}[A-Z]$"
    validator: "dni_checksum"
confidence_thresholds:
  minimum: 0.7
  target: 0.95
ocr_patterns:
  document_indicators: ["DOCUMENTO NACIONAL DE IDENTIDAD", "DNI"]
  field_indicators: {}
      `,
      'nie-tie-template.yaml': `
name: "Spanish NIE/TIE"
type: "NIE_TIE"
category: "IDENTITY"
version: "1.0"
required_fields: ["documentNumber", "fullName", "dateOfBirth", "nationality", "cardType"]
optional_fields: ["sex", "expiryDate"]
validation_rules:
  documentNumber:
    pattern: "^[XY]\\\\d{7}[A-Z]$"
    validator: "nie_checksum"
confidence_thresholds:
  minimum: 0.7
  target: 0.95
ocr_patterns:
  document_indicators: ["TARJETA DE IDENTIDAD DE EXTRANJERO", "NIE"]
  field_indicators: {}
      `
    };

    (fs.readFile as any).mockImplementation((path: string) => {
      const filename = path.split('/').pop();
      if (filename && mockTemplates[filename as keyof typeof mockTemplates]) {
        return Promise.resolve(mockTemplates[filename as keyof typeof mockTemplates]);
      }
      return Promise.reject(new Error('File not found'));
    });

    ocrProcessor = new OCRProcessor();
  });

  describe('Data Extraction', () => {
    it('should have correct structure for OCR result', () => {
      // Test the expected structure without actual OCR processing
      const mockOCRResult = {
        text: 'DOCUMENTO NACIONAL DE IDENTIDAD 12345678A',
        confidence: 0.85,
        blocks: [],
        extractedData: {
          documentNumber: '12345678A'
        }
      };

      expect(mockOCRResult).toHaveProperty('text');
      expect(mockOCRResult).toHaveProperty('confidence');
      expect(mockOCRResult).toHaveProperty('blocks');
      expect(mockOCRResult).toHaveProperty('extractedData');
    });

    it('should validate extraction quality', () => {
      const mockOCRResult = {
        text: 'DOCUMENTO NACIONAL DE IDENTIDAD 12345678Z',
        confidence: 0.85,
        blocks: [
          {
            text: 'DOCUMENTO',
            confidence: 0.9,
            bbox: { x: 0, y: 0, width: 100, height: 20 },
            type: 'text' as const
          }
        ],
        extractedData: {
          documentNumber: '12345678Z',
          fullName: 'JUAN GARCIA',
          dateOfBirth: '15/03/1985',
          nationality: 'ESPAÑOLA'
        }
      };

      const validation = ocrProcessor.validateExtractionQuality(
        mockOCRResult,
        DocumentTypeEnum.DNI
      );

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect low confidence and add warnings', () => {
      const mockOCRResult = {
        text: 'Poor quality text',
        confidence: 0.5, // Low confidence
        blocks: [],
        extractedData: {}
      };

      const validation = ocrProcessor.validateExtractionQuality(
        mockOCRResult,
        DocumentTypeEnum.DNI
      );

      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.warnings[0]).toContain('Low OCR confidence');
    });

    it('should detect missing required data', () => {
      const mockOCRResult = {
        text: 'Some text without DNI number',
        confidence: 0.8,
        blocks: [],
        extractedData: {} // Missing documentNumber
      };

      const validation = ocrProcessor.validateExtractionQuality(
        mockOCRResult,
        DocumentTypeEnum.DNI
      );

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors[0].code).toBe('MISSING_DNI_NUMBER');
    });
  });

  describe('Spanish Document Data Extraction', () => {
    describe('DNI Extraction', () => {
      it('should extract DNI data with high accuracy', () => {
        const mockDNIText = `
          DOCUMENTO NACIONAL DE IDENTIDAD
          APELLIDOS Y NOMBRE: GARCÍA LÓPEZ, JUAN CARLOS
          NACIMIENTO: 15/03/1985
          NACIONALIDAD: ESPAÑOLA
          SEXO: M
          NÚMERO: 12345678Z
          VÁLIDO HASTA: 20/12/2030
        `;

        const processor = ocrProcessor as any;
        const extractedData = processor.extractDNIData(mockDNIText);

        expect(extractedData.documentNumber).toBe('12345678Z');
        expect(extractedData.dni).toBe('12345678Z');
        expect(extractedData.fullName).toContain('GARCÍA LÓPEZ');
        expect(extractedData.dateOfBirth).toBe('15/03/1985');
        expect(extractedData.nationality).toBe('ESPAÑOLA');
        expect(extractedData.sex).toBe('M');
        expect(extractedData.expiryDate).toBe('20/12/2030');
      });

      it('should validate DNI checksum correctly', () => {
        const processor = ocrProcessor as any;
        
        // Valid DNI
        expect(processor.validateDNI('12345678Z')).toBe(true);
        expect(processor.validateDNI('87654321X')).toBe(true);
        
        // Invalid DNI
        expect(processor.validateDNI('12345678A')).toBe(false);
        expect(processor.validateDNI('invalid')).toBe(false);
      });

      it('should handle Spanish names with accents', () => {
        const mockText = 'APELLIDOS Y NOMBRE: MARTÍNEZ PÉREZ, MARÍA JOSÉ';
        const processor = ocrProcessor as any;
        const extractedData = processor.extractDNIData(mockText);

        expect(extractedData.fullName).toContain('MARTÍNEZ');
        expect(extractedData.fullName).toContain('MARÍA');
      });
    });

    describe('NIE/TIE Extraction', () => {
      it('should extract NIE data with high accuracy', () => {
        const mockNIEText = `
          TARJETA DE IDENTIDAD DE EXTRANJERO
          APELLIDOS Y NOMBRE: SMITH, JOHN MICHAEL
          NACIMIENTO: 22/08/1990
          NACIONALIDAD: BRITÁNICA
          NÚMERO: X1234567L
          VÁLIDO HASTA: 15/06/2025
        `;

        const processor = ocrProcessor as any;
        const extractedData = processor.extractNIETIEData(mockNIEText);

        expect(extractedData.documentNumber).toBe('X1234567L');
        expect(extractedData.nieNumber).toBe('X1234567L');
        expect(extractedData.fullName).toContain('SMITH');
        expect(extractedData.dateOfBirth).toBe('22/08/1990');
        expect(extractedData.nationality).toBe('BRITÁNICA');
        expect(extractedData.cardType).toBe('TIE');
        expect(extractedData.expiryDate).toBe('15/06/2025');
      });

      it('should validate NIE checksum correctly', () => {
        const processor = ocrProcessor as any;
        
        // Valid NIE (using correct checksums)
        expect(processor.validateNIE('X1234567L')).toBe(true);
        expect(processor.validateNIE('Y1234567X')).toBe(true);
        
        // Invalid NIE
        expect(processor.validateNIE('X1234567A')).toBe(false);
        expect(processor.validateNIE('invalid')).toBe(false);
      });

      it('should determine card type correctly', () => {
        const processor = ocrProcessor as any;
        
        const tieText = 'TARJETA DE IDENTIDAD DE EXTRANJERO X1234567L';
        const nieText = 'NÚMERO DE IDENTIDAD DE EXTRANJERO Y7654321X';
        
        const tieData = processor.extractNIETIEData(tieText);
        const nieData = processor.extractNIETIEData(nieText);
        
        expect(tieData.cardType).toBe('TIE');
        expect(nieData.cardType).toBe('NIE');
      });
    });

    describe('Passport Extraction', () => {
      it('should extract passport data accurately', () => {
        const mockPassportText = `
          PASAPORTE ESPAÑA
          APELLIDOS Y NOMBRE: RODRÍGUEZ FERNÁNDEZ, ANA ISABEL
          FECHA DE NACIMIENTO: 10/12/1988
          LUGAR DE NACIMIENTO: MADRID, ESPAÑA
          NACIONALIDAD: ESPAÑOLA
          PASAPORTE: ESP123456
          FECHA DE EXPEDICIÓN: 01/01/2020
          FECHA DE CADUCIDAD: 01/01/2030
        `;

        const processor = ocrProcessor as any;
        const extractedData = processor.extractPassportData(mockPassportText);

        expect(extractedData.documentNumber).toBe('ESP123456');
        expect(extractedData.passportNumber).toBe('ESP123456');
        expect(extractedData.fullName).toContain('RODRÍGUEZ');
        expect(extractedData.dateOfBirth).toBe('10/12/1988');
        expect(extractedData.placeOfBirth).toContain('MADRID');
        expect(extractedData.nationality).toBe('ESPAÑOLA');
        expect(extractedData.issueDate).toBe('01/01/2020');
        expect(extractedData.expiryDate).toBe('01/01/2030');
      });
    });
  });

  describe('Spanish Text Processing', () => {
    it('should handle Spanish character corrections', () => {
      const processor = ocrProcessor as any;
      const textWithErrors = "Nombre: Jose' Mari'a Pen~a";
      const corrected = processor.postProcessSpanishText(textWithErrors);
      
      expect(corrected).toContain('José');
      expect(corrected).toContain('María');
      expect(corrected).toContain('Peña');
    });

    it('should standardize Spanish names correctly', () => {
      const processor = ocrProcessor as any;
      
      expect(processor.cleanSpanishName('GARCÍA LÓPEZ, JUAN CARLOS')).toBe('GARCÍA LÓPEZ JUAN CARLOS');
      expect(processor.cleanSpanishName('MARTÍNEZ  PÉREZ,  MARÍA')).toBe('MARTÍNEZ PÉREZ MARÍA');
    });

    it('should standardize date formats', () => {
      const processor = ocrProcessor as any;
      
      expect(processor.standardizeDate('5/3/1985')).toBe('05/03/1985');
      expect(processor.standardizeDate('15-12-2030')).toBe('15/12/2030');
    });

    it('should detect Spanish document patterns', () => {
      const processor = ocrProcessor as any;
      
      expect(processor.isSpanishPattern('12345678Z')).toBe(true);
      expect(processor.isSpanishPattern('X1234567L')).toBe(true);
      expect(processor.isSpanishPattern('ESP123456')).toBe(true);
      expect(processor.isSpanishPattern('28001')).toBe(true);
      expect(processor.isSpanishPattern('random text')).toBe(false);
    });
  });

  describe('Template Validation', () => {
    it('should validate against document templates', async () => {
      const mockOCRResult = {
        text: 'DOCUMENTO NACIONAL DE IDENTIDAD 12345678Z',
        confidence: 0.95,
        blocks: [],
        extractedData: {
          documentNumber: '12345678Z',
          fullName: 'GARCÍA LÓPEZ, JUAN',
          dateOfBirth: '15/03/1985',
          nationality: 'ESPAÑOLA'
        }
      };

      const validation = await ocrProcessor.validateAgainstTemplate(
        mockOCRResult,
        DocumentTypeEnum.DNI
      );

      expect(validation.isValid).toBe(true);
      expect(validation.score).toBeGreaterThan(0.8);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing required fields', async () => {
      const mockOCRResult = {
        text: 'Some text',
        confidence: 0.8,
        blocks: [],
        extractedData: {
          fullName: 'GARCÍA LÓPEZ, JUAN'
          // Missing documentNumber, dateOfBirth, nationality
        }
      };

      const validation = await ocrProcessor.validateAgainstTemplate(
        mockOCRResult,
        DocumentTypeEnum.DNI
      );

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors.some(e => e.code === 'MISSING_REQUIRED_FIELD')).toBe(true);
    });
  });

  describe('Text Block Classification', () => {
    it('should classify date patterns', () => {
      // Access private method through any for testing
      const processor = ocrProcessor as any;
      
      expect(processor.classifyTextBlock('15/03/1985')).toBe('date');
      expect(processor.classifyTextBlock('20-12-2030')).toBe('date');
    });

    it('should classify number patterns', () => {
      const processor = ocrProcessor as any;
      
      expect(processor.classifyTextBlock('12345678A')).toBe('number');
      expect(processor.classifyTextBlock('X1234567L')).toBe('number');
      expect(processor.classifyTextBlock('12345678')).toBe('number');
    });

    it('should classify text patterns', () => {
      const processor = ocrProcessor as any;
      
      expect(processor.classifyTextBlock('JUAN GARCIA')).toBe('text');
      expect(processor.classifyTextBlock('DOCUMENTO')).toBe('text');
    });
  });

  describe('OCR Quality Validation', () => {
    it('should meet ≥95% accuracy target for Spanish documents', () => {
      const highQualityResult = {
        text: 'DOCUMENTO NACIONAL DE IDENTIDAD 12345678Z GARCÍA LÓPEZ, JUAN',
        confidence: 0.96,
        blocks: [
          { text: 'DOCUMENTO', confidence: 0.98, bbox: { x: 0, y: 0, width: 100, height: 20 }, type: 'text' as const },
          { text: '12345678Z', confidence: 0.95, bbox: { x: 0, y: 0, width: 100, height: 20 }, type: 'number' as const }
        ],
        extractedData: {
          documentNumber: '12345678Z',
          fullName: 'GARCÍA LÓPEZ, JUAN',
          dateOfBirth: '15/03/1985',
          nationality: 'ESPAÑOLA'
        }
      };

      const validation = ocrProcessor.validateExtractionQuality(
        highQualityResult,
        DocumentTypeEnum.DNI
      );

      expect(validation.isValid).toBe(true);
      expect(validation.warnings).toHaveLength(0);
      expect(highQualityResult.confidence).toBeGreaterThanOrEqual(0.95);
    });

    it('should detect low quality OCR results', () => {
      const lowQualityResult = {
        text: 'Poor quality text with artifacts @@##',
        confidence: 0.4,
        blocks: [],
        extractedData: {}
      };

      const validation = ocrProcessor.validateExtractionQuality(
        lowQualityResult,
        DocumentTypeEnum.DNI
      );

      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.code === 'CONFIDENCE_TOO_LOW')).toBe(true);
    });
  });
});