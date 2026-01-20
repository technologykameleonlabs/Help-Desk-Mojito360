# Mojito360 Help Desk

Internal ticket management application built with React + Supabase.

## Tech Stack

- **Frontend**: React (Vite) + TypeScript
- **Styling**: TailwindCSS v4
- **State**: TanStack Query (React Query)
- **Backend**: Supabase (PostgreSQL, Auth, Realtime)
- **Icons**: Lucide React
- **Hosting**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
cd app
npm install
```

### Environment Variables

Create a `.env.local` file in the `app` folder:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Development

```bash
cd app
npm run dev
```

Open http://localhost:5173

### Build

```bash
npm run build
```

## Project Structure

```
├── app/                    # React application
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── hooks/          # React Query hooks
│   │   ├── lib/            # Supabase client
│   │   └── pages/          # Page components
│   └── ...
├── scripts/                # Utility scripts
│   ├── seed_entities.js    # Seed entities from CSV
│   └── create_user.js      # Create admin user
├── supabase/               # Database migrations
│   └── migrations/
└── input/                  # Source data
    └── odoo/
```

## Database Schema

- `profiles` - User profiles (extends auth.users)
- `entities` - Clients/partners
- `tickets` - Support tickets
- `comments` - Ticket comments

## Deployment

Deploy to Vercel:

1. Push to GitHub
2. Connect repo to Vercel
3. Set build settings:
   - Root Directory: `app`
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Add environment variables in Vercel dashboard
