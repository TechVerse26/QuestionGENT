import { docFromText } from './richtext.js';
import { newId } from './id.js';
import { parseLabels, labelIndex } from './bulkParse.js';

const f = (key, label, ...syn) => ({ key, label, syn });
export const IMPORT_FIELDS = [
  f('type', 'Question type', 'type', 'question type', 'প্রশ্নের ধরন', 'ধরন'),
  f('stem', 'Question text', 'question', 'stem', 'text', 'প্রশ্ন'),
  f('stimulus', 'Stimulus (CQ)', 'stimulus', 'উদ্দীপক', 'passage'),
  f('optionA', 'Option A', 'option a', 'a', 'option1', 'option 1', 'opt a', 'ক'),
  f('optionB', 'Option B', 'option b', 'b', 'option2', 'option 2', 'opt b', 'খ'),
  f('optionC', 'Option C', 'option c', 'c', 'option3', 'option 3', 'opt c', 'গ'),
  f('optionD', 'Option D', 'option d', 'd', 'option4', 'option 4', 'opt d', 'ঘ'),
  f('optionE', 'Option E', 'option e', 'e', 'option5', 'option 5'),
  f('optionF', 'Option F', 'option f', 'f', 'option6', 'option 6'),
  f('answer', 'Correct answer', 'answer', 'correct', 'correct answer', 'ans', 'উত্তর', 'সঠিক উত্তর'),
  f('explanation', 'Explanation', 'explanation', 'ব্যাখ্যা'),
  f('marks', 'Marks', 'marks', 'mark', 'নম্বর', 'মান'),
  f('difficulty', 'Difficulty', 'difficulty', 'level', 'কাঠিন্য'),
  f('className', 'Class', 'class', 'শ্রেণি'),
  f('group', 'Group', 'group', 'গ্রুপ'),
  f('department', 'Department', 'department', 'বিভাগ'),
  f('subject', 'Subject', 'subject', 'বিষয়'),
  f('chapter', 'Chapter', 'chapter', 'অধ্যায়'),
  f('topic', 'Topic', 'topic', 'টপিক'),
  f('tags', 'Tags', 'tags', 'tag', 'ট্যাগ'),
  ...[1, 2, 3, 4].map((n) => f(`sub${n}`, `CQ part ${n}`, `sub${n}`, `part${n}`, `q${n}`)),
  ...[1, 2, 3, 4].map((n) => f(`marks${n}`, `CQ part ${n} marks`, `marks${n}`, `mark${n}`, `m${n}`)),
];

const TYPE_SYN = {
  mcq: ['mcq', 'multiple choice', 'objective', 'বহুনির্বাচনি', 'বহুনির্বাচনী'],
  cq: ['cq', 'creative', 'creative question', 'সৃজনশীল'],
  short: ['short', 'short question', 'সংক্ষিপ্ত', 'সংক্ষিপ্ত প্রশ্ন'],
  broad: ['broad', 'long', 'essay', 'descriptive', 'বর্ণনামূলক', 'রচনামূলক'],
  tf: ['tf', 'true/false', 'true false', 'সত্য/মিথ্যা', 'সত্য মিথ্যা'],
};
export const IMPORTABLE_TYPES = Object.keys(TYPE_SYN);

export function detectType(raw) {
  const n = String(raw || '').trim().toLowerCase();
  if (!n) return null;
  for (const [type, list] of Object.entries(TYPE_SYN)) if (list.includes(n)) return type;
  return null;
}

export function guessMapping(headers) {
  const map = {};
  headers.forEach((h, i) => {
    const n = String(h || '').trim().toLowerCase();
    if (!n) return;
    const field = IMPORT_FIELDS.find((x) => map[x.key] === undefined && (x.key.toLowerCase() === n || x.syn.includes(n)));
    if (field) map[field.key] = i;
  });
  return map;
}

export function distinctTypeValues(rows, mapping) {
  const idx = mapping.type;
  if (idx == null) return [];
  return [...new Set(rows.map((r) => String(r[idx] ?? '').trim()).filter(Boolean))];
}

const parseBool = (v) => (/^(t|true|yes|y|1|সত্য|ঠিক)$/i.test(v) ? true : /^(f|false|no|n|0|মিথ্যা|ভুল)$/i.test(v) ? false : null);
const parseDifficulty = (v) => { const n = String(v || '').trim().toLowerCase(); return ['easy', 'e', 'সহজ'].includes(n) ? 'easy' : ['hard', 'h', 'কঠিন'].includes(n) ? 'hard' : 'medium'; };
const DEFAULT_MARKS = { mcq: 1, tf: 1, short: 2, broad: 5 };

