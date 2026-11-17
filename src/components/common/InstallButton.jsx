import { useState, useSyncExternalStore } from 'react';
import { Download } from 'lucide-react';
import { useI18n } from '../../i18n/index.jsx';
import { installMode, promptInstall, subscribeInstall } from '../../pwa/install.js';

// "Install app" button. It appears only where the app can really be installed and disappears once it runs as an installed app.
export default function InstallButton({ className = '' }) {
  const { t } = useI18n();
  const mode = useSyncExternalStore(subscribeInstall, installMode);
  const [help, setHelp] = useState(false);
  if (mode === 'installed' || mode === 'none') return null;

  const onClick = () => {
    if (mode === 'prompt') promptInstall();
    else setHelp((v) => !v);
  };

  return (
    <div className="relative">
      <button type="button" className={`btn btn-ghost btn-sm ${className}`} onClick={onClick} title={t('Install app')} aria-label={t('Install app')}>
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">{t('Install app')}</span>
      </button>
      {help && (
        <div className="panel absolute right-0 top-full z-50 mt-1 w-64 p-3 text-sm" role="dialog">
          <p>{t('To install on iPhone or iPad, tap the Share button, then choose "Add to Home Screen".')}</p>
          <button type="button" className="btn btn-sm mt-2" onClick={() => setHelp(false)}>{t('Close')}</button>
        </div>
      )}
    </div>
  );
}
