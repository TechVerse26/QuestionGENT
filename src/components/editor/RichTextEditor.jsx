import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import TextAlign from '@tiptap/extension-text-align';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, Underline as UnderlineIcon, Superscript as SupIcon, Subscript as SubIcon, AlignLeft, AlignCenter, AlignRight, List, ListOrdered, Image as ImageIcon, Sigma, Undo2, Redo2 } from 'lucide-react';
import { FontSize, MathInline } from './extensions.js';
import MathDialog from './MathDialog.jsx';
import { emptyDoc, SRC_RE } from '../../utils/richtext.js';
import { FONT_STACKS } from '../../constants/templates.js';
import { uploadImage, uploadsEnabled } from '../../services/uploadService.js';
import { useI18n } from '../../i18n/index.jsx';
import { useToast } from '../common/Toast.jsx';

const BASE = [
  StarterKit.configure({ heading: { levels: [2, 3] } }),
  Underline, Subscript, Superscript, TextStyle, Color, FontFamily, FontSize,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Table.configure({ resizable: false }), TableRow, TableHeader, TableCell,
  Image.configure({ inline: false, allowBase64: false }),
  MathInline,
];

const SIZES = ['', '12px', '14px', '16px', '18px', '22px', '28px'];

function TBtn({ onClick, active, title, disabled, children }) {
  return (
    <button type="button" title={title} aria-label={title} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={onClick}
      className={`btn btn-sm btn-icon border-transparent ${active ? 'bg-brand-soft text-brand' : 'bg-transparent'}`}>
      {children}
    </button>
  );
}

function ImagePopover({ onInsert, onClose }) {
  const { t } = useI18n();
  const toast = useToast();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = () => {
    if (!SRC_RE.test(url.trim())) { toast.error(t('Enter a full https:// image address.')); return; }
    onInsert(url.trim());
  };
  const onFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setBusy(true);
    try { onInsert(await uploadImage(file)); } catch (err) { toast.error(t(err.message)); } finally { setBusy(false); }
  };
  return (
    <div className="absolute left-2 top-11 z-20 w-72 rounded border border-line bg-surface p-3">
      <label className="label">{t('Image address (URL)')}</label>
      <div className="flex gap-2">
        <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }} />
        <button type="button" className="btn btn-primary btn-sm" onClick={submit}>{t('Insert')}</button>
      </div>
      {uploadsEnabled && (
        <div className="mt-3">
          <label className="label">{t('Or upload a file')}</label>
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={onFile} disabled={busy} className="text-sm" />
          {busy && <p className="hint">{t('Uploading...')}</p>}
        </div>
      )}
      <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={onClose}>{t('Close')}</button>
    </div>
  );
}

