import { usePolling } from './usePolling';
import { getJson } from '../api/client';
import { endpoints } from '../api/endpoints';

export function useOrders(intervalMs = 3000) {
  return usePolling(
    () => getJson(endpoints.orders),
    intervalMs
  );
}
