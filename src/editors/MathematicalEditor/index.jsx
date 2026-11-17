import { WrittenEditor } from '../ShortQuestionEditor/index.jsx';
import { useI18n } from '../../i18n/index.jsx';

export default function MathematicalEditor(props) {
  const { t } = useI18n();
  return (
    <WrittenEditor {...props} stemLabel={t('Problem (use the Σ button for formulas, fractions, roots and matrices)')} answerLabel={t('Solution steps')}>
      <p className="hint">{t('Formulas use LaTeX. Double-click a formula in the editor to change it.')}</p>
    </WrittenEditor>
  );
}
