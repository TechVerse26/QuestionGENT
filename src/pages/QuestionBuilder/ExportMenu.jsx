import { useState } from 'react';
import { Download, Printer, FileText, KeyRound, FileJson } from 'lucide-react';
import Button from '../../components/common/Button.jsx';
import { useToast } from '../../components/common/Toast.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { useCurrent } from '../../hooks/useCurrent.js';
import { useBuilder } from '../../store/builderStore.js';
import { runExport } from '../../export/runExport.js';

export default function ExportMenu({ canKeys }) {
  const { t } = useI18n();
  const toast = useToast();
  const { user, institution, institutionId } = useCurrent();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (kind) => {
    setBusy(true);
    setOpen(false);
    try {
      const { paper, items, keys } = useBuilder.getState();
      await runExport(kind, { paper, items, keys }, { institution, institutionId, uid: user.uid, canKeys });
    } catch (e) {
      toast.error(t(e.message));
    } finally {
      setBusy(false);
    }
  };

  const Item = ({ icon: Icon, label, kind, hint }) => (
    <button type="button" className="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-surface2" onClick={() => run(kind)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
      <span><span className="block text-sm">{label}</span>{hint && <span className="block text-xs text-muted">{hint}</span>}</span>
    </button>
  );

  return (
    <div className="relative">
      <Button icon={Download} loading={busy} onClick={() => setOpen((v) => !v)}>{t('Export')}</Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-72 rounded border border-line bg-surface py-1">
            <Item icon={Printer} label={t('Print / save as PDF')} hint={t('Opens the print view; choose "Save as PDF"')} kind="print" />
            <Item icon={FileText} label={t('Word document (.docx)')} kind="docx" />
            {canKeys && <Item icon={KeyRound} label={t('Answer key as PDF')} kind="keyprint" />}
            {canKeys && <Item icon={KeyRound} label={t('Answer key as Word')} kind="keydocx" />}
            <Item icon={FileJson} label={t('Question data (JSON)')} kind="json" />
          </div>
        </>
      )}
    </div>
  );
}
