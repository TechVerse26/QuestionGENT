import { newId } from '../utils/id.js';
import { emptyDoc, docFromText } from '../utils/richtext.js';
import MCQEditor from '../editors/MCQEditor/index.jsx';
import CQEditor from '../editors/CQEditor/index.jsx';
import ShortQuestionEditor from '../editors/ShortQuestionEditor/index.jsx';
import BroadQuestionEditor from '../editors/BroadQuestionEditor/index.jsx';
import MathematicalEditor from '../editors/MathematicalEditor/index.jsx';
import FillBlankEditor from '../editors/FillBlankEditor/index.jsx';
import TrueFalseEditor from '../editors/TrueFalseEditor/index.jsx';
import MatchingEditor from '../editors/MatchingEditor/index.jsx';
import PracticalEditor from '../editors/PracticalEditor/index.jsx';
import CustomQuestionEditor from '../editors/CustomQuestionEditor/index.jsx';
import { OrderingEditor, NumericEditor, ProgrammingEditor } from '../editors/AdditionalEditors.jsx';

const subs = () => ['ক', 'খ', 'গ', 'ঘ'].map((label, i) => ({ id: newId(6), label, content: emptyDoc(), marks: [1, 2, 3, 4][i] }));
const style = (lang) => (lang === 'en' ? 'ALPHA' : 'bnLetter');
const options = (n) => Array.from({ length: n }, () => ({ id: newId(6), content: emptyDoc() }));
const items = (n) => Array.from({ length: n }, () => ({ id: newId(6), content: '' }));

const ASSERTION = {
  en: ['Both Assertion and Reason are true, and Reason is the correct explanation of Assertion.', 'Both Assertion and Reason are true, but Reason is not the correct explanation of Assertion.', 'Assertion is true but Reason is false.', 'Assertion is false but Reason is true.'],
  bn: ['দাবি ও কারণ উভয়ই সত্য এবং কারণ দাবির সঠিক ব্যাখ্যা।', 'দাবি ও কারণ উভয়ই সত্য কিন্তু কারণ দাবির সঠিক ব্যাখ্যা নয়।', 'দাবি সত্য কিন্তু কারণ মিথ্যা।', 'দাবি মিথ্যা কিন্তু কারণ সত্য।'],
};

const stimulus = () => ({ marks: 0, body: { stimulus: emptyDoc(), subs: subs(), subPattern: '{n}.' }, key: { answers: {}, guideline: null, rubric: [] } });
const written = (marks, extra = {}) => () => ({ marks, body: { stem: emptyDoc(), parts: [], ...extra }, key: { answer: null, rubric: [] } });

export const TYPE_DEFS = {
  mcq: { Editor: MCQEditor, make: ({ lang }) => ({ marks: 1, body: { stem: emptyDoc(), options: options(4), multi: false, shuffle: true, optionStyle: style(lang), optionPattern: '{n}.', negative: 0 }, key: { correct: [], explanation: null } }) },
  assertion: {
    Editor: MCQEditor,
    make: ({ lang }) => ({ marks: 1, body: { assertion: emptyDoc(), reason: emptyDoc(), options: ASSERTION[lang === 'en' ? 'en' : 'bn'].map((t) => ({ id: newId(6), content: docFromText(t), fixed: true })), multi: false, shuffle: false, optionStyle: style(lang), optionPattern: '{n}.', negative: 0 }, key: { correct: [], explanation: null } }),
  },
  cq: { Editor: CQEditor, make: stimulus },
  comprehension: { Editor: CQEditor, make: stimulus },
  case_study: { Editor: CQEditor, make: stimulus },
  diagram: { Editor: CQEditor, make: stimulus },
  map: { Editor: CQEditor, make: stimulus },
  short: { Editor: ShortQuestionEditor, make: written(2) },
  grammar: { Editor: ShortQuestionEditor, make: written(1) },
  translation: { Editor: ShortQuestionEditor, make: written(2) },
  broad: { Editor: BroadQuestionEditor, make: written(5, { kind: 'descriptive' }) },
  math: { Editor: MathematicalEditor, make: written(4) },
  fill: { Editor: FillBlankEditor, make: () => ({ marks: 0, body: { text: emptyDoc(), marksPerBlank: 1 }, key: { answers: [] } }) },
  tf: { Editor: TrueFalseEditor, make: () => ({ marks: 1, body: { statement: emptyDoc() }, key: { answer: null, explanation: null } }) },
  matching: { Editor: MatchingEditor, make: ({ lang }) => ({ marks: 0, body: { stem: emptyDoc(), left: items(3), right: items(3), leftStyle: 'decimal', rightStyle: style(lang), marksPerPair: 1 }, key: { pairs: {} } }) },
  practical: { Editor: PracticalEditor, make: () => ({ marks: 5, body: { stem: emptyDoc(), materials: '', steps: [] }, key: { answer: null, rubric: [] } }) },
  ordering: { Editor: OrderingEditor, make: () => ({ marks: 2, body: { stem: emptyDoc(), items: items(4), shuffleOnPrint: true, itemStyle: 'bnLetter' }, key: {} }) },
  numeric: { Editor: NumericEditor, make: () => ({ marks: 2, body: { stem: emptyDoc() }, key: { value: '', tolerance: '', unit: '', solution: null } }) },
  programming: { Editor: ProgrammingEditor, make: () => ({ marks: 5, body: { stem: emptyDoc(), language: '', constraints: '', sampleInput: '', sampleOutput: '' }, key: { solutionCode: '', explanation: null } }) },
  custom: { Editor: CustomQuestionEditor, make: ({ customDef }) => ({ marks: 1, body: { def: customDef || { name: 'Custom', fields: [{ id: 'f1', label: 'Question', kind: 'rich' }] }, values: {} }, key: { answer: null } }) },
};

export const editorFor = (type) => (TYPE_DEFS[type] || TYPE_DEFS.short).Editor;

export function newQuestion(type, opts = {}) {
  const def = TYPE_DEFS[type] || TYPE_DEFS.short;
  return {
    id: newId(12), type, difficulty: 'medium', optional: false, className: '', group: '', department: '', subject: '', chapter: '', topic: '', tags: [],
    ...def.make(opts),
  };
}
