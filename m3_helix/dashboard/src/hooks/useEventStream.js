import { useState, useEffect, useRef } from 'react';

const WS_BASE = import.meta.env.VITE_WS_BASE || 'ws://localhost:8000';

export function useEventStream() {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState([]);
  const [lastMessage, setLastMessage] = useState(null);
  const wsRef = useRef(null);

  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLastMessage(data);
        setEvents((prev) => {
          const newEvents = [data, ...prev];
          return newEvents.slice(0, 50); // Keep last 50 events
        });
      } catch (err) {
        console.error('Invalid WS message:', err);
        setEvents((prev) => [
          { type: 'invalid_event', raw: event.data, ts: Date.now() },
          ...prev,
        ].slice(0, 50));
      }
    };

    ws.onclose = () => {
      setConnected(false);
    };

    ws.onerror = (err) => {
      console.error('WS error:', err);
      setConnected(false);
    };

    return () => {
      ws.close();
    };
  }, []);

  return { connected, events, lastMessage };
}
