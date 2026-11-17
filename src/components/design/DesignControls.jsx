import { Field, Input, Select } from '../common/Field.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { setIn, getIn } from '../../utils/object.js';
import { FONT_STACKS, DOCX_FONTS, PAGE_SIZES, resolveDesign } from '../../constants/templates.js';

function Group({ title, children, open = false }) {
  return (
    <details open={open} className="border-b border-line py-2">
      <summary className="cursor-pointer py-1 text-sm font-semibold">{title}</summary>
      <div className="grid gap-3 pt-2 sm:grid-cols-2">{children}</div>
    </details>
  );
}

// Controls for every field of a paper design (also used for templates in the Design Studio)
export default function DesignControls({ value, onChange, templates = [], onTemplate }) {
  const { t, lang } = useI18n();
  const d = resolveDesign(value);
  const set = (path, v) => onChange(setIn(d, path, v));
  const num = (path, label, step = 1) => (
    <Field label={label}><Input type="number" step={step} value={getIn(d, path, 0)} onChange={(e) => set(path, e.target.value === '' ? 0 : Number(e.target.value))} /></Field>
  );
  const sel = (path, label, options) => (
    <Field label={label}><Select value={String(getIn(d, path, ''))} onChange={(e) => set(path, e.target.value)}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
  );
  const chk = (path, label) => (
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!getIn(d, path)} onChange={(e) => set(path, e.target.checked)} />{label}</label>
  );
  const color = (path, label) => (
    <Field label={label}><input type="color" className="h-9 w-full cursor-pointer rounded border border-line bg-surface p-0.5" value={getIn(d, path, '#111111')} onChange={(e) => set(path, e.target.value)} /></Field>
  );

  return (
    <div>
      {templates.length > 0 && (
        <Group title={t('Template')} open>
          <Field label={t('Start from a template')} className="sm:col-span-2">
            <Select value={d.templateId || ''} onChange={(e) => onTemplate && onTemplate(e.target.value)}>
              {templates.map((x) => <option key={x.id} value={x.id}>{x.name[lang] || x.name.en || x.name}</option>)}
            </Select>
          </Field>
          <p className="hint sm:col-span-2">{t('Choosing a template replaces the layout settings below.')}</p>
        </Group>
      )}
      <Group title={t('Language and numbers')} open>
        {sel('language', t('Fixed labels language'), [['bn', 'বাংলা'], ['en', 'English']])}
        {sel('digits', t('Digits'), [['bn', '১২৩ (Bengali)'], ['en', '123 (English)']])}
      </Group>
      <Group title={t('Typography')}>
        {sel('fontFamily', t('Font (PDF and preview)'), Object.entries(FONT_STACKS).map(([k, f]) => [k, f.label]))}
        {sel('docxFont', t('Font (Word file)'), DOCX_FONTS.map((f) => [f, f]))}
        {num('fontSize', t('Font size (pt)'), 0.5)}
        {num('lineHeight', t('Line height'), 0.05)}
      </Group>
      <Group title={t('Page and margins')}>
        {sel('page.size', t('Paper size'), [...Object.keys(PAGE_SIZES).map((k) => [k, k]), ['Custom', t('Custom')]])}
        {sel('page.orientation', t('Orientation'), [['portrait', t('Portrait')], ['landscape', t('Landscape')]])}
        {d.page.size === 'Custom' && num('page.customW', t('Width (mm)'))}
        {d.page.size === 'Custom' && num('page.customH', t('Height (mm)'))}
        {num('margins.top', t('Top margin (mm)'))}
        {num('margins.bottom', t('Bottom margin (mm)'))}
        {num('margins.left', t('Left margin (mm)'))}
        {num('margins.right', t('Right margin (mm)'))}
      </Group>
      <Group title={t('Border and colors')}>
        {chk('border.enabled', t('Page border'))}
        {sel('border.style', t('Border style'), [['solid', t('Solid')], ['double', t('Double')], ['dashed', t('Dashed')], ['dotted', t('Dotted')]])}
        {num('border.width', t('Border width (mm)'), 0.1)}
        {num('border.inset', t('Border distance from edge (mm)'))}
        {color('border.color', t('Border color'))}
        {color('accent', t('Accent color'))}
      </Group>
      <Group title={t('Header')}>
        {sel('header.layout', t('Header layout'), [['centered', t('Centered')], ['split', t('Logo left')], ['minimal', t('Minimal')]])}
        {sel('header.infoLayout', t('Exam details'), [['grid', t('Boxed grid')], ['line', t('Single line')]])}
        {num('header.titleSize', t('Institution name size (pt)'))}
        <div className="space-y-1">{chk('header.showLogo', t('Show logo'))}{chk('header.showInstitution', t('Show institution'))}{chk('header.showExam', t('Show exam name'))}</div>
      </Group>
      <Group title={t('Sections and questions')}>
        {sel('section.style', t('Section heading style'), [['bar', t('Filled bar')], ['underline', t('Underline')], ['boxed', t('Boxed')], ['plain', t('Plain')]])}
        {sel('section.align', t('Heading alignment'), [['left', t('Left')], ['center', t('Center')]])}
        {num('question.spacing', t('Space between questions (mm)'), 0.5)}
        {sel('question.marksAlign', t('Marks position'), [['right', t('Right column')], ['inline', t('After the question text')]])}
      </Group>
      <Group title={t('Footer and page numbers')}>
        {chk('footer.enabled', t('Show footer'))}
        {chk('footer.pageNumbers', t('Page numbers'))}
        {sel('footer.format', t('Page number format'), [['n_of_total', t('Page 1 of 3')], ['n', '1']])}
        <Field label={t('Footer text')}><Input value={d.footer.text} onChange={(e) => set('footer.text', e.target.value)} /></Field>
      </Group>
      <Group title={t('Watermark')}>
        {chk('watermark.enabled', t('Show watermark'))}
        <Field label={t('Watermark text')}><Input value={d.watermark.text} onChange={(e) => set('watermark.text', e.target.value)} /></Field>
        {num('watermark.opacity', t('Opacity (0.02 to 0.3)'), 0.01)}
      </Group>
      <Group title={t('Signature lines')}>
        {chk('signature.enabled', t('Show signature lines'))}
        <Field label={t('Labels (comma separated)')}>
          <Input key={d.signature.labels.join('|')} defaultValue={d.signature.labels.join(', ')} onBlur={(e) => set('signature.labels', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />
        </Field>
      </Group>
    </div>
  );
}
