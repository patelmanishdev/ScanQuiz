require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');

const authRoutes = require('./routes/auth');
const quizRoutes = require('./routes/quiz');

const app = express();

// On Vercel, connectDB() runs on each invocation but reuses a cached
// connection (see config/db.js) so this stays fast after the first request.
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(500).json({ error: 'Database connection failed. Check server logs.' });
  }
});

app.use(cors());
// Higher limit because a base64-encoded textbook photo can be a few MB.
app.use(express.json({ limit: '12mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/quiz', quizRoutes);

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Vercel imports this file as a serverless function and calls the exported
// app directly — it never runs app.listen(). Locally (npm start / npm run dev)
// we still need app.listen() to actually start a server.
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`ScanQuiz server running on http://localhost:${PORT}`));
}

module.exports = app;
