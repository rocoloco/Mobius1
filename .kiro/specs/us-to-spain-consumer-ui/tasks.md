# Implementation Plan: US to Spain Migration Consumer UI

## Overview

This implementation plan breaks down the development of the US to Spain Migration Consumer UI into discrete, manageable tasks. Each task builds incrementally on previous work, with checkpoints to ensure quality and correctness throughout the development process.

## Task List

- [-] 1. Design and Wireframing Phase



- [x] 1.1 Set up Figma MCP integration and create project structure



  - Configure Figma MCP in `.kiro/settings/mcp.json`
  - Create Figma file for the project
  - Set up design system foundations (grid, spacing scale)
  - _Requirements: All requirements (foundation for implementation)_

- [x] 1.2 Create low-fidelity wireframes for all major pages using Figma MCP






  - Dashboard / Home page wireframe
  - User Profile Setup wireframe
  - Workflow Selection wireframe
  - Workflow Stepper wireframe
  - Document Vault wireframe
  - Form Generator wireframe
  - AI Assistant Chat wireframe
  - Appointment Calendar wireframe
  - Cost Tracker wireframe
  - Regional Resources wireframe
  - Export wireframes as images to spec folder
  - Apply design philosophy: simple, magical, functional
  - Ensure generous whitespace and clear visual hierarchy
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, 8.1, 11.1_

- [x] 1.3 Define color palette and branding




  - Present 2-3 color palette options with accessibility verification
  - Get user approval on selected palette
  - Configure Tailwind with approved colors
  - Document color usage guidelines
  - _Requirements: NFR-003 (accessibility)_

- [x] 1.4 Create high-fidelity mockups with approved branding





  - Apply color palette to wireframes
  - Add typography and visual polish
  - Create component library in Figma
  - Define design tokens (colors, spacing, typography)
  - Export mockups and design specifications
  - _Requirements: All requirements (visual design foundation)_

- [-] 2. Project Setup and Infrastructure


- [x] 2.1 Initialize Next.js project with TypeScript and required dependencies


  - Create Next.js 14+ project with App Router
  - Install and configure TypeScript
  - Install Tailwind CSS and shadcn/ui
  - Install Zustand for state management
  - Install React Hook Form and Zod for form handling
  - Install Axios for API client
  - Install date-fns for date handling
  - Set up project structure (components, lib, hooks, types)
  - _Requirements: NFR-008 (browser support), NFR-010 (maintainability)_

- [x] 2.2 Configure development environment and tooling


  - Set up ESLint with TypeScript and React rules
  - Configure Prettier for code formatting
  - Set up Husky and lint-staged for pre-commit hooks
  - Configure environment variables structure
  - Set up path aliases in tsconfig.json
  - _Requirements: NFR-010 (maintainability)_

- [x] 2.3 Set up testing infrastructure



  - Install and configure Vitest for unit testing
  - Install React Testing Library
  - Install fast-check for property-based testing
  - Configure Chrome DevTools MCP for E2E testing
  - Create test utilities and helpers
  - Set up test coverage reporting
  - _Requirements: NFR-010 (maintainability)_

- [ ]* 2.4 Write property test for project setup validation
  - **Property 1: Configuration round trip**
  - **Validates: Requirements NFR-010**
  - Test that environment variables are correctly loaded and accessible

- [ ] 3. Authentication and User Management
- [ ] 3.1 Implement authentication integration with Mobius platform
  - Create authentication context and hooks
  - Implement OAuth 2.0 / OIDC flow
  - Create login and registration pages
  - Implement session management with HTTP-only cookies
  - Add session timeout logic (30 minutes)
  - _Requirements: 13.1, 13.2_

- [ ] 3.2 Create user profile data models and API client
  - Define TypeScript interfaces for UserProfile
  - Create API client methods for profile CRUD operations
  - Implement profile validation with Zod schemas
  - _Requirements: 1.1, 1.4_

