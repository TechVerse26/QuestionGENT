import { createContext, useCallback, useContext, useState } from 'react';
import Modal from './Modal.jsx';
import Button from './Button.jsx';
import { useI18n } from '../../i18n/index.jsx';

const Ctx = createContext(() => Promise.resolve(false));

export function ConfirmProvider({ children }) {
  const { t } = useI18n();
  const [state, setState] = useState(null);
  const confirm = useCallback((opts) => new Promise((resolve) => setState({ ...opts, resolve })), []);
  const close = (v) => { if (state) state.resolve(v); setState(null); };
  return (
    <Ctx.Provider value={confirm}>
      {children}
      <Modal open={!!state} onClose={() => close(false)} title={state ? state.title : ''} size="sm"
        footer={(
          <>
            <Button onClick={() => close(false)}>{t('Cancel')}</Button>
            <Button variant={state && state.danger ? 'danger' : 'primary'} onClick={() => close(true)}>{state && state.confirmLabel ? state.confirmLabel : t('Confirm')}</Button>
          </>
        )}
      >
        <p className="text-sm">{state ? state.message : ''}</p>
      </Modal>
    </Ctx.Provider>
  );
}

// const ok = await useConfirm()({ title, message, danger: true, confirmLabel })
export const useConfirm = () => useContext(Ctx);
