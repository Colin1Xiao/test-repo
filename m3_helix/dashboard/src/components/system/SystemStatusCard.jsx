export function SystemStatusCard({ data, loading, error }) {
  if (loading) {
    return (
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-3">System Status</h2>
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-3">System Status</h2>
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  const { runtime_mode, uptime_seconds, ordering_enabled, event_store_writable, ws_client_count } = data || {};

  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <h2 className="text-lg font-semibold text-white mb-3">System Status</h2>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-400">Runtime Mode</span>
          <span className="text-slate-200">{runtime_mode || 'N/A'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Uptime</span>
          <span className="text-slate-200">{uptime_seconds ? `${Math.floor(uptime_seconds / 60)}m` : 'N/A'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Ordering</span>
          <span className={ordering_enabled ? 'text-green-400' : 'text-red-400'}>
            {ordering_enabled ? 'enabled' : 'disabled'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Event Store</span>
          <span className={event_store_writable ? 'text-green-400' : 'text-red-400'}>
            {event_store_writable ? 'writable' : 'readonly'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">WS Clients</span>
          <span className="text-slate-200">{ws_client_count ?? 0}</span>
        </div>
      </div>
    </div>
  );
}
