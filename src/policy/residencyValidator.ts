/**
 * Spain Residency Validator
 * Validates that all processing and storage occurs within Spanish jurisdiction
 */

import type { 
  ResidencyValidation, 
  GeographicLocation, 
  ResidencyConfig 
} from './types.js';

/**
 * Default residency configuration for Spain-only mode
 */
export const DEFAULT_RESIDENCY_CONFIG: ResidencyConfig = {
  enforceSpainOnly: true,
  allowedCountries: ['ES'],
  allowedRegions: ['ES-AN', 'ES-AR', 'ES-AS', 'ES-CB', 'ES-CE', 'ES-CL', 'ES-CM', 'ES-CN', 'ES-CT', 'ES-EX', 'ES-GA', 'ES-IB', 'ES-MC', 'ES-MD', 'ES-ML', 'ES-NC', 'ES-PV', 'ES-RI', 'ES-VC'],
  strictMode: true,
  auditAllRequests: true,
};

/**
 * Spanish regions and their codes
 */
const SPANISH_REGIONS = new Map([
  ['ES-AN', 'Andalucía'],
  ['ES-AR', 'Aragón'],
  ['ES-AS', 'Asturias'],
  ['ES-CB', 'Cantabria'],
  ['ES-CE', 'Ceuta'],
  ['ES-CL', 'Castilla y León'],
  ['ES-CM', 'Castilla-La Mancha'],
  ['ES-CN', 'Canarias'],
  ['ES-CT', 'Cataluña'],
  ['ES-EX', 'Extremadura'],
  ['ES-GA', 'Galicia'],
  ['ES-IB', 'Islas Baleares'],
  ['ES-MC', 'Murcia'],
  ['ES-MD', 'Madrid'],
  ['ES-ML', 'Melilla'],
  ['ES-NC', 'Navarra'],
  ['ES-PV', 'País Vasco'],
  ['ES-RI', 'La Rioja'],
  ['ES-VC', 'Comunidad Valenciana'],
]);

/**
 * Known Spanish data centers and cloud regions
 */
const SPANISH_DATA_CENTERS = new Set([
  'es-central-1',
  'spain-central',
  'madrid-1',
  'barcelona-1',
  'spain-west',
  'iberia-1',
]);

/**
 * Residency validator class
 */
export class ResidencyValidator {
  private config: ResidencyConfig;

  constructor(config: Partial<ResidencyConfig> = {}) {
    this.config = { ...DEFAULT_RESIDENCY_CONFIG, ...config };
  }

  /**
   * Validate residency compliance for a request
   */
  async validateResidency(
    operation: string,
    location?: GeographicLocation,
    workspaceId?: string
  ): Promise<ResidencyValidation> {
    const violations: string[] = [];
    let compliant = true;

    // If Spain-only mode is not enforced, allow all
    if (!this.config.enforceSpainOnly) {
      return {
        allowedRegion: 'GLOBAL',
        enforced: false,
        currentLocation: location,
        compliant: true,
        violations: [],
      };
    }

    // Validate current location if provided
    if (location) {
      const locationValidation = this.validateLocation(location);
      if (!locationValidation.valid) {
        violations.push(...locationValidation.violations);
        compliant = false;
      }
    }

    // Validate operation type
    const operationValidation = this.validateOperation(operation);
    if (!operationValidation.valid) {
      violations.push(...operationValidation.violations);
      compliant = false;
    }

    // In strict mode, require explicit location validation
    if (this.config.strictMode && !location) {
      violations.push('Strict mode requires explicit location validation');
      compliant = false;
    }

    return {
      allowedRegion: 'ES',
      enforced: this.config.enforceSpainOnly,
      currentLocation: location,
      compliant,
      violations,
    };
  }

  /**
   * Validate geographic location
   */
  private validateLocation(location: GeographicLocation): { valid: boolean; violations: string[] } {
    const violations: string[] = [];

    // Check country
    if (!this.config.allowedCountries.includes(location.country)) {
      violations.push(`Country '${location.country}' is not allowed. Only Spain (ES) is permitted.`);
    }

    // Check region if provided
    if (location.region && !this.config.allowedRegions.includes(location.region)) {
      violations.push(`Region '${location.region}' is not a valid Spanish region.`);
    }

    // Check data center if provided
    if (location.dataCenter && !this.isSpanishDataCenter(location.dataCenter)) {
      violations.push(`Data center '${location.dataCenter}' is not located in Spain.`);
    }

    // Validate coordinates if provided (Spain boundaries)
    if (location.coordinates) {
      const coordValidation = this.validateCoordinates(location.coordinates);
      if (!coordValidation.valid) {
        violations.push(...coordValidation.violations);
      }
    }

    return {
      valid: violations.length === 0,
      violations,
    };
  }

