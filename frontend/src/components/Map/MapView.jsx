import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import styles from './MapView.module.scss';
import { useGalleries } from '../../hooks/useGalleries'; // ← live data from the API
import { neighbourhoodsGeoJSON, landmarksGeoJSON } from '../../data/lagosGeo';
import LegendPanel from './LegendPanel';
import GalleryCard from './GalleryCard';

const MAPTILER_KEY = 'eBsT19HyOExrdi0WUD3x';

const ALL_BOUNDS = [
  [3.343, 6.435],
  [3.458, 6.575],
];

const ALL_GALLERIES_CENTER = [3.4004, 6.5083];

const LAYER_DEFAULTS = {
  neighbourhoods: true,
  landmarks:      true,
  greenZones:     true,
  regionOverlays: true,
  galleries:      true,
};

const ZOOM = { overview: 11, district: 12, street: 14, detail: 16 };

const FIT_PADDING        = { top: 100, bottom: 60,  left: 60,  right: 280 };
// Mobile: top clears the sticky filter bar, which overlaps the map once
// scrolled to; bottom clears the layers toggle and zoom buttons. The old
// 140px bottom reserved room for a bottom sheet that is closed whenever a
// region is fitted, and squeezed Lagos into a strip.
const FIT_PADDING_MOBILE = { top: 116, bottom: 72,  left: 24,  right: 24  };

// Peek sheet occupies 20vh of screen height on mobile.
// flyToGallery shifts the map centre upward so the marker lands
// in the middle of the remaining 80vh of visible map.
// We subtract ~48px for the region bar above the map container
// so the offset is accurate to the actual visible map zone.
// Calculated at runtime so it works across all phone sizes.
// Bounds around a region's main cluster, for fitting on a phone. A few
// venues sit far out (Badagry, Lekki–Ajah); fitting to them shrinks the
// cluster where most venues are to a speck on a narrow screen. Points
// outside the usual 1.5×IQR fences are left out of the fit — their pins
// still render, the visitor just pans to them.
const coreBounds = (points) => {
  const fences = (values) => {
    const s = [...values].sort((a, b) => a - b);
    const q = (p) => s[Math.floor(p * (s.length - 1))];
    const iqr = q(0.75) - q(0.25);
    return [q(0.25) - 1.5 * iqr, q(0.75) + 1.5 * iqr];
  };
  const [lngLo, lngHi] = fences(points.map((p) => p.lng));
  const [latLo, latHi] = fences(points.map((p) => p.lat));
  const core = points.filter(
    (p) => p.lng >= lngLo && p.lng <= lngHi && p.lat >= latLo && p.lat <= latHi,
  );
  const bounds = new maplibregl.LngLatBounds();
  (core.length ? core : points).forEach((p) => bounds.extend([p.lng, p.lat]));
  return bounds;
};

const getMobileOffset = () => {
  const regionBarPx  = 48; // approx height of the filter bar above the map
  const visibleMapPx = window.innerHeight * 0.80 - regionBarPx;
  return [0, -(visibleMapPx / 2)];
};

// Nomadic spaces and festivals can have no fixed coordinates; they stay in
// the list but get no pin (MapLibre throws on a null LngLat).
const withCoords = (list) =>
  list.filter((g) => Number.isFinite(g.lat) && Number.isFinite(g.lng));

// ── Build GeoJSON from the galleries array ────────────────────
const buildGalleriesGeoJSON = (galleryList) => ({
  type: 'FeatureCollection',
  features: galleryList.map((g) => ({
    type: 'Feature',
    properties: {
      id:           g.id,
      name:         g.name,
      neighborhood: g.neighborhood,
      address:      g.address,
      region:       g.region,
      rating:       g.rating,
      image:        g.image,
      artTypes:     JSON.stringify(g.artTypes || []),
    },
    geometry: { type: 'Point', coordinates: [g.lng, g.lat] },
  })),
});

// ── SVG pin → HTMLImageElement for map.addImage() ─────────────
// Brand map pin states (Colour Alignment PDF): terracotta with a cream
// centre by default, light orange with an ink centre on hover.
const PIN_DEFAULT = { body: '#b0431c', dot: '#f6efe2' };
const PIN_HOVER   = { body: '#e0673a', dot: '#241b12' };