- [ ] 3.3 Build user profile creation and management UI
  - Create profile setup form with all required fields
  - Implement form validation
  - Add profile editing functionality
  - Create profile display component
  - _Requirements: 1.1, 1.4_

- [ ]* 3.4 Write property test for profile validation
  - **Property 3: Profile validation gates workflow access**
  - **Validates: Requirements 1.4**

- [ ]* 3.5 Write property test for profile data persistence
  - **Property 4: Data persistence round trip**
  - **Validates: Requirements 1.5**

- [ ] 4. Dashboard and Progress Tracking
- [ ] 4.1 Create dashboard layout and navigation
  - Implement responsive layout component
  - Create navigation bar with user menu
  - Add mobile navigation drawer
  - Implement breadcrumb navigation
  - _Requirements: 9.1, 9.2_

- [ ] 4.2 Implement progress tracker component
  - Create progress visualization (percentage, charts)
  - Implement task categorization by urgency
  - Add color coding for task states
  - Create timeline view with dependencies
  - _Requirements: 2.1, 2.2, 2.5_

- [ ] 4.3 Build dashboard data aggregation and display
  - Fetch and aggregate user progress data
  - Display active workflows summary
  - Show upcoming appointments
  - Display recent activity feed
  - Show cost summary
  - _Requirements: 2.1, 2.3, 2.4_

- [ ]* 4.4 Write property test for progress calculation
  - **Property 5: Progress calculation accuracy**
  - **Validates: Requirements 2.1, 2.3**

- [ ]* 4.5 Write property test for task urgency categorization
  - **Property 6: Task urgency categorization**
  - **Validates: Requirements 2.2**

- [ ]* 4.6 Write property test for time estimation
  - **Property 7: Time estimation reasonableness**
  - **Validates: Requirements 2.4**

- [ ]* 4.7 Write property test for dependency ordering
  - **Property 8: Dependency ordering in timeline**
  - **Validates: Requirements 2.5**

- [ ] 5. Workflow System
- [ ] 5.1 Create workflow data models and state management
  - Define TypeScript interfaces for Workflow and WorkflowStep
  - Create Zustand store for workflow state
  - Implement workflow API client methods
  - _Requirements: 3.1, 3.2_

- [ ] 5.2 Build workflow selection and overview UI
  - Create workflow catalog page
  - Display workflow cards with descriptions
  - Implement workflow filtering and search
  - Add workflow recommendation display
  - _Requirements: 1.2, 3.1_

- [ ] 5.3 Implement workflow stepper component
  - Create multi-step form component
  - Implement step navigation (next, back, skip)
  - Add progress indicator
  - Implement prerequisite checking
  - Add contextual help and tooltips
  - _Requirements: 3.2, 3.3, 3.4_

- [ ] 5.4 Create workflow completion and summary
  - Implement workflow completion logic
  - Generate completion summary
  - Display next steps recommendations
  - _Requirements: 3.5_

- [ ]* 5.5 Write property test for workflow recommendations
  - **Property 1: Profile-based workflow recommendations**
  - **Validates: Requirements 1.2**

- [ ]* 5.6 Write property test for workflow recommendation performance
  - **Property 2: Workflow recommendation refresh performance**
  - **Validates: Requirements 1.3**

- [ ]* 5.7 Write property test for workflow step rendering
  - **Property 9: Workflow step rendering completeness**
  - **Validates: Requirements 3.2, 3.4**

- [ ]* 5.8 Write property test for prerequisite enforcement
  - **Property 10: Prerequisite enforcement**
  - **Validates: Requirements 3.3**

- [ ]* 5.9 Write property test for workflow completion
  - **Property 11: Workflow completion summary generation**
  - **Validates: Requirements 3.5**

- [ ] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Document Management System
- [ ] 7.1 Create document data models and API integration
  - Define TypeScript interfaces for Document and ExtractedData
  - Create API client for document operations
  - Implement document upload with progress tracking
  - _Requirements: 4.1, 4.2_

