const express = require('express');
const requireAuth = require('../middleware/auth');
const QuizAttempt = require('../models/QuizAttempt');

const router = express.Router();

// All quiz routes require a logged-in user.
router.use(requireAuth);

// POST /api/quiz/generate
// body: { imageBase64, mimeType, count, difficulty }
// Calls Gemini using the server-side key — the key never reaches the browser.
router.post('/generate', async (req, res) => {
  try {
    const { imageBase64, mimeType, count, difficulty } = req.body;
    if (!imageBase64 || !mimeType) {
      return res.status(400).json({ error: 'An image is required.' });
    }
    const safeCount = Math.max(1, Math.min(50, parseInt(count, 10) || 10));
    const safeDifficulty = ['easy', 'medium', 'hard', 'mixed'].includes(difficulty) ? difficulty : 'mixed';

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY. Add it to .env and restart.' });
    }

    const prompt = `You are given a photo of a textbook page. Read all the text on the page carefully, then write exactly ${safeCount} multiple choice practice questions based ONLY on the content shown, at a ${safeDifficulty === 'mixed' ? 'mix of easy, medium and hard' : safeDifficulty} difficulty.

Respond with ONLY raw JSON (no markdown fences, no commentary) in this exact shape:
{"title":"a short 3-6 word title for this topic","questions":[{"question":"...","options":["...","...","...","..."],"correctIndex":0,"explanation":"one short sentence"}]}

Rules:
- Exactly 4 options per question, only one correct.
- correctIndex is the 0-based index of the correct option.
- Base every question strictly on the page content — do not invent facts not supported by it.
- If the page does not contain enough distinct content for ${safeCount} unique questions, write as many good, non-repetitive questions as the content supports.`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const geminiBody = {
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: imageBase64 } },
        ],
      }],
      generationConfig: { temperature: 0.4 },
    };

    // Retry a few times if Gemini is temporarily overloaded (503) or rate-limited (429).
    let geminiRes;
    let lastErrorDetail = '';
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      geminiRes = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiBody),
      });

      if (geminiRes.ok) break;

      lastErrorDetail = await geminiRes.text().catch(() => '');
      console.error(`Gemini error (attempt ${attempt}/${maxAttempts}):`, geminiRes.status, lastErrorDetail);

      const retryable = geminiRes.status === 503 || geminiRes.status === 429;
      if (!retryable || attempt === maxAttempts) break;

      const waitMs = attempt * 1500; // 1.5s, then 3s
      await new Promise(r => setTimeout(r, waitMs));
    }

    if (!geminiRes.ok) {
      const friendly = geminiRes.status === 503 || geminiRes.status === 429
        ? 'The AI service is busy right now. Please wait a moment and try again.'
        : 'The AI service could not process that image. Please try again.';
      return res.status(502).json({ error: friendly });
    }

    const data = await geminiRes.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    }

    const questions = Array.isArray(parsed?.questions)
      ? parsed.questions.filter(q => q && q.question && Array.isArray(q.options) && q.options.length === 4)
      : [];

    if (!questions.length) {
      return res.status(502).json({ error: 'Could not generate questions from that page. Try a clearer photo.' });
    }

    res.json({ title: parsed.title || 'Practice set', difficulty: safeDifficulty, questions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong generating your quiz.' });
  }
});

// POST /api/quiz/submit
// body: { title, difficulty, questions, answers }
// Saves a completed attempt to history.
router.post('/submit', async (req, res) => {
  try {
    const { title, difficulty, questions, answers } = req.body;
    if (!Array.isArray(questions) || !questions.length || !Array.isArray(answers)) {
      return res.status(400).json({ error: 'Missing quiz data.' });
    }

    let score = 0;
    questions.forEach((q, i) => { if (answers[i] === q.correctIndex) score += 1; });

    const attempt = await QuizAttempt.create({
      user: req.userId,
      title: title || 'Practice set',
      difficulty: difficulty || 'mixed',
      questions,
      answers,
      score,
      total: questions.length,
    });

    res.status(201).json({ attempt });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not save this attempt.' });
  }
});

// GET /api/quiz/history
router.get('/history', async (req, res) => {
  const attempts = await QuizAttempt
    .find({ user: req.userId })
    .sort({ createdAt: -1 })
    .limit(100)
    .select('title difficulty score total createdAt');
  res.json({ attempts });
});

// GET /api/quiz/history/:id  (full detail, for reviewing a past attempt)
router.get('/history/:id', async (req, res) => {
  const attempt = await QuizAttempt.findOne({ _id: req.params.id, user: req.userId });
  if (!attempt) return res.status(404).json({ error: 'Attempt not found.' });
  res.json({ attempt });
});

module.exports = router;
