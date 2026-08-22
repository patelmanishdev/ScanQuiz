# ScanQuiz

Upload a photo of a textbook page → get an AI-generated multiple-choice practice
quiz → answers and scores are saved to your account's history.

- **Frontend:** plain HTML/CSS/JS (`public/index.html`) — no build step
- **Backend:** Node.js + Express
- **Database:** MongoDB (via Mongoose) — stores users and quiz history
- **Auth:** email + password, hashed with bcrypt, sessions via JWT
- **AI:** Google Gemini (`gemini-2.0-flash`) — the API key stays on the server,
  it is never sent to the browser

## 1. Install dependencies

```bash
npm install
```

## 2. Set up your environment variables

Copy the example file and fill in your real values:

```bash
cp .env.example .env
```

Then edit `.env`:

- `MONGO_URI` — a MongoDB connection string. Easiest option: create a free
  cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas), or point it
  at a local `mongod` instance (`mongodb://localhost:27017/scanquiz`).
- `JWT_SECRET` — any long random string. Generate one with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```
- `GEMINI_API_KEY` — a free key from
  [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
- `PORT` — defaults to `5000`.

`.env` is already listed in `.gitignore`, so it will never be committed or
exposed to the browser.

## 3. Run it

```bash
npm start        # production
npm run dev       # auto-restart on changes (requires nodemon, already in devDependencies)
```

Then open **http://localhost:5000**.

## How it works

1. A visitor signs up or logs in (`/api/auth/register`, `/api/auth/login`) —
   password is hashed with bcrypt, and a JWT is issued and stored in
   `localStorage` on the client.
2. Once logged in, they upload a photo of a textbook page and choose how many
   questions and what difficulty they want.
3. The browser sends the image to `POST /api/quiz/generate` (with the JWT in
   the `Authorization` header). The **server** — not the browser — calls the
   Gemini API using `GEMINI_API_KEY` from `.env`, and returns the generated
   questions.
4. The quiz renders as a scantron-style bubble sheet. On submit, the score is
   computed and the whole attempt (questions, chosen answers, score) is saved
   via `POST /api/quiz/submit` into the `quizattempts` MongoDB collection.
5. The **History** tab in the nav calls `GET /api/quiz/history` to list past
   attempts for the logged-in user, and clicking one loads the full attempt
   (`GET /api/quiz/history/:id`) in a read-only review view.

## Project structure

```
scanquiz/
├── server.js              # Express app entry point
├── config/db.js           # MongoDB connection
├── middleware/auth.js     # JWT verification middleware
├── models/
│   ├── User.js
│   └── QuizAttempt.js
├── routes/
│   ├── auth.js            # register / login / me
│   └── quiz.js            # generate / submit / history
├── public/
│   └── index.html         # entire frontend (HTML+CSS+JS, no build step)
├── .env.example
└── package.json
```

## Deploying

Any Node host works (Render, Railway, Fly.io, a VPS, etc.) — just set the same
three environment variables in your host's dashboard instead of a local
`.env` file, and make sure your MongoDB cluster's IP access list allows
connections from your host.
