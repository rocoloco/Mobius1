/**
 * OCR Processing Service
 * 
 * Handles Optical Character Recognition with specialized extraction
 * for Spanish administrative documents
 */

import * as Tesseract from 'tesseract.js';
import * as sharp from 'sharp';
import { DocumentTypeEnum } from '@prisma/client';
import { 
  OCRResult, 
  OCRBlock, 
  BoundingBox, 
  ExtractedDocumentData,
  DNIData,
  NIETIEData,
  PassportData,
  Modelo303Data,
  ProcessingError
} from './types.js';
import { TemplateValidator } from './templateValidator.js';

export class OCRProcessor {
  private readonly supportedLanguages = ['spa', 'eng']; // Spanish and English
  private readonly confidenceThreshold = 0.6;
  private readonly templateValidator = new TemplateValidator();
  private readonly spanishDocumentPatterns = {
    dni: /\b(\d{8}[A-Z])\b/g,
    nie: /\b([XY]\d{7}[A-Z])\b/g,
    passport: /\b([A-Z]{3}\d{6})\b/g,
    postalCode: /\b(\d{5})\b/g,
    phone: /\b([6-9]\d{8})\b/g,
    date: /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\b/g
  };

  /**
   * Process document with OCR and extract structured data
   */
  async processDocument(
    imageBuffer: Buffer,
    documentType: DocumentTypeEnum,
    options: { language?: string; confidence?: number } = {}
  ): Promise<OCRResult> {
    try {
      // Preprocess image for better OCR accuracy
      const processedImage = await this.preprocessImage(imageBuffer);
      
      // Perform OCR
      const ocrData = await this.performOCR(processedImage, options.language || 'spa');
      
      // Extract structured data based on document type
      const extractedData = await this.extractStructuredData(ocrData.text, documentType);
      
      // Calculate overall confidence
      const overallConfidence = this.calculateOverallConfidence(ocrData.blocks);
      
      return {
        text: ocrData.text,
        confidence: overallConfidence,
        blocks: ocrData.blocks,
        extractedData
      };
    } catch (error) {
      throw new Error(`OCR processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Preprocess image for better OCR accuracy
   * Enhanced preprocessing for Spanish documents
   */
  private async preprocessImage(imageBuffer: Buffer): Promise<Buffer> {
    try {
      // Multi-stage preprocessing for optimal Spanish document OCR
      const processed = await sharp(imageBuffer)
        // Stage 1: Resize to optimal resolution (1600px height for better text recognition)
        .resize(null, 1600, { 
          withoutEnlargement: true,
          kernel: sharp.kernel.lanczos3 
        })
        // Stage 2: Enhance contrast and normalize
        .normalize({ lower: 1, upper: 99 })
        .linear(1.2, -(128 * 1.2) + 128) // Increase contrast
        // Stage 3: Convert to grayscale with optimal gamma
        .gamma(1.2)
        .greyscale()
        // Stage 4: Apply unsharp mask for text clarity
        .sharpen({ sigma: 1.0, m1: 1.0, m2: 2.0, x1: 2, y2: 10, y3: 20 })
        // Stage 5: Ensure clean background
        .threshold(240, { greyscale: false })
        .png({ quality: 100, compressionLevel: 0 })
        .toBuffer();

      return processed;
    } catch (error) {
      console.warn('Image preprocessing failed, using original:', error);
      return imageBuffer;
    }
  }

  /**
   * Perform OCR using Tesseract.js with Spanish-optimized settings
   */
  private async performOCR(
    imageBuffer: Buffer, 
    language: string
  ): Promise<{ text: string; blocks: OCRBlock[] }> {
    const worker = await Tesseract.createWorker(language, 1, {
      logger: m => {
        if (m.status === 'recognizing text') {
          console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
        }
      }
    });
    
    try {
      // Configure Tesseract for Spanish documents
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZabcdefghijklmnñopqrstuvwxyz0123456789áéíóúüÁÉÍÓÚÜ.,;:()/-_ ',
        tessedit_pageseg_mode: '6', // Uniform block of text
        preserve_interword_spaces: '1',
        user_defined_dpi: '300'
      });

      const { data } = await worker.recognize(imageBuffer);
      
      // Enhanced block extraction with better confidence calculation
      const blocks: OCRBlock[] = [];
      
      if (data.words) {
        for (const word of data.words) {
          if (word.text && word.text.trim().length > 0) {
            const block: OCRBlock = {
              text: word.text.trim(),
              confidence: word.confidence / 100,
              bbox: {
                x: word.bbox?.x0 || 0,
                y: word.bbox?.y0 || 0,
                width: (word.bbox?.x1 || 0) - (word.bbox?.x0 || 0),
                height: (word.bbox?.y1 || 0) - (word.bbox?.y0 || 0)
              },
              type: this.classifyTextBlock(word.text)
            };
            
            // Apply Spanish-specific confidence boost for known patterns
            if (this.isSpanishPattern(word.text)) {
              block.confidence = Math.min(1.0, block.confidence * 1.1);
            }
            
            blocks.push(block);
          }
        }
      }

      // Post-process text for Spanish characters
      const cleanedText = this.postProcessSpanishText(data.text);

      return {
        text: cleanedText,
        blocks: blocks.filter(block => block.confidence >= this.confidenceThreshold)
      };
    } finally {
      await worker.terminate();
    }
  }

  /**
   * Check if text matches Spanish document patterns
   */
  private isSpanishPattern(text: string): boolean {
    const patterns = Object.values(this.spanishDocumentPatterns);
    return patterns.some(pattern => pattern.test(text));
  }

  /**
   * Post-process text to fix common Spanish OCR errors
   */
  private postProcessSpanishText(text: string): string {
    return text
      // Fix common character substitutions
      .replace(/[0O]/g, (match, offset, string) => {
        // Context-aware O/0 correction
        const before = string[offset - 1];
        const after = string[offset + 1];
        if (/[A-Z]/.test(before) && /[A-Z]/.test(after)) return 'O';
        if (/\d/.test(before) || /\d/.test(after)) return '0';
        return match;
      })
      // Fix Spanish accents
      .replace(/a'/g, 'á')
      .replace(/e'/g, 'é')
      .replace(/i'/g, 'í')
      .replace(/o'/g, 'ó')
      .replace(/u'/g, 'ú')
      // Fix ñ character
      .replace(/n~/g, 'ñ')
      .replace(/n\^/g, 'ñ')
      // Clean up whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Classify text block type
   */
  private classifyTextBlock(text: string): 'text' | 'number' | 'date' | 'signature' {
    // Date patterns
    if (/\d{1,2}\/\d{1,2}\/\d{4}/.test(text) || /\d{1,2}-\d{1,2}-\d{4}/.test(text)) {
      return 'date';
    }
    
    // Number patterns (including DNI, NIE, etc.)
    if (/^[XY]?\d+[A-Z]?$/.test(text.replace(/\s/g, ''))) {
      return 'number';
    }
    
    // Signature detection (very basic)
    if (text.length < 3 && /[A-Z]/.test(text)) {
      return 'signature';
    }
    
    return 'text';
  }

  /**
   * Extract structured data based on document type
   */
  private async extractStructuredData(
    text: string, 
    documentType: DocumentTypeEnum
  ): Promise<ExtractedDocumentData> {
    const normalizedText = text.replace(/\s+/g, ' ').trim();
    
    switch (documentType) {
      case DocumentTypeEnum.DNI:
        return this.extractDNIData(normalizedText);
      case DocumentTypeEnum.NIE_TIE:
        return this.extractNIETIEData(normalizedText);
      case DocumentTypeEnum.PASSPORT:
        return this.extractPassportData(normalizedText);
      case DocumentTypeEnum.MODELO_303:
        return this.extractModelo303Data(normalizedText);
      default:
        return this.extractGenericData(normalizedText);
    }
  }

  /**
   * Extract DNI specific data with enhanced Spanish patterns
   */
  private extractDNIData(text: string): DNIData {
    const data: Partial<DNIData> = {};
    
    // Enhanced DNI number pattern with validation
    const dniMatches = text.match(/\b(\d{8}[A-Z])\b/g);
    if (dniMatches) {
      // Validate DNI checksum
      for (const dni of dniMatches) {
        if (this.validateDNI(dni)) {
          data.dni = dni;
          data.documentNumber = dni;
          break;
        }
      }
    }
    
    // Enhanced name extraction with multiple patterns
    const namePatterns = [
      /(?:APELLIDOS Y NOMBRE|APELLIDOS,?\s*NOMBRE)[:\s]+([A-ZÁÉÍÓÚÑÜ\s,]+?)(?:\n|$|FECHA|NACIMIENTO)/i,
      /(?:NOMBRE)[:\s]+([A-ZÁÉÍÓÚÑÜ\s,]+?)(?:\n|$|APELLIDOS|FECHA)/i,
      /([A-ZÁÉÍÓÚÑÜ]{2,}\s+[A-ZÁÉÍÓÚÑÜ]{2,}(?:\s+[A-ZÁÉÍÓÚÑÜ]{2,})*)/
    ];
    
    for (const pattern of namePatterns) {
      const nameMatch = text.match(pattern);
      if (nameMatch && nameMatch[1]) {
        data.fullName = this.cleanSpanishName(nameMatch[1]);
        break;
      }
    }
    
    // Enhanced date of birth extraction
    const dobPatterns = [
      /(?:NACIMIENTO|FECHA DE NACIMIENTO|NACIDO)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i,
      /(?:BORN|BIRTH)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i
    ];
    
    for (const pattern of dobPatterns) {
      const dobMatch = text.match(pattern);
      if (dobMatch) {
        data.dateOfBirth = this.standardizeDate(dobMatch[1]);
        break;
      }
    }
    
    // Enhanced nationality extraction
    const nationalityPatterns = [
      /(?:NACIONALIDAD)[:\s]+([A-ZÁÉÍÓÚÑÜ]+)/i,
      /(?:NATIONALITY)[:\s]+([A-ZÁÉÍÓÚÑÜ]+)/i,
      /(?:ESP|ESPAÑA|SPANISH)/i
    ];
    
    for (const pattern of nationalityPatterns) {
      const nationalityMatch = text.match(pattern);
      if (nationalityMatch) {
        data.nationality = nationalityMatch[1] === 'ESP' ? 'ESPAÑOLA' : nationalityMatch[1].trim();
        break;
      }
    }
    
    // Sex extraction
    const sexMatch = text.match(/(?:SEXO)[:\s]+([MF])/i);
    if (sexMatch) {
      data.sex = sexMatch[1];
    }
    
    // Enhanced expiry date extraction
    const expiryPatterns = [
      /(?:VÁLIDO HASTA|VÁLIDA HASTA|EXPIRY|EXPIRES)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i,
      /(?:CADUCIDAD)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i
    ];
    
    for (const pattern of expiryPatterns) {
      const expiryMatch = text.match(pattern);
      if (expiryMatch) {
        data.expiryDate = this.standardizeDate(expiryMatch[1]);
        break;
      }
    }
    
    // Extract place of birth if available
    const pobMatch = text.match(/(?:LUGAR DE NACIMIENTO|NACIDO EN)[:\s]+([A-ZÁÉÍÓÚÑÜ\s,]+)/i);
    if (pobMatch) {
      data.placeOfBirth = pobMatch[1].trim();
    }
    
    return data as DNIData;
  }

  /**
   * Validate Spanish DNI checksum
   */
  private validateDNI(dni: string): boolean {
    if (!/^\d{8}[A-Z]$/.test(dni)) return false;
    
    const letters = 'TRWAGMYFPDXBNJZSQVHLCKE';
    const number = parseInt(dni.substring(0, 8), 10);
    const letter = dni.charAt(8);
    
    return letters.charAt(number % 23) === letter;
  }

  /**
   * Clean and standardize Spanish names
   */
  private cleanSpanishName(name: string): string {
    return name
      .replace(/,/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(part => part.length > 1)
      .join(' '); // Keep original case for Spanish names
  }

  /**
   * Standardize date format to DD/MM/YYYY
   */
  private standardizeDate(dateStr: string): string {
    const cleaned = dateStr.replace(/[-]/g, '/');
    const parts = cleaned.split('/');
    
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${day}/${month}/${year}`;
    }
    
    return dateStr;
  }

  /**
   * Extract NIE/TIE specific data with enhanced validation
   */
  private extractNIETIEData(text: string): NIETIEData {
    const data: Partial<NIETIEData> = {};
    
    // Enhanced NIE number pattern with validation
    const nieMatches = text.match(/\b([XY]\d{7}[A-Z])\b/g);
    if (nieMatches) {
      // Validate NIE checksum
      for (const nie of nieMatches) {
        if (this.validateNIE(nie)) {
          data.nieNumber = nie;
          data.documentNumber = nie;
          break;
        }
      }
    }
    
    // Enhanced card type determination
    if (text.includes('TARJETA DE IDENTIDAD DE EXTRANJERO') || text.includes('TIE')) {
      data.cardType = 'TIE';
    } else if (text.includes('NÚMERO DE IDENTIDAD DE EXTRANJERO') || text.includes('NIE')) {
      data.cardType = 'NIE';
    } else {
      // Default based on document structure
      data.cardType = text.includes('TARJETA') ? 'TIE' : 'NIE';
    }
    
    // Enhanced name extraction
    const namePatterns = [
      /(?:APELLIDOS Y NOMBRE|APELLIDOS,?\s*NOMBRE)[:\s]+([A-ZÁÉÍÓÚÑÜ\s,]+?)(?:\n|$|FECHA|NACIMIENTO)/i,
      /(?:SURNAME.*NAME|NAME)[:\s]+([A-ZÁÉÍÓÚÑÜ\s,]+?)(?:\n|$|BIRTH|DATE)/i
    ];
    
    for (const pattern of namePatterns) {
      const nameMatch = text.match(pattern);
      if (nameMatch && nameMatch[1]) {
        data.fullName = this.cleanSpanishName(nameMatch[1]);
        break;
      }
    }
    
    // Enhanced date of birth extraction
    const dobPatterns = [
      /(?:NACIMIENTO|FECHA DE NACIMIENTO|BIRTH)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i,
      /(?:BORN)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i
    ];
    
    for (const pattern of dobPatterns) {
      const dobMatch = text.match(pattern);
      if (dobMatch) {
        data.dateOfBirth = this.standardizeDate(dobMatch[1]);
        break;
      }
    }
    
    // Enhanced nationality extraction with common country codes
    const nationalityPatterns = [
      /(?:NACIONALIDAD|NATIONALITY)[:\s]+([A-ZÁÉÍÓÚÑÜ]+)/i,
      /(?:PAÍS|COUNTRY)[:\s]+([A-ZÁÉÍÓÚÑÜ]+)/i
    ];
    
    for (const pattern of nationalityPatterns) {
      const nationalityMatch = text.match(pattern);
      if (nationalityMatch) {
        data.nationality = this.standardizeNationality(nationalityMatch[1].trim());
        break;
      }
    }
    
    // Enhanced expiry date extraction
    const expiryPatterns = [
      /(?:VÁLIDO HASTA|VÁLIDA HASTA|EXPIRY|EXPIRES)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i,
      /(?:CADUCIDAD|VALID UNTIL)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i
    ];
    
    for (const pattern of expiryPatterns) {
      const expiryMatch = text.match(pattern);
      if (expiryMatch) {
        data.expiryDate = this.standardizeDate(expiryMatch[1]);
        break;
      }
    }
    
    return data as NIETIEData;
  }

  /**
   * Validate Spanish NIE checksum
   */
  private validateNIE(nie: string): boolean {
    if (!/^[XY]\d{7}[A-Z]$/.test(nie)) return false;
    
    const letters = 'TRWAGMYFPDXBNJZSQVHLCKE';
    const digits = nie.substring(1, 8);
    
    // Convert X/Y to numbers for checksum calculation
    let number: string;
    if (nie.charAt(0) === 'X') {
      number = '0' + digits;
    } else if (nie.charAt(0) === 'Y') {
      number = '1' + digits;
    } else {
      return false;
    }
    
    const numValue = parseInt(number, 10);
    const letter = nie.charAt(8);
    const expectedLetter = letters.charAt(numValue % 23);
    
    return letter === expectedLetter;
  }

  /**
   * Standardize nationality names
   */
  private standardizeNationality(nationality: string): string {
    const nationalityMap: Record<string, string> = {
      'USA': 'ESTADOUNIDENSE',
      'UK': 'BRITÁNICA',
      'GBR': 'BRITÁNICA',
      'FRA': 'FRANCESA',
      'DEU': 'ALEMANA',
      'ITA': 'ITALIANA',
      'PRT': 'PORTUGUESA',
      'MAR': 'MARROQUÍ',
      'ARG': 'ARGENTINA',
      'COL': 'COLOMBIANA',
      'VEN': 'VENEZOLANA',
      'BRA': 'BRASILEÑA'
    };
    
    const upper = nationality.toUpperCase();
    return nationalityMap[upper] || nationality;
  }

  /**
   * Extract passport specific data
   */
  private extractPassportData(text: string): PassportData {
    const data: Partial<PassportData> = {};
    
    // Passport number pattern
    const passportMatch = text.match(/\b([A-Z]{3}\d{6})\b/);
    if (passportMatch) {
      data.passportNumber = passportMatch[1];
      data.documentNumber = passportMatch[1];
    }
    
    // Name extraction
    const nameMatch = text.match(/(?:APELLIDOS Y NOMBRE|SURNAME|NAME)[:\s]+([A-ZÁÉÍÓÚÑ\s]+)/i);
    if (nameMatch) {
      data.fullName = nameMatch[1].trim();
    }
    
    // Date of birth
    const dobMatch = text.match(/(?:FECHA DE NACIMIENTO|DATE OF BIRTH)[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i);
    if (dobMatch) {
      data.dateOfBirth = dobMatch[1];
    }
    
    // Place of birth
    const pobMatch = text.match(/(?:LUGAR DE NACIMIENTO|PLACE OF BIRTH)[:\s]+([A-ZÁÉÍÓÚÑ\s,]+)/i);
    if (pobMatch) {
      data.placeOfBirth = pobMatch[1].trim();
    }
    
    // Nationality
    const nationalityMatch = text.match(/(?:NACIONALIDAD|NATIONALITY)[:\s]+([A-ZÁÉÍÓÚÑ]+)/i);
    if (nationalityMatch) {
      data.nationality = nationalityMatch[1].trim();
    }
    
    // Issue date
    const issueMatch = text.match(/(?:FECHA DE EXPEDICIÓN|DATE OF ISSUE)[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i);
    if (issueMatch) {
      data.issueDate = issueMatch[1];
    }
    
    // Expiry date
    const expiryMatch = text.match(/(?:FECHA DE CADUCIDAD|DATE OF EXPIRY)[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i);
    if (expiryMatch) {
      data.expiryDate = expiryMatch[1];
    }
    
    return data as PassportData;
  }

  /**
   * Extract Modelo 303 tax form data
   */
  private extractModelo303Data(text: string): Modelo303Data {
    const data: Partial<Modelo303Data> = {};
    
    // Tax period
    const periodMatch = text.match(/(?:PERÍODO|TRIMESTRE)[:\s]+(\d{1}T\d{4}|\d{2}\/\d{4})/i);
    if (periodMatch) {
      data.taxPeriod = periodMatch[1];
    }
    
    // NIF
    const nifMatch = text.match(/(?:NIF)[:\s]+([A-Z]?\d{8}[A-Z]?)/i);
    if (nifMatch) {
      data.nif = nifMatch[1];
    }
    
    // VAT amounts (simplified extraction)
    const vatBaseMatch = text.match(/(?:BASE IMPONIBLE)[:\s]+(\d+[,.]?\d*)/i);
    if (vatBaseMatch) {
      data.vatBase = parseFloat(vatBaseMatch[1].replace(',', '.'));
    }
    
    const vatAmountMatch = text.match(/(?:CUOTA)[:\s]+(\d+[,.]?\d*)/i);
    if (vatAmountMatch) {
      data.vatAmount = parseFloat(vatAmountMatch[1].replace(',', '.'));
    }
    
    return data as Modelo303Data;
  }

  /**
   * Extract generic document data
   */
  private extractGenericData(text: string): ExtractedDocumentData {
    const data: ExtractedDocumentData = {};
    
    // Extract dates
    const dates = text.match(/\d{1,2}\/\d{1,2}\/\d{4}/g);
    if (dates && dates.length > 0) {
      data.dates = dates;
    }
    
    // Extract numbers that might be document numbers
    const numbers = text.match(/\b\d{6,}\b/g);
    if (numbers && numbers.length > 0) {
      data.numbers = numbers;
    }
    
    return data;
  }

  /**
   * Calculate overall confidence score
   */
  private calculateOverallConfidence(blocks: OCRBlock[]): number {
    if (blocks.length === 0) return 0;
    
    const totalConfidence = blocks.reduce((sum, block) => sum + block.confidence, 0);
    return totalConfidence / blocks.length;
  }

  /**
   * Validate extracted data quality with comprehensive checks
   */
  validateExtractionQuality(result: OCRResult, documentType: DocumentTypeEnum): {
    isValid: boolean;
    errors: ProcessingError[];
    warnings: string[];
  } {
    const errors: ProcessingError[] = [];
    const warnings: string[] = [];
    
    // Check minimum confidence for Spanish documents (≥95% target)
    if (result.confidence < 0.7) {
      warnings.push(`Low OCR confidence: ${(result.confidence * 100).toFixed(1)}%`);
    }
    
    if (result.confidence < 0.5) {
      errors.push({
        code: 'CONFIDENCE_TOO_LOW',
        message: `OCR confidence ${(result.confidence * 100).toFixed(1)}% is below minimum threshold`,
        timestamp: new Date()
      });
    }
    
    // Document-specific validation
    switch (documentType) {
      case DocumentTypeEnum.DNI:
        this.validateDNIExtraction(result.extractedData, errors, warnings);
        break;
        
      case DocumentTypeEnum.NIE_TIE:
        this.validateNIETIEExtraction(result.extractedData, errors, warnings);
        break;
        
      case DocumentTypeEnum.PASSPORT:
        this.validatePassportExtraction(result.extractedData, errors, warnings);
        break;
        
      case DocumentTypeEnum.MODELO_303:
        this.validateModelo303Extraction(result.extractedData, errors, warnings);
        break;
    }
    
    // General data quality checks
    this.validateGeneralDataQuality(result, errors, warnings);
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate extracted data against document template
   */
  async validateAgainstTemplate(result: OCRResult, documentType: DocumentTypeEnum): Promise<{
    isValid: boolean;
    score: number;
    errors: ProcessingError[];
    warnings: string[];
    templateValidation: any;
  }> {
    try {
      const templateValidation = await this.templateValidator.validateAgainstTemplate(
        result.extractedData,
        documentType,
        result.confidence
      );

      return {
        isValid: templateValidation.isValid,
        score: templateValidation.score,
        errors: templateValidation.errors,
        warnings: templateValidation.warnings,
        templateValidation
      };
    } catch (error) {
      return {
        isValid: false,
        score: 0,
        errors: [{
          code: 'TEMPLATE_VALIDATION_FAILED',
          message: `Template validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date()
        }],
        warnings: [],
        templateValidation: null
      };
    }
  }

  /**
   * Validate DNI extraction quality
   */
  private validateDNIExtraction(data: ExtractedDocumentData, errors: ProcessingError[], warnings: string[]): void {
    if (!data.documentNumber) {
      errors.push({
        code: 'MISSING_DNI_NUMBER',
        message: 'DNI number not found in document',
        timestamp: new Date()
      });
    } else if (!this.validateDNI(data.documentNumber)) {
      errors.push({
        code: 'INVALID_DNI_CHECKSUM',
        message: `DNI number ${data.documentNumber} has invalid checksum`,
        timestamp: new Date()
      });
    }
    
    if (!data.fullName || data.fullName.length < 3) {
      warnings.push('Full name not found or too short');
    }
    
    if (!data.dateOfBirth) {
      warnings.push('Date of birth not found');
    } else if (!this.isValidDate(data.dateOfBirth)) {
      warnings.push(`Invalid date format: ${data.dateOfBirth}`);
    }
    
    if (!data.nationality) {
      warnings.push('Nationality not found');
    }
  }

  /**
   * Validate NIE/TIE extraction quality
   */
  private validateNIETIEExtraction(data: ExtractedDocumentData, errors: ProcessingError[], warnings: string[]): void {
    if (!data.documentNumber) {
      errors.push({
        code: 'MISSING_NIE_NUMBER',
        message: 'NIE number not found in document',
        timestamp: new Date()
      });
    } else if (!this.validateNIE(data.documentNumber)) {
      errors.push({
        code: 'INVALID_NIE_CHECKSUM',
        message: `NIE number ${data.documentNumber} has invalid checksum`,
        timestamp: new Date()
      });
    }
    
    if (!data.fullName || data.fullName.length < 3) {
      warnings.push('Full name not found or too short');
    }
    
    if (!data.dateOfBirth) {
      warnings.push('Date of birth not found');
    } else if (!this.isValidDate(data.dateOfBirth)) {
      warnings.push(`Invalid date format: ${data.dateOfBirth}`);
    }
    
    if (!data.nationality) {
      warnings.push('Nationality not found');
    }
    
    if (!data.expiryDate) {
      warnings.push('Expiry date not found');
    } else if (!this.isValidDate(data.expiryDate)) {
      warnings.push(`Invalid expiry date format: ${data.expiryDate}`);
    }
  }

  /**
   * Validate passport extraction quality
   */
  private validatePassportExtraction(data: ExtractedDocumentData, errors: ProcessingError[], warnings: string[]): void {
    if (!data.documentNumber) {
      errors.push({
        code: 'MISSING_PASSPORT_NUMBER',
        message: 'Passport number not found in document',
        timestamp: new Date()
      });
    }
    
    if (!data.fullName || data.fullName.length < 3) {
      warnings.push('Full name not found or too short');
    }
    
    if (!data.dateOfBirth) {
      warnings.push('Date of birth not found');
    }
    
    if (!data.nationality) {
      warnings.push('Nationality not found');
    }
    
    if (!data.expiryDate) {
      warnings.push('Expiry date not found');
    }
  }

  /**
   * Validate Modelo 303 extraction quality
   */
  private validateModelo303Extraction(data: ExtractedDocumentData, errors: ProcessingError[], warnings: string[]): void {
    if (!data.taxPeriod) {
      warnings.push('Tax period not found');
    }
    
    if (!data.nif) {
      errors.push({
        code: 'MISSING_NIF',
        message: 'NIF not found in Modelo 303',
        timestamp: new Date()
      });
    }
    
    if (data.vatAmount === undefined || data.vatAmount === null) {
      warnings.push('VAT amount not found');
    }
    
    if (data.vatBase === undefined || data.vatBase === null) {
      warnings.push('VAT base not found');
    }
  }

  /**
   * Validate general data quality
   */
  private validateGeneralDataQuality(result: OCRResult, errors: ProcessingError[], warnings: string[]): void {
    // Check if text is too short (might indicate poor OCR)
    if (result.text.length < 50) {
      warnings.push('Extracted text is very short, OCR quality may be poor');
    }
    
    // Check for excessive special characters (OCR artifacts)
    const specialCharRatio = (result.text.match(/[^a-zA-Z0-9\sáéíóúüñÁÉÍÓÚÜÑ]/g) || []).length / result.text.length;
    if (specialCharRatio > 0.3) {
      warnings.push('High ratio of special characters detected, may indicate OCR artifacts');
    }
    
    // Check block confidence distribution
    if (result.blocks.length > 0) {
      const lowConfidenceBlocks = result.blocks.filter(block => block.confidence < 0.6).length;
      const lowConfidenceRatio = lowConfidenceBlocks / result.blocks.length;
      
      if (lowConfidenceRatio > 0.5) {
        warnings.push(`${Math.round(lowConfidenceRatio * 100)}% of text blocks have low confidence`);
      }
    }
  }

  /**
   * Validate date format and reasonableness
   */
  private isValidDate(dateStr: string): boolean {
    const dateRegex = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
    if (!dateRegex.test(dateStr)) return false;
    
    const [day, month, year] = dateStr.split('/').map(Number);
    const date = new Date(year, month - 1, day);
    
    // Check if date is valid and reasonable
    return date.getFullYear() === year &&
           date.getMonth() === month - 1 &&
           date.getDate() === day &&
           year >= 1900 &&
           year <= new Date().getFullYear() + 10;
  }
}