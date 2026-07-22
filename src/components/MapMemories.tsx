import React, { useEffect, useState, useRef } from 'react';
import { db } from '../services/db';
import type { Photo } from '../services/db';
import { MapPin } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MapMemoriesProps {
  onSelectPhoto: (photo: Photo) => void;
  userSession?: any;
}

interface LocationGroup {
  name: string;
  lat: number;
  lon: number;
  photos: Photo[];
}

export const MapMemories: React.FC<MapMemoriesProps> = ({ onSelectPhoto, userSession }) => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [geocodingProgress, setGeocodingProgress] = useState('');
  const [locationGroups, setLocationGroups] = useState<LocationGroup[]>([]);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  // Načítanie a geokódovanie lokácií
  useEffect(() => {
    const initMapData = async () => {
      try {
        setLoading(true);
        let allPhotos = await db.getPhotos();
        const privatePhotoIds = await db.getPrivatePhotoIds(userSession);
        if (privatePhotoIds.size > 0) {
          allPhotos = allPhotos.filter(p => !privatePhotoIds.has(p.id));
        }
        const photosWithLocation = allPhotos.filter(p => p.location && p.location.trim().length > 0);
        setPhotos(photosWithLocation);

        if (photosWithLocation.length === 0) {
          setLoading(false);
          return;
        }

        // Načítanie cache
        const cacheRaw = localStorage.getItem('kronika_geocoding_cache');
        const cache: Record<string, { lat: number; lon: number }> = cacheRaw ? JSON.parse(cacheRaw) : {};

        // Zoskupenie fotiek podľa lokality
        const groupedMap: Record<string, Photo[]> = {};
        photosWithLocation.forEach(photo => {
          const loc = photo.location!.trim();
          if (!groupedMap[loc]) {
            groupedMap[loc] = [];
          }
          groupedMap[loc].push(photo);
        });

        const uniqueLocations = Object.keys(groupedMap);
        const resolvedGroups: LocationGroup[] = [];
        let updatedCache = { ...cache };
        let hasCacheChanges = false;

        for (let i = 0; i < uniqueLocations.length; i++) {
          const loc = uniqueLocations[i];
          setGeocodingProgress(`Hľadám súradnice pre: ${loc} (${i + 1}/${uniqueLocations.length})...`);

          if (updatedCache[loc]) {
            resolvedGroups.push({
              name: loc,
              lat: updatedCache[loc].lat,
              lon: updatedCache[loc].lon,
              photos: groupedMap[loc]
            });
          } else {
            try {
              // Nominatim API dopyt
              const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(loc + ', Slovakia')}&limit=1`,
                {
                  headers: {
                    'Accept-Language': 'sk',
                    'User-Agent': 'KronikaRodiny/1.0'
                  }
                }
              );
              const data = await response.json();
              if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lon = parseFloat(data[0].lon);

                updatedCache[loc] = { lat, lon };
                hasCacheChanges = true;

                resolvedGroups.push({
                  name: loc,
                  lat,
                  lon,
                  photos: groupedMap[loc]
                });
              } else {
                console.warn(`Nepodarilo sa nájsť súradnice pre: ${loc}`);
              }
            } catch (err) {
              console.error(`Chyba geokódovania pre ${loc}:`, err);
            }
            // Slušný odstup medzi požiadavkami pre Nominatim
            await new Promise(r => setTimeout(r, 1000));
          }
        }

        if (hasCacheChanges) {
          localStorage.setItem('kronika_geocoding_cache', JSON.stringify(updatedCache));
        }

        setLocationGroups(resolvedGroups);
      } catch (e) {
        console.error('Chyba pri inicializácii mapy:', e);
      } finally {
        setLoading(false);
      }
    };

    initMapData();
  }, []);

  // Inicializácia mapy Leaflet
  useEffect(() => {
    if (loading || locationGroups.length === 0 || !mapContainerRef.current) return;

    // Ak už mapa existuje, zničíme ju, aby sme ju vytvorili nanovo
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    // Nastavenie počiatočného stredu mapy (napr. stred Slovenska - Zvolen)
    const slovakiaCenter: L.LatLngExpression = [48.6667, 19.15];
    const map = L.map(mapContainerRef.current, {
      center: slovakiaCenter,
      zoom: 7,
      zoomControl: true
    });

    mapRef.current = map;

    // Pridanie tmavej mapovej vrstvy (CartoDB Dark Matter), ktorá sa hodí k nášmu dizajnu
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    // Vytvorenie a vykreslenie markerov
    const bounds = L.latLngBounds([]);

    locationGroups.forEach(group => {
      const markerPosition: L.LatLngExpression = [group.lat, group.lon];
      bounds.extend(markerPosition);

      // Pekná vlastná ikona v štýle fialového pinu
      const customMarkerIcon = L.divIcon({
        html: `
          <div style="
            background: linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%);
            width: 32px;
            height: 32px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid rgba(255,255,255,0.8);
            box-shadow: 0 4px 10px rgba(0,0,0,0.5);
            transition: all 0.2s ease;
          ">
            <span style="
              transform: rotate(45deg);
              color: white;
              font-size: 0.75rem;
              font-weight: 800;
            ">${group.photos.length}</span>
          </div>
        `,
        className: 'custom-leaflet-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
      });

      // Vytvorenie HTML obsahu pre Popup
      const popupContent = document.createElement('div');
      popupContent.style.width = '240px';
      popupContent.style.color = '#e2e8f0';
      popupContent.style.fontFamily = 'inherit';

      const titleHtml = `<h4 style="margin: 0 0 0.5rem 0; font-size: 0.95rem; font-weight: 700; color: white; display: flex; align-items: center; gap: 0.25rem;">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #a78bfa;"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
        ${group.name}
      </h4>`;

      let photosHtml = '<div style="max-height: 220px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem; padding-right: 0.25rem;">';
      
      group.photos.forEach(photo => {
        photosHtml += `
          <div class="map-popup-card" data-photo-id="${photo.id}" style="
            display: flex;
            gap: 0.5rem;
            cursor: pointer;
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 6px;
            padding: 0.35rem;
            align-items: center;
            transition: all 0.2s ease;
          ">
            <img src="${photo.storage_path}" style="width: 44px; height: 44px; object-fit: cover; border-radius: 4px;" />
            <div style="flex-grow: 1; min-width: 0;">
              <div style="font-size: 0.8rem; font-weight: 600; color: white; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${photo.title}</div>
              <div style="font-size: 0.7rem; color: #a78bfa; margin-top: 0.1rem;">${photo.taken_at || photo.decade + 's'}</div>
            </div>
          </div>
        `;
      });
      photosHtml += '</div>';

      popupContent.innerHTML = titleHtml + photosHtml;

      // Event listener pre kliknutie na fotku v popupe
      popupContent.addEventListener('click', (e) => {
        const card = (e.target as HTMLElement).closest('.map-popup-card');
        if (card) {
          const photoId = card.getAttribute('data-photo-id');
          const photo = group.photos.find(p => p.id === photoId);
          if (photo) {
            onSelectPhoto(photo);
          }
        }
      });

      L.marker(markerPosition, { icon: customMarkerIcon })
        .addTo(map)
        .bindPopup(popupContent, {
          className: 'custom-map-popup',
          maxWidth: 260
        });
    });

    // Prispôsobenie priblíženia mapy tak, aby obsiahla všetky markery
    if (locationGroups.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40] });
      // Ak máme len 1 lokalitu, nezväčšuj príliš
      if (locationGroups.length === 1) {
        map.setZoom(10);
      }
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [loading, locationGroups]);

  if (loading) {
    return (
      <div className="flex flex-column align-center justify-center" style={{ padding: '8rem 0', gap: '1.5rem' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid rgba(167, 139, 250, 0.2)', borderTopColor: '#a78bfa', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <div style={{ textAlign: 'center' }}>
          <h3>Generujem rodinnú mapu...</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.5rem' }}>{geocodingProgress}</p>
        </div>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div style={{ padding: '2.5rem' }}>
        <h1>Mapa spomienok</h1>
        <p>Prezrite si na mape miesta, kde vznikli naše rodinné spomienky.</p>
        
        <div className="empty-state panel" style={{ marginTop: '2rem' }}>
          <MapPin size={48} className="empty-state-icon" />
          <h3>Žiadne lokality na zobrazenie</h3>
          <p className="mt-4">Pre zobrazenie mapy spomienok najprv pridajte miesto (lokalitu) k fotografiám v rodinnom archíve.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 5rem)' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1>Mapa rodinných spomienok</h1>
        <p>Usporiadané rodinné fotografie a udalosti podľa miesta ich vzniku.</p>
      </div>

      <div style={{ flexGrow: 1, position: 'relative', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-md)' }}>
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%', zIndex: 1 }} />
      </div>

      {/* Rýchly CSS pre animáciu točenia loading spinneru */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .custom-map-popup .leaflet-popup-content-wrapper {
          background: #1e1b4b !important;
          border: 1px solid rgba(167, 139, 250, 0.25) !important;
          border-radius: 10px !important;
          box-shadow: 0 10px 25px rgba(0,0,0,0.6) !important;
          padding: 0.5rem !important;
        }
        .custom-map-popup .leaflet-popup-tip {
          background: #1e1b4b !important;
          border-left: 1px solid rgba(167, 139, 250, 0.25) !important;
          border-bottom: 1px solid rgba(167, 139, 250, 0.25) !important;
        }
        .custom-map-popup .leaflet-popup-content {
          margin: 8px 10px !important;
        }
        .map-popup-card:hover {
          background: rgba(167, 139, 250, 0.1) !important;
          border-color: rgba(167, 139, 250, 0.3) !important;
          transform: translateY(-1px);
        }
      `}</style>
    </div>
  );
};
