import { downloadText, safeName, toCsv } from '../utils/download.js';
import { docToText } from '../utils/richtext.js';
import { primaryDoc } from '../utils/question.js';
import { questionMarks } from '../utils/marks.js';

export function paperToJson({ paper, items, keys }) {
  const sections = (paper.sections || []).map((s) => ({ ...s, questions: (s.itemIds || []).map((id) => items[id]).filter(Boolean).map((q) => ({ ...q, key: keys ? keys[q.id] || null : undefined })) }));
  return {
    schema: 'exam-master/paper@1', exportedAt: new Date().toISOString(),
    paper: { title: paper.title, info: paper.info, design: paper.design, setLabel: paper.setLabel || null }, sections,
  };
}

export const downloadPaperJson = (data, name) => downloadText(JSON.stringify(paperToJson(data), null, 2), `${safeName(name || data.paper.title)}.json`, 'application/json');

export function downloadBankJson(questions, name = 'question-bank') {
  const rows = questions.map(({ searchText, fingerprint, ...q }) => q);
  downloadText(JSON.stringify({ schema: 'exam-master/questions@1', exportedAt: new Date().toISOString(), questions: rows }, null, 2), `${safeName(name)}.json`, 'application/json');
}

// Answers are not part of the CSV (they live in the protected answer-key collection); use JSON export of a paper for keys.
export function downloadBankCsv(questions, name = 'question-bank') {
  const rows = [['type', 'question', 'optionA', 'optionB', 'optionC', 'optionD', 'marks', 'difficulty', 'class', 'subject', 'chapter', 'topic', 'tags']];
  questions.forEach((q) => {
    const opts = (q.body && q.body.options ? q.body.options : []).slice(0, 4).map((o) => docToText(o.content));
    rows.push([q.type, docToText(primaryDoc(q)), opts[0] || '', opts[1] || '', opts[2] || '', opts[3] || '', questionMarks(q), q.difficulty || '', q.className || '', q.subject || '', q.chapter || '', q.topic || '', (q.tags || []).join(';')]);
  });
  downloadText(toCsv(rows), `${safeName(name)}.csv`, 'text/csv;charset=utf-8');
}
