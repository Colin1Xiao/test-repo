export function Header({ mode, loopState, globalFreeze, wsConnected, lastEventTs }) {
  const getModeBadge = () => {
    const color = mode === 'live' ? 'bg-green-500' : 
                  mode === 'paper' ? 'bg-blue-500' : 'bg-gray-500';
    return (
      <span className={`${color} text-white text-xs px-2 py-1 rounded`}>
        {mode || 'unknown'}
      </span>
    );
  };

  const getWsBadge = () => {
    const color = wsConnected ? 'bg-green-500' : 'bg-red-500';
    const text = wsConnected ? 'connected' : 'disconnected';
    return (
      <span className={`${color} text-white text-xs px-2 py-1 rounded`}>
        ws: {text}
      </span>
    );
  };

  const getFreezeBadge = () => {
    if (!globalFreeze) return null;
    return (
      <span className="bg-red-600 text-white text-xs px-2 py-1 rounded animate-pulse">
        FROZEN
      </span>
    );
  };

  return (
    <header className="bg-slate-800 border-b border-slate-700 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-white">🐉 M3 Helix</h1>
          <div className="flex items-center gap-2">
            {getModeBadge()}
            {getFreezeBadge()}
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="text-slate-400">
            loop: <span className="text-slate-200">{loopState || 'unknown'}</span>
          </div>
          {getWsBadge()}
          {lastEventTs && (
            <div className="text-slate-500 text-xs">
              last: {new Date(lastEventTs).toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