export function rowsToQuestions(rows, mapping, { defaultType = 'mcq', typeMap = {}, defaults = {}, lang = 'bn' } = {}) {
  const valid = [];
  const errors = [];
  rows.forEach((row, i) => {
    const rowNo = i + 2; // header is row 1
    const get = (k) => { const idx = mapping[k]; return idx == null || idx < 0 ? '' : String(row[idx] ?? '').trim(); };
    if (row.every((c) => String(c ?? '').trim() === '')) return;
    const rawType = get('type');
    const type = rawType ? typeMap[rawType] || detectType(rawType) : defaultType;
    const fail = (message) => errors.push({ rowNo, message });
    if (!type) return fail(`Unknown question type "${rawType}"`);
    if (!IMPORTABLE_TYPES.includes(type)) return fail(`Type "${type}" cannot be imported from a table`);
    const stem = get('stem');
    const marksRaw = get('marks');
    if (marksRaw && !(Number(marksRaw) > 0)) return fail(`Marks "${marksRaw}" is not a positive number`);
    const meta = {
      difficulty: parseDifficulty(get('difficulty')),
      className: get('className') || defaults.className || '',
      group: get('group') || defaults.group || '',
      department: get('department') || defaults.department || '',
      subject: get('subject') || defaults.subject || '',
      chapter: get('chapter') || defaults.chapter || '',
      topic: get('topic') || defaults.topic || '',
      tags: get('tags').split(/[,;]/).map((x) => x.trim()).filter(Boolean),
    };
    const marks = marksRaw ? Number(marksRaw) : Number(defaults.marks) || DEFAULT_MARKS[type] || 0;
    if (type === 'cq') {
      const stimulus = get('stimulus') || stem;
      const defMarks = [1, 2, 3, 4];
      const subs = [1, 2, 3, 4].map((n, k) => ({ text: get(`sub${n}`), marks: Number(get(`marks${n}`)) || defMarks[k], k })).filter((s) => s.text);
      if (!stimulus && !subs.length) return fail('CQ needs a stimulus or at least one sub-question');
      if (!subs.length) return fail('CQ needs at least one sub-question');
      const body = { stimulus: docFromText(stimulus), subs: subs.map((s) => ({ id: newId(6), label: ['ক', 'খ', 'গ', 'ঘ'][s.k], content: docFromText(s.text), marks: s.marks })), subPattern: '{n}.' };
      valid.push({ rowNo, question: { type, marks: 0, ...meta, body }, key: null });
      return;
    }
    if (!stem) return fail('Missing question text');
    if (type === 'mcq') {
      const texts = ['optionA', 'optionB', 'optionC', 'optionD', 'optionE', 'optionF'].map(get);
      const options = texts.map((t) => (t ? { id: newId(8), content: docFromText(t) } : null)).filter(Boolean);
      if (options.length < 2) return fail('MCQ needs at least two options');
      const present = texts.map((t, k) => (t ? k : -1)).filter((k) => k >= 0);
      const correct = [];
      for (const a of parseLabels(get('answer'))) {
        const k = labelIndex(a);
        const pos = present.indexOf(k);
        if (pos >= 0 && !correct.includes(options[pos].id)) correct.push(options[pos].id);
      }
      if (!correct.length) return fail('Correct answer is missing or does not match an option');
      const body = { stem: docFromText(stem), options, multi: correct.length > 1, optionStyle: lang === 'bn' ? 'bnLetter' : 'ALPHA', optionPattern: '{n}.', negative: 0 };
      valid.push({ rowNo, question: { type, marks, ...meta, body }, key: { correct, explanation: get('explanation') ? docFromText(get('explanation')) : null } });
      return;
    }
    if (type === 'tf') {
      const ans = parseBool(get('answer'));
      if (ans === null) return fail('True/False answer must be true or false');
      valid.push({ rowNo, question: { type, marks, ...meta, body: { statement: docFromText(stem) } }, key: { answer: ans, explanation: get('explanation') ? docFromText(get('explanation')) : null } });
      return;
    }
    valid.push({ rowNo, question: { type, marks, ...meta, body: { stem: docFromText(stem), parts: [] } }, key: get('answer') ? { answer: docFromText(get('answer')), rubric: [] } : null });
  });
  return { valid, errors };
}
