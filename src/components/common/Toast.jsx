import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CircleCheck, TriangleAlert, Info } from 'lucide-react';

const Ctx = createContext({ success() {}, error() {}, info() {} });
const TONES = {
  success: { cls: 'border-l-brand', Icon: CircleCheck, color: 'text-brand' },
  error: { cls: 'border-l-danger', Icon: TriangleAlert, color: 'text-danger' },
  info: { cls: 'border-l-info', Icon: Info, color: 'text-info' },
};

export function ToastProvider({ children }) {
  const [list, setList] = useState([]);
  const push = useCallback((kind, text) => {
    const id = Math.random().toString(36).slice(2);
    setList((l) => [...l, { id, kind, text }]);
    setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 3500);
  }, []);
  const api = useMemo(() => ({ success: (t) => push('success', t), error: (t) => push('error', t), info: (t) => push('info', t) }), [push]);
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="no-print fixed bottom-3 right-3 z-[60] flex w-[min(92vw,380px)] flex-col gap-2" aria-live="polite">
        {list.map((x) => {
          const tone = TONES[x.kind];
          return (
            <div key={x.id} className={`panel flex items-start gap-2 border-l-4 px-3 py-2 text-sm ${tone.cls}`}>
              <tone.Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone.color}`} />
              <span>{x.text}</span>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
