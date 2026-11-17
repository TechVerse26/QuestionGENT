import { useEffect, useMemo, useState } from 'react';
import { Upload, FileDown } from 'lucide-react';
import Button from '../../components/common/Button.jsx';
import { Field, Input, Select } from '../../components/common/Field.jsx';
import { Badge, PageHeader, Spinner, Tabs } from '../../components/common/Misc.jsx';
import { useToast } from '../../components/common/Toast.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { useCurrent } from '../../hooks/useCurrent.js';
import { useBank } from '../../store/bankStore.js';
import { parseFile } from '../../import/parsers.js';
import { IMPORT_FIELDS, IMPORTABLE_TYPES, guessMapping, distinctTypeValues, rowsToQuestions } from '../../utils/importMap.js';
import { parseBulkMcq, parsedToMcq } from '../../utils/bulkParse.js';
import { fingerprintOf, previewText } from '../../utils/question.js';
import { downloadText, toCsv } from '../../utils/download.js';
import { downloadBankJson, downloadBankCsv } from '../../export/jsonExport.js';
import { runExport } from '../../export/runExport.js';
import { createQuestionsBulk } from '../../services/questionService.js';
import { listPapers, loadPaper } from '../../services/paperService.js';
import { logImport, listLogs } from '../../services/activityService.js';
import { checkLimit, invalidateUsage } from '../../services/planService.js';
import { millis } from '../../services/db.js';
import { typeLabel } from '../../constants/questionTypes.js';

const GROUPS = [
  ['Basics', ['type', 'stem', 'optionA', 'optionB', 'optionC', 'optionD', 'optionE', 'optionF', 'answer', 'explanation', 'marks', 'difficulty']],
  ['Class, subject and tags', ['className', 'group', 'department', 'subject', 'chapter', 'topic', 'tags']],
  ['Creative questions (CQ)', ['stimulus', 'sub1', 'sub2', 'sub3', 'sub4', 'marks1', 'marks2', 'marks3', 'marks4']],
];

