import { useState } from 'react';
import Modal from '../../components/common/Modal.jsx';
import Button from '../../components/common/Button.jsx';
import { Select } from '../../components/common/Field.jsx';
import { Badge } from '../../components/common/Misc.jsx';
import { useToast } from '../../components/common/Toast.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { useCurrent } from '../../hooks/useCurrent.js';
import { useBuilder } from '../../store/builderStore.js';
import { useBank } from '../../store/bankStore.js';
import { generateSet, findEquivalent, setLabel } from '../../utils/sets.js';
import { mulberry32, seedFrom } from '../../utils/shuffle.js';
import { paperSummary } from '../../utils/marks.js';
import { fingerprintOf } from '../../utils/question.js';
import { newId } from '../../utils/id.js';
import { downloadBlob, safeName } from '../../utils/download.js';
import { getBankKeys } from '../../services/questionService.js';
import { createPaper, savePaper } from '../../services/paperService.js';
import { openPrint } from '../../export/printExport.js';

export default function SetsDialog({ open, onClose, canKeys, canEditKeys }) {
  const { t } = useI18n();
  const toast = useToast();
  const { user, institutionId } = useCurrent();
  const [count, setCount] = useState(3);
  const [shuffleQ, setShuffleQ] = useState(true);
  const [shuffleO, setShuffleO] = useState(true);
  const [equiv, setEquiv] = useState(false);
  const [sets, setSets] = useState([]);
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      const { paper, items, keys } = useBuilder.getState();
      const base = { paper, items, keys: canKeys ? keys : {} };
      const baseTotal = paperSummary(paper, items).total;
      let pool = [];
      if (equiv) { await useBank.getState().load(institutionId); pool = useBank.getState().items; }
      const seed = newId(6);
      const used = new Set(Object.values(items).map(fingerprintOf));
      const out = [];
      for (let i = 0; i < count; i++) {
        const label = setLabel(i);
        const replacements = {};
        if (equiv) {
          const rng = mulberry32(seedFrom(`${seed}:${label}:eq`));
          const picked = [];
          for (const q of Object.values(items)) {
            const cand = findEquivalent(q, pool, used, rng);
            if (cand) { picked.push([q.id, cand]); used.add(fingerprintOf(cand)); }
          }
          const bankKeys = canKeys ? await getBankKeys(picked.map(([, c]) => c.id)) : {};
          picked.forEach(([id, c]) => { replacements[id] = { question: { ...c, id, bankId: c.id }, key: bankKeys[c.id] }; });
        }
        const set = generateSet(base, { label, seed, shuffleQuestions: shuffleQ, shuffleOptions: shuffleO, replacements });
        const total = paperSummary(set.paper, set.items).total;
        out.push({ ...set, label, total, ok: total === baseTotal, replaced: Object.keys(replacements).length });
      }
      setSets(out);
    } catch (e) { toast.error(t(e.message)); } finally { setBusy(false); }
  };

  const titled = (s) => ({ ...s.paper, title: `${s.paper.title || ''} (${t('Set')} ${s.label})` });
  const docx = async (s, mode) => {
    const { docxBlob } = await import('../../export/docxExport.js');
    downloadBlob(await docxBlob({ paper: titled(s), items: s.items, keys: s.keys, mode }), `${safeName(s.paper.title)}-set-${s.label}${mode === 'key' ? '-key' : ''}.docx`);
  };
  const saveAs = async (s) => {
    const p = titled(s);
    const id = await createPaper({ institutionId, uid: user.uid, title: p.title, info: p.info, design: p.design, sections: p.sections });
    await savePaper({ paper: { ...p, id, institutionId, setLabel: s.label }, items: s.items, keys: s.keys, dirtyIds: Object.keys(s.items), removed: [], uid: user.uid, canKeys: canEditKeys });
    return id;
  };
  const guard = (fn) => async () => { try { await fn(); } catch (e) { toast.error(t(e.message)); } };
  const zipAll = guard(async () => {
    const [{ default: JSZip }, { docxBlob }] = await Promise.all([import('jszip'), import('../../export/docxExport.js')]);
    const zip = new JSZip();
    for (const s of sets) {
      zip.file(`set-${s.label}.docx`, await docxBlob({ paper: titled(s), items: s.items, keys: s.keys, mode: 'paper' }));
      if (canKeys) zip.file(`set-${s.label}-answer-key.docx`, await docxBlob({ paper: titled(s), items: s.items, keys: s.keys, mode: 'key' }));
    }
    downloadBlob(await zip.generateAsync({ type: 'blob' }), `${safeName(useBuilder.getState().paper.title)}-sets.zip`);
  });

  return (
    <Modal open={open} onClose={onClose} size="lg" title={t('Multiple question sets')}>
      <div className="grid gap-3 sm:grid-cols-4">
        <div><label className="label">{t('Number of sets')}</label><Select value={count} onChange={(e) => setCount(Number(e.target.value))}>{[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} ({Array.from({ length: n }, (_, i) => setLabel(i)).join(', ')})</option>)}</Select></div>
        <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={shuffleQ} onChange={(e) => setShuffleQ(e.target.checked)} />{t('Shuffle questions inside each section')}</label>
        <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={shuffleO} onChange={(e) => setShuffleO(e.target.checked)} />{t('Shuffle MCQ options')}</label>
        <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={equiv} onChange={(e) => setEquiv(e.target.checked)} />{t('Swap in equivalent bank questions')}</label>
      </div>
      <p className="hint">{t('Questions stay in their own section, so every set keeps the same section marks. Equivalent means same type, marks and difficulty.')}</p>
      <Button variant="primary" className="mt-3" loading={busy} onClick={generate}>{t('Generate sets')}</Button>

      {sets.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between"><h3 className="text-sm">{t('Generated sets')}</h3><Button size="sm" onClick={zipAll}>{t('Download all as ZIP')}</Button></div>
          {sets.map((s) => (
            <div key={s.label} className="mb-2 flex flex-wrap items-center gap-2 rounded border border-line p-2">
              <strong className="w-16">{t('Set')} {s.label}</strong>
              <Badge tone={s.ok ? 'brand' : 'danger'}>{s.total} {t('marks')}</Badge>
              {s.replaced > 0 && <Badge tone="info">{t('{n} swapped', { n: s.replaced })}</Badge>}
              {!s.ok && <span className="text-xs text-danger">{t('Total marks differ from the original paper.')}</span>}
              <div className="ml-auto flex flex-wrap gap-1">
                <Button size="sm" onClick={guard(async () => openPrint({ paper: titled(s), items: s.items, keys: s.keys, mode: 'paper', auto: false }))}>{t('Preview / PDF')}</Button>
                {canKeys && <Button size="sm" onClick={guard(async () => openPrint({ paper: titled(s), items: s.items, keys: s.keys, mode: 'key', auto: false }))}>{t('Key PDF')}</Button>}
                <Button size="sm" onClick={guard(() => docx(s, 'paper'))}>Word</Button>
                {canKeys && <Button size="sm" onClick={guard(() => docx(s, 'key'))}>{t('Key Word')}</Button>}
                <Button size="sm" onClick={guard(async () => { await saveAs(s); toast.success(t('Saved as a new paper. Open it in the library to edit.')); })}>{t('Save as paper')}</Button>
              </div>
            </div>
          ))}
          <p className="hint">{t('To review or edit a set by hand, save it as a paper and open it in the builder.')}</p>
        </div>
      )}
    </Modal>
  );
}
