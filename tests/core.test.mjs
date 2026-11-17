import test from 'node:test';
import assert from 'node:assert/strict';
import { formatIndex, formatLabel, toBnDigits } from '../src/utils/numbering.js';
import { docFromText, docToText, docToHtml, isEmptyDoc, prefixDoc, emptyDoc } from '../src/utils/richtext.js';
import { questionMarks, sectionSummary, paperSummary, validateQuestion } from '../src/utils/marks.js';
import { parseBulkMcq, parsedToMcq } from '../src/utils/bulkParse.js';
import { rowsToQuestions, guessMapping } from '../src/utils/importMap.js';
import { generateSet, setLabel } from '../src/utils/sets.js';
import { latexToText } from '../src/utils/latexText.js';
import { fingerprintOf, groupDuplicates, previewText } from '../src/utils/question.js';
import { buildPaperModel } from '../src/preview/paperModel.js';
import { buildSamplePaper } from '../src/constants/samplePaper.js';
import { newSection } from '../src/utils/paper.js';
import { roleCan } from '../src/constants/roles.js';

const opt = (id, t) => ({ id, content: docFromText(t) });
const mcq = (id, marks = 1) => ({ id, type: 'mcq', marks, body: { stem: docFromText(`Q ${id}`), options: [opt('a', 'one'), opt('b', 'two'), opt('c', 'three'), { ...opt('d', 'all'), fixed: true }] } });

test('numbering styles', () => {
  assert.equal(formatIndex(3, 'bn'), '৩');
  assert.equal(formatIndex(2, 'bnLetter'), 'খ');
  assert.equal(formatIndex(27, 'alpha'), 'aa');
  assert.equal(formatIndex(4, 'ROMAN'), 'IV');
  assert.equal(formatLabel(5, 'decimal', '({n})'), '(5)');
  assert.equal(toBnDigits('2026'), '২০২৬');
});

test('rich text: text, html escaping, empties', () => {
  const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '<b>x</b> & y', marks: [{ type: 'bold' }, { type: 'textStyle', attrs: { color: '#ff0000', fontFamily: '"Noto Serif Bengali"' } }] }] }, { type: 'paragraph', content: [{ type: 'mathInline', attrs: { latex: 'x^2' } }] }] };
  const html = docToHtml(doc);
  assert.ok(html.includes('&lt;b&gt;x&lt;/b&gt; &amp; y'));
  assert.ok(!html.includes('<b>x'));
  assert.ok(html.includes('color:#ff0000'));
  assert.ok(html.includes('&quot;Noto Serif Bengali&quot;'));
  assert.equal(docToText(doc), '<b>x</b> & y\nx^2');
  assert.equal(isEmptyDoc(emptyDoc()), true);
  assert.equal(isEmptyDoc(doc), false);
  const unsafe = { type: 'doc', content: [{ type: 'image', attrs: { src: 'javascript:alert(1)' } }] };
  assert.equal(docToHtml(unsafe), '');
  assert.equal(isEmptyDoc({ type: 'doc', content: [{ type: 'image', attrs: { src: 'https://x/y.png' } }] }), false);
  assert.ok(docToText(prefixDoc('A:', docFromText('hello'))).startsWith('A: hello'));
});

test('marks: per type and computed totals', () => {
  assert.equal(questionMarks(mcq('1', 2)), 2);
  const cq = { id: 'c', type: 'cq', body: { stimulus: docFromText('s'), subs: [1, 2, 3, 4].map((m) => ({ id: `s${m}`, label: 'ক', content: docFromText('x'), marks: m })) } };
  assert.equal(questionMarks(cq), 10);
  assert.equal(questionMarks({ type: 'fill', body: { text: docFromText('A ____ and ____ b'), marksPerBlank: 0.5 } }), 1);
  assert.equal(questionMarks({ type: 'matching', body: { left: [{}, {}, {}], marksPerPair: 2 } }), 6);
  assert.equal(questionMarks({ type: 'short', marks: 9, body: { stem: docFromText('x'), parts: [{ marks: 1 }, { marks: 2 }] } }), 3);
  assert.equal(questionMarks({ type: 'short', marks: 4, body: { stem: docFromText('x'), parts: [] } }), 4);
});

