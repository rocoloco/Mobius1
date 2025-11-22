/**
 * Document Classification System
 * 
 * Classifies documents based on content analysis and pattern matching
 * Specialized for Spanish administrative documents
 */

import { DocumentTypeEnum, DocumentCategory } from '@prisma/client';
import { DocumentClassificationResult, ClassificationFeature } from './types.js';

export class DocumentClassifier {
  private readonly classificationRules: ClassificationRule[];

  constructor() {
    this.classificationRules = this.initializeClassificationRules();
  }

  /**
   * Classify document based on content and filename
   */
  async classifyDocument(
    content: string,
    filename: string,
    imageBuffer?: Buffer
  ): Promise<DocumentClassificationResult> {
    const features: ClassificationFeature[] = [];
    let bestMatch: { type: DocumentTypeEnum; category: DocumentCategory; confidence: number } = {
      type: DocumentTypeEnum.OTHER,
      category: DocumentCategory.OTHER,
      confidence: 0
    };

    // Analyze filename patterns
    const filenameFeatures = this.analyzeFilename(filename);
    features.push(...filenameFeatures);

    // Analyze text content
    const contentFeatures = this.analyzeContent(content);
    features.push(...contentFeatures);

    // Apply classification rules
    for (const rule of this.classificationRules) {
      const confidence = this.evaluateRule(rule, features, content);
      if (confidence > bestMatch.confidence) {
        bestMatch = {
          type: rule.documentType,
          category: rule.category,
          confidence
        };
      }
    }

    // Ensure minimum confidence threshold
    if (bestMatch.confidence < 0.3) {
      bestMatch = {
        type: DocumentTypeEnum.OTHER,
        category: DocumentCategory.OTHER,
        confidence: 0.1
      };
    }

    return {
      type: bestMatch.type,
      category: bestMatch.category,
      confidence: bestMatch.confidence,
      features
    };
  }

  /**
   * Analyze filename for classification hints
   */
  private analyzeFilename(filename: string): ClassificationFeature[] {
    const features: ClassificationFeature[] = [];
    const lowerFilename = filename.toLowerCase();

    // DNI patterns
    if (lowerFilename.includes('dni') || lowerFilename.includes('cedula')) {
      features.push({
        name: 'filename_dni_indicator',
        value: 'present',
        confidence: 0.8
      });
    }

    // NIE/TIE patterns
    if (lowerFilename.includes('nie') || lowerFilename.includes('tie')) {
      features.push({
        name: 'filename_nie_tie_indicator',
        value: 'present',
        confidence: 0.8
      });
    }

    // Passport patterns
    if (lowerFilename.includes('passport') || lowerFilename.includes('pasaporte')) {
      features.push({
        name: 'filename_passport_indicator',
        value: 'present',
        confidence: 0.7
      });
    }

    // Tax document patterns
    if (lowerFilename.includes('modelo') || lowerFilename.includes('303') || lowerFilename.includes('111')) {
      features.push({
        name: 'filename_tax_indicator',
        value: 'present',
        confidence: 0.9
      });
    }

    // Visa patterns
    if (lowerFilename.includes('visa') || lowerFilename.includes('visado')) {
      features.push({
        name: 'filename_visa_indicator',
        value: 'present',
        confidence: 0.8
      });
    }

    // Empadronamiento patterns
    if (lowerFilename.includes('empadron') || lowerFilename.includes('padron')) {
      features.push({
        name: 'filename_padron_indicator',
        value: 'present',
        confidence: 0.9
      });
    }

    return features;
  }

  /**
   * Analyze document content for classification
   */
  private analyzeContent(content: string): ClassificationFeature[] {
    const features: ClassificationFeature[] = [];
    const normalizedContent = content.toLowerCase().replace(/\s+/g, ' ');

    // DNI patterns
    const dniPattern = /\b\d{8}[a-z]\b/gi;
    const dniMatches = content.match(dniPattern);
    if (dniMatches && dniMatches.length > 0) {
      features.push({
        name: 'dni_number_pattern',
        value: dniMatches.length,
        confidence: 0.9
      });
    }

    // NIE patterns
    const niePattern = /\b[xy]\d{7}[a-z]\b/gi;
    const nieMatches = content.match(niePattern);
    if (nieMatches && nieMatches.length > 0) {
      features.push({
        name: 'nie_number_pattern',
        value: nieMatches.length,
        confidence: 0.9
      });
    }

    // Spanish passport patterns
    const passportPattern = /\b[a-z]{3}\d{6}\b/gi;
    const passportMatches = content.match(passportPattern);
    if (passportMatches && passportMatches.length > 0) {
      features.push({
        name: 'passport_number_pattern',
        value: passportMatches.length,
        confidence: 0.7
      });
    }

    // Tax form indicators
    if (normalizedContent.includes('modelo 303') || normalizedContent.includes('iva trimestral')) {
      features.push({
        name: 'modelo_303_indicator',
        value: 'present',
        confidence: 0.95
      });
    }

    if (normalizedContent.includes('modelo 111') || normalizedContent.includes('retenciones')) {
      features.push({
        name: 'modelo_111_indicator',
        value: 'present',
        confidence: 0.95
      });
    }

    // Government document indicators
    if (normalizedContent.includes('ministerio') || normalizedContent.includes('gobierno de españa')) {
      features.push({
        name: 'government_document',
        value: 'present',
        confidence: 0.8
      });
    }

    // Date patterns (Spanish format)
    const datePattern = /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g;
    const dateMatches = content.match(datePattern);
    if (dateMatches && dateMatches.length > 0) {
      features.push({
        name: 'date_patterns',
        value: dateMatches.length,
        confidence: 0.5
      });
    }

    // Address patterns
    if (normalizedContent.includes('calle') || normalizedContent.includes('avenida') || 
        normalizedContent.includes('plaza') || normalizedContent.includes('código postal')) {
      features.push({
        name: 'address_indicators',
        value: 'present',
        confidence: 0.6
      });
    }

    return features;
  }

