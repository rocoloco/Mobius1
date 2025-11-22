/**
 * Residency Validator Tests
 * Tests for Spain residency validation logic
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ResidencyValidator } from '../../src/policy/residencyValidator.js';
import type { GeographicLocation } from '../../src/policy/types.js';

describe('ResidencyValidator', () => {
  let validator: ResidencyValidator;

  beforeEach(() => {
    validator = new ResidencyValidator();
  });

  describe('Spain Location Validation', () => {
    it('should validate Spanish location as compliant', async () => {
      const location: GeographicLocation = {
        country: 'ES',
        region: 'ES-MD',
        city: 'Madrid',
        coordinates: {
          latitude: 40.4168,
          longitude: -3.7038,
        },
      };

      const result = await validator.validateResidency('document_processing', location);
      
      expect(result.compliant).toBe(true);
      expect(result.allowedRegion).toBe('ES');
      expect(result.enforced).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should reject non-Spanish location', async () => {
      const location: GeographicLocation = {
        country: 'FR',
        region: 'FR-75',
        city: 'Paris',
        coordinates: {
          latitude: 48.8566,
          longitude: 2.3522,
        },
      };

      const result = await validator.validateResidency('document_processing', location);
      
      expect(result.compliant).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0]).toContain('FR');
    });

    it('should validate all Spanish regions', async () => {
      const spanishRegions = [
        'ES-AN', 'ES-AR', 'ES-AS', 'ES-CB', 'ES-CE',
        'ES-CL', 'ES-CM', 'ES-CN', 'ES-CT', 'ES-EX',
        'ES-GA', 'ES-IB', 'ES-MC', 'ES-MD', 'ES-ML',
        'ES-NC', 'ES-PV', 'ES-RI', 'ES-VC'
      ];

      for (const region of spanishRegions) {
        const location: GeographicLocation = {
          country: 'ES',
          region,
        };

        const result = await validator.validateResidency('test', location);
        expect(result.compliant).toBe(true);
      }
    });

    it('should reject invalid Spanish region', async () => {
      const location: GeographicLocation = {
        country: 'ES',
        region: 'ES-XX', // Invalid region
      };

      const result = await validator.validateResidency('test', location);
      
      expect(result.compliant).toBe(false);
      expect(result.violations.some(v => v.includes('ES-XX'))).toBe(true);
    });
  });

  describe('Coordinate Validation', () => {
    it('should validate Madrid coordinates', async () => {
      const location: GeographicLocation = {
        country: 'ES',
        coordinates: {
          latitude: 40.4168,
          longitude: -3.7038,
        },
      };

      const result = await validator.validateResidency('test', location);
      expect(result.compliant).toBe(true);
    });

    it('should validate Barcelona coordinates', async () => {
      const location: GeographicLocation = {
        country: 'ES',
        coordinates: {
          latitude: 41.3851,
          longitude: 2.1734,
        },
      };

      const result = await validator.validateResidency('test', location);
      expect(result.compliant).toBe(true);
    });

    it('should validate Canary Islands coordinates', async () => {
      const location: GeographicLocation = {
        country: 'ES',
        coordinates: {
          latitude: 28.2916,
          longitude: -16.6291, // Las Palmas
        },
      };

      const result = await validator.validateResidency('test', location);
      expect(result.compliant).toBe(true);
    });

    it('should reject coordinates outside Spain', async () => {
      const location: GeographicLocation = {
        country: 'ES',
        coordinates: {
          latitude: 48.8566, // Paris coordinates
          longitude: 2.3522,
        },
      };

      const result = await validator.validateResidency('test', location);
      expect(result.compliant).toBe(false);
      expect(result.violations.some(v => v.includes('outside Spanish territory'))).toBe(true);
    });
  });

  describe('Data Center Validation', () => {
    it('should validate Spanish data centers', async () => {
      const spanishDataCenters = [
        'es-central-1',
        'spain-central',
        'madrid-1',
        'barcelona-1',
        'spain-west',
        'iberia-1',
      ];

      for (const dataCenter of spanishDataCenters) {
        const location: GeographicLocation = {
          country: 'ES',
          dataCenter,
        };

        const result = await validator.validateResidency('test', location);
        expect(result.compliant).toBe(true);
      }
    });

    it('should reject non-Spanish data centers', async () => {
      const location: GeographicLocation = {
        country: 'ES',
        dataCenter: 'us-east-1',
      };

      const result = await validator.validateResidency('test', location);
      expect(result.compliant).toBe(false);
      expect(result.violations.some(v => v.includes('not located in Spain'))).toBe(true);
    });
  });

  describe('Operation Validation', () => {
    it('should validate restricted operations', async () => {
      const restrictedOps = [
        'document_processing',
        'pii_extraction',
        'tax_calculation',
        'form_generation',
        'data_storage',
        'model_inference',
      ];

      for (const operation of restrictedOps) {
        const result = await validator.validateResidency(operation);
        // Should not fail on operation type alone
        expect(result.violations.filter(v => v.includes('operation')).length).toBe(0);
      }
    });
  });

  describe('Data Egress Validation', () => {
    it('should allow Spanish government domains', async () => {
      const allowedDestinations = [
        'www.gob.es',
        'sede.agenciatributaria.gob.es',
        'extranjeros.inclusion.gob.es',
      ];

      for (const destination of allowedDestinations) {
        const result = await validator.validateDataEgress(destination, 'form_data');
        expect(result.allowed).toBe(true);
      }
    });

    it('should block external destinations', async () => {
      const blockedDestinations = [
        'api.openai.com',
        'www.google.com',
        'amazonaws.com',
      ];

      for (const destination of blockedDestinations) {
        const result = await validator.validateDataEgress(destination, 'sensitive_data');
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('not allowed in Spain-only mode');
      }
    });

    it('should allow localhost', async () => {
      const localDestinations = [
        'localhost',
        '127.0.0.1',
        '::1',
      ];

      for (const destination of localDestinations) {
        const result = await validator.validateDataEgress(destination, 'test_data');
        expect(result.allowed).toBe(true);
      }
    });
  });

  describe('Configuration Management', () => {
    it('should allow global access when Spain-only is disabled', async () => {
      validator.updateConfig({ enforceSpainOnly: false });

      const location: GeographicLocation = {
        country: 'US',
        region: 'CA',
      };

      const result = await validator.validateResidency('test', location);
      expect(result.compliant).toBe(true);
      expect(result.allowedRegion).toBe('GLOBAL');
      expect(result.enforced).toBe(false);
    });

    it('should require location in strict mode', async () => {
      validator.updateConfig({ strictMode: true });

      const result = await validator.validateResidency('test'); // No location provided
      expect(result.compliant).toBe(false);
      expect(result.violations.some(v => v.includes('Strict mode'))).toBe(true);
    });

    it('should allow missing location in non-strict mode', async () => {
      validator.updateConfig({ strictMode: false });

      const result = await validator.validateResidency('test'); // No location provided
      expect(result.compliant).toBe(true);
    });
  });

  describe('Region Name Resolution', () => {
    it('should resolve Spanish region names', () => {
      expect(validator.getRegionName('ES-MD')).toBe('Madrid');
      expect(validator.getRegionName('ES-CT')).toBe('Cataluña');
      expect(validator.getRegionName('ES-AN')).toBe('Andalucía');
    });

    it('should return undefined for invalid regions', () => {
      expect(validator.getRegionName('ES-XX')).toBeUndefined();
      expect(validator.getRegionName('FR-75')).toBeUndefined();
    });

    it('should return all valid regions', () => {
      const regions = validator.getValidRegions();
      expect(regions.size).toBe(19); // 17 autonomous communities + 2 autonomous cities
      expect(regions.has('ES-MD')).toBe(true);
      expect(regions.has('ES-CT')).toBe(true);
    });
  });

  describe('Current Location Detection', () => {
    it('should return mock Spanish location', async () => {
      const location = await validator.getCurrentLocation();
      
      expect(location.country).toBe('ES');
      expect(location.region).toBe('ES-MD');
      expect(location.city).toBe('Madrid');
      expect(location.coordinates?.latitude).toBe(40.4168);
      expect(location.coordinates?.longitude).toBe(-3.7038);
    });
  });
});