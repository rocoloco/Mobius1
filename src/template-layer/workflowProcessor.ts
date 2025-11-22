/**
 * Workflow Processor - Spanish Administrative Workflow Processing
 * 
 * Handles end-to-end processing of Spanish administrative workflows
 * including Modelo 303 VAT returns and NIE/TIE applications with
 * validation, form generation, and completeness checking.
 * 
 * Requirements: FR-006, FR-010
 */

import { FormGenerator, FormGenerationResult } from './formGenerator.js';
import { TemplateManager } from './templateManager.js';
import { WorkflowEngine } from './workflowEngine.js';
import { 
  WorkflowTemplate, 
  Modelo303Data, 
  NIETIEApplicationData,
  ExecutionContext,
  WorkflowExecutionError
} from './types.js';

export interface WorkflowProcessingResult {
  success: boolean;
  workflowId: string;
  formData?: Record<string, any>;
  validationErrors: string[];
  completenessScore: number;
  recommendations: string[];
  generatedDocuments: string[];
  processingTime: number;
  nextSteps: string[];
}

export interface ProcessingOptions {
  validateOnly?: boolean;
  generateForms?: boolean;
  includeRecommendations?: boolean;
  skipOptionalSteps?: boolean;
}

export class WorkflowProcessor {
  constructor(
    private templateManager: TemplateManager,
    private workflowEngine: WorkflowEngine
  ) {}

  /**
   * Process Modelo 303 VAT return workflow
   */
  async processModelo303(
    workspaceId: string,
    userId: string,
    data: any, // Accept any data format for flexibility
    options: ProcessingOptions = {}
  ): Promise<WorkflowProcessingResult> {
    const startTime = Date.now();
    const workflowId = `modelo-303-${Date.now()}`;

    try {
      // Validate input data
      const template = this.templateManager.getTemplate('modelo-303-vat-return');
      if (!template) {
        throw new WorkflowExecutionError('Modelo 303 template not found', 'TEMPLATE_NOT_FOUND');
      }

      const validationResult = await this.templateManager.validateTemplateData(
        'modelo-303-vat-return',
        data
      );

      if (!validationResult.isValid) {
        return {
          success: false,
          workflowId,
          validationErrors: validationResult.errors.map(e => e.message),
          completenessScore: validationResult.score,
          recommendations: [],
          generatedDocuments: [],
          processingTime: Date.now() - startTime,
          nextSteps: ['Corrija los errores de validación antes de continuar']
        };
      }

      // Generate form if requested
      let formGenerationResult: FormGenerationResult | undefined;
      if (options.generateForms !== false) {
        // Map template data to form generator format
        const formData: Modelo303Data = {
          nif: data.companyNIF || data.nif,
          companyName: data.companyName,
          taxPeriod: data.taxPeriod,
          vatBase: data.totalSales || data.vatBase,
          vatRate: data.vatRate || 0.21,
          vatAmount: data.vatAmount || (data.totalSales || data.vatBase) * (data.vatRate || 0.21),
          deductibleVAT: data.inputVAT || data.deductibleVAT,
          netVATAmount: data.netVATAmount || ((data.vatAmount || (data.totalSales || data.vatBase) * (data.vatRate || 0.21)) - (data.inputVAT || data.deductibleVAT)),
          economicActivity: data.economicActivity,
          paymentMethod: data.paymentMethod || 'bank_transfer',
          preparationDate: data.preparationDate,
          submissionDeadline: data.submissionDeadline
        };

        formGenerationResult = FormGenerator.generateModelo303(formData);
        
        if (!formGenerationResult.success) {
          return {
            success: false,
            workflowId,
            validationErrors: formGenerationResult.validationErrors,
            completenessScore: formGenerationResult.completenessScore,
            recommendations: [],
            generatedDocuments: [],
            processingTime: Date.now() - startTime,
            nextSteps: ['Corrija los datos del formulario antes de continuar']
          };
        }
      }

      // Return early if validation only
      if (options.validateOnly) {
        return {
          success: true,
          workflowId,
          formData: formGenerationResult?.formData,
          validationErrors: [],
          completenessScore: formGenerationResult?.completenessScore || 1.0,
          recommendations: this.getModelo303Recommendations(data),
          generatedDocuments: [
            'modelo_303_form.pdf',
            'vat_calculation_summary.pdf',
            'submission_package.zip'
          ],
          processingTime: Date.now() - startTime,
          nextSteps: ['Los datos son válidos. Proceda con la generación del formulario.']
        };
      }

      // Execute workflow
      const execution = await this.workflowEngine.startExecution(
        'modelo-303-vat-return',
        workspaceId,
        userId,
        data,
        workflowId
      );

      // Wait for workflow completion (simplified for demo)
      await this.waitForWorkflowCompletion(execution.id, 30000); // 30 second timeout

      const completedExecution = await this.workflowEngine.getExecution(execution.id);
      
      if (!completedExecution || completedExecution.status !== 'COMPLETED') {
        throw new WorkflowExecutionError(
          'Workflow execution failed or timed out',
          'EXECUTION_FAILED'
        );
      }

      // Generate completeness check
      const completenessCheck = FormGenerator.validateFormCompleteness(
        formGenerationResult?.formData || {},
        'modelo_303'
      );

      return {
        success: true,
        workflowId,
        formData: formGenerationResult?.formData,
        validationErrors: [],
        completenessScore: completenessCheck.completenessScore,
        recommendations: [
          ...this.getModelo303Recommendations(data),
          ...completenessCheck.recommendations
        ],
        generatedDocuments: [
          'modelo_303_form.pdf',
          'vat_calculation_summary.pdf',
          'submission_package.zip'
        ],
        processingTime: Date.now() - startTime,
        nextSteps: this.getModelo303NextSteps(data, completenessCheck.isComplete)
      };

    } catch (error) {
      return {
        success: false,
        workflowId,
        validationErrors: [error instanceof Error ? error.message : 'Unknown error'],
        completenessScore: 0,
        recommendations: [],
        generatedDocuments: [],
        processingTime: Date.now() - startTime,
        nextSteps: ['Revise los errores y vuelva a intentar el procesamiento']
      };
    }
  }

