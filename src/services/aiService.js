import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config.js';
import { docFromText } from '../utils/richtext.js';
import { newId } from '../utils/id.js';
import { generateQuestionsDirect, GeminiError, MSG } from './gemini.js';
import { getAiKey, getAiModel } from './aiKey.js';

// 'direct' (default): the browser talks to Google Gemini with the user's own free key. Needs no Cloud Functions and no billing.
// 'functions': the original Cloud Function (needs the Firebase Blaze plan and a GEMINI_API_KEY secret). Set VITE_AI_MODE=functions.
export const aiMode = () => (import.meta.env && import.meta.env.VITE_AI_MODE === 'functions' ? 'functions' : 'direct');

// Resolves to { questions, model } (raw items; nothing is saved here).
export async function generateQuestionsAI(payload, { uid } = {}) {
  if (aiMode() === 'functions') {
    const fn = httpsCallable(functions, 'generateQuestions', { timeout: 120000 });
    const res = await fn(payload);
    return { questions: (res.data && res.data.questions) || [], model: '' };
  }
  const key = getAiKey(uid);
  if (!key) throw new GeminiError('no-key', MSG.noKey);
  return generateQuestionsDirect({ key, payload, preferredModel: getAiModel(uid) });
}

const LETTERS_BN = ['ক', 'খ', 'গ', 'ঘ', 'ঙ', 'চ'];

// Maps the plain-text JSON returned by the AI into editable question objects (nothing is saved here).
export function aiToQuestions(items, { lang = 'bn', defaults = {} } = {}) {
  return items.map((it) => {
    const meta = { difficulty: it.difficulty || defaults.difficulty || 'medium', className: defaults.className || '', subject: defaults.subject || '', chapter: defaults.chapter || '', topic: defaults.topic || '', group: '', department: '', tags: ['ai'] };
    const marks = Number(it.marks) > 0 ? Number(it.marks) : 1;
    if (it.type === 'mcq' && Array.isArray(it.options) && it.options.length >= 2) {
      const options = it.options.map((t) => ({ id: newId(8), content: docFromText(String(t)) }));
      const correct = (it.correct || []).map((i) => options[Number(i)]?.id).filter(Boolean);
      return { question: { type: 'mcq', marks, ...meta, body: { stem: docFromText(String(it.stem || '')), options, multi: correct.length > 1, optionStyle: lang === 'bn' ? 'bnLetter' : 'ALPHA', optionPattern: '{n}.', negative: 0 } }, key: { correct, explanation: it.explanation ? docFromText(String(it.explanation)) : null }, ai: true };
    }
    if (it.type === 'cq' && Array.isArray(it.subs) && it.subs.length) {
      const subs = it.subs.slice(0, 6).map((s, i) => ({ id: newId(6), label: LETTERS_BN[i], content: docFromText(String(s.text || '')), marks: Number(s.marks) > 0 ? Number(s.marks) : [1, 2, 3, 4][i] || 1 }));
      const answers = Object.fromEntries(it.subs.slice(0, 6).map((s, i) => [subs[i].id, docFromText(String(s.answer || ''))]));
      return { question: { type: 'cq', marks: 0, ...meta, body: { stimulus: docFromText(String(it.stimulus || '')), subs, subPattern: '{n}.' } }, key: { answers, guideline: null, rubric: [] }, ai: true };
    }
    if (it.type === 'tf') {
      return { question: { type: 'tf', marks, ...meta, body: { statement: docFromText(String(it.stem || '')) } }, key: { answer: !!it.answer && String(it.answer).toLowerCase() !== 'false', explanation: it.explanation ? docFromText(String(it.explanation)) : null }, ai: true };
    }
    const type = ['short', 'broad', 'math'].includes(it.type) ? it.type : 'short';
    return { question: { type, marks, ...meta, body: { stem: docFromText(String(it.stem || '')), parts: [] } }, key: { answer: docFromText(String(it.answer || '')), rubric: [] }, ai: true };
  });
}
