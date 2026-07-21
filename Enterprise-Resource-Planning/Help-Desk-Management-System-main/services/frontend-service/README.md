# Frontend Service

Next.js frontend application for HDMS.

## Configuration

This frontend service is configured to call the **API Gateway** instead of individual microservices.

## Environment Variables

- `NEXT_PUBLIC_API_GATEWAY_URL` - API Gateway URL (default: http://localhost/api/v1)
- `NEXT_PUBLIC_WS_URL` - WebSocket Gateway URL (default: ws://localhost/ws)

## API Calls

All API calls go through the gateway:
- `GET /api/v1/tickets/` → API Gateway → Ticket Service
- `POST /api/v1/auth/login` → API Gateway → User Service
- `GET /api/v1/notifications/` → API Gateway → Communication Service

## WebSocket

WebSocket connections also go through gateway:
- `ws://gateway/ws/chat/{ticket_id}/` → API Gateway → Communication Service

## Development

```bash
npm install
npm run dev
```

## Production Build

```bash
npm run build
npm start
```

## Docker

```bash
docker build -t hdms-frontend .
docker run -p 3000:3000 hdms-frontend
```


