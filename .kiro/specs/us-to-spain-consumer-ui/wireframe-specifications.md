# Wireframe Specifications: US to Spain Migration Consumer UI

## Design Philosophy

**Simple, Magical, Functional**
- Generous whitespace for breathing room
- Clear visual hierarchy
- Progressive disclosure (show complexity only when needed)
- Consistent patterns across all pages
- Focus on essential actions

## Layout System

**Grid**: 12-column grid with 24px gutters
**Breakpoints**:
- Mobile: < 768px (single column)
- Tablet: 768px - 1024px (flexible columns)
- Desktop: > 1024px (full layout)

**Spacing Scale**: 8px base unit (8, 16, 24, 32, 48, 64, 96)

**Common Elements Across All Pages**:
- Top Navigation Bar (64px height)
- Sidebar Navigation (256px width on desktop, drawer on mobile)
- Main Content Area (flexible width with max-width: 1440px)
- Footer (minimal, links only)

---

## 1. Dashboard / Home Page

**Purpose**: Central hub showing progress, upcoming tasks, and quick actions

**Layout Structure**:
```
┌─────────────────────────────────────────────────────────┐
│ Top Nav: Logo | Search | Notifications | Profile        │
├──────────┬──────────────────────────────────────────────┤
│          │  Welcome Header                              │
│ Sidebar  │  "Welcome back, [Name]"                      │
│          │  Overall Progress: 45% [Progress Bar]        │
│ - Home   │                                              │
│ - Profile├──────────────────────────────────────────────┤
│ - Workflows│ Active Workflows (3 cards)                │
│ - Documents│ [Visa Application] [NIE] [Empadronamiento]│
│ - Forms  │                                              │
│ - Chat   ├──────────────────────────────────────────────┤
│ - Calendar│ Upcoming Appointments (list)               │
│ - Costs  │ • NIE Appointment - Dec 15, 2024            │
│ - Resources│ • Document Translation - Dec 20, 2024     │
│          │                                              │
│          ├──────────────────────────────────────────────┤
│          │ Recent Activity (timeline)                   │
│          │ • Document uploaded                          │
│          │ • Workflow step completed                    │
└──────────┴──────────────────────────────────────────────┘
```

**Key Components**:
1. **Welcome Header** (top, full width)
   - Personalized greeting
   - Overall progress bar with percentage
   - Quick stats (X tasks completed, Y pending)

2. **Active Workflows Section** (3-column grid on desktop)
   - Card per workflow
   - Progress indicator
   - Next action button
   - Status badge

3. **Upcoming Appointments** (right sidebar or below workflows)
   - List of next 3-5 appointments
   - Date, time, location
   - "View all" link

4. **Recent Activity** (timeline format)
   - Last 5 activities
   - Timestamps
   - Activity icons

5. **Cost Summary** (small widget)
   - Total estimated vs spent
   - Quick view

---

## 2. User Profile Setup Page

**Purpose**: Collect essential user information for personalized experience