  /**
   * Process NIE/TIE application workflow
   */
  async processNIETIEApplication(
    workspaceId: string,
    userId: string,
    data: any, // Accept any data format for flexibility
    options: ProcessingOptions = {}
  ): Promise<WorkflowProcessingResult> {
    const startTime = Date.now();
    const workflowId = `nie-tie-${Date.now()}`;

    try {
      // Validate input data
      const template = this.templateManager.getTemplate('nie-tie-application');
      if (!template) {
        throw new WorkflowExecutionError('NIE/TIE template not found', 'TEMPLATE_NOT_FOUND');
      }

      const validationResult = await this.templateManager.validateTemplateData(
        'nie-tie-application',
        data
      );

      if (!validationResult.isValid) {
        return {
          success: false,
          workflowId,
          validationErrors: validationResult.errors.map(e => e.message),
          completenessScore: validationResult.score,
          recommendations: [],
          generatedDocuments: [],
          processingTime: Date.now() - startTime,
          nextSteps: ['Corrija los errores de validación antes de continuar']
        };
      }

      // Generate form if requested
      let formGenerationResult: FormGenerationResult | undefined;
      if (options.generateForms !== false) {
        // Map template data to form generator format
        const formData: NIETIEApplicationData = {
          fullName: data.applicantName || data.fullName,
          dateOfBirth: data.birthDate || data.dateOfBirth,
          placeOfBirth: data.placeOfBirth,
          nationality: data.nationality,
          passportNumber: data.passportNumber,
          applicationType: data.applicationType,
          reasonForApplication: data.applicationReason || data.reasonForApplication,
          intendedStayDuration: data.intendedStayDuration,
          currentAddress: data.currentAddress,
          spanishAddress: data.spanishAddress,
          supportingDocuments: data.supportingDocuments || [],
          appointmentOffice: data.appointmentOffice,
          preferredAppointmentDate: data.preferredAppointmentDate
        };

        formGenerationResult = FormGenerator.generateNIETIEApplication(formData);
        
        if (!formGenerationResult.success) {
          return {
            success: false,
            workflowId,
            validationErrors: formGenerationResult.validationErrors,
            completenessScore: formGenerationResult.completenessScore,
            recommendations: [],
            generatedDocuments: [],
            processingTime: Date.now() - startTime,
            nextSteps: ['Corrija los datos de la solicitud antes de continuar']
          };
        }
      }

      // Return early if validation only
      if (options.validateOnly) {
        const applicationType = data.applicationType || 'nie';
        return {
          success: true,
          workflowId,
          formData: formGenerationResult?.formData,
          validationErrors: [],
          completenessScore: formGenerationResult?.completenessScore || 1.0,
          recommendations: this.getNIETIERecommendations(data),
          generatedDocuments: this.getNIETIEGeneratedDocuments(applicationType),
          processingTime: Date.now() - startTime,
          nextSteps: ['Los datos son válidos. Proceda con la generación de la solicitud.']
        };
      }

      // Execute workflow
      const execution = await this.workflowEngine.startExecution(
        'nie-tie-application',
        workspaceId,
        userId,
        data,
        workflowId
      );

      // Wait for workflow completion (simplified for demo)
      await this.waitForWorkflowCompletion(execution.id, 45000); // 45 second timeout

      const completedExecution = await this.workflowEngine.getExecution(execution.id);
      
      if (!completedExecution || completedExecution.status !== 'COMPLETED') {
        throw new WorkflowExecutionError(
          'Workflow execution failed or timed out',
          'EXECUTION_FAILED'
        );
      }

      // Generate completeness check
      const completenessCheck = FormGenerator.validateFormCompleteness(
        formGenerationResult?.formData || {},
        'nie_tie_application'
      );

      return {
        success: true,
        workflowId,
        formData: formGenerationResult?.formData,
        validationErrors: [],
        completenessScore: completenessCheck.completenessScore,
        recommendations: [
          ...this.getNIETIERecommendations(data),
          ...completenessCheck.recommendations
        ],
        generatedDocuments: this.getNIETIEGeneratedDocuments(data.applicationType),
        processingTime: Date.now() - startTime,
        nextSteps: this.getNIETIENextSteps(data, completenessCheck.isComplete)
      };

    } catch (error) {
      return {
        success: false,
        workflowId,
        validationErrors: [error instanceof Error ? error.message : 'Unknown error'],
        completenessScore: 0,
        recommendations: [],
        generatedDocuments: [],
        processingTime: Date.now() - startTime,
        nextSteps: ['Revise los errores y vuelva a intentar el procesamiento']
      };
    }
  }

