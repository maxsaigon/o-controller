import { ArrowLeft, RotateCw } from 'lucide-react';
import { useState } from 'react';
import type { ShortcutStatus } from '../native/shortcuts';

type Props = {
  serviceUrl: string;
  serviceReachable: boolean;
  error: string | null;
  shortcutStatus: ShortcutStatus[];
  onChangeServiceUrl: (url: string) => void;
  onBack: () => void;
  onTest: () => void;
};

export function ServiceSettings({ serviceUrl, serviceReachable, error, shortcutStatus, onChangeServiceUrl, onBack, onTest }: Props) {
  const [draft, setDraft] = useState(serviceUrl);
  const shortcutErrors = shortcutStatus.filter((shortcut) => shortcut.error);
  const nativeShellMissing = shortcutErrors.every((shortcut) => shortcut.error?.includes('Tauri shell'));

  return (
    <section className="settings-view">
      <button className="ghost-button back-button" type="button" onClick={onBack}>
        <ArrowLeft size={16} />
        Back
      </button>

      <div className="settings-header">
        <h2>Settings</h2>
        <span className={`status-pill ${serviceReachable ? 'connected' : 'offline'}`}>
          <span className="status-dot" />
          {serviceReachable ? 'Service online' : 'Service offline'}
        </span>
      </div>

      <label className="field">
        <span>Service URL</span>
        <input value={draft} onChange={(event) => setDraft(event.currentTarget.value)} placeholder="http://localhost:8787" />
      </label>

      <div className="settings-actions">
        <button className="primary-button" type="button" onClick={() => onChangeServiceUrl(draft)}>
          Save
        </button>
        <button className="ghost-button" type="button" onClick={onTest}>
          <RotateCw size={15} />
          Test
        </button>
      </div>

      <div className="shortcut-list">
        <h3>Shortcuts</h3>
        {shortcutStatus.map((shortcut) => (
          <p key={shortcut.id}>
            <kbd>{shortcut.display}</kbd>
            <span>{shortcut.label}</span>
            <small className={shortcut.registered ? 'shortcut-ok' : 'shortcut-unavailable'}>
              {shortcut.registered ? 'Active' : 'Unavailable'}
            </small>
          </p>
        ))}
      </div>

      {shortcutErrors.length > 0 ? (
        <p className="shortcut-note">
          {nativeShellMissing
            ? 'Native shortcuts activate in the Tauri shell. Browser preview keeps every control available on screen.'
            : 'Shortcut conflicts are non-fatal. If macOS or another app already owns a shortcut, O-Control leaves the control available on screen and reports it here.'}
        </p>
      ) : null}

      {error ? <p className="inline-error">{error}</p> : null}
    </section>
  );
}