**Layout Structure**:
```
┌─────────────────────────────────────────────────────────┐
│ Top Nav: Logo | [Skip for now]                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│         Profile Setup (centered, max-width: 600px)      │
│                                                          │
│         Step Indicator: ● ○ ○ ○ (Step 1 of 4)          │
│                                                          │
│         Personal Information                             │
│         ─────────────────────                            │
│                                                          │
│         Full Name: [________________]                    │
│         Email: [________________]                        │
│         Date of Birth: [____/____/____]                  │
│         Nationality: [Dropdown ▼]                        │
│                                                          │
│         Current Location                                 │
│         City: [________________]                         │
│         State: [________________]                        │
│         Country: [United States ▼]                       │
│                                                          │
│                                                          │
│                    [Back]  [Continue →]                  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Key Components**:
1. **Step Indicator** (top center)
   - 4 steps total
   - Current step highlighted
   - Step labels on hover

2. **Form Sections** (stacked vertically)
   - Step 1: Personal Information
   - Step 2: Migration Details (target region, timeline)
   - Step 3: Visa Interests (checkboxes)
   - Step 4: Preferences (language, notifications)

3. **Form Fields**
   - Clear labels above fields
   - Placeholder text for guidance
   - Validation messages below fields
   - Required field indicators (*)

4. **Navigation Buttons** (bottom)
   - Back button (secondary)
   - Continue button (primary, right-aligned)
   - Progress saved automatically

---

## 3. Workflow Selection Page

**Purpose**: Browse and select migration workflows relevant to user's situation

**Layout Structure**:
```
┌─────────────────────────────────────────────────────────┐
│ Top Nav + Sidebar                                        │
├──────────┬──────────────────────────────────────────────┤
│          │  Workflows                                   │
│ Sidebar  │  Choose the workflows that match your goals  │
│          │                                              │
│          │  Recommended for You (based on profile)     │
│          │  ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│          │  │ Digital  │ │   NIE    │ │Empadron- │    │
│          │  │  Nomad   │ │Application│ │ amiento  │    │
│          │  │  Visa    │ │          │ │          │    │
│          │  │          │ │          │ │          │    │
│          │  │ 8 steps  │ │ 6 steps  │ │ 4 steps  │    │
│          │  │ ~3 weeks │ │ ~2 weeks │ │ ~1 week  │    │
│          │  │[Start →] │ │[Start →] │ │[Start →] │    │
│          │  └──────────┘ └──────────┘ └──────────┘    │
│          │                                              │
│          │  All Workflows                               │
│          │  [Filter: All ▼] [Search workflows...]      │
│          │                                              │
│          │  Visa & Residency                            │
│          │  ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│          │  │Non-Lucra-│ │ Student  │ │  Work    │    │
│          │  │tive Visa │ │  Visa    │ │  Visa    │    │
│          │  └──────────┘ └──────────┘ └──────────┘    │
│          │                                              │
│          │  Administrative                              │
│          │  ┌──────────┐ ┌──────────┐                  │
│          │  │   TIE    │ │  Social  │                  │
│          │  │Application│ │ Security │                  │
│          │  └──────────┘ └──────────┘                  │
└──────────┴──────────────────────────────────────────────┘
```

**Key Components**:
1. **Page Header**
   - Title: "Workflows"
   - Subtitle explaining purpose
   - Generous top padding (48px)

2. **Recommended Section** (top)
   - 3 workflow cards (horizontal)
   - "Recommended for You" label
   - Based on user profile

3. **Workflow Cards**
   - Icon/illustration at top
   - Workflow name (bold)
   - Brief description (2 lines)
   - Metadata: steps count, estimated time
   - Status badge (Not Started, In Progress, Completed)
   - Primary action button

4. **All Workflows Section**
   - Filter dropdown (by category)
   - Search bar
   - Grouped by category
   - Grid layout (3 columns desktop, 2 tablet, 1 mobile)

---

## 4. Workflow Stepper Page

**Purpose**: Guide users through multi-step workflow with clear progress

**Layout Structure**:
```
┌─────────────────────────────────────────────────────────┐
│ Top Nav + Sidebar                                        │
├──────────┬──────────────────────────────────────────────┤
│          │  ← Back to Workflows                         │
│ Sidebar  │                                              │
│          │  Digital Nomad Visa Application              │
│          │  Step 3 of 8: Gather Required Documents      │
│          │                                              │
│          │  Progress: ●●●○○○○○ 38%                     │
│          │                                              │
│          │  ┌────────────────────────────────────────┐ │
│          │  │ Step Content Area                      │ │
│          │  │                                        │ │
│          │  │ Required Documents                     │ │
│          │  │ ─────────────────                      │ │
│          │  │                                        │ │
│          │  │ You'll need the following documents:   │ │
│          │  │                                        │ │
│          │  │ ☑ Valid Passport                       │ │
│          │  │   [View in vault]                      │ │
│          │  │                                        │ │
│          │  │ ☐ Proof of Income ($2,400/month)       │ │
│          │  │   [Upload document]                    │ │
│          │  │                                        │ │
│          │  │ ☐ Health Insurance Certificate         │ │
│          │  │   [Upload document]                    │ │
│          │  │                                        │ │
│          │  │ ☐ Criminal Background Check            │ │
│          │  │   [Upload document]                    │ │
│          │  │                                        │ │
│          │  │ ℹ️ Tip: All documents must be less    │ │
│          │  │   than 90 days old                     │ │
│          │  │                                        │ │
│          │  └────────────────────────────────────────┘ │
│          │                                              │
│          │  [← Previous Step]    [Mark Complete →]     │
│          │                                              │
│          │  ┌────────────────────────────────────────┐ │
│          │  │ Need Help?                             │ │
│          │  │ Ask the AI Assistant about this step   │ │
│          │  │ [Ask a question...]                    │ │
│          │  └────────────────────────────────────────┘ │
└──────────┴──────────────────────────────────────────────┘
```

**Key Components**:
1. **Workflow Header**
   - Back navigation
   - Workflow name
   - Current step indicator (X of Y)
   - Progress bar with percentage

2. **Step Content Card** (centered, max-width: 800px)
   - Step title
   - Instructions/description
   - Interactive checklist or form
   - Contextual help text
   - Related actions (upload, view, etc.)

3. **Navigation Buttons** (bottom of card)
   - Previous step (secondary, left)
   - Skip step (if optional, center)
   - Complete/Next step (primary, right)

4. **Help Widget** (below main card)
   - Quick link to AI assistant
   - Contextual to current step
   - Collapsible

5. **Sidebar Progress** (optional, desktop only)
   - All steps listed
   - Current step highlighted
   - Completed steps checked
   - Click to jump to step (if allowed)

---

## 5. Document Vault Page

**Purpose**: Secure storage and management of uploaded documents

**Layout Structure**:
```
┌─────────────────────────────────────────────────────────┐
│ Top Nav + Sidebar                                        │
├──────────┬──────────────────────────────────────────────┤
│          │  Document Vault                              │
│ Sidebar  │  Securely store and manage your documents    │
│          │                                              │
│          │  [+ Upload Document]  [Search docs...]       │
│          │                                              │
│          │  Filter: [All Categories ▼] [All Types ▼]   │
│          │                                              │
│          │  Identity Documents (3)                      │
│          │  ┌──────────────────────────────────────┐   │
│          │  │ 📄 US Passport                       │   │
│          │  │    Uploaded: Nov 15, 2024            │   │
│          │  │    Status: ✓ Verified                │   │
│          │  │    [View] [Download] [Delete]        │   │
│          │  └──────────────────────────────────────┘   │
│          │  ┌──────────────────────────────────────┐   │
│          │  │ 📄 Birth Certificate                 │   │
│          │  │    Uploaded: Nov 16, 2024            │   │
│          │  │    Status: ⏳ Processing OCR         │   │
│          │  │    [View] [Download] [Delete]        │   │
│          │  └──────────────────────────────────────┘   │
│          │                                              │
│          │  Financial Documents (2)                     │
│          │  ┌──────────────────────────────────────┐   │
│          │  │ 📄 Bank Statement - October          │   │
│          │  │    Uploaded: Nov 10, 2024            │   │
│          │  │    Status: ✓ Verified                │   │
│          │  │    Extracted: Balance $45,230        │   │
│          │  │    [View] [Download] [Delete]        │   │
│          │  └──────────────────────────────────────┘   │
│          │                                              │
│          │  [Load More...]                              │
└──────────┴──────────────────────────────────────────────┘
```

**Key Components**:
1. **Page Header**
   - Title and description
   - Upload button (primary action, top right)
   - Search bar

2. **Filters** (below header)
   - Category dropdown
   - Document type dropdown
   - Sort options

3. **Document Groups** (by category)
   - Category header with count
   - Collapsible sections
   - Documents listed within

4. **Document Card** (list item)
   - Document icon/thumbnail
   - Document name (editable)
   - Upload date
   - Status badge (Verified, Processing, Failed)
   - Extracted data preview (if available)
   - Action buttons (View, Download, Delete)

5. **Upload Modal** (triggered by upload button)
   - Drag-and-drop zone
   - File browser button
   - File type restrictions shown
   - Progress indicator during upload

6. **Empty State** (when no documents)
   - Illustration
   - "No documents yet"
   - Upload button

---

## 6. Form Generator Page

**Purpose**: Auto-fill Spanish administrative forms using user data

**Layout Structure**:
```
┌─────────────────────────────────────────────────────────┐
│ Top Nav + Sidebar                                        │
├──────────┬──────────────────────────────────────────────┤
│          │  Form Generator                              │
│ Sidebar  │  Generate pre-filled Spanish forms           │
│          │                                              │
│          │  Select Form Type                            │
│          │  ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│          │  │   NIE    │ │   TIE    │ │Empadron- │    │
│          │  │Application│ │Application│ │ amiento  │    │
│          │  │          │ │          │ │          │    │
│          │  │ [Select] │ │ [Select] │ │ [Select] │    │
│          │  └──────────┘ └──────────┘ └──────────┘    │
│          │                                              │
│          │  ─────────────────────────────────────────  │
│          │                                              │
│          │  NIE Application Form                        │
│          │                                              │
│          │  Form Preview                                │
│          │  ┌────────────────────────────────────────┐ │
│          │  │ Personal Information                   │ │
│          │  │                                        │ │
│          │  │ Full Name: ✓ John Smith                │ │
│          │  │ Date of Birth: ✓ 01/15/1985            │ │
│          │  │ Nationality: ✓ United States           │ │
│          │  │ Passport Number: ✓ 123456789           │ │
│          │  │                                        │ │
│          │  │ Spanish Address                        │ │
│          │  │ Street: ⚠️ [Required - Enter manually] │ │
│          │  │ City: ⚠️ [Required - Enter manually]   │ │
│          │  │ Postal Code: ⚠️ [Required]             │ │
│          │  │                                        │ │
│          │  │ Contact Information                    │ │
│          │  │ Email: ✓ john@example.com              │ │
│          │  │ Phone: ⚠️ [Spanish number required]    │ │
│          │  │                                        │ │
│          │  │ Completion: 70% (7 of 10 fields)       │ │
│          │  └────────────────────────────────────────┘ │
│          │                                              │
│          │  [Edit Fields]  [Download PDF]               │
│          │                                              │
│          │  ℹ️ Missing fields must be completed before │
│          │     downloading                              │
└──────────┴──────────────────────────────────────────────┘
```

**Key Components**:
1. **Form Type Selection** (top)
   - Cards for each form type
   - Form name and description
   - Select button
   - Shows which forms are available

2. **Form Preview** (main area)
   - Grouped by sections
   - Field name and value
   - Status indicator per field:
     - ✓ Auto-filled from profile/documents
     - ⚠️ Missing/requires manual entry
     - ✏️ Manually edited
   - Editable fields inline or via modal

3. **Completion Indicator**
   - Progress bar
   - X of Y fields completed
   - List of missing fields

4. **Actions** (bottom)
   - Edit fields button (opens edit modal)
   - Download PDF button (disabled if incomplete)
   - Save draft button

5. **Edit Modal** (when editing)
   - Form with all fields
   - Pre-filled values
   - Validation messages
   - Save/Cancel buttons

---

## 7. AI Assistant Chat Page

**Purpose**: Conversational interface for questions and guidance

**Layout Structure**:
```
┌─────────────────────────────────────────────────────────┐
│ Top Nav + Sidebar                                        │
├──────────┬──────────────────────────────────────────────┤
│          │  AI Assistant                                │
│ Sidebar  │  Ask questions about your migration process  │
│          │                                              │
│          │  ┌────────────────────────────────────────┐ │
│          │  │ Chat History                           │ │
│          │  │                                        │ │
│          │  │ [User]                                 │ │
│          │  │ What documents do I need for a         │ │
│          │  │ digital nomad visa?                    │ │
│          │  │                                        │ │
│          │  │ [Assistant] 🤖                         │ │
│          │  │ For a Spanish digital nomad visa,      │ │
│          │  │ you'll need:                           │ │
│          │  │ • Valid passport                       │ │
│          │  │ • Proof of remote employment           │ │
│          │  │ • Health insurance certificate         │ │
│          │  │ • Criminal background check            │ │
│          │  │                                        │ │
│          │  │ Source: Spanish Ministry of Foreign    │ │
│          │  │ Affairs [↗]                            │ │
│          │  │                                        │ │
│          │  │ Suggested questions:                   │ │
│          │  │ • How long does processing take?       │ │
│          │  │ • What are the income requirements?    │ │
│          │  │                                        │ │
│          │  │ [User]                                 │ │
│          │  │ What are the income requirements?      │ │
│          │  │                                        │ │
│          │  │ [Assistant] 🤖                         │ │
│          │  │ You need to demonstrate a minimum      │ │
│          │  │ monthly income of €2,400...            │ │
│          │  │                                        │ │
│          │  └────────────────────────────────────────┘ │
│          │                                              │
│          │  ┌────────────────────────────────────────┐ │
│          │  │ [Type your question...]            [→] │ │
│          │  └────────────────────────────────────────┘ │
│          │                                              │
│          │  Quick Actions:                              │
│          │  [Clear conversation] [Export chat]          │
└──────────┴──────────────────────────────────────────────┘
```

**Key Components**:
1. **Chat History** (scrollable area)
   - User messages (right-aligned, colored background)
   - Assistant messages (left-aligned, different color)
   - Timestamps (subtle, on hover)
   - Message grouping by conversation

2. **Assistant Messages**
   - Bot avatar/icon
   - Formatted text (markdown support)
   - Source citations (links)
   - Confidence indicator (if low confidence)
   - Suggested follow-up questions (buttons)
   - Copy message button

3. **User Messages**
   - User avatar
   - Plain text
   - Edit/delete options (on hover)

4. **Input Area** (bottom, sticky)
   - Text input (auto-expanding)
   - Send button
   - Character count (if limit)
   - Typing indicator when assistant is responding

5. **Quick Actions** (below input)
   - Clear conversation
   - Export chat history
   - New conversation

6. **Empty State** (when no messages)
   - Welcome message
   - Suggested starter questions
   - Example queries

---

## 8. Appointment Calendar Page

**Purpose**: Track and manage appointments with Spanish authorities

**Layout Structure**:
```
┌─────────────────────────────────────────────────────────┐
│ Top Nav + Sidebar                                        │
├──────────┬──────────────────────────────────────────────┤
│          │  Appointments                                │
│ Sidebar  │  Manage your appointments and deadlines      │
│          │                                              │
│          │  [+ New Appointment]  [View: Calendar ▼]     │
│          │                                              │
│          │  December 2024                               │
│          │  ┌────────────────────────────────────────┐ │
│          │  │ Sun Mon Tue Wed Thu Fri Sat            │ │
│          │  │  1   2   3   4   5   6   7             │ │
│          │  │  8   9  10  11  12  13  14             │ │
│          │  │ 15 [16] 17  18  19 [20] 21             │ │
│          │  │ 22  23  24  25  26  27  28             │ │
│          │  │ 29  30  31                             │ │
│          │  │                                        │ │
│          │  │ [16] = NIE Appointment                 │ │
│          │  │ [20] = Document Translation Due        │ │
│          │  └────────────────────────────────────────┘ │
│          │                                              │
│          │  Upcoming Appointments                       │
│          │  ┌────────────────────────────────────────┐ │
│          │  │ 📅 NIE Appointment                     │ │
│          │  │    Dec 16, 2024 at 10:00 AM            │ │
│          │  │    📍 Police Station - Madrid          │ │
│          │  │    📄 Required: Passport, Photos       │ │
│          │  │    🔔 Reminders: 7d, 3d, 1d            │ │
│          │  │    [View Details] [Edit] [Cancel]      │ │
│          │  └────────────────────────────────────────┘ │
│          │  ┌────────────────────────────────────────┐ │
│          │  │ 📅 Document Translation Deadline       │ │
│          │  │    Dec 20, 2024                        │ │
│          │  │    📄 Birth Certificate, Diploma       │ │
│          │  │    [Mark Complete] [Edit]              │ │
│          │  └────────────────────────────────────────┘ │
│          │                                              │
│          │  Past Appointments (2)                       │
│          │  [Show past appointments...]                 │
└──────────┴──────────────────────────────────────────────┘
```

**Key Components**:
1. **View Toggle** (top right)
   - Calendar view
   - List view
   - Timeline view

2. **Calendar Widget** (month view)
   - Current month displayed
   - Navigation arrows (prev/next month)
   - Days with appointments highlighted
   - Click day to see details
   - Color coding by appointment type

3. **Appointment List** (below calendar or in list view)
   - Grouped by time (Upcoming, Today, Past)
   - Sorted chronologically

4. **Appointment Card**
   - Appointment type icon
   - Title
   - Date and time
   - Location with map link
   - Required documents list
   - Reminder settings
   - Status badge
   - Action buttons (View, Edit, Cancel, Mark Complete)

5. **New Appointment Modal**
   - Form fields:
     - Appointment type (dropdown)
     - Title
     - Date and time pickers
     - Location
     - Required documents (checklist)
     - Notes
     - Reminder preferences
   - Save/Cancel buttons

6. **Export Options**
   - Export to iCal
   - Export to Google Calendar
   - Print view

---

## 9. Cost Tracker Page

**Purpose**: Monitor expenses and budget for migration process

**Layout Structure**:
```
┌─────────────────────────────────────────────────────────┐
│ Top Nav + Sidebar                                        │
├──────────┬──────────────────────────────────────────────┤
│          │  Cost Tracker                                │
│ Sidebar  │  Track your migration expenses               │
│          │                                              │
│          │  Currency: [USD ▼]  [+ Add Expense]          │
│          │                                              │
│          │  ┌────────────────────────────────────────┐ │
│          │  │ Total Budget Overview                  │ │
│          │  │                                        │ │
│          │  │ Estimated Total: $8,500                │ │
│          │  │ Total Spent:     $3,200                │ │
│          │  │ Remaining:       $5,300                │ │
│          │  │                                        │ │
│          │  │ [Progress Bar: 38% spent]              │ │
│          │  └────────────────────────────────────────┘ │
│          │                                              │
│          │  Breakdown by Category                       │
│          │  ┌────────────────────────────────────────┐ │
│          │  │ Visa Fees                              │ │
│          │  │ Estimated: $1,200  Spent: $1,200       │ │
│          │  │ [████████████████████] 100%            │ │
│          │  │                                        │ │
│          │  │ • Digital Nomad Visa Fee - $1,200 ✓    │ │
│          │  │   Paid: Nov 10, 2024                   │ │
│          │  └────────────────────────────────────────┘ │
│          │  ┌────────────────────────────────────────┐ │
│          │  │ Document Translations                  │ │
│          │  │ Estimated: $800    Spent: $400         │ │
│          │  │ [██████████          ] 50%             │ │
│          │  │                                        │ │
│          │  │ • Birth Certificate - $200 ✓           │ │
│          │  │   Paid: Nov 5, 2024                    │ │
│          │  │ • Diploma Translation - $200 ✓         │ │
│          │  │   Paid: Nov 12, 2024                   │ │
│          │  │ • Marriage Certificate - $200 ⏳       │ │
│          │  │   Due: Dec 15, 2024                    │ │
│          │  │ • Criminal Record - $200 ⏳            │ │
│          │  │   Due: Dec 20, 2024                    │ │
│          │  └────────────────────────────────────────┘ │
│          │  ┌────────────────────────────────────────┐ │
│          │  │ Legal Services                         │ │
│          │  │ Estimated: $2,500  Spent: $1,600       │ │
│          │  │ [████████████        ] 64%             │ │
│          │  └────────────────────────────────────────┘ │
│          │                                              │
│          │  [View All Expenses...]                      │
└──────────┴──────────────────────────────────────────────┘
```

**Key Components**:
1. **Currency Selector** (top right)
   - Toggle between USD and EUR
   - Shows current exchange rate

2. **Total Summary Card** (top)
   - Estimated total
   - Total spent
   - Remaining budget
   - Overall progress bar
   - Visual indicator (green if under budget, red if over)

3. **Category Breakdown** (accordion or cards)
   - Category name
   - Estimated vs spent
   - Progress bar
   - Expandable to show individual expenses

4. **Expense Items** (within categories)
   - Expense description
   - Amount
   - Status (Paid ✓, Pending ⏳, Overdue ⚠️)
   - Date (paid or due)
   - Edit/Delete buttons (on hover)

5. **Add Expense Modal**
   - Form fields:
     - Description
     - Amount
     - Category (dropdown)
     - Status (Paid/Pending)
     - Date
     - Notes
   - Save/Cancel buttons

6. **Export Options**
   - Export to CSV
   - Print summary
   - Generate expense report

---

## 10. Regional Resources Page

**Purpose**: Browse region-specific guides and information

**Layout Structure**:
```
┌─────────────────────────────────────────────────────────┐
│ Top Nav + Sidebar                                        │
├──────────┬──────────────────────────────────────────────┤
│          │  Regional Resources                          │
│ Sidebar  │  Guides and information for your region      │
│          │                                              │
│          │  Select Your Region                          │
│          │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐       │
│          │  │Madrid│ │Barce-│ │Valen-│ │Seville│       │
│          │  │  ✓   │ │ lona │ │ cia  │ │      │       │
│          │  └──────┘ └──────┘ └──────┘ └──────┘       │
│          │  ┌──────┐ ┌──────┐ ┌──────┐                │
│          │  │Malaga│ │Bilbao│ │Other │                │
│          │  └──────┘ └──────┘ └──────┘                │
│          │                                              │
│          │  Resources for Madrid                        │
│          │  [Search resources...]                       │
│          │                                              │
│          │  Administrative Offices                      │
│          │  ┌────────────────────────────────────────┐ │
│          │  │ 🏛️ National Police Station - Madrid    │ │
│          │  │    Address: Calle de los Madrazo, 9    │ │
│          │  │    Hours: Mon-Fri 9:00-14:00           │ │
│          │  │    Services: NIE, TIE applications     │ │
│          │  │    [View on map] [Get directions]      │ │
│          │  └────────────────────────────────────────┘ │
│          │  ┌────────────────────────────────────────┐ │
│          │  │ 🏛️ Tax Office - Madrid Centro          │ │
│          │  │    Address: Calle Alcalá, 45           │ │
│          │  │    Hours: Mon-Fri 9:00-14:00           │ │
│          │  │    [View on map] [Get directions]      │ │
│          │  └────────────────────────────────────────┘ │
│          │                                              │
│          │  Healthcare                                  │
│          │  ┌────────────────────────────────────────┐ │
│          │  │ 📖 Healthcare System Guide             │ │
│          │  │    Learn about Spanish healthcare,     │ │
│          │  │    insurance, and registration         │ │
│          │  │    [Read guide →]                      │ │
│          │  └────────────────────────────────────────┘ │
│          │                                              │
│          │  Banking & Finance                           │
│          │  Housing & Rentals                           │
│          │  Transportation                              │
│          │  Expat Communities                           │
│          │                                              │
│          │  [Load more resources...]                    │
└──────────┴──────────────────────────────────────────────┘
```

**Key Components**:
1. **Region Selector** (top)
   - Cards or buttons for major regions
   - Current selection highlighted
   - "Other" option for less common regions

2. **Search Bar**
   - Search within selected region
   - Filter by resource type

3. **Resource Categories** (accordion or sections)
   - Administrative Offices
   - Healthcare
   - Banking & Finance
   - Housing & Rentals
   - Transportation
   - Cultural Guides
   - Expat Communities
   - Local Services

4. **Resource Cards**
   - Icon representing type
   - Title
   - Brief description
   - Key details (address, hours, contact)
   - Action buttons (View map, Get directions, Read guide)
   - Last updated date

5. **Map Integration** (optional, right sidebar)
   - Shows locations of offices/services
   - Click markers to see details

6. **Empty State** (if no resources for region)
   - Message explaining
   - Suggest selecting different region
   - Link to general resources

---

## Common UI Patterns

### Navigation Bar (Top)
```
┌─────────────────────────────────────────────────────────┐
│ [Logo] US→Spain Migration    [🔍] [🔔3] [👤 John ▼]    │
└─────────────────────────────────────────────────────────┘
```
- Logo and app name (left)
- Search icon (center-right)
- Notifications icon with badge (right)
- User profile dropdown (far right)

### Sidebar Navigation
```
┌──────────┐
│ [Logo]   │
│          │
│ 🏠 Home  │
│ 👤 Profile│
│ 📋 Workflows│
│ 📄 Documents│
│ 📝 Forms │
│ 💬 Chat  │
│ 📅 Calendar│
│ 💰 Costs │
│ 📍 Resources│
│          │
│ ⚙️ Settings│
│ ❓ Help  │
└──────────┘
```
- Collapsible on mobile (hamburger menu)
- Active page highlighted
- Icons + labels
- Settings and Help at bottom

### Card Component
```
┌────────────────────────────────┐
│ [Icon] Title                   │
│                                │
│ Description text goes here     │
│ and can span multiple lines    │
│                                │
│ Metadata: value                │
│                                │
│ [Primary Action] [Secondary]   │
└────────────────────────────────┘
```
- Consistent padding (24px)
- Rounded corners (8px)
- Subtle shadow
- Hover state (slight elevation)

### Button Styles
- **Primary**: Solid color, white text, used for main actions
- **Secondary**: Outline, colored text, used for secondary actions
- **Tertiary**: Text only, used for less important actions
- **Danger**: Red color, used for destructive actions

### Form Fields
```
Label *
[_________________________]
Helper text or error message
```
- Label above field
- Required indicator (*)
- Clear focus state
- Validation messages below
- Consistent height (40px)

### Status Badges
- **Success**: Green background, "✓ Completed"
- **Warning**: Yellow background, "⚠️ Attention needed"
- **Info**: Blue background, "ℹ️ In progress"
- **Error**: Red background, "✗ Failed"

### Empty States
```
┌────────────────────────────────┐
│                                │
│        [Illustration]          │
│                                │
│     No items yet               │
│     Get started by...          │
│                                │
│     [Primary Action]           │
│                                │
└────────────────────────────────┘
```
- Centered content
- Friendly illustration
- Clear message
- Call-to-action button

### Loading States
- Skeleton screens for content loading
- Spinner for actions in progress
- Progress bars for file uploads
- Shimmer effect for placeholders

### Modal/Dialog
```
┌─────────────────────────────────┐
│ Title                      [✕]  │
├─────────────────────────────────┤
│                                 │
│ Content area                    │
│                                 │
├─────────────────────────────────┤
│              [Cancel] [Confirm] │
└─────────────────────────────────┘
```
- Overlay background (semi-transparent)
- Centered on screen
- Close button (top right)
- Actions at bottom

---

## Responsive Behavior

### Mobile (< 768px)
- Sidebar collapses to hamburger menu
- Single column layout
- Stack cards vertically
- Full-width buttons
- Larger touch targets (min 44px)
- Simplified navigation

### Tablet (768px - 1024px)
- Sidebar can be toggled
- 2-column grid for cards
- Flexible layouts
- Optimized for both portrait and landscape

### Desktop (> 1024px)
- Full sidebar visible
- 3-4 column grids
- Hover states active
- Keyboard shortcuts enabled
- Maximum content width: 1440px

---

## Accessibility Considerations

- **Keyboard Navigation**: All interactive elements accessible via Tab
- **Focus Indicators**: Clear visual focus states (2px outline)
- **ARIA Labels**: Proper labels for screen readers
- **Color Contrast**: Minimum 4.5:1 for text
- **Alt Text**: All images have descriptive alt text
- **Semantic HTML**: Proper heading hierarchy (h1, h2, h3)
- **Skip Links**: "Skip to main content" link at top
- **Error Messages**: Associated with form fields via aria-describedby

---

## Animation Guidelines

- **Duration**: 200-300ms for most transitions
- **Easing**: ease-in-out for natural feel
- **Purpose**: Animations should guide attention, not distract
- **Reduced Motion**: Respect prefers-reduced-motion setting
- **Examples**:
  - Page transitions: fade in
  - Modal open/close: scale + fade
  - Dropdown menus: slide down
  - Notifications: slide in from top
  - Loading: subtle pulse or spin

---

## Next Steps

1. **Review this specification** with stakeholders
2. **Create wireframes in Figma** based on these layouts
3. **Export wireframes** as PNG/PDF to `.kiro/specs/us-to-spain-consumer-ui/wireframes/`
4. **Iterate** based on feedback
5. **Proceed to high-fidelity mockups** once wireframes are approved

