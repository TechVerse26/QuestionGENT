import { newId } from './id.js';
import { clone } from './object.js';

export const newSection = (o = {}) => ({
  id: newId(8), title: '', description: '', instructions: '', allowedTypes: [],
  answerRule: { mode: 'all', count: 0 },
  numbering: { style: 'decimal', pattern: '{n}.', start: 1, continue: false },
  optionsCols: 'auto', itemIds: [], ...o,
});

export const EMPTY_INFO = { institutionName: '', address: '', logoUrl: '', examName: '', className: '', group: '', section: '', department: '', subject: '', subjectCode: '', year: '', date: '', duration: '', fullMarks: '', passMarks: '', instructions: '' };

export const cloneItem = (q) => { const c = clone(q); c.id = newId(12); delete c.bankId; return c; };

export function infoFromInstitution(inst = {}) {
  return { ...EMPTY_INFO, institutionName: inst.name || '', address: inst.address || '', logoUrl: inst.logoUrl || '' };
}
