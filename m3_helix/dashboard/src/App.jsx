import { Header } from './components/layout/Header';
import { SystemStatusCard } from './components/system/SystemStatusCard';
import { OrdersTable } from './components/orders/OrdersTable';
import { PositionsCard } from './components/positions/PositionsCard';
import { IncidentsPanel } from './components/incidents/IncidentsPanel';
import { EventFeed } from './components/events/EventFeed';

import { useSystemStatus } from './hooks/useSystemStatus';
import { useOrders } from './hooks/useOrders';
import { usePositions } from './hooks/usePositions';
import { useIncidents } from './hooks/useIncidents';
import { useEventStream } from './hooks/useEventStream';

function App() {
  const { data: systemData, loading: systemLoading, error: systemError } = useSystemStatus();
  const { data: ordersData, loading: ordersLoading, error: ordersError } = useOrders();
  const { data: positionsData, loading: positionsLoading, error: positionsError } = usePositions();
  const { data: incidentsData, loading: incidentsLoading, error: incidentsError } = useIncidents();
  const { connected: wsConnected, events, lastMessage } = useEventStream();

  // Extract header data from system status
  const mode = systemData?.runtime_mode;
  const loopState = systemData?.loop_state;
  const globalFreeze = systemData?.global_freeze || incidentsData?.global_freeze;
  const lastEventTs = lastMessage?.ts || lastMessage?.timestamp;

  return (
    <div className="min-h-screen bg-slate-900">
      <Header 
        mode={mode} 
        loopState={loopState} 
        globalFreeze={globalFreeze}
        wsConnected={wsConnected}
        lastEventTs={lastEventTs}
      />
      
      <main className="p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          {/* System Status */}
          <SystemStatusCard 
            data={systemData} 
            loading={systemLoading} 
            error={systemError} 
          />
          
          {/* Orders */}
          <OrdersTable 
            data={ordersData} 
            loading={ordersLoading} 
            error={ordersError} 
          />
          
          {/* Positions */}
          <PositionsCard 
            data={positionsData} 
            loading={positionsLoading} 
            error={positionsError} 
          />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Incidents */}
          <IncidentsPanel 
            data={incidentsData} 
            loading={incidentsLoading} 
            error={incidentsError} 
          />
          
          {/* Event Feed */}
          <EventFeed 
            events={events} 
            connected={wsConnected} 
          />
        </div>
      </main>
      
      <footer className="border-t border-slate-800 px-4 py-3 text-xs text-slate-500">
        <div className="flex items-center justify-between">
          <div>
            API: {import.meta.env.VITE_API_BASE || 'http://localhost:8000'} | 
            WS: {import.meta.env.VITE_WS_BASE || 'ws://localhost:8000'}
          </div>
          <div>M3 Helix Dashboard v0.1.0</div>
        </div>
      </footer>
    </div>
  );
}

export default App;