- [ ] 7.2 Build document upload component
  - Implement drag-and-drop file upload with react-dropzone
  - Add file type and size validation
  - Create upload progress indicator
  - Implement image preview and PDF rendering
  - Add mobile image optimization
  - _Requirements: 4.1, 9.3_

- [ ] 7.3 Create document vault UI
  - Build document list with filtering and search
  - Implement document categorization display
  - Add document detail view
  - Create document deletion with confirmation
  - _Requirements: 4.4, 4.5_

- [ ] 7.4 Implement OCR status tracking and display
  - Show OCR processing status
  - Display extracted data when available
  - Handle OCR errors gracefully
  - _Requirements: 4.3_

- [ ]* 7.5 Write property test for document classification
  - **Property 12: Document classification assignment**
  - **Validates: Requirements 4.1, 4.4**

- [ ]* 7.6 Write property test for document encryption
  - **Property 13: Document encryption round trip**
  - **Validates: Requirements 4.2**

- [ ]* 7.7 Write property test for OCR accuracy
  - **Property 14: OCR extraction accuracy**
  - **Validates: Requirements 4.3**

- [ ]* 7.8 Write property test for document deletion
  - **Property 15: Document deletion completeness**
  - **Validates: Requirements 4.5**

- [ ] 8. Form Generation System
- [ ] 8.1 Create form generation data models and API client
  - Define TypeScript interfaces for GeneratedForm and FormField
  - Create API client for form generation
  - Implement form validation logic
  - _Requirements: 5.1, 5.4_

- [ ] 8.2 Build form generator UI
  - Create form type selection interface
  - Implement form field display with auto-fill
  - Add missing field highlighting
  - Create manual field editing
  - Implement form validation feedback
  - _Requirements: 5.1, 5.3, 5.4_

- [ ] 8.3 Implement PDF export functionality
  - Integrate PDF generation library
  - Create form templates for Spanish forms
  - Implement PDF download
  - Add PDF preview
  - _Requirements: 5.5_

- [ ]* 8.4 Write property test for form field population
  - **Property 16: Form field population from available data**
  - **Validates: Requirements 5.1**

- [ ]* 8.5 Write property test for missing field highlighting
  - **Property 17: Missing form field highlighting**
  - **Validates: Requirements 5.3**

- [ ]* 8.6 Write property test for form validation
  - **Property 18: Form validation before download**
  - **Validates: Requirements 5.4**

- [ ]* 8.7 Write property test for PDF format compliance
  - **Property 19: Form PDF format compliance**
  - **Validates: Requirements 5.5**

- [ ] 9. AI Assistant Integration
- [ ] 9.1 Create AI assistant API client and state management
  - Define TypeScript interfaces for Message and AssistantResponse
  - Create API client for chat operations
  - Implement Zustand store for conversation state
  - Add message streaming support
  - _Requirements: 6.1, 6.2_

- [ ] 9.2 Build chat interface UI
  - Create message list component
  - Implement message input with auto-resize
  - Add typing indicators
  - Display source citations
  - Show confidence indicators
  - Add suggested follow-up questions
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 9.3 Implement conversation context management
  - Pass workflow context to AI
  - Include recent documents in context
  - Maintain conversation history
  - _Requirements: 6.2_

- [ ]* 9.4 Write property test for response time
  - **Property 20: AI assistant response time**
  - **Validates: Requirements 6.1**

- [ ]* 9.5 Write property test for context maintenance
  - **Property 21: Conversation context maintenance**
  - **Validates: Requirements 6.2**

- [ ]* 9.6 Write property test for citation inclusion
  - **Property 22: Regulation citation inclusion**
  - **Validates: Requirements 6.3**

- [ ]* 9.7 Write property test for uncertainty indication
  - **Property 23: Uncertainty indication**
  - **Validates: Requirements 6.4**

- [ ]* 9.8 Write property test for PII redaction
  - **Property 24: PII redaction in conversation logs**
  - **Validates: Requirements 6.5**

