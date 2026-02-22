const path = require("path");
const express = require("express");
const session = require("express-session");
const { google } = require("googleapis");
const dotenv = require("dotenv");

dotenv.config();

const {
  PORT = 3000,
  SESSION_SECRET = "change-me",
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
  GOOGLE_CALENDAR_EMBED_URL,
  ALLOWED_GOOGLE_EMAILS = "",
  GOOGLE_TARGET_CALENDAR_ID = "primary"
} = process.env;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
  // eslint-disable-next-line no-console
  console.warn(
    "Missing Google OAuth configuration. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI."
  );
}

const app = express();

app.use(express.json());
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false
    }
  })
);

app.use(express.static(path.join(__dirname, "public")));

function buildOAuthClient() {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
}

function isEmailAllowed(email) {
  const allowed = ALLOWED_GOOGLE_EMAILS
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  // Empty list means no restriction.
  if (!allowed.length) {
    return true;
  }

  return allowed.includes((email || "").toLowerCase());
}

function requireAuth(req, res, next) {
  if (!req.session.tokens) {
    return res.status(401).json({ error: "Not authenticated. Use Sign in first." });
  }
  return next();
}

app.get("/auth/google", (req, res) => {
  const oauth2Client = buildOAuthClient();
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/userinfo.email",
      "openid",
      "email",
      "profile"
    ]
  });
  res.redirect(authUrl);
});

app.get("/auth/google/callback", async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).send("Missing auth code.");
    }

    const oauth2Client = buildOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const me = await oauth2.userinfo.get();
    const email = me.data.email;

    if (!isEmailAllowed(email)) {
      return res.status(403).send("This Google account is not allowed to use Dustin Schedule.");
    }

    req.session.tokens = tokens;
    req.session.userEmail = email;
    return res.redirect("/");
  } catch (error) {
    return res.status(500).send(`Google auth failed: ${error.message}`);
  }
});

app.get("/api/auth/status", (req, res) => {
  res.json({
    authenticated: Boolean(req.session.tokens),
    email: req.session.userEmail || null
  });
});

app.post("/api/events", requireAuth, async (req, res) => {
  try {
    const { startDateTime, type } = req.body;
    const validTypes = ["Vacuum Only", "Full Clean"];
    if (!startDateTime || !validTypes.includes(type)) {
      return res.status(400).json({
        error: "Invalid payload. Expected startDateTime and type ('Vacuum Only'|'Full Clean')."
      });
    }

    const start = new Date(startDateTime);
    if (Number.isNaN(start.getTime())) {
      return res.status(400).json({ error: "Invalid date/time." });
    }

    // Default duration is 1 hour.
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const oauth2Client = buildOAuthClient();
    oauth2Client.setCredentials(req.session.tokens);

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    const event = {
      summary: type,
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() }
    };

    const result = await calendar.events.insert({
      calendarId: GOOGLE_TARGET_CALENDAR_ID,
      requestBody: event
    });

    return res.json({
      message: "Event created.",
      eventId: result.data.id,
      eventLink: result.data.htmlLink
    });
  } catch (error) {
    if (
      error &&
      error.code === 403 &&
      typeof error.message === "string" &&
      error.message.toLowerCase().includes("insufficient permission")
    ) {
      req.session.destroy(() => {});
      return res.status(403).json({
        error:
          "Google token is missing calendar write permission. Please sign in again and grant Calendar access."
      });
    }
    return res.status(500).json({ error: `Failed to create event: ${error.message}` });
  }
});

app.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get("/api/embed-url", (req, res) => {
  res.json({
    embedUrl:
      GOOGLE_CALENDAR_EMBED_URL ||
      "https://calendar.google.com/calendar/embed?showTitle=0&showTabs=0&showCalendars=0"
  });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Dustin Schedule running on http://localhost:${PORT}`);
});
