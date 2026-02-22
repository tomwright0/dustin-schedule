# Dustin Schedule

Small local web app for creating cleaning events in Google Calendar.

## Features

- Title: `Dustin Schedule`
- Proper date/time picker UI
- Two event options:
  - `Vacuum Only`
  - `Full Clean`
- Creates events on your Google Calendar
- Embedded Google Calendar view in the page
- Dockerized for local hosting

## 1) Google setup

1. In Google Cloud Console, create/select a project.
2. Enable **Google Calendar API**.
3. Configure OAuth consent screen (external/internal as needed).
4. Create OAuth Client ID (Web app).
5. Add authorized redirect URI:
   - `http://localhost:3000/auth/google/callback`
   - Add your Tailscale-hosted callback URI too if needed.

## 2) Configure app

1. Copy `.env.example` to `.env`.
2. Fill in:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `SESSION_SECRET`
   - `GOOGLE_TARGET_CALENDAR_ID` (set to `primary` or your `...@group.calendar.google.com` ID)
   - Optional account restriction:
     - `ALLOWED_GOOGLE_EMAILS=you@gmail.com,other@gmail.com`
3. Optional: set `GOOGLE_CALENDAR_EMBED_URL` to your calendar's embed URL.

## 3) Run with Docker

```bash
docker compose up --build -d
```

Open:

- `http://localhost:3000`

## 4) Use

1. Click **Sign in with Google**.
2. Pick date/time.
3. Click **Vacuum Only** or **Full Clean**.
4. Confirm in the embedded calendar panel.
