import { openPrint } from './printExport.js';
import { downloadPaperJson } from './jsonExport.js';
import { downloadBlob, safeName } from '../utils/download.js';
import { logExport } from '../services/activityService.js';
import { notify } from '../services/notificationService.js';
import { checkLimit, invalidateUsage } from '../services/planService.js';

// kind: print | keyprint | docx | keydocx | json. data: { paper, items, keys }
export async function runExport(kind, data, { institution, institutionId, uid, canKeys }) {
  const limitMsg = await checkLimit(institution, 'exportsPerMonth');
  if (limitMsg) throw new Error(limitMsg);
  const { paper, items } = data;
  const keys = canKeys ? data.keys || {} : {};
  const isKey = kind === 'keyprint' || kind === 'keydocx';
  if (isKey && !canKeys) throw new Error('Your role cannot export answer keys.');
  const base = safeName(paper.title || (paper.info && paper.info.examName) || 'question-paper');
  if (kind === 'print' || kind === 'keyprint') {
    openPrint({ paper, items, keys, mode: isKey ? 'key' : 'paper' });
  } else if (kind === 'docx' || kind === 'keydocx') {
    const { docxBlob } = await import('./docxExport.js');
    downloadBlob(await docxBlob({ paper, items, keys, mode: isKey ? 'key' : 'paper' }), `${base}${isKey ? '-answer-key' : ''}.docx`);
  } else if (kind === 'json') {
    downloadPaperJson({ paper, items, keys: canKeys ? keys : undefined }, base);
  }
  await logExport(institutionId, uid, paper.id, kind);
  if (paper.createdBy && paper.createdBy !== uid) notify({ institutionId, userId: paper.createdBy, createdBy: uid, type: 'export', title: 'Your paper was exported', body: paper.title || '', link: `/app/papers/${paper.id}` });
  invalidateUsage(institutionId);
}
