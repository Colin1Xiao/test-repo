import { usePolling } from './usePolling';
import { getJson } from '../api/client';
import { endpoints } from '../api/endpoints';

export function useSystemStatus(intervalMs = 3000) {
  return usePolling(
    () => getJson(endpoints.systemStatus),
    intervalMs
  );
}