test('section rules: answer any N with mandatory questions', () => {
  const items = {};
  const ids = [];
  for (let i = 0; i < 6; i++) { const q = { ...mcq(`q${i}`, 5), optional: i > 0 }; items[q.id] = q; ids.push(q.id); }
  const s = newSection({ itemIds: ids, answerRule: { mode: 'choice', count: 4 } });
  const sum = sectionSummary(s, items);
  assert.equal(sum.answerCount, 4);
  assert.equal(sum.marks, 20);
  assert.equal(sum.available, 30);
  assert.equal(sectionSummary({ ...s, answerRule: { mode: 'choice', count: 9 } }, items).issues.some((i) => i.code === 'choice_exceeds'), true);
  items.q1 = { ...items.q1, marks: 3 };
  assert.equal(sectionSummary(s, items).issues.some((i) => i.code === 'unequal_optional'), true);
});

test('paper summary validates totals and questions', () => {
  const items = { a: mcq('a', 1), b: mcq('b', 1) };
  const paper = { title: 't', info: { fullMarks: '5', passMarks: '2' }, sections: [newSection({ itemIds: ['a', 'b'] })] };
  const sum = paperSummary(paper, items);
  assert.equal(sum.total, 2);
  assert.ok(sum.issues.some((i) => i.code === 'total_mismatch'));
  assert.equal(paperSummary({ ...paper, info: { fullMarks: '2' } }, items).errors, 0);
  assert.ok(validateQuestion({ type: 'mcq', marks: 1, body: { stem: emptyDoc(), options: [opt('a', 'x')] } }).some((i) => i.code === 'empty_question'));
  assert.ok(paperSummary({ ...paper, info: { fullMarks: '2' } }, items, {}).issues.some((i) => i.code === 'mcq_no_answer'));
});

test('bulk MCQ parser: english and bengali', () => {
  const en = parseBulkMcq('1. What is 2+2?\nA. 3\nB. 4\nC. 5\nD. 6\nAnswer: B\nExplanation: Basic sum.\n\n2. Capital of France?\nA) Paris\nB) Rome\nAnswer: A');
  assert.equal(en.length, 2);
  assert.equal(en[0].options.length, 4);
  assert.deepEqual(en[0].answers, ['B']);
  assert.equal(en[0].explanation, 'Basic sum.');
  const q = parsedToMcq(en[0], { lang: 'en' });
  assert.equal(q.key.correct.length, 1);
  assert.equal(q.question.body.options[1].id, q.key.correct[0]);
  const bn = parseBulkMcq('১. বাংলাদেশের রাজধানী কোনটি?\nক. চট্টগ্রাম\nখ. ঢাকা\nগ. খুলনা\nঘ. রাজশাহী\nউত্তর: খ');
  assert.equal(bn.length, 1);
  const r = parsedToMcq(bn[0]);
  assert.equal(r.question.body.options[1].id, r.key.correct[0]);
  assert.ok(parsedToMcq({ stem: 'x', options: [{ label: 'A', text: 'a' }], answers: [] }).error);
});

