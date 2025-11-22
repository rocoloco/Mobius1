/**
 * Template Manager - YAML-based workflow template management
 * 
 * Handles loading, validation, and management of workflow templates
 * for Spanish administrative processes.
 */

import * as yaml from 'js-yaml';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';
import { WorkflowCategory } from '@prisma/client';
import {
    WorkflowTemplate,
    TemplateLoadResult,
    TemplateStorageConfig,
    TemplateError,
    TemplateValidationResult
} from './types.js';
import { TemplateValidator } from './templateValidator';

export class TemplateManager {
    private templates: Map<string, WorkflowTemplate> = new Map();
    private templateCache: Map<string, TemplateLoadResult> = new Map();
    private validator: TemplateValidator;
    private config: TemplateStorageConfig;

    constructor(config?: Partial<TemplateStorageConfig>) {
        this.config = {
            templatesPath: path.join(process.cwd(), 'templates', 'workflows'),
            cacheEnabled: true,
            cacheTTL: 3600, // 1 hour
            watchForChanges: false,
            ...config
        };

        this.validator = new TemplateValidator();
        this.loadTemplates();
    }

    /**
     * Load all workflow templates from the templates directory
     */
    private async loadTemplates(): Promise<void> {
        try {
            // Ensure templates directory exists
            await fs.mkdir(this.config.templatesPath, { recursive: true });

            const templateFiles = await this.findTemplateFiles();

            for (const filePath of templateFiles) {
                try {
                    await this.loadTemplate(filePath);
                } catch (error) {
                    console.warn(`Failed to load template ${filePath}:`, error);
                }
            }

            console.log(`Loaded ${this.templates.size} workflow templates`);
        } catch (error) {
            console.error('Failed to load workflow templates:', error);
            throw new TemplateError('Failed to initialize template manager', 'INIT_FAILED', { error });
        }
    }

    /**
     * Find all YAML template files in the templates directory
     */
    private async findTemplateFiles(): Promise<string[]> {
        const files: string[] = [];

        try {
            const entries = await fs.readdir(this.config.templatesPath, { withFileTypes: true });

            for (const entry of entries) {
                if (entry.isFile() && (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml'))) {
                    files.push(path.join(this.config.templatesPath, entry.name));
                } else if (entry.isDirectory()) {
                    // Recursively search subdirectories
                    const subFiles = await this.findTemplateFilesInDirectory(
                        path.join(this.config.templatesPath, entry.name)
                    );
                    files.push(...subFiles);
                }
            }
        } catch (error) {
            console.warn('Error reading templates directory:', error);
        }

        return files;
    }

    /**
     * Recursively find template files in a directory
     */
    private async findTemplateFilesInDirectory(dirPath: string): Promise<string[]> {
        const files: string[] = [];

        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);

                if (entry.isFile() && (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml'))) {
                    files.push(fullPath);
                } else if (entry.isDirectory()) {
                    const subFiles = await this.findTemplateFilesInDirectory(fullPath);
                    files.push(...subFiles);
                }
            }
        } catch (error) {
            console.warn(`Error reading directory ${dirPath}:`, error);
        }