- [ ] 10. Appointment Management
- [ ] 10.1 Create appointment data models and API client
  - Define TypeScript interfaces for Appointment and Reminder
  - Create API client for appointment operations
  - Implement reminder scheduling logic
  - _Requirements: 7.1, 7.2_

- [ ] 10.2 Build appointment calendar UI
  - Create calendar view component
  - Implement appointment list view
  - Add appointment creation form
  - Create appointment detail view
  - Implement appointment editing and deletion
  - _Requirements: 7.1, 7.3_

- [ ] 10.3 Implement reminder system
  - Create reminder notification logic
  - Add reminder display in UI
  - Implement iCal export
  - _Requirements: 7.2, 7.4_

- [ ] 10.4 Add appointment document requirements display
  - Show required documents for each appointment type
  - Link to document vault
  - _Requirements: 7.5_

- [ ]* 10.5 Write property test for appointment persistence
  - **Property 4: Data persistence round trip** (appointments)
  - **Validates: Requirements 7.1**

- [ ]* 10.6 Write property test for reminder scheduling
  - **Property 25: Appointment reminder scheduling**
  - **Validates: Requirements 7.2**

- [ ]* 10.7 Write property test for past appointment prompting
  - **Property 26: Past appointment prompting**
  - **Validates: Requirements 7.3**

- [ ]* 10.8 Write property test for iCal export
  - **Property 27: iCal export round trip**
  - **Validates: Requirements 7.4**

- [ ]* 10.9 Write property test for document requirements
  - **Property 28: Appointment document requirements**
  - **Validates: Requirements 7.5**

- [ ] 11. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Cost Tracking System
- [ ] 12.1 Create cost tracking data models and state management
  - Define TypeScript interfaces for CostSummary and CostItem
  - Create Zustand store for cost state
  - Implement cost calculation logic
  - _Requirements: 8.1, 8.2, 8.3_

- [ ] 12.2 Build cost tracker UI
  - Create cost summary dashboard
  - Implement cost breakdown by category
  - Add expense list with status
  - Create expense editing interface
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [ ] 12.3 Implement currency conversion
  - Integrate exchange rate API
  - Display costs in USD and EUR
  - Add currency toggle
  - _Requirements: 8.5_

- [ ]* 12.4 Write property test for cost display
  - **Property 29: Cost estimate display**
  - **Validates: Requirements 8.1**

- [ ]* 12.5 Write property test for cost updates
  - **Property 30: Cost total update on payment**
  - **Validates: Requirements 8.2**

- [ ]* 12.6 Write property test for cost categorization
  - **Property 31: Cost categorization correctness**
  - **Validates: Requirements 8.3**

- [ ]* 12.7 Write property test for expense status
  - **Property 32: Expense status mutability**
  - **Validates: Requirements 8.4**

- [ ]* 12.8 Write property test for currency conversion
  - **Property 33: Currency conversion accuracy**
  - **Validates: Requirements 8.5**

- [ ] 13. Responsive Design and Mobile Optimization
- [ ] 13.1 Implement responsive layouts for all pages
  - Add mobile breakpoints to all components
  - Test layouts at mobile, tablet, and desktop sizes
  - Ensure touch-friendly interactions
  - _Requirements: 9.1, 9.2_

- [ ] 13.2 Optimize for mobile performance
  - Implement image optimization
  - Add lazy loading for images
  - Optimize bundle size
  - Test on simulated 4G connection
  - _Requirements: 9.3, 9.5_

- [ ]* 13.3 Write property test for responsive design
  - **Property 34: Responsive design adaptation**
  - **Validates: Requirements 9.1, 9.2**

- [ ]* 13.4 Write property test for image optimization
  - **Property 35: Image upload optimization**
  - **Validates: Requirements 9.3**

- [ ]* 13.5 Write property test for mobile load time
  - **Property 36: Mobile load time performance**
  - **Validates: Requirements 9.5**

- [ ] 14. Notification System
- [ ] 14.1 Create notification data models and state management
  - Define TypeScript interfaces for Notification
  - Create Zustand store for notifications
  - Implement notification API client
  - _Requirements: 10.1, 10.2_

