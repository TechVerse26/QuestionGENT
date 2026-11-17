import { RichField, KeySection, useQ } from '../common.jsx';
import { useI18n } from '../../i18n/index.jsx';

export default function TrueFalseEditor({ q, update, canKey }) {
  const { t } = useI18n();
  const { setBody, setKey } = useQ(update);
  const answer = q.key ? q.key.answer : null;
  return (
    <div className="space-y-4">
      <RichField label={t('Statement')} value={q.body.statement} onChange={(statement) => setBody({ statement })} minHeight={70} />
      <KeySection canKey={canKey}>
        <div className="flex gap-6 text-sm">
          <label className="flex items-center gap-2"><input type="radio" name={`tf-${q.id}`} checked={answer === true} onChange={() => setKey({ answer: true })} />{t('True')}</label>
          <label className="flex items-center gap-2"><input type="radio" name={`tf-${q.id}`} checked={answer === false} onChange={() => setKey({ answer: false })} />{t('False')}</label>
        </div>
        <RichField label={t('Explanation')} value={q.key && q.key.explanation} onChange={(explanation) => setKey({ explanation })} minHeight={50} compact />
      </KeySection>
    </div>
  );
}