  /**
   * Get processing recommendations for Modelo 303
   */
  private getModelo303Recommendations(data: any): string[] {
    const recommendations: string[] = [];

    // Calculate VAT amounts for recommendations
    const vatBase = data.totalSales || data.vatBase || 0;
    const vatRate = data.vatRate || 0.21;
    const vatAmount = data.vatAmount || (vatBase * vatRate);
    const deductibleVAT = data.inputVAT || data.deductibleVAT || 0;
    const netVATAmount = data.netVATAmount || (vatAmount - deductibleVAT);

    // VAT amount recommendations
    if (netVATAmount > 3000) {
      recommendations.push('Considere realizar pagos fraccionados para importes superiores a 3.000€');
    }

    if (netVATAmount < 0) {
      recommendations.push('Importe negativo: solicite devolución o compense en próximas declaraciones');
    }

    // Payment method recommendations
    if (!data.paymentMethod) {
      recommendations.push('Especifique el método de pago preferido (transferencia o domiciliación)');
    }

    // Economic activity recommendations
    if (!data.economicActivity) {
      recommendations.push('Incluya el código CNAE de actividad económica para mayor precisión');
    }

    // Deadline recommendations
    if (data.submissionDeadline) {
      const deadline = new Date(data.submissionDeadline);
      const now = new Date();
      const daysUntilDeadline = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilDeadline <= 5) {
        recommendations.push('¡URGENTE! Quedan menos de 5 días para la fecha límite de presentación');
      } else if (daysUntilDeadline <= 15) {
        recommendations.push('Quedan menos de 15 días para la presentación. Planifique la presentación pronto');
      }
    } else {
      // Calculate deadline from tax period if not provided
      const taxPeriod = data.taxPeriod;
      if (taxPeriod) {
        const [year, month] = taxPeriod.split('-').map(Number);
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        
        // Check if we're close to the deadline for this period
        if (currentYear === year && currentMonth >= month + 1) {
          recommendations.push('¡URGENTE! El período de presentación para este trimestre puede estar próximo a vencer');
        }
      }
    }

