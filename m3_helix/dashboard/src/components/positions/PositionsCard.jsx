export function PositionsCard({ data, loading, error }) {
  if (loading) {
    return (
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-3">Positions</h2>
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-3">Positions</h2>
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  const positions = data?.positions || data || [];
  const positionList = Array.isArray(positions) ? positions : [positions].filter(Boolean);

  if (positionList.length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-3">Positions</h2>
        <div className="text-slate-500">No open positions</div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <h2 className="text-lg font-semibold text-white mb-3">Positions ({positionList.length})</h2>
      <div className="space-y-3">
        {positionList.map((pos, idx) => {
          const pnl = pos.unrealized_pnl || 0;
          const pnlColor = pnl >= 0 ? 'text-green-400' : 'text-red-400';
          const sideColor = pos.side === 'long' ? 'text-green-400' : 'text-red-400';

          return (
            <div key={idx} className="border border-slate-700 rounded p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-white">{pos.symbol || 'ETH-USDT'}</span>
                <span className={sideColor}>{pos.side || 'N/A'}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-slate-400">Qty:</span>{' '}
                  <span className="text-slate-200">{pos.qty ?? '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400">Entry:</span>{' '}
                  <span className="text-slate-200">{pos.entry_price ?? '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400">Mark:</span>{' '}
                  <span className="text-slate-200">{pos.mark_price ?? '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400">PnL:</span>{' '}
                  <span className={pnlColor}>{pnl > 0 ? '+' : ''}{pnl.toFixed(4)}</span>
                </div>
              </div>
              {pos.updated_at && (
                <div className="text-xs text-slate-500 mt-2">
                  Updated: {new Date(pos.updated_at).toLocaleTimeString()}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
