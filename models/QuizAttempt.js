const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: { type: [String], required: true },
  correctIndex: { type: Number, required: true },
  explanation: { type: String, default: '' },
}, { _id: false });

const QuizAttemptSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, default: 'Practice set' },
  difficulty: { type: String, default: 'mixed' },
  questions: { type: [QuestionSchema], required: true },
  answers: { type: [Number], required: true }, // user's chosen option index per question
  score: { type: Number, required: true },
  total: { type: Number, required: true },
}, { timestamps: true });

module.exports = mongoose.model('QuizAttempt', QuizAttemptSchema);
