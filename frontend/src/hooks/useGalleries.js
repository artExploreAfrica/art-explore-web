import { useEffect, useState, useCallback } from 'react';
import { apiGet } from '../lib/api';
import { adaptInstitutions } from '../lib/adapters';

/**
 * Fetch published institutions from the backend and return them already adapted
 * to the UI's gallery shape. Drop-in replacement for the old static
 * `import { galleries } from '../../data/galleries'`.
 *
 * @param {object} [opts]
 * @param {number} [opts.limit=100] - how many to request (backend max is 100)
 * @returns {{ galleries: any[], loading: boolean, error: string|null, reload: () => void }}
 */
export function useGalleries({ limit = 100 } = {}) {
  const [galleries, setGalleries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiGet('/institutions', { limit });
      setGalleries(adaptInstitutions(data));
    } catch (err) {
      setError(err.message);
      setGalleries([]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    load();
  }, [load]);

  return { galleries, loading, error, reload: load };
}
