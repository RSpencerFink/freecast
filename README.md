# Freecast

Freecast is a modern podcast discovery and analysis platform that allows users to search, explore, and extract insights from podcast content.

## Features

- **Podcast Discovery**: Search the iTunes/Apple Podcasts directory to find podcasts
- **Episode Browsing**: View and browse recent episodes from podcasts
- **Transcript Generation**: Generate transcripts of podcast episodes using both AssemblyAI and OpenAI
- **Chapter Analysis**: Automatically identify and segment podcast chapters
- **Advertisement Detection**: Identify advertising segments within podcasts and automatically skip them in playback
- **Audio Processing**: Split audio for more efficient processing

## Technologies

### Frontend

- **Next.js 15**: React framework with server-side rendering
- **React 18**: UI component library
- **Tailwind CSS**: Utility-first CSS framework for styling
- **TypeScript**: Typed JavaScript for better developer experience

### Backend

- **Next.js Server Actions**: Server-side functions for data fetching and processing
- **Drizzle ORM**: TypeScript ORM for database interactions
- **PostgreSQL**: Relational database for storing podcast data and transcripts
- **Python Integration**: For specialized audio processing tasks

### External APIs

- **AssemblyAI**: AI-powered audio transcription and chapter detection
- **OpenAI**: Natural language processing for transcript analysis
- **iTunes Search API**: For podcast discovery and metadata

### Development Tools

- **ESLint & Prettier**: Code quality and formatting
- **Drizzle Kit**: Database migration and management tools
- **TypeScript**: Static type checking

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables (see `.env.example`)
4. Start the development server: `npm run dev`
5. Optional: Run the database setup script: `./start-database.sh`

## Environment Variables

Create a `.env` file based on the `.env.example` template. Required variables include:

- Database connection strings
- API keys for AssemblyAI and OpenAI

## Development

- **Database migrations**: `npm run db:migrate`
- **Database schema updates**: `npm run db:push`
- **Linting**: `npm run lint`
- **Type checking**: `npm run typecheck`
- **Formatting**: `npm run format:write`

## License

MIT