const createPinImage = ({ body, dot }) =>
  new Promise((resolve) => {
    const svg = `
      <svg viewBox="0 0 28 38" fill="none" xmlns="http://www.w3.org/2000/svg" width="28" height="38">
        <path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 24 14 24S28 24.5 28 14C28 6.3 21.7 0 14 0z" fill="${body}"/>
        <circle cx="14" cy="13" r="5.5" fill="${dot}"/>
      </svg>`;
    const img = new Image(28, 38);
    img.onload = () => resolve(img);
    img.src = `data:image/svg+xml;base64,${btoa(svg)}`;
  });

// ── Component ─────────────────────────────────────────────────
const MapView = () => {
  const { galleries } = useGalleries();

  const mapContainer = useRef(null);
  const mapRef       = useRef(null);
  // Ref so MapLibre event closures always read the current value
  const isMobileRef  = useRef(false);
  // Ref so the map-init effect (runs once) and MapLibre event closures
  // always read the latest fetched galleries instead of a stale snapshot.
  const galleriesRef = useRef(withCoords(galleries));

  const [activeRegion,    setActiveRegion]    = useState('All');
  const [activeLayers,    setActiveLayers]    = useState(LAYER_DEFAULTS);
  const [selectedGallery, setSelectedGallery] = useState(null);
  const [mapReady,        setMapReady]        = useState(false);

  useEffect(() => { galleriesRef.current = withCoords(galleries); }, [galleries]);

  // ── Fly to a gallery and open the bottom sheet ────────────
  const flyToGallery = useCallback((gallery) => {
    if (!mapRef.current) return;
    mapRef.current.flyTo({
      center:    [gallery.lng, gallery.lat],
      zoom:      ZOOM.detail,
      speed:     1.2,
      curve:     1.4,
      easing:    (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
      duration:  1800,
      essential: true,
      // On mobile: shift the map centre upward so the marker sits in the
      // middle of the 62vh visible above the bottom sheet.
      // Calculated dynamically so it works across all phone sizes.
      offset: isMobileRef.current ? getMobileOffset() : [0, 0],
    });
    setSelectedGallery(gallery);
  }, []);

  // ── Fly to a neighbourhood centroid ───────────────────────
  const flyToNeighbourhood = useCallback((lng, lat, zoom = ZOOM.district) => {
    if (!mapRef.current) return;
    mapRef.current.flyTo({
      center:   [lng, lat],
      zoom,
      speed:    1.0,
      curve:    1.2,
      easing:   (t) => 1 - Math.pow(1 - t, 3),
      duration: 1400,
    });
  }, []);

  // ── Reset to full Lagos overview ───────────────────────────
  const resetView = useCallback(() => {
    if (!mapRef.current) return;
    mapRef.current.fitBounds(ALL_BOUNDS, {
      padding:  isMobileRef.current ? FIT_PADDING_MOBILE : FIT_PADDING,
      duration: 1000,
    });
    setSelectedGallery(null);
  }, []);

  // ── Apply layer visibility to the live map ─────────────────
  const applyLayerVisibility = useCallback((layers) => {
    const map  = mapRef.current;
    if (!map) return;
    const vis  = (b) => (b ? 'visible' : 'none');
    const safe = (id, v) => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', v); };

    safe('neighbourhood-fill',    vis(layers.neighbourhoods));
    safe('neighbourhood-outline', vis(layers.neighbourhoods));
    safe('neighbourhood-label',   vis(layers.neighbourhoods));
    safe('landmark-icon',         vis(layers.landmarks));
    safe('landmark-label',        vis(layers.landmarks));
    safe('green-zone-fill',       vis(layers.greenZones));
    safe('green-zone-outline',    vis(layers.greenZones));
    safe('green-zone-label',      vis(layers.greenZones));
    safe('island-overlay',        vis(layers.regionOverlays));
    safe('mainland-overlay',      vis(layers.regionOverlays));
    safe('island-label',          vis(layers.regionOverlays));
    safe('mainland-label',        vis(layers.regionOverlays));
    safe('gallery-pins',          vis(layers.galleries));
    safe('gallery-pins-hover',    vis(layers.galleries));
    safe('gallery-labels',        vis(layers.galleries));
  }, []);

  // ── Toggle a single layer on/off ───────────────────────────
  const toggleLayer = useCallback(
    (layerKey) => {
      setActiveLayers((prev) => {
        const next = { ...prev, [layerKey]: !prev[layerKey] };
        applyLayerVisibility(next);
        return next;
      });
    },
    [applyLayerVisibility],
  );

  // ── Filter pins + refit bounds when region changes ────────
  const updateGalleryFilter = useCallback(
    (region) => {
      const map = mapRef.current;
      if (!map || !mapReady || !map.getSource('galleries')) return;

      const all = galleriesRef.current;
      const filtered =
        region === 'All' ? all : all.filter((g) => g.region === region);
      map.getSource('galleries').setData(buildGalleriesGeoJSON(filtered));

      const padding = isMobileRef.current ? FIT_PADDING_MOBILE : FIT_PADDING;

      if (region === 'All') {
        map.fitBounds(ALL_BOUNDS, { padding, duration: 800 });
      } else if (isMobileRef.current) {
        if (filtered.length) {
          map.fitBounds(coreBounds(filtered), { padding, maxZoom: 13, duration: 800 });
        }
      } else {
        const bounds = new maplibregl.LngLatBounds();
        filtered.forEach((g) => bounds.extend([g.lng, g.lat]));
        map.fitBounds(bounds, { padding, maxZoom: 13, duration: 800 });
      }
    },
    [mapReady],
  );

  // ── Map initialisation — runs once on mount ────────────────
  useEffect(() => {
    const isMobile = window.innerWidth <= 768;
    isMobileRef.current = isMobile;

    // Mobile opens on the same Lagos overview as desktop. It used to start
    // at street level (zoom 16) with a zoom-out floor of 14, so the region
    // buttons' fitBounds could never zoom out far enough to show the pins.
    const map = new maplibregl.Map({
      container:          mapContainer.current,
      style:              `https://api.maptiler.com/maps/streets-v2-light/style.json?key=${MAPTILER_KEY}`,
      ...(isMobile
        ? { bounds: ALL_BOUNDS, fitBoundsOptions: { padding: FIT_PADDING_MOBILE } }
        : { center: ALL_GALLERIES_CENTER, zoom: 10 }),
      minZoom:            9,
      // Mobile reaches a little further west so Badagry (lng 2.889) can be
      // panned to; desktop keeps its original box.
      maxBounds:          isMobile ? [[2.7, 6.1], [3.95, 6.9]] : [[2.9, 6.1], [3.9, 6.9]],
      attributionControl: false,
    });

    mapRef.current = map;

    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    // Mobile: zoom buttons at the bottom — the sticky filter bar covers
    // the top of the map once the visitor scrolls to it.
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      isMobile ? 'bottom-right' : 'top-right',
    );

    // The mobile container settles at its full height (100svh) after the
    // map has measured it, which left the canvas short and threw fitBounds
    // off-centre. Re-measure whenever the container changes size.
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(mapContainer.current);

    // Fallback placeholder for any missing sprite icons
    map.on('styleimagemissing', (e) => {
      const id = e.id;
      if (['office', 'supermarket', 'school', 'park', 'hospital'].includes(id)) {
        const canvas = document.createElement('canvas');
        canvas.width = 24; canvas.height = 24;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#5c3d33';
        ctx.beginPath(); ctx.arc(12, 12, 10, 0, 2 * Math.PI); ctx.fill();
        ctx.fillStyle = 'white'; ctx.font = '14px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(id === 'office' ? '🏢' : id === 'supermarket' ? '🛒' : '📍', 12, 12);
        map.loadImage(canvas.toDataURL(), (err, img) => {
          if (!err && img) map.addImage(id, img);
        });
      }
    });

    map.on('load', async () => {
      // Register the gallery pin image.
      // pixelRatio:2 renders it at double resolution — keep icon-size ≤ 1.4
      // on mobile or the pin becomes enormous and overflows the canvas.
      const [pinImg, pinHoverImg] = await Promise.all([
        createPinImage(PIN_DEFAULT),
        createPinImage(PIN_HOVER),
      ]);
      map.addImage('gallery-pin', pinImg, { pixelRatio: 2 });
      map.addImage('gallery-pin-hover', pinHoverImg, { pixelRatio: 2 });

      // 1 ── Neighbourhood fills ─────────────────────────────
      map.addSource('neighbourhoods', { type: 'geojson', data: neighbourhoodsGeoJSON });
      map.addLayer({
        id: 'neighbourhood-fill', type: 'fill', source: 'neighbourhoods',
        filter: ['!=', ['get', 'category'], 'green-zone'],
        paint: {
          'fill-color':   ['get', 'color'],
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.06, 13, 0.1, 15, 0.14],
        },
      });
      map.addLayer({
        id: 'neighbourhood-outline', type: 'line', source: 'neighbourhoods',
        filter: ['!=', ['get', 'category'], 'green-zone'],
        paint: {
          'line-color':   ['get', 'color'],
          'line-width':   ['interpolate', ['linear'], ['zoom'], 10, 0.8, 13, 1.6, 15, 2.2],
          'line-opacity': 0.5,
        },
      });
      map.addLayer({
        id: 'neighbourhood-label', type: 'symbol', source: 'neighbourhoods',
        filter:  ['!=', ['get', 'category'], 'green-zone'],
        minzoom: ZOOM.overview,
        layout: {
          'text-field':     ['get', 'name'],
          'text-size':      ['interpolate', ['linear'], ['zoom'], 10, 11, 13, 15, 15, 18],
          'text-font':      ['Open Sans SemiBold', 'Arial Unicode MS Bold'],
          'text-anchor':    'center',
          'text-max-width': 8,
        },
        paint: {
          'text-color':      ['get', 'color'],
          'text-halo-color': 'rgba(246,239,226,0.9)',
          'text-halo-width': 2,
          'text-opacity':    ['interpolate', ['linear'], ['zoom'], 9.5, 0, 10.5, 1],
        },
      });

      // 2 ── Green zones ─────────────────────────────────────
      const greenFeatures = {
        type: 'FeatureCollection',
        features: landmarksGeoJSON.features.filter(
          (f) => f.properties.category === 'green-zone',
        ),
      };
      map.addSource('green-zones', { type: 'geojson', data: greenFeatures });
      map.addLayer({
        id: 'green-zone-fill', type: 'fill', source: 'green-zones',
        paint: {
          'fill-color':   '#16a34a',
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.10, 14, 0.22],
        },
      });
      map.addLayer({
        id: 'green-zone-outline', type: 'line', source: 'green-zones',
        paint: { 'line-color': '#16a34a', 'line-width': 1.5, 'line-dasharray': [4, 2], 'line-opacity': 0.7 },
      });
      map.addLayer({
        id: 'green-zone-label', type: 'symbol', source: 'green-zones',
        minzoom: 11,
        layout: {
          'text-field':  ['get', 'name'],
          'text-size':   11,
          'text-font':   ['Open Sans Italic', 'Arial Unicode MS Regular'],
          'text-anchor': 'center',
        },
        paint: {
          'text-color':      '#15803d',
          'text-halo-color': 'rgba(246,239,226,0.9)',
          'text-halo-width': 2,
        },
      });

      // 3 ── Landmarks ───────────────────────────────────────
      const landmarkPoints = {
        type: 'FeatureCollection',
        features: landmarksGeoJSON.features.filter((f) => f.geometry.type === 'Point'),
      };
      map.addSource('landmarks', { type: 'geojson', data: landmarkPoints });
      map.addLayer({
        id: 'landmark-icon', type: 'symbol', source: 'landmarks',
        minzoom: 11,
        layout: {
          'text-field':         '●',
          'text-size':          ['interpolate', ['linear'], ['zoom'], 11, 14, 14, 20],
          'text-allow-overlap': false,
        },
        paint: { 'text-opacity': ['interpolate', ['linear'], ['zoom'], 10.5, 0, 11.5, 1] },
      });
      map.addLayer({
        id: 'landmark-label', type: 'symbol', source: 'landmarks',
        minzoom: 12,
        layout: {
          'text-field':     ['get', 'name'],
          'text-size':      11,
          'text-font':      ['Open Sans Regular', 'Arial Unicode MS Regular'],
          'text-anchor':    'top',
          'text-offset':    [0, 1.2],
          'text-max-width': 10,
        },
        paint: {
          'text-color':      'rgba(36,27,18,0.78)',
          'text-halo-color': 'rgba(246,239,226,0.92)',
          'text-halo-width': 1.5,
          'text-opacity':    ['interpolate', ['linear'], ['zoom'], 12, 0, 13, 1],
        },
      });
      map.on('click', 'landmark-icon', (e) => {
        const p = e.features[0].properties;
        new maplibregl.Popup({ offset: [0, -8], maxWidth: '240px' })
          .setLngLat(e.features[0].geometry.coordinates)
          .setHTML(`
            <div class="landmark-popup">
              <span class="landmark-popup__icon">📍</span>
              <div>
                <strong>${p.name}</strong>
                <p>${p.description || 'Landmark'}</p>
              </div>
            </div>`)
          .addTo(map);
      });
      map.on('mouseenter', 'landmark-icon', () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', 'landmark-icon', () => (map.getCanvas().style.cursor = ''));

      // 4 ── Region overlays (Island / Mainland shading) ────
      map.addSource('island-region', {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[3.28,6.4],[3.5,6.4],[3.5,6.48],[3.28,6.48]]] } },
      });
      map.addSource('mainland-region', {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[3.2,6.48],[3.46,6.48],[3.46,6.66],[3.2,6.66]]] } },
      });
      map.addLayer({ id: 'island-overlay',   type: 'fill', source: 'island-region',   paint: { 'fill-color': '#0c50bd', 'fill-opacity': 0.10 } });
      map.addLayer({ id: 'mainland-overlay', type: 'fill', source: 'mainland-region', paint: { 'fill-color': '#92400e', 'fill-opacity': 0.10 } });
      map.addLayer({
        id: 'island-label', type: 'symbol', source: 'island-region', maxzoom: 11,
        layout: { 'text-field': 'ISLAND',   'text-size': 12, 'text-letter-spacing': 0.2, 'text-font': ['Open Sans SemiBold', 'Arial Unicode MS Bold'] },
        paint:  { 'text-color': '#1a6bbd', 'text-halo-color': 'rgba(246,239,226,0.9)', 'text-halo-width': 2 },
      });
      map.addLayer({
        id: 'mainland-label', type: 'symbol', source: 'mainland-region', maxzoom: 11,
        layout: { 'text-field': 'MAINLAND', 'text-size': 12, 'text-letter-spacing': 0.2, 'text-font': ['Open Sans SemiBold', 'Arial Unicode MS Bold'] },
        paint:  { 'text-color': '#b45309',  'text-halo-color': 'rgba(246,239,226,0.9)', 'text-halo-width': 2 },
      });

      // 5 ── Gallery pins ────────────────────────────────────
      // Seeded with whatever's in galleriesRef at mount (likely still empty
      // while the API fetch is in flight); the sync effect below calls
      // setData once the live galleries arrive.
      map.addSource('galleries', { type: 'geojson', data: buildGalleriesGeoJSON(galleriesRef.current) });
      const pinLayout = {
        'icon-image':            'gallery-pin',
        // Mobile pins stay compact at the overview zoom so dozens of
        // venues don't pile into one blob, and grow as you zoom in.
        'icon-size':             ['interpolate', ['linear'], ['zoom'],
                                   10, isMobile ? 0.9 : 1.0,
                                   14, isMobile ? 1.15 : 1.2,
                                   16, isMobile ? 1.35 : 1.5],
        'icon-anchor':           'bottom',
        'icon-allow-overlap':    true,
        'icon-ignore-placement': true,
        'text-field':            '',
      };
      map.addLayer({
        id: 'gallery-pins', type: 'symbol', source: 'galleries',
        layout: pinLayout,
        paint: { 'icon-opacity': ['interpolate', ['linear'], ['zoom'], 8.5, 0, 9.5, 1] },
      });
      // Hovered pin, drawn on top in the hover colours. Icon images are
      // layout properties, which can't read feature-state, so the hover
      // state is a filtered copy of the pin layer.
      map.addLayer({
        id: 'gallery-pins-hover', type: 'symbol', source: 'galleries',
        filter: ['==', ['get', 'id'], ''],
        layout: { ...pinLayout, 'icon-image': 'gallery-pin-hover' },
      });
      map.addLayer({
        id: 'gallery-labels', type: 'symbol', source: 'galleries',
        minzoom: isMobile ? 12 : 13,
        layout: {
          'text-field':         ['get', 'name'],
          'text-size':          isMobile ? 14 : 11,
          'text-font':          ['Open Sans SemiBold', 'Arial Unicode MS Bold'],
          'text-anchor':        'top',
          'text-offset':        [0, 0.8],
          'text-max-width':     10,
          'text-allow-overlap': false,
        },
        paint: {
          'text-color':      '#241b12',
          'text-halo-color': 'rgba(246,239,226,0.95)',
          'text-halo-width': 2.5,
          'text-opacity':    ['interpolate', ['linear'], ['zoom'], 12, 0, 13, 1],
        },
      });

      // Pin click:
      // Mobile — flyToGallery centres the marker in the visible map zone
      //          above the bottom sheet, then GalleryCard slides up.
      // Desktop — same fly + a MapLibre popup beside the marker.
      map.on('click', 'gallery-pins', (e) => {
        const props   = e.features[0].properties;
        const gallery = galleriesRef.current.find((g) => g.id === props.id);
        if (!gallery) return;

        flyToGallery(gallery);

        if (!isMobileRef.current) {
          new maplibregl.Popup({
            offset:      [0, -52],
            maxWidth:    '300px',
            closeButton: true,
            className:   'gallery-popup-wrapper',
          })
            .setLngLat(e.features[0].geometry.coordinates)
            .setHTML(`
              <div class="popup-content">
                <img src="${gallery.image}" alt="${gallery.name}" class="popup-image"
                  onerror="this.src='https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=400&q=60'"/>
                <div class="popup-text">
                  <div class="popup-meta">
                    <span class="popup-region popup-region--${gallery.region.toLowerCase()}">${gallery.region}</span>
                    <span class="popup-neighbourhood">${gallery.neighborhood}</span>
                  </div>
                  <h4>${gallery.name}</h4>
                  <p>${gallery.address}</p>
                  <div class="popup-footer">
                    <span class="popup-rating">★ ${gallery.rating}</span>
                    <span class="popup-tags">${(gallery.artTypes || []).join(' · ')}</span>
                  </div>
                </div>
              </div>`)
            .addTo(map);
        }
      });

      map.on('mousemove', 'gallery-pins', (e) => {
        map.getCanvas().style.cursor = 'pointer';
        map.setFilter('gallery-pins-hover', ['==', ['get', 'id'], e.features[0].properties.id]);
      });
      map.on('mouseleave', 'gallery-pins', () => {
        map.getCanvas().style.cursor = '';
        map.setFilter('gallery-pins-hover', ['==', ['get', 'id'], '']);
      });

      setMapReady(true);
    });

    return () => { resizeObserver.disconnect(); map.remove(); setMapReady(false); };
  }, []); // map is created once; live galleries are read via galleriesRef

  // ── Sync region filter and layer visibility with map ──────
  // Also re-runs when `galleries` changes (API fetch resolves) so the
  // pins that were seeded empty at mount get populated once data arrives.
  useEffect(() => {
    if (!mapReady) return;
    updateGalleryFilter(activeRegion);
    applyLayerVisibility(activeLayers);
  }, [activeRegion, mapReady, galleries, updateGalleryFilter, applyLayerVisibility]);

  // ── Render ────────────────────────────────────────────────
  return (
    <div className={styles.mapWrapper}>
      <div className={styles.regionBar}>
        {['All', 'Island', 'Mainland'].map((r) => (
          <button
            key={r}
            className={`${styles.regionBtn} ${activeRegion === r ? styles.regionBtnActive : ''} ${styles[`regionBtn${r}`]}`}
            onClick={() => setActiveRegion(r)}
          >
            {r === 'All' ? 'All Lagos' : r}
          </button>
        ))}
        <button className={styles.resetBtn} onClick={resetView} title="Reset view">
          ⤢ Overview
        </button>
      </div>

      <div ref={mapContainer} className={styles.mapContainer} />

      <LegendPanel
        activeLayers={activeLayers}
        onToggle={toggleLayer}
        galleries={galleries}
        onGalleryClick={flyToGallery}
        onNeighbourhoodClick={flyToNeighbourhood}
        activeRegion={activeRegion}
        galleryOpen={!!selectedGallery}
      />

      {selectedGallery && (
        <GalleryCard gallery={selectedGallery} onClose={() => setSelectedGallery(null)} />
      )}
    </div>
  );
};

export default MapView;