        return files;
    }

    /**
     * Load a single template from file
     */
    private async loadTemplate(filePath: string): Promise<WorkflowTemplate> {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const checksum = createHash('sha256').update(content).digest('hex');

            // Check cache if enabled
            if (this.config.cacheEnabled) {
                const cached = this.templateCache.get(filePath);
                if (cached && cached.checksum === checksum) {
                    const age = Date.now() - cached.loadedAt.getTime();
                    if (age < this.config.cacheTTL * 1000) {
                        this.templates.set(cached.template.id, cached.template);
                        return cached.template;
                    }
                }
            }

            // Parse YAML content
            const templateData = yaml.load(content) as any;

            // Validate template structure
            const validationResult = await this.validator.validateTemplate(templateData);
            if (!validationResult.isValid) {
                throw new TemplateError(
                    `Template validation failed: ${validationResult.errors.map((e: any) => e.message).join(', ')}`,
                    'VALIDATION_FAILED',
                    { filePath, errors: validationResult.errors }
                );
            }

            // Convert to WorkflowTemplate
            const template = this.parseTemplate(templateData, filePath);

            // Store in memory
            this.templates.set(template.id, template);

            // Cache if enabled
            if (this.config.cacheEnabled) {
                this.templateCache.set(filePath, {
                    template,
                    source: 'file',
                    loadedAt: new Date(),
                    checksum
                });
            }

            return template;
        } catch (error) {
            if (error instanceof TemplateError) {
                throw error;
            }
            throw new TemplateError(
                `Failed to load template from ${filePath}`,
                'LOAD_FAILED',
                { filePath, error: error instanceof Error ? error.message : error }
            );
        }
    }

    /**
     * Parse raw template data into WorkflowTemplate
     */
    private parseTemplate(data: any, filePath: string): WorkflowTemplate {
        // Generate ID from filename if not provided
        const filename = path.basename(filePath, path.extname(filePath));
        const id = data.id || filename;

        return {
            id,
            name: data.name || filename,
            category: this.parseCategory(data.category),
            version: data.version || '1.0',
            description: data.description,
            steps: data.steps || [],
            validationSchema: data.validationSchema || {
                type: 'object',
                properties: {},
                required: [],
                additionalProperties: true
            },
            outputFormat: data.outputFormat || {
                type: 'json',
                fields: [],
                metadata: {
                    title: data.name || filename,
                    description: data.description || '',
                    version: data.version || '1.0'
                }
            },
            metadata: {
                author: data.metadata?.author || 'system',
                createdAt: data.metadata?.createdAt || new Date().toISOString(),
                updatedAt: data.metadata?.updatedAt || new Date().toISOString(),
                tags: data.metadata?.tags || [],
                regulations: data.metadata?.regulations || [],
                applicableRegions: data.metadata?.applicableRegions || ['ES']
            }
        };
    }

    /**
     * Parse category string to WorkflowCategory enum
     */
    private parseCategory(category: string): WorkflowCategory {
        const categoryMap: Record<string, WorkflowCategory> = {
            'modelo_303': WorkflowCategory.MODELO_303,
            'modelo-303': WorkflowCategory.MODELO_303,
            'vat': WorkflowCategory.MODELO_303,
            'nie_tie': WorkflowCategory.NIE_TIE,
            'nie-tie': WorkflowCategory.NIE_TIE,
            'nie': WorkflowCategory.NIE_TIE,
            'tie': WorkflowCategory.NIE_TIE,
            'visa_application': WorkflowCategory.VISA_APPLICATION,
            'visa-application': WorkflowCategory.VISA_APPLICATION,
            'visa': WorkflowCategory.VISA_APPLICATION,
            'empadronamiento': WorkflowCategory.EMPADRONAMIENTO,
            'padron': WorkflowCategory.EMPADRONAMIENTO
        };

        return categoryMap[category?.toLowerCase()] || WorkflowCategory.OTHER;
    }

    /**
     * Get template by ID
     */
    getTemplate(templateId: string): WorkflowTemplate | undefined {
        return this.templates.get(templateId);
    }

    /**
     * Get all templates
     */
    getAllTemplates(): WorkflowTemplate[] {
        return Array.from(this.templates.values());
    }

    /**
     * Get templates by category
     */
    getTemplatesByCategory(category: WorkflowCategory): WorkflowTemplate[] {
        return Array.from(this.templates.values()).filter(t => t.category === category);
    }

    /**
     * Search templates by name or description
     */
    searchTemplates(query: string): WorkflowTemplate[] {
        const lowerQuery = query.toLowerCase();
        return Array.from(this.templates.values()).filter(template =>
            template.name.toLowerCase().includes(lowerQuery) ||
            template.description?.toLowerCase().includes(lowerQuery) ||
            template.metadata.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
        );
    }

    /**
     * Validate template data against schema
     */
    async validateTemplateData(templateId: string, data: Record<string, any>): Promise<TemplateValidationResult> {
        const template = this.getTemplate(templateId);
        if (!template) {
            return {
                isValid: false,
                errors: [{
                    code: 'TEMPLATE_NOT_FOUND',
                    message: `Template ${templateId} not found`,
                    path: '',
                    severity: 'error' as const,
                    details: { templateId }
                }],
                warnings: [],
                score: 0
            };
        }

        return this.validator.validateData(data, template.validationSchema);
    }

    /**
     * Reload templates from disk
     */
    async reloadTemplates(): Promise<void> {
        this.templates.clear();
        this.templateCache.clear();
        await this.loadTemplates();
    }

    /**
     * Create a new template from data
     */
    async createTemplate(templateData: any, filePath?: string): Promise<WorkflowTemplate> {
        // Validate template structure
        const validationResult = await this.validator.validateTemplate(templateData);
        if (!validationResult.isValid) {
            throw new TemplateError(
                `Template validation failed: ${validationResult.errors.map((e: any) => e.message).join(', ')}`,
                'VALIDATION_FAILED',
                { errors: validationResult.errors }
            );
        }

        // Parse template
        const template = this.parseTemplate(templateData, filePath || `template-${Date.now()}.yaml`);

        // Store in memory
        this.templates.set(template.id, template);

        // Save to file if path provided
        if (filePath) {
            const yamlContent = yaml.dump(templateData, {
                indent: 2,
                lineWidth: 120,
                noRefs: true
            });
            await fs.writeFile(filePath, yamlContent, 'utf8');
        }

        return template;
    }

    /**
     * Update an existing template
     */
    async updateTemplate(templateId: string, templateData: any): Promise<WorkflowTemplate> {
        const existingTemplate = this.getTemplate(templateId);
        if (!existingTemplate) {
            throw new TemplateError(`Template ${templateId} not found`, 'TEMPLATE_NOT_FOUND');
        }

        // Validate updated template
        const validationResult = await this.validator.validateTemplate(templateData);
        if (!validationResult.isValid) {
            throw new TemplateError(
                `Template validation failed: ${validationResult.errors.map((e: any) => e.message).join(', ')}`,
                'VALIDATION_FAILED',
                { errors: validationResult.errors }
            );
        }

        // Parse updated template
        const updatedTemplate = this.parseTemplate(templateData, `${templateId}.yaml`);
        updatedTemplate.id = templateId; // Preserve original ID

        // Update in memory
        this.templates.set(templateId, updatedTemplate);

        return updatedTemplate;
    }

    /**
     * Delete a template
     */
    deleteTemplate(templateId: string): boolean {
        return this.templates.delete(templateId);
    }

    /**
     * Get template statistics
     */
    getStatistics(): {
        totalTemplates: number;
        templatesByCategory: Record<string, number>;
        averageStepsPerTemplate: number;
        mostUsedCategory: string;
    } {
        const templates = Array.from(this.templates.values());
        const totalTemplates = templates.length;

        const templatesByCategory: Record<string, number> = {};
        let totalSteps = 0;

        for (const template of templates) {
            const category = template.category;
            templatesByCategory[category] = (templatesByCategory[category] || 0) + 1;
            totalSteps += template.steps.length;
        }

        const mostUsedCategory = Object.entries(templatesByCategory)
            .sort(([, a], [, b]) => b - a)[0]?.[0] || 'NONE';

        return {
            totalTemplates,
            templatesByCategory,
            averageStepsPerTemplate: totalTemplates > 0 ? totalSteps / totalTemplates : 0,
            mostUsedCategory
        };
    }
}