- [ ] 14.2 Build notification center UI
  - Create notification dropdown/panel
  - Implement notification list
  - Add notification badges
  - Create notification preferences UI
  - _Requirements: 10.3, 10.4_

- [ ] 14.3 Implement notification delivery logic
  - Create notification triggers for events
  - Implement batching logic
  - Add email notification integration
  - _Requirements: 10.1, 10.2, 10.5_

- [ ]* 14.4 Write property test for notification delivery
  - **Property 37: Notification delivery on events**
  - **Validates: Requirements 10.1, 10.2**

- [ ]* 14.5 Write property test for notification preferences
  - **Property 38: Notification preference persistence**
  - **Validates: Requirements 10.3**

- [ ]* 14.6 Write property test for notification persistence
  - **Property 39: In-app notification persistence**
  - **Validates: Requirements 10.4**

- [ ]* 14.7 Write property test for notification batching
  - **Property 40: Notification batching by preference**
  - **Validates: Requirements 10.5**

- [ ] 15. Regional Resources and Content
- [ ] 15.1 Create regional resource data models and API client
  - Define TypeScript interfaces for RegionalResource
  - Create API client for resource operations
  - _Requirements: 11.1, 11.2, 11.3, 11.4_

- [ ] 15.2 Build regional resources UI
  - Create region selection interface
  - Implement resource browsing by category
  - Add resource search and filtering
  - Create resource detail view
  - _Requirements: 11.1, 11.2, 11.3, 11.4_

- [ ]* 15.3 Write property test for regional resource availability
  - **Property 41: Regional resource availability**
  - **Validates: Requirements 11.1, 11.2, 11.3, 11.4**

- [ ] 16. Application Status Tracking
- [ ] 16.1 Create application tracking data models and API client
  - Define TypeScript interfaces for application status
  - Create API client for status operations
  - _Requirements: 12.1, 12.2_

- [ ] 16.2 Build application status tracker UI
  - Create status timeline view
  - Implement status update interface
  - Display processing time estimates
  - Add delay alerts
  - Show status history
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [ ]* 16.3 Write property test for tracking entry creation
  - **Property 42: Application tracking entry creation**
  - **Validates: Requirements 12.1**

- [ ]* 16.4 Write property test for status updates
  - **Property 43: Application status mutability**
  - **Validates: Requirements 12.2**

- [ ]* 16.5 Write property test for processing time estimates
  - **Property 44: Processing time estimate availability**
  - **Validates: Requirements 12.3**

- [ ]* 16.6 Write property test for delay alerting
  - **Property 45: Delayed application alerting**
  - **Validates: Requirements 12.4**

- [ ]* 16.7 Write property test for status history
  - **Property 46: Application status history completeness**
  - **Validates: Requirements 12.5**

- [ ] 17. Security and Privacy Features
- [ ] 17.1 Implement session management
  - Add session timeout logic
  - Implement automatic logout
  - Add session renewal
  - _Requirements: 13.2_

- [ ] 17.2 Add audit logging integration
  - Log document access
  - Log profile changes
  - Log sensitive operations
  - _Requirements: 13.5_

- [ ]* 17.3 Write property test for session timeout
  - **Property 47: Session timeout enforcement**
  - **Validates: Requirements 13.2**

- [ ]* 17.4 Write property test for audit logging
  - **Property 49: Document access audit logging**
  - **Validates: Requirements 13.5**

- [ ] 18. Data Export and Portability
- [ ] 18.1 Create data export functionality
  - Implement export data aggregation
  - Create export package generation
  - Add password encryption for exports
  - Support selective export
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

- [ ] 18.2 Build data export UI
  - Create export request interface
  - Add export format selection
  - Implement export progress tracking
  - Add export download
  - _Requirements: 14.1, 14.2, 14.5_

- [ ]* 18.3 Write property test for export completeness
  - **Property 48: GDPR data export completeness**
  - **Validates: Requirements 13.4, 14.1**

