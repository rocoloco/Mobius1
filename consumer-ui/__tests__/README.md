# Testing Guide

This directory contains tests for the US to Spain Migration Consumer UI.

## Testing Stack

- **Unit Testing**: Vitest + React Testing Library
- **Property-Based Testing**: fast-check
- **E2E Testing**: Chrome DevTools MCP (configured separately)
- **Coverage**: @vitest/coverage-v8

## Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests with UI
npm run test:ui
```

## Test Structure

```
__tests__/
├── test-utils.tsx           # Custom render utilities and helpers
├── setup.test.ts            # Basic setup verification
└── property-test-example.test.ts  # Property-based testing examples
```

## Writing Tests

### Unit Tests

Use Vitest and React Testing Library for component and utility tests:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@/__tests__/test-utils';
import MyComponent from '@/components/MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### Property-Based Tests

Use fast-check for property-based testing. Each property test MUST:
- Run a minimum of 100 iterations
- Include a comment tag: `// Feature: us-to-spain-consumer-ui, Property {number}: {property_text}`
- Reference the design document property it validates

```typescript
import { describe, it } from 'vitest';
import * as fc from 'fast-check';

describe('Data Persistence', () => {
  it('should maintain data integrity on round trip', () => {
    // Feature: us-to-spain-consumer-ui, Property 4: Data persistence round trip
    fc.assert(
      fc.property(fc.record({ name: fc.string(), age: fc.integer() }), (data) => {
        const saved = saveData(data);
        const retrieved = retrieveData(saved.id);
        return JSON.stringify(retrieved) === JSON.stringify(data);
      }),
      { numRuns: 100 }
    );
  });
});
```

## Coverage Requirements

- **Target**: ≥ 80% coverage for lines, functions, branches, and statements
- **Excluded**: Configuration files, type definitions, test files
- **Reports**: Generated in `coverage/` directory

## Test Utilities

### Custom Render

Use `renderWithProviders` from `test-utils.tsx` to render components with necessary providers:

```typescript
import { render } from '@/__tests__/test-utils';

render(<MyComponent />);
```

### Mocked Modules

The following are automatically mocked in `vitest.setup.ts`:
- `next/navigation` (router, pathname, search params)
- Environment variables

## Best Practices

1. **Focus on behavior**: Test what the component does, not how it does it
2. **Use semantic queries**: Prefer `getByRole`, `getByLabelText` over `getByTestId`
3. **Test user interactions**: Use `@testing-library/user-event` for realistic interactions
4. **Keep tests simple**: One assertion per test when possible
5. **Property tests for universal rules**: Use PBT for properties that should hold across all inputs
6. **Unit tests for specific cases**: Use unit tests for edge cases and examples

## Chrome DevTools MCP for E2E

E2E tests using Chrome DevTools MCP will be configured separately. These tests will:
- Automate real browser interactions
- Verify complete user journeys
- Test responsive design at different viewports
- Capture screenshots for visual regression
- Monitor network requests and performance

See the main tasks document for E2E test implementation tasks.