function Toolbar({ editor, compact, onMath, onImage, extra }) {
  const { t } = useI18n();
  const run = (fn) => () => fn(editor.chain().focus()).run();
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-line bg-surface2 px-1.5 py-1">
      {!compact && <TBtn title={t('Undo')} onClick={run((c) => c.undo())}><Undo2 className="h-4 w-4" /></TBtn>}
      {!compact && <TBtn title={t('Redo')} onClick={run((c) => c.redo())}><Redo2 className="h-4 w-4" /></TBtn>}
      <TBtn title={t('Bold')} active={editor.isActive('bold')} onClick={run((c) => c.toggleBold())}><Bold className="h-4 w-4" /></TBtn>
      <TBtn title={t('Italic')} active={editor.isActive('italic')} onClick={run((c) => c.toggleItalic())}><Italic className="h-4 w-4" /></TBtn>
      <TBtn title={t('Underline')} active={editor.isActive('underline')} onClick={run((c) => c.toggleUnderline())}><UnderlineIcon className="h-4 w-4" /></TBtn>
      <TBtn title={t('Superscript')} active={editor.isActive('superscript')} onClick={run((c) => c.toggleSuperscript())}><SupIcon className="h-4 w-4" /></TBtn>
      <TBtn title={t('Subscript')} active={editor.isActive('subscript')} onClick={run((c) => c.toggleSubscript())}><SubIcon className="h-4 w-4" /></TBtn>
      {!compact && (
        <>
          <select className="input h-8 w-auto max-w-[9.5rem] px-1 text-xs" aria-label={t('Font')} defaultValue="" onChange={(e) => { const v = e.target.value; if (v) editor.chain().focus().setFontFamily(v).run(); else editor.chain().focus().unsetFontFamily().run(); }}>
            <option value="">{t('Font')}</option>
            {Object.values(FONT_STACKS).map((f) => <option key={f.label} value={f.css}>{f.label}</option>)}
          </select>
          <select className="input h-8 w-auto px-1 text-xs" aria-label={t('Size')} defaultValue="" onChange={(e) => { const v = e.target.value; if (v) editor.chain().focus().setFontSize(v).run(); else editor.chain().focus().unsetFontSize().run(); }}>
            {SIZES.map((s) => <option key={s} value={s}>{s || t('Size')}</option>)}
          </select>
          <input type="color" aria-label={t('Text color')} title={t('Text color')} className="h-8 w-8 cursor-pointer rounded border border-line bg-surface p-0.5" onChange={(e) => editor.chain().focus().setColor(e.target.value).run()} />
          <TBtn title={t('Align left')} active={editor.isActive({ textAlign: 'left' })} onClick={run((c) => c.setTextAlign('left'))}><AlignLeft className="h-4 w-4" /></TBtn>
          <TBtn title={t('Align center')} active={editor.isActive({ textAlign: 'center' })} onClick={run((c) => c.setTextAlign('center'))}><AlignCenter className="h-4 w-4" /></TBtn>
          <TBtn title={t('Align right')} active={editor.isActive({ textAlign: 'right' })} onClick={run((c) => c.setTextAlign('right'))}><AlignRight className="h-4 w-4" /></TBtn>
          <TBtn title={t('Bulleted list')} active={editor.isActive('bulletList')} onClick={run((c) => c.toggleBulletList())}><List className="h-4 w-4" /></TBtn>
          <TBtn title={t('Numbered list')} active={editor.isActive('orderedList')} onClick={run((c) => c.toggleOrderedList())}><ListOrdered className="h-4 w-4" /></TBtn>
          <select className="input h-8 w-auto px-1 text-xs" aria-label={t('Table')} value="" onChange={(e) => {
            const v = e.target.value;
            const c = editor.chain().focus();
            if (v === 'insert') c.insertTable({ rows: 3, cols: 3, withHeaderRow: false }).run();
            else if (v === 'row') c.addRowAfter().run();
            else if (v === 'col') c.addColumnAfter().run();
            else if (v === 'delrow') c.deleteRow().run();
            else if (v === 'delcol') c.deleteColumn().run();
            else if (v === 'del') c.deleteTable().run();
          }}>
            <option value="">{t('Table')}</option>
            <option value="insert">{t('Insert 3 x 3 table')}</option>
            <option value="row">{t('Add row below')}</option>
            <option value="col">{t('Add column right')}</option>
            <option value="delrow">{t('Delete row')}</option>
            <option value="delcol">{t('Delete column')}</option>
            <option value="del">{t('Delete table')}</option>
          </select>
        </>
      )}
      <TBtn title={t('Image')} onClick={onImage}><ImageIcon className="h-4 w-4" /></TBtn>
      <TBtn title={t('Math formula')} onClick={onMath}><Sigma className="h-4 w-4" /></TBtn>
      {extra}
    </div>
  );
}

// value: Tiptap JSON document. The editor reads `value` once on mount; give it a `key` to reload other content.
export default function RichTextEditor({ value, onChange, placeholder = '', minHeight = 100, compact = false, toolbarExtra, className = '' }) {
  const { t } = useI18n();
  const toast = useToast();
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const [math, setMath] = useState(null);
  const [imgOpen, setImgOpen] = useState(false);

  const editor = useEditor({
    extensions: [...BASE, Placeholder.configure({ placeholder })],
    content: value && value.type === 'doc' ? value : emptyDoc(),
    onUpdate: ({ editor: ed }) => { if (changeRef.current) changeRef.current(ed.getJSON()); },
  });

  useEffect(() => {
    if (editor) editor.storage.mathInline.onEdit = (info) => setMath(info);
  }, [editor]);

  if (!editor) return null;

  const applyMath = ({ latex, display }) => {
    if (math && math.pos != null) {
      editor.chain().focus().command(({ tr }) => { tr.setNodeMarkup(math.pos, undefined, { latex, display }); return true; }).run();
    } else {
      editor.chain().focus().insertContent({ type: 'mathInline', attrs: { latex, display } }).run();
    }
    setMath(null);
  };

  const insertImage = (src) => {
    if (!SRC_RE.test(src)) { toast.error(t('Unsupported image address.')); return; }
    editor.chain().focus().setImage({ src }).run();
    setImgOpen(false);
  };

  return (
    <div className={`relative rounded border border-line bg-surface focus-within:border-brand ${className}`}>
      <Toolbar editor={editor} compact={compact} onMath={() => setMath({})} onImage={() => setImgOpen((v) => !v)} extra={toolbarExtra ? toolbarExtra(editor) : null} />
      {imgOpen && <ImagePopover onInsert={insertImage} onClose={() => setImgOpen(false)} />}
      <EditorContent editor={editor} className="rt px-3 py-2 text-[15px]" style={{ minHeight }} />
      <MathDialog open={!!math} initial={math} onClose={() => setMath(null)} onApply={applyMath} />
    </div>
  );
}