test('table import: mapping, mcq, cq and error report', () => {
  const headers = ['Type', 'Question', 'A', 'B', 'C', 'D', 'Answer', 'Marks', 'Subject'];
  const m = guessMapping(headers);
  assert.equal(m.stem, 1);
  assert.equal(m.optionC, 4);
  const rows = [
    ['MCQ', 'Largest planet?', 'Mars', 'Jupiter', 'Venus', 'Earth', 'B', '1', 'Science'],
    ['mcq', 'No answer', 'x', 'y', '', '', '', '', ''],
    ['essay', 'Describe the water cycle', '', '', '', '', '', '5', ''],
    ['weird', 'zzz', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', '', ''],
  ];
  const { valid, errors } = rowsToQuestions(rows, m, {});
  assert.equal(valid.length, 2);
  assert.equal(errors.length, 2);
  assert.equal(valid[0].question.body.options[1].id, valid[0].key.correct[0]);
  assert.equal(valid[0].question.subject, 'Science');
  assert.equal(valid[1].question.type, 'broad');
  assert.equal(errors[0].rowNo, 3);
  const cq = rowsToQuestions([['cq', 'Stimulus text', 'a?', 'b?', 'c?', 'd?']], { type: 0, stimulus: 1, sub1: 2, sub2: 3, sub3: 4, sub4: 5 }, {});
  assert.equal(questionMarks(cq.valid[0].question), 10);
});

test('sets: shuffle keeps marks, ids, answers and fixed options', () => {
  const items = {};
  const ids = [];
  for (let i = 0; i < 10; i++) { const q = mcq(`q${i}`, 1); items[q.id] = q; ids.push(q.id); }
  const keys = Object.fromEntries(ids.map((id) => [id, { correct: ['b'] }]));
  const base = { paper: { title: 'x', info: {}, sections: [newSection({ itemIds: ids })] }, items, keys };
  const a = generateSet(base, { label: setLabel(0), seed: 's1' });
  const a2 = generateSet(base, { label: setLabel(0), seed: 's1' });
  const b = generateSet(base, { label: setLabel(1), seed: 's1' });
  assert.deepEqual(a.paper.sections[0].itemIds, a2.paper.sections[0].itemIds);
  assert.notDeepEqual(a.paper.sections[0].itemIds, b.paper.sections[0].itemIds);
  assert.deepEqual([...a.paper.sections[0].itemIds].sort(), [...ids].sort());
  assert.equal(paperSummary(a.paper, a.items).total, paperSummary(base.paper, base.items).total);
  for (const q of Object.values(a.items)) {
    assert.equal(q.body.options[3].id, 'd');
    assert.deepEqual(q.body.options.map((o) => o.id).sort(), ['a', 'b', 'c', 'd']);
  }
  assert.equal(a.paper.setLabel, 'A');
  assert.deepEqual(base.items.q0.body.options.map((o) => o.id), ['a', 'b', 'c', 'd']); // base untouched
});

test('latex to text', () => {
  assert.equal(latexToText('\\frac{a+b}{2}'), '(a+b)/(2)');
  assert.equal(latexToText('x^{2} + \\sqrt{y}'), 'x² + √(y)');
  assert.equal(latexToText('H_2O \\times \\pi'), 'H₂O × π');
});

test('duplicates and previews', () => {
  const a = mcq('zzz');
  const b = { ...mcq('b'), body: { ...mcq('b').body, stem: docFromText('Q  A!') } };
  const c = { ...mcq('c'), body: { ...mcq('c').body, stem: docFromText('q a') } };
  assert.equal(fingerprintOf(b), fingerprintOf(c));
  assert.notEqual(fingerprintOf(a), fingerprintOf(b));
  assert.equal(groupDuplicates([a, b, c]).length, 1);
  assert.equal(previewText(a), 'Q zzz');
});

test('paper model: numbering, continuation, key mode', () => {
  const { paper, items } = buildSamplePaper();
  paper.sections[1].numbering.continue = true;
  const model = buildPaperModel({ paper, items });
  assert.equal(model.sections[0].qs[0].no, '১.');
  assert.equal(model.sections[1].qs[0].no, '৪.');
  assert.equal(model.totalMarks, 3 + 10 + 4);
  assert.ok(model.sections[0].marksText.includes('৩'));
  const first = model.sections[0].qs[0].blocks;
  assert.equal(first[0].k, 'stem');
  assert.equal(first[1].k, 'options');
  assert.equal(first[1].items[1].label, 'খ.');
  const keys = Object.fromEntries(Object.values(items).filter((q) => q.type === 'mcq').map((q) => [q.id, { correct: [q.body.options[1].id] }]));
  const km = buildPaperModel({ paper, items, keys, mode: 'key' });
  assert.equal(km.sections[0].qs[0].blocks[0].text, 'খ');
  assert.equal(km.sections[2].qs[0].blocks[1].k, 'note');
  paper.design = { language: 'en', digits: 'en' };
  assert.equal(buildPaperModel({ paper, items }).sections[0].qs[0].no, '1.');
});

test('role permissions', () => {
  assert.equal(roleCan('teacher', 'questions.create'), true);
  assert.equal(roleCan('viewer', 'questions.create'), false);
  assert.equal(roleCan('print_operator', 'answerKeys.view'), false);
  assert.equal(roleCan('institution_admin', 'billing.manage'), true);
});