    return recommendations;
  }

  /**
   * Get processing recommendations for NIE/TIE
   */
  private getNIETIERecommendations(data: any): string[] {
    const recommendations: string[] = [];

    // Application type specific recommendations
    if (data.applicationType === 'tie_initial' && !data.spanishAddress) {
      recommendations.push('Para TIE inicial, proporcione dirección de residencia en España');
    }

    if (data.applicationType === 'nie' && data.intendedStayDuration) {
      recommendations.push('Para NIE, especifique claramente el motivo y duración de la estancia');
    }

    // Document recommendations
    if (!data.supportingDocuments || data.supportingDocuments.length === 0) {
      recommendations.push('Prepare todos los documentos justificativos antes de la cita');
    }

    // Appointment recommendations
    if (!data.appointmentOffice) {
      recommendations.push('Seleccione la oficina de extranjería más conveniente para su cita');
    }

    // Address recommendations
    if (data.currentAddress && data.currentAddress.country === 'ES' && data.applicationType === 'nie') {
      recommendations.push('Si ya reside en España, considere solicitar TIE en lugar de NIE');
    }

    return recommendations;
  }

  /**
   * Get next steps for Modelo 303 processing
   */
  private getModelo303NextSteps(data: Modelo303Data, isComplete: boolean): string[] {
    const steps: string[] = [];

    if (isComplete) {
      steps.push('1. Revise el formulario Modelo 303 generado');
      steps.push('2. Verifique los cálculos de IVA');
      steps.push('3. Prepare el método de pago seleccionado');
      
      if (data.netVATAmount > 0) {
        steps.push('4. Realice el pago antes de la fecha límite');
        steps.push('5. Presente la declaración en la AEAT');
      } else {
        steps.push('4. Presente la declaración para solicitar devolución');
      }
      
      steps.push('6. Conserve el justificante de presentación');
    } else {
      steps.push('1. Complete los campos obligatorios faltantes');
      steps.push('2. Verifique la información de la empresa');
      steps.push('3. Revise los importes de IVA');
      steps.push('4. Vuelva a procesar el formulario');
    }

    return steps;
  }

  /**
   * Get next steps for NIE/TIE processing
   */
  private getNIETIENextSteps(data: NIETIEApplicationData, isComplete: boolean): string[] {
    const steps: string[] = [];

    if (isComplete) {
      steps.push('1. Revise la solicitud generada');
      steps.push('2. Prepare todos los documentos originales');
      steps.push('3. Solicite cita previa en la oficina de extranjería');
      steps.push('4. Pague las tasas correspondientes');
      steps.push('5. Acuda a la cita con toda la documentación');
      
      if (data.applicationType === 'tie_renewal') {
        steps.push('6. Lleve la TIE anterior para su renovación');
      }
    } else {
      steps.push('1. Complete la información personal faltante');
      steps.push('2. Verifique los datos del pasaporte');
      steps.push('3. Especifique claramente el motivo de la solicitud');
      steps.push('4. Vuelva a procesar la solicitud');
    }

    return steps;
  }

  /**
   * Get generated documents for NIE/TIE application
   */
  private getNIETIEGeneratedDocuments(applicationType: string): string[] {
    const baseDocuments = [
      'solicitud_cumplimentada.pdf',
      'checklist_documentos.pdf',
      'resumen_tasas.pdf'
    ];

    switch (applicationType) {
      case 'nie':
        return [
          ...baseDocuments,
          'formulario_nie.pdf',
          'justificacion_necesidad.pdf'
        ];
      case 'tie_initial':
        return [
          ...baseDocuments,
          'formulario_tie_inicial.pdf',
          'requisitos_residencia.pdf'
        ];
      case 'tie_renewal':
        return [
          ...baseDocuments,
          'formulario_renovacion_tie.pdf',
          'documentos_renovacion.pdf'
        ];
      default:
        return baseDocuments;
    }
  }

  /**
   * Wait for workflow completion with timeout
   */
  private async waitForWorkflowCompletion(executionId: string, timeoutMs: number): Promise<void> {
    const startTime = Date.now();
    const pollInterval = 1000; // 1 second

    while (Date.now() - startTime < timeoutMs) {
      const execution = await this.workflowEngine.getExecution(executionId);
      
      if (!execution) {
        throw new WorkflowExecutionError('Execution not found', 'EXECUTION_NOT_FOUND');
      }

      if (execution.status === 'COMPLETED' || execution.status === 'FAILED' || execution.status === 'CANCELLED') {
        return;
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new WorkflowExecutionError('Workflow execution timed out', 'EXECUTION_TIMEOUT');
  }

  /**
   * Get workflow processing statistics
   */
  async getProcessingStatistics(workspaceId: string): Promise<{
    totalProcessed: number;
    successRate: number;
    averageProcessingTime: number;
    mostCommonErrors: string[];
    processingByType: Record<string, number>;
  }> {
    // This would typically query a database for actual statistics
    // For now, return mock data
    return {
      totalProcessed: 0,
      successRate: 0.95,
      averageProcessingTime: 15000, // 15 seconds
      mostCommonErrors: [
        'Datos de empresa incompletos',
        'Formato de NIF inválido',
        'Período fiscal incorrecto'
      ],
      processingByType: {
        'modelo_303': 0,
        'nie_tie_application': 0
      }
    };
  }
}