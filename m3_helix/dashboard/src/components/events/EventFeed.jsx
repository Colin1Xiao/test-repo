export function EventFeed({ events, connected }) {
  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-white">Live Event Feed</h2>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-xs text-slate-400">{connected ? 'Live' : 'Disconnected'}</span>
        </div>
      </div>
      
      <div className="h-64 overflow-y-auto space-y-1 font-mono text-xs">
        {events.length === 0 ? (
          <div className="text-slate-500 text-center py-8">
            {connected ? 'Waiting for events...' : 'WebSocket disconnected'}
          </div>
        ) : (
          events.map((event, idx) => {
            const type = event.type || event.topic || 'unknown';
            const ts = event.ts || event.timestamp || Date.now();
            const source = event.source || 'system';
            
            const getTypeColor = () => {
              if (type.includes('order')) return 'text-blue-400';
              if (type.includes('position')) return 'text-green-400';
              if (type.includes('incident') || type.includes('breaker')) return 'text-red-400';
              if (type.includes('invalid')) return 'text-yellow-400';
              return 'text-slate-400';
            };

            return (
              <div key={idx} className="flex items-start gap-2 py-1 border-b border-slate-700/50">
                <span className="text-slate-500 whitespace-nowrap">
                  {new Date(ts).toLocaleTimeString()}
                </span>
                <span className={getTypeColor()}>[{type}]</span>
                <span className="text-slate-400">{source}</span>
                {event.payload && (
                  <span className="text-slate-500 truncate">
                    {JSON.stringify(event.payload).slice(0, 60)}...
                  </span>
                )}
                {event.raw && (
                  <span className="text-yellow-500 truncate">{event.raw.slice(0, 40)}...</span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
