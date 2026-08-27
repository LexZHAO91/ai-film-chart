# AI Film Chart

A global AI film ranking platform built with Cloudflare Workers, D1, and React.

## Architecture

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Cloudflare Workers
- **Database**: Cloudflare D1
- **AI**: Cloudflare Workers AI
- **Scheduled Jobs**: Cloudflare Cron

## Project Structure

```
ai-film-chart/
├── frontend/          # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── types/
│   │   └── utils/
│   └── ...
├── backend/           # Cloudflare Workers backend
│   ├── src/
│   │   ├── ai/        # AI classification interface
│   │   ├── db/        # Database schema and client
│   │   ├── discovery/ # Data source adapters
│   │   ├── models/    # Database models
│   │   ├── ranking/   # Ranking engine
│   │   ├── routes/    # API routes
│   │   ├── services/  # Business services
│   │   ├── types/     # TypeScript types
│   │   └── utils/     # Utilities
│   └── ...
```

## Development

### Backend

```bash
cd backend
npm run dev
```

### Frontend

```bash
cd frontend
npm run dev
```

## API Endpoints

### Public
- `GET /api/rankings/top100` - Get TOP 100 ranking
- `GET /api/rankings/rising50` - Get RISING 50 ranking
- `GET /api/rankings/new50` - Get NEW 50 ranking
- `GET /api/films` - List films
- `GET /api/films/:id` - Get film details

### Admin
- `GET /api/admin/dashboard` - Dashboard stats
- `GET /api/admin/candidates` - Review candidates
- `POST /api/admin/candidates/:id/approve` - Approve candidate
- `POST /api/admin/candidates/:id/reject` - Reject candidate
- `POST /api/admin/run-discovery` - Run discovery job
- `POST /api/admin/run-ranking` - Run ranking calculation
- `POST /api/admin/seed-mock-data` - Seed test data

## Ranking Algorithm v0.1

- **Popularity**: 35% (log-normalized views)
- **Momentum**: 25% (growth acceleration)
- **Engagement**: 15% (likes/comments ratio)
- **Audience**: 15% (Bayesian-adjusted ratings)
- **Quality**: 10% (AI analysis scores)

## Data Flow

```
YouTube Search → Rule Filter → AI Classification → D1 → Metrics → Ranking Engine → Snapshot → Website
```

## License

MIT
