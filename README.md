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

Create a `.env.local` file in the `app` folder for the frontend:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Importante**: El frontend **no** utiliza la service role key. La creación y edición de usuarios se hace mediante la Edge Function `admin-users`, que valida el JWT y el rol admin en el servidor. En Vercel solo hace falta `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.

Para **scripts locales** (seed, create_user, import_tickets, check_tables) se usa la variable `SUPABASE_SERVICE_KEY` en el entorno (p. ej. en `.env.local` en la raíz o donde se ejecuten). No uses el prefijo `VITE_` para esa clave; no debe estar en el build del frontend.

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
├── scripts/                # Utility scripts (usan SUPABASE_SERVICE_KEY en local)
│   ├── seed_entities.js    # Seed entities from CSV
│   ├── create_user.js      # Create admin user
│   ├── import_tickets.py   # Import tickets from Excel
│   └── check_tables.py     # Check notifications/attachments tables
├── supabase/               # Database migrations + Edge Functions
│   ├── functions/          # admin-users, send-notification-email, etc.
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
4. Add environment variables in Vercel dashboard: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (no incluir la service key).

Para la gestión de usuarios (crear/editar) desde la app se usa la Edge Function `admin-users`. Ver `docs/integracion-mojito360.md` para detalles de todas las Edge Functions.
