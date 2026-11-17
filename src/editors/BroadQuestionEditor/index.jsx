import { WrittenEditor } from '../ShortQuestionEditor/index.jsx';
import { Select } from '../../components/common/Field.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { useQ } from '../common.jsx';

const KINDS = [['essay', 'Essay'], ['descriptive', 'Descriptive'], ['explanatory', 'Explanatory'], ['analytical', 'Analytical'], ['evaluation', 'Evaluation-based'], ['long', 'Long-form']];

export default function BroadQuestionEditor(props) {
  const { t } = useI18n();
  const { setBody } = useQ(props.update);
  return (
    <WrittenEditor {...props} stemHeight={130} answerLabel={t('Answer outline')}>
      <div className="max-w-xs">
        <label className="label">{t('Question style')}</label>
        <Select value={props.q.body.kind || 'descriptive'} onChange={(e) => setBody({ kind: e.target.value })}>
          {KINDS.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
        </Select>
      </div>
    </WrittenEditor>
  );
}