  /**
   * Evaluate classification rule against features
   */
  private evaluateRule(rule: ClassificationRule, features: ClassificationFeature[], content: string): number {
    let score = 0;
    let maxScore = 0;

    for (const condition of rule.conditions) {
      maxScore += condition.weight;
      
      const matchingFeatures = features.filter(f => f.name === condition.featureName);
      
      for (const feature of matchingFeatures) {
        if (this.matchesCondition(feature, condition)) {
          score += condition.weight * feature.confidence;
        }
      }
    }

    // Apply content-specific rules
    for (const pattern of rule.contentPatterns) {
      maxScore += pattern.weight;
      if (pattern.regex.test(content)) {
        score += pattern.weight;
      }
    }

    return maxScore > 0 ? Math.min(score / maxScore, 1.0) : 0;
  }

  /**
   * Check if feature matches condition
   */
  private matchesCondition(feature: ClassificationFeature, condition: ClassificationCondition): boolean {
    switch (condition.operator) {
      case 'equals':
        return feature.value === condition.value;
      case 'contains':
        return String(feature.value).includes(String(condition.value));
      case 'greater_than':
        return Number(feature.value) > Number(condition.value);
      case 'exists':
        return feature.value !== null && feature.value !== undefined;
      default:
        return false;
    }
  }

  /**
   * Initialize classification rules for Spanish documents
   */
  private initializeClassificationRules(): ClassificationRule[] {
    return [
      // DNI Classification
      {
        documentType: DocumentTypeEnum.DNI,
        category: DocumentCategory.IDENTITY,
        conditions: [
          {
            featureName: 'filename_dni_indicator',
            operator: 'equals',
            value: 'present',
            weight: 0.3
          },
          {
            featureName: 'dni_number_pattern',
            operator: 'greater_than',
            value: 0,
            weight: 0.4
          }
        ],
        contentPatterns: [
          {
            regex: /documento nacional de identidad/i,
            weight: 0.3
          }
        ]
      },

      // NIE/TIE Classification
      {
        documentType: DocumentTypeEnum.NIE_TIE,
        category: DocumentCategory.IDENTITY,
        conditions: [
          {
            featureName: 'filename_nie_tie_indicator',
            operator: 'equals',
            value: 'present',
            weight: 0.3
          },
          {
            featureName: 'nie_number_pattern',
            operator: 'greater_than',
            value: 0,
            weight: 0.4
          }
        ],
        contentPatterns: [
          {
            regex: /tarjeta de identidad de extranjero|número de identidad de extranjero/i,
            weight: 0.3
          }
        ]
      },

      // Passport Classification
      {
        documentType: DocumentTypeEnum.PASSPORT,
        category: DocumentCategory.IDENTITY,
        conditions: [
          {
            featureName: 'filename_passport_indicator',
            operator: 'equals',
            value: 'present',
            weight: 0.3
          },
          {
            featureName: 'passport_number_pattern',
            operator: 'greater_than',
            value: 0,
            weight: 0.3
          }
        ],
        contentPatterns: [
          {
            regex: /pasaporte|passport/i,
            weight: 0.4
          }
        ]
      },

      // Modelo 303 Classification
      {
        documentType: DocumentTypeEnum.MODELO_303,
        category: DocumentCategory.TAX,
        conditions: [
          {
            featureName: 'filename_tax_indicator',
            operator: 'equals',
            value: 'present',
            weight: 0.2
          },
          {
            featureName: 'modelo_303_indicator',
            operator: 'equals',
            value: 'present',
            weight: 0.5
          }
        ],
        contentPatterns: [
          {
            regex: /modelo\s*303/i,
            weight: 0.3
          }
        ]
      },

      // Empadronamiento Classification
      {
        documentType: DocumentTypeEnum.EMPADRONAMIENTO,
        category: DocumentCategory.OTHER,
        conditions: [
          {
            featureName: 'filename_padron_indicator',
            operator: 'equals',
            value: 'present',
            weight: 0.4
          }
        ],
        contentPatterns: [
          {
            regex: /certificado de empadronamiento|padrón municipal/i,
            weight: 0.6
          }
        ]
      }
    ];
  }
}

interface ClassificationRule {
  documentType: DocumentTypeEnum;
  category: DocumentCategory;
  conditions: ClassificationCondition[];
  contentPatterns: ContentPattern[];
}

interface ClassificationCondition {
  featureName: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'exists';
  value: any;
  weight: number;
}

interface ContentPattern {
  regex: RegExp;
  weight: number;
}