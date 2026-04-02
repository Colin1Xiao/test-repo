export function IncidentsPanel({ data, loading, error }) {
  if (loading) {
    return (
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-3">Incidents & Breakers</h2>
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-3">Incidents & Breakers</h2>
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  const { global_freeze, breakers = [], active_incidents = [] } = data || {};

  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <h2 className="text-lg font-semibold text-white mb-3">Incidents & Breakers</h2>
      
      {/* Global Freeze */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-slate-400">Global Freeze</span>
          <span className={global_freeze ? 'text-red-400 font-bold' : 'text-green-400'}>
            {global_freeze ? 'ACTIVE' : 'Inactive'}
          </span>
        </div>
        {global_freeze && (
          <div className="bg-red-900/30 border border-red-700 rounded p-2 text-sm text-red-200">
            ⚠️ Trading is currently frozen
          </div>
        )}
      </div>

      {/* Breakers */}
      <div className="mb-4">
        <h3 className="text-sm font-medium text-slate-300 mb-2">Breakers</h3>
        {breakers.length === 0 ? (
          <div className="text-slate-500 text-sm">No active breakers</div>
        ) : (
          <div className="space-y-1">
            {breakers.map((breaker, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <span className="text-slate-300">{breaker.name || breaker.id || `Breaker ${idx + 1}`}</span>
                <span className={breaker.active ? 'text-red-400' : 'text-green-400'}>
                  {breaker.active ? 'TRIPPED' : 'OK'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Incidents */}
      <div>
        <h3 className="text-sm font-medium text-slate-300 mb-2">Active Incidents</h3>
        {active_incidents.length === 0 ? (
          <div className="text-slate-500 text-sm">No active incidents</div>
        ) : (
          <div className="space-y-2">
            {active_incidents.map((incident, idx) => (
              <div key={idx} className="border border-slate-700 rounded p-2 text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-200 font-medium">{incident.type || 'Incident'}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    incident.severity === 'critical' ? 'bg-red-600 text-white' :
                    incident.severity === 'warning' ? 'bg-yellow-600 text-white' :
                    'bg-slate-600 text-white'
                  }`}>
                    {incident.severity || 'info'}
                  </span>
                </div>
                <div className="text-slate-400 text-xs">{incident.message || incident.description}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