  /**
   * Validate operation type for residency compliance
   */
  private validateOperation(operation: string): { valid: boolean; violations: string[] } {
    const violations: string[] = [];

    // Operations that require Spain-only processing
    const restrictedOperations = [
      'document_processing',
      'pii_extraction',
      'tax_calculation',
      'form_generation',
      'data_storage',
      'model_inference',
    ];

    if (restrictedOperations.includes(operation)) {
      // These operations must be performed in Spain
      // Additional validation would be performed here
      // For now, we assume they are compliant if location is validated
    }

    return {
      valid: violations.length === 0,
      violations,
    };
  }

  /**
   * Validate coordinates are within Spanish territory
   */
  private validateCoordinates(coordinates: { latitude: number; longitude: number }): { valid: boolean; violations: string[] } {
    const violations: string[] = [];

    // Spain boundaries (approximate)
    const SPAIN_BOUNDS = {
      north: 43.791,
      south: 27.638, // Including Canary Islands
      east: 4.327,
      west: -18.161, // Including Canary Islands
    };

    // Mainland Spain boundaries (more restrictive)
    const MAINLAND_BOUNDS = {
      north: 43.791,
      south: 36.001,
      east: 3.327,
      west: -9.301,
    };

    const { latitude, longitude } = coordinates;

    // Check if coordinates are within Spanish territory (including islands)
    const withinSpain = 
      latitude >= SPAIN_BOUNDS.south &&
      latitude <= SPAIN_BOUNDS.north &&
      longitude >= SPAIN_BOUNDS.west &&
      longitude <= SPAIN_BOUNDS.east;

    if (!withinSpain) {
      violations.push(`Coordinates (${latitude}, ${longitude}) are outside Spanish territory.`);
    }

    return {
      valid: violations.length === 0,
      violations,
    };
  }

  /**
   * Check if data center is located in Spain
   */
  private isSpanishDataCenter(dataCenter: string): boolean {
    return SPANISH_DATA_CENTERS.has(dataCenter.toLowerCase());
  }

  /**
   * Get current system location (mock implementation)
   */
  async getCurrentLocation(): Promise<GeographicLocation> {
    // In a real implementation, this would:
    // 1. Check server location via cloud provider APIs
    // 2. Validate network routing
    // 3. Confirm data storage locations
    
    // Mock implementation for development
    return {
      country: 'ES',
      region: 'ES-MD',
      city: 'Madrid',
      coordinates: {
        latitude: 40.4168,
        longitude: -3.7038,
      },
      dataCenter: 'madrid-1',
      provider: 'local',
    };
  }

  /**
   * Validate data egress prevention
   */
  async validateDataEgress(
    destination: string,
    dataType: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Block any external data egress in Spain-only mode
    if (this.config.enforceSpainOnly) {
      const allowedDestinations = [
        'localhost',
        '127.0.0.1',
        '::1',
        // Spanish government domains
        '.gob.es',
        '.administracion.gob.es',
        // Spanish tax authority
        '.agenciatributaria.es',
        // Spanish immigration
        '.inclusion.gob.es',
      ];

      const isAllowed = allowedDestinations.some(allowed => 
        destination.includes(allowed) || destination.endsWith(allowed)
      );

      if (!isAllowed) {
        return {
          allowed: false,
          reason: `Data egress to '${destination}' is not allowed in Spain-only mode`,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Get Spanish region name from code
   */
  getRegionName(regionCode: string): string | undefined {
    return SPANISH_REGIONS.get(regionCode);
  }

  /**
   * Get all valid Spanish regions
   */
  getValidRegions(): Map<string, string> {
    return new Map(SPANISH_REGIONS);
  }

  /**
   * Update residency configuration
   */
  updateConfig(config: Partial<ResidencyConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): ResidencyConfig {
    return { ...this.config };
  }
}

/**
 * Singleton residency validator instance
 */
export const residencyValidator = new ResidencyValidator();