- [ ]* 18.4 Write property test for export formats
  - **Property 50: Export format correctness**
  - **Validates: Requirements 14.2**

- [ ]* 18.5 Write property test for export performance
  - **Property 51: Export performance**
  - **Validates: Requirements 14.3**

- [ ]* 18.6 Write property test for export encryption
  - **Property 52: Export encryption round trip**
  - **Validates: Requirements 14.4**

- [ ]* 18.7 Write property test for selective export
  - **Property 53: Selective export filtering**
  - **Validates: Requirements 14.5**

- [ ] 19. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 20. Internationalization
- [ ] 20.1 Set up i18n infrastructure
  - Install and configure next-intl
  - Create translation file structure
  - Implement language switching
  - _Requirements: NFR-007_

- [ ] 20.2 Create English and Spanish translations
  - Translate all UI strings
  - Translate error messages
  - Translate help text
  - _Requirements: NFR-007_

- [ ] 21. Accessibility Implementation
- [ ] 21.1 Implement keyboard navigation
  - Add keyboard shortcuts
  - Ensure tab order is logical
  - Add skip navigation links
  - _Requirements: NFR-003_

- [ ] 21.2 Add ARIA labels and semantic HTML
  - Add ARIA labels to interactive elements
  - Use semantic HTML elements
  - Add alt text to images
  - _Requirements: NFR-003_

- [ ] 21.3 Verify color contrast and visual accessibility
  - Test color contrast ratios
  - Ensure text is resizable
  - Test with screen readers
  - _Requirements: NFR-003_

- [ ] 22. Performance Optimization
- [ ] 22.1 Implement code splitting and lazy loading
  - Add route-based code splitting
  - Lazy load heavy components
  - Optimize bundle size
  - _Requirements: NFR-001_

- [ ] 22.2 Add caching and optimization
  - Implement React Query for data caching
  - Add service worker for offline support
  - Optimize images with Next.js Image
  - _Requirements: NFR-001_

- [ ] 23. End-to-End Testing with Chrome DevTools MCP
- [ ]* 23.1 Write E2E test for user onboarding flow
  - Test registration → profile setup → first workflow
  - Use Chrome DevTools MCP for browser automation
  - Capture screenshots for visual regression
  - _Requirements: 1.1, 1.2, 3.1_

- [ ]* 23.2 Write E2E test for document management flow
  - Test upload → classify → use in form generation
  - Verify OCR processing
  - _Requirements: 4.1, 4.3, 5.1_

- [ ]* 23.3 Write E2E test for visa application workflow
  - Test complete workflow from start to finish
  - Verify form generation
  - _Requirements: 3.1, 3.2, 3.5, 5.1_

- [ ]* 23.4 Write E2E test for AI assistant usage
  - Test question → response → follow-up
  - Verify context maintenance
  - _Requirements: 6.1, 6.2_

- [ ]* 23.5 Write E2E test for mobile experience
  - Test navigation on mobile viewport
  - Test document upload on mobile
  - Verify responsive design
  - _Requirements: 9.1, 9.2_

- [ ] 24. Deployment and Production Setup
- [ ] 24.1 Configure production environment
  - Set up environment variables
  - Configure security headers
  - Set up error tracking (Sentry)
  - Configure analytics
  - _Requirements: NFR-004, NFR-005_

- [ ] 24.2 Deploy to production
  - Deploy to Vercel or similar platform
  - Configure custom domain
  - Set up SSL/TLS
  - Verify deployment
  - _Requirements: NFR-007_

- [ ] 25. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Verify all requirements are met
  - Conduct final review with user

---

**Notes:**
- Tasks marked with `*` are optional testing tasks that can be skipped for faster MVP delivery
- Each property-based test should run a minimum of 100 iterations
- All property tests must include the tag: `// Feature: us-to-spain-consumer-ui, Property {number}: {property_text}`
- Checkpoints are placed at strategic points to ensure quality before proceeding
- The implementation follows a logical progression: design → infrastructure → core features → polish → testing → deployment
