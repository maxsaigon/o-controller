import { ArrowLeft, RotateCw } from 'lucide-react';
import { useState } from 'react';

type Props = {
  serviceUrl: string;
  serviceReachable: boolean;
  error: string | null;
  onChangeServiceUrl: (url: string) => void;
  onBack: () => void;
  onTest: () => void;
};

export function ServiceSettings({ serviceUrl, serviceReachable, error, onChangeServiceUrl, onBack, onTest }: Props) {
  const [draft, setDraft] = useState(serviceUrl);

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
        <p><kbd>Cmd</kbd><kbd>Shift</kbd><kbd>Up</kbd> Volume up</p>
        <p><kbd>Cmd</kbd><kbd>Shift</kbd><kbd>Down</kbd> Volume down</p>
        <p><kbd>Cmd</kbd><kbd>Shift</kbd><kbd>Space</kbd> Play/pause</p>
      </div>

      {error ? <p className="inline-error">{error}</p> : null}
    </section>
  );
}
