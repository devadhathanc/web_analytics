// Base API URL: Defaults to localhost:5005 for local dev, or NEXT_PUBLIC_API_URL in production (e.g. Render)
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5005';
