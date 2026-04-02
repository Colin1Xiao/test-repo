export function OrdersTable({ data, loading, error }) {
  if (loading) {
    return (
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-3">Orders</h2>
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-3">Orders</h2>
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  const orders = data?.orders || data || [];
  const recentOrders = Array.isArray(orders) ? orders.slice(0, 10) : [];

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'filled': return 'text-green-400';
      case 'rejected': return 'text-red-400';
      case 'canceled': return 'text-slate-400';
      case 'pending': return 'text-yellow-400';
      default: return 'text-slate-300';
    }
  };

  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <h2 className="text-lg font-semibold text-white mb-3">Orders ({recentOrders.length})</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 border-b border-slate-700">
              <th className="text-left py-2">ID</th>
              <th className="text-left py-2">Side</th>
              <th className="text-left py-2">Type</th>
              <th className="text-right py-2">Qty</th>
              <th className="text-right py-2">Filled</th>
              <th className="text-left py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {recentOrders.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-slate-500 py-4 text-center">No orders</td>
              </tr>
            ) : (
              recentOrders.map((order, idx) => (
                <tr key={order.order_id || idx} className="border-b border-slate-700/50">
                  <td className="py-2 text-slate-300 font-mono text-xs">
                    {order.order_id?.slice(0, 8) || 'N/A'}...
                  </td>
                  <td className="py-2">
                    <span className={order.side === 'buy' ? 'text-green-400' : 'text-red-400'}>
                      {order.side}
                    </span>
                  </td>
                  <td className="py-2 text-slate-300">{order.type || 'market'}</td>
                  <td className="py-2 text-right text-slate-300">{order.qty ?? '-'}</td>
                  <td className="py-2 text-right text-slate-300">{order.filled_qty ?? '-'}</td>
                  <td className={`py-2 ${getStatusColor(order.status)}`}>
                    {order.status || 'unknown'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