function ImportTab() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user, institution, institutionId, can } = useCurrent();
  const bank = useBank((s) => s.items);
  const [parsed, setParsed] = useState(null);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [mapping, setMapping] = useState({});
  const [defaultType, setDefaultType] = useState('mcq');
  const [typeMap, setTypeMap] = useState({});
  const [defaults, setDefaults] = useState({ className: '', subject: '', chapter: '', topic: '', marks: '' });
  const [skipDups, setSkipDups] = useState(true);
  const [result, setResult] = useState(null);

  useEffect(() => { useBank.getState().load(institutionId); }, [institutionId]);

  const onFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const r = await parseFile(file);
      setParsed(r);
      setFileName(file.name);
      setMapping(r.kind === 'table' ? guessMapping(r.headers) : {});
      setTypeMap({});
    } catch (err) { setParsed(null); toast.error(t(err.message)); } finally { setBusy(false); e.target.value = ''; }
  };

  const prepared = useMemo(() => {
    if (!parsed) return null;
    let valid = [];
    let errors = [];
    if (parsed.kind === 'table') {
      ({ valid, errors } = rowsToQuestions(parsed.rows, mapping, { defaultType, typeMap, defaults, lang }));
    } else {
      parseBulkMcq(parsed.text).forEach((p, i) => {
        const r = parsedToMcq(p, { lang });
        if (r.error) errors.push({ rowNo: i + 1, message: r.error });
        else valid.push({ rowNo: i + 1, question: { ...r.question, ...defaults, marks: Number(defaults.marks) || 1, tags: [] }, key: r.key, warning: r.warning });
      });
      if (!valid.length && !errors.length) errors.push({ rowNo: 1, message: 'No questions could be recognised. Use the "1. Question / A. option / Answer: B" layout.' });
    }
    const seen = new Set(bank.map(fingerprintOf));
    valid.forEach((v) => { const fp = fingerprintOf(v.question); v.dup = seen.has(fp); seen.add(fp); });
    return { valid, errors };
  }, [parsed, mapping, defaultType, typeMap, defaults, lang, bank]);

  const toImport = prepared ? prepared.valid.filter((v) => !(skipDups && v.dup)) : [];
  const dupCount = prepared ? prepared.valid.filter((v) => v.dup).length : 0;

  const run = async () => {
    setBusy(true);
    try {
      const msg = await checkLimit(institution, 'questions', toImport.length);
      if (msg) throw new Error(msg);
      await createQuestionsBulk(institutionId, user.uid, toImport.map((v) => ({ question: v.question, key: can('answerKeys.edit') ? v.key : null })));
      await logImport(institutionId, user.uid, { fileName, imported: toImport.length, skippedDuplicates: skipDups ? dupCount : 0, errors: prepared.errors.length, kind: parsed.kind });
      invalidateUsage(institutionId);
      useBank.getState().invalidate();
      setResult({ imported: toImport.length, errors: prepared.errors });
      setParsed(null);
    } catch (e) { toast.error(t(e.message)); } finally { setBusy(false); }
  };

  const errorReport = (errors) => downloadText(toCsv([['Row', 'Problem'], ...errors.map((e) => [e.rowNo, e.message])]), 'import-errors.csv', 'text/csv;charset=utf-8');

  return (
    <div className="space-y-4">
      <div className="panel p-4">
        <h2 className="mb-1 text-base">{t('1. Choose a file')}</h2>
        <p className="mb-3 text-sm text-muted">{t('CSV, XLSX and XLS files are mapped column by column. TXT, DOCX and PDF files are read as MCQ text. Nothing is saved until you confirm.')}</p>
        <label className="btn btn-primary cursor-pointer"><Upload className="h-4 w-4" />{t('Select file')}<input type="file" className="hidden" accept=".csv,.xlsx,.xls,.txt,.docx,.pdf" onChange={onFile} /></label>
        {busy && <Spinner className="ml-3 inline" />}
        {fileName && parsed && <span className="ml-3 text-sm">{fileName}</span>}
        {parsed && parsed.pdf && <p className="hint">{t('PDF text extraction depends on how the PDF was made. Check the preview carefully.')}</p>}
      </div>

      {parsed && (
        <div className="panel p-4">
          <h2 className="mb-3 text-base">{t('2. Match the data')}</h2>
          {parsed.kind === 'table' && (
            <>
              {GROUPS.map(([title, keys], gi) => (
                <details key={title} open={gi === 0} className="mb-3">
                  <summary className="cursor-pointer text-sm font-semibold">{t(title)}</summary>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {keys.map((k) => {
                      const field = IMPORT_FIELDS.find((x) => x.key === k);
                      return (
                        <Field key={k} label={field.label}>
                          <Select value={mapping[k] ?? ''} onChange={(e) => setMapping((m) => ({ ...m, [k]: e.target.value === '' ? undefined : Number(e.target.value) }))}>
                            <option value="">{t('Not in the file')}</option>
                            {parsed.headers.map((h, i) => <option key={i} value={i}>{h || `(${t('column')} ${i + 1})`}</option>)}
                          </Select>
                        </Field>
                      );
                    })}
                  </div>
                </details>
              ))}
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label={t('Type when the file has no type column')}><Select value={defaultType} onChange={(e) => setDefaultType(e.target.value)}>{IMPORTABLE_TYPES.map((x) => <option key={x} value={x}>{typeLabel(x, lang)}</option>)}</Select></Field>
              </div>
              {distinctTypeValues(parsed.rows, mapping).length > 0 && (
                <div className="mt-3">
                  <p className="label">{t('Question type values in your file')}</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {distinctTypeValues(parsed.rows, mapping).map((raw) => (
                      <div key={raw} className="flex items-center gap-2 text-sm"><span className="w-28 truncate font-mono">{raw}</span>
                        <Select className="h-8" value={typeMap[raw] || ''} onChange={(e) => setTypeMap((m) => ({ ...m, [raw]: e.target.value || undefined }))}><option value="">{t('Detect automatically')}</option>{IMPORTABLE_TYPES.map((x) => <option key={x} value={x}>{typeLabel(x, lang)}</option>)}</Select>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          <p className="label mt-4">{t('Defaults for rows that do not provide them')}</p>
          <div className="grid gap-2 sm:grid-cols-5">
            {[['className', 'Class'], ['subject', 'Subject'], ['chapter', 'Chapter'], ['topic', 'Topic'], ['marks', 'Marks']].map(([k, l]) => <Input key={k} placeholder={t(l)} value={defaults[k]} onChange={(e) => setDefaults((d) => ({ ...d, [k]: e.target.value }))} />)}
          </div>
        </div>
      )}

      {prepared && (
        <div className="panel p-4">
          <h2 className="mb-3 text-base">{t('3. Check and import')}</h2>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge tone="brand">{t('{n} ready', { n: prepared.valid.length })}</Badge>
            {dupCount > 0 && <Badge tone="warn">{t('{n} look like duplicates', { n: dupCount })}</Badge>}
            {prepared.errors.length > 0 && <Badge tone="danger">{t('{n} with problems', { n: prepared.errors.length })}</Badge>}
            {dupCount > 0 && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={skipDups} onChange={(e) => setSkipDups(e.target.checked)} />{t('Skip duplicates')}</label>}
          </div>
          {prepared.valid.slice(0, 6).map((v) => (
            <p key={v.rowNo} className="truncate border-b border-line py-1 text-sm"><span className="mr-2 text-muted">{v.rowNo}</span>{previewText(v.question, 120)} {v.dup && <Badge tone="warn">{t('duplicate')}</Badge>} {v.warning && <Badge tone="warn">{t(v.warning)}</Badge>}</p>
          ))}
          {prepared.errors.length > 0 && (
            <div className="mt-3"><p className="label">{t('Rows that cannot be imported')}</p>
              <ul className="max-h-40 overflow-y-auto text-sm">{prepared.errors.slice(0, 50).map((e, i) => <li key={i} className="border-b border-line py-1 text-danger">{t('Row')} {e.rowNo}: {t(e.message)}</li>)}</ul>
              <Button size="sm" className="mt-2" icon={FileDown} onClick={() => errorReport(prepared.errors)}>{t('Download error report')}</Button>
            </div>
          )}
          <Button variant="primary" className="mt-4" disabled={!toImport.length} loading={busy} onClick={run}>{t('Import {n} question(s)', { n: toImport.length })}</Button>
        </div>
      )}

      {result && (
        <div className="panel border-brand/50 bg-brand-soft p-4 text-sm">
          <p className="font-semibold">{t('Imported {n} question(s).', { n: result.imported })}</p>
          {result.errors.length > 0 && <Button size="sm" className="mt-2" icon={FileDown} onClick={() => errorReport(result.errors)}>{t('Download error report')} ({result.errors.length})</Button>}
        </div>
      )}
    </div>
  );
}

function ExportTab() {
  const { t } = useI18n();
  const toast = useToast();
  const { user, institution, institutionId, role, can } = useCurrent();
  const bank = useBank((s) => s.items);
  const [papers, setPapers] = useState([]);
  const [sel, setSel] = useState('');
  const [busy, setBusy] = useState('');
  useEffect(() => { useBank.getState().load(institutionId); listPapers(institutionId, { uid: user.uid, role }).then(setPapers).catch(() => {}); }, [institutionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = async (kind) => {
    if (!sel) { toast.error(t('Choose a paper first.')); return; }
    setBusy(kind);
    try {
      const data = await loadPaper(sel, institutionId, can('answerKeys.view'));
      await runExport(kind, data, { institution, institutionId, uid: user.uid, canKeys: can('answerKeys.view') });
    } catch (e) { toast.error(t(e.message)); } finally { setBusy(''); }
  };

  return (
    <div className="space-y-4">
      <div className="panel p-4">
        <h2 className="mb-3 text-base">{t('Export a question paper')}</h2>
        <Select value={sel} onChange={(e) => setSel(e.target.value)} className="mb-3 max-w-md"><option value="">{t('Choose a paper')}</option>{papers.map((p) => <option key={p.id} value={p.id}>{p.title || p.id}</option>)}</Select>
        <div className="flex flex-wrap gap-2">
          <Button loading={busy === 'print'} onClick={() => go('print')}>{t('Print / PDF')}</Button>
          <Button loading={busy === 'docx'} onClick={() => go('docx')}>Word</Button>
          {can('answerKeys.view') && <Button loading={busy === 'keyprint'} onClick={() => go('keyprint')}>{t('Answer key PDF')}</Button>}
          {can('answerKeys.view') && <Button loading={busy === 'keydocx'} onClick={() => go('keydocx')}>{t('Answer key Word')}</Button>}
          <Button loading={busy === 'json'} onClick={() => go('json')}>JSON</Button>
        </div>
      </div>
      {can('questions.view') && (
        <div className="panel p-4">
          <h2 className="mb-3 text-base">{t('Export the question bank')}</h2>
          <p className="mb-3 text-sm text-muted">{t('{n} questions. CSV does not include answers; JSON of a paper includes its answer key if you have access.', { n: bank.length })}</p>
          <div className="flex gap-2"><Button onClick={() => downloadBankJson(bank)}>JSON</Button><Button onClick={() => downloadBankCsv(bank)}>CSV</Button></div>
        </div>
      )}
    </div>
  );
}

function HistoryTab() {
  const { t } = useI18n();
  const { institutionId } = useCurrent();
  const [imports, setImports] = useState(null);
  const [exportsL, setExportsL] = useState(null);
  useEffect(() => {
    listLogs('imports', institutionId, 30).then(setImports).catch(() => setImports([]));
    listLogs('exports', institutionId, 30).then(setExportsL).catch(() => setExportsL([]));
  }, [institutionId]);
  const date = (v) => new Date(millis(v)).toLocaleString();
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="panel overflow-x-auto"><h2 className="border-b border-line px-4 py-3 text-base">{t('Import history')}</h2>
        {imports === null ? <div className="p-4"><Spinner /></div> : !imports.length ? <p className="p-4 text-sm text-muted">{t('No imports yet.')}</p> : (
          <table className="tbl"><thead><tr><th>{t('File')}</th><th>{t('Imported')}</th><th>{t('Problems')}</th><th>{t('Date')}</th></tr></thead><tbody>{imports.map((i) => <tr key={i.id}><td>{i.fileName}</td><td>{i.imported}</td><td>{i.errors}</td><td className="whitespace-nowrap">{date(i.createdAt)}</td></tr>)}</tbody></table>
        )}
      </div>
      <div className="panel overflow-x-auto"><h2 className="border-b border-line px-4 py-3 text-base">{t('Export history')}</h2>
        {exportsL === null ? <div className="p-4"><Spinner /></div> : !exportsL.length ? <p className="p-4 text-sm text-muted">{t('No exports yet.')}</p> : (
          <table className="tbl"><thead><tr><th>{t('Format')}</th><th>{t('Date')}</th></tr></thead><tbody>{exportsL.map((i) => <tr key={i.id}><td>{i.format}</td><td className="whitespace-nowrap">{date(i.createdAt)}</td></tr>)}</tbody></table>
        )}
      </div>
    </div>
  );
}

export default function ImportExport() {
  const { t } = useI18n();
  const { can } = useCurrent();
  const [tab, setTab] = useState(can('import.use') ? 'import' : 'export');
  const tabs = [can('import.use') && { id: 'import', label: t('Import') }, { id: 'export', label: t('Export') }, { id: 'history', label: t('History') }].filter(Boolean);
  return (
    <div>
      <PageHeader title={t('Import and export')} />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      <div className="pt-4">{tab === 'import' && <ImportTab />}{tab === 'export' && <ExportTab />}{tab === 'history' && <HistoryTab />}</div>
    </div>
  );
}
