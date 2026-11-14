import { useEffect, useState, useCallback } from 'react';
import { apiGet } from '../lib/api';
import { adaptInstitutions } from '../lib/adapters';

const PAGE_SIZE = 100; // backend max per request

/** Every page of published institutions — the catalogue is larger than one page. */
async function fetchAll() {
  const first = await apiGet('/institutions', { limit: PAGE_SIZE, page: 1 });
  const totalPages = first.pagination?.totalPages ?? 1;
  const rest = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, i) =>
      apiGet('/institutions', { limit: PAGE_SIZE, page: i + 2 }),
    ),
  );
  return adaptInstitutions([first, ...rest].flatMap((r) => r.data));
}

// One request shared by every caller. The home page reads the list in the
// hero ticker, the popular section and the map; sharing it means one round of
// requests, and all three finish loading at the same moment.
let shared = null;

function loadShared(force = false) {
  if (!shared || force) {
    const p = fetchAll();
    // A failed load isn't kept, so the next caller retries.
    p.catch(() => {
      if (shared === p) shared = null;
    });
    shared = p;
  }
  return shared;
}

/**
 * Fetch published institutions from the backend and return them already adapted
 * to the UI's gallery shape. Drop-in replacement for the old static
 * `import { galleries } from '../../data/galleries'`.
 *
 * @returns {{ galleries: any[], loading: boolean, error: string|null, reload: () => void }}
 */
export function useGalleries() {
  const [galleries, setGalleries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback((force = false) => {
    let live = true;
    setLoading(true);
    setError(null);
    loadShared(force)
      .then((data) => live && setGalleries(data))
      .catch((err) => {
        if (!live) return;
        setError(err.message);
        setGalleries([]);
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => load(), [load]);

  const reload = useCallback(() => {
    load(true);
  }, [load]);

  return { galleries, loading, error, reload };
}
