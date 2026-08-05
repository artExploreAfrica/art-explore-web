import { useEffect, useState, useCallback } from 'react';
import { apiGet } from '../lib/api';
import { adaptInstitutions } from '../lib/adapters';

/**
 * Fetch published institutions from the backend and return them already adapted
 * to the UI's gallery shape. Drop-in replacement for the old static
 * `import { galleries } from '../../data/galleries'`.
 *
 * The API caps `limit` at 100 per page and the catalogue is already larger than
 * that, so every page is walked — requesting one page would silently drop the
 * tail of the list from search and the tab counts.
 *
 * @param {object} [opts]
 * @param {number} [opts.limit=100] - page size to request (backend max is 100)
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
      const all = [];
      let page = 1;
      let totalPages = 1;
      do {
        const { data, pagination } = await apiGet('/institutions', { limit, page });
        all.push(...data);
        totalPages = pagination?.totalPages ?? 1;
        page += 1;
      } while (page <= totalPages);
      setGalleries(adaptInstitutions(all));
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
