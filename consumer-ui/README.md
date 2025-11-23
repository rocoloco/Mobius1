# US to Spain Migration Consumer UI

A Next.js-based web application that provides an intuitive, guided experience for US expats navigating the complex process of relocating to Spain.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **State Management**: Zustand
- **Form Handling**: React Hook Form + Zod
- **API Client**: Axios
- **Date Utilities**: date-fns

## Project Structure

```
consumer-ui/
├── app/              # Next.js App Router pages and layouts
├── components/       # React components
├── hooks/            # Custom React hooks
├── lib/              # Utility functions and shared code
├── types/            # TypeScript type definitions
└── public/           # Static assets
```

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Installation

Dependencies are already installed. If you need to reinstall:

```bash
npm install
```

### Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

Build for production:

```bash
npm run build
```

### Start Production Server

```bash
npm start
```

## Design Philosophy

This application follows a **simple, magical, yet functional** design philosophy:

- **Simplicity**: Remove unnecessary complexity, focus on essential features
- **Magical Experience**: Anticipate user needs, provide intelligent defaults
- **Functionality**: Every feature serves a clear purpose, prioritize reliability

## Key Features

- User profile management and personalized workflows
- Document vault with OCR and automatic classification
- AI-powered assistant for migration guidance
- Automated Spanish form generation
- Progress tracking and deadline management
- Appointment scheduling and reminders
- Cost tracking with currency conversion
- Regional resources and guides
- Mobile-responsive design

## Environment Variables

Create a `.env.local` file with the following variables:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_WORKSPACE_ID=your-workspace-id
```

## License

Private - Mobius 1 Platform
