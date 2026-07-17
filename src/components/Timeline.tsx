import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import type { Photo } from '../services/db';
import { Calendar, MapPin, AlertCircle, ArrowUp } from 'lucide-react';

interface TimelineProps {
  onSelectPhoto: (photo: Photo) => void;
}

export const Timeline: React.FC<TimelineProps> = ({ onSelectPhoto }) => {
  const [timelineData, setTimelineData] = useState<Record<number, Photo[]>>({});
  const [loading, setLoading] = useState(true);
  const [isEmpty, setIsEmpty] = useState(false);

  const loadTimeline = async () => {
    try {
      setLoading(true);
      const photos = await db.getPhotos();
      
      if (photos.length === 0) {
        setIsEmpty(true);
        setTimelineData({});
        return;
      }

      setIsEmpty(false);
      // Zoskupenie podla dekad
      const grouped: Record<number, Photo[]> = {};
      
      // Zoradiť fotky od najstarších po najnovšie (chronologicky)
      const sortedPhotos = [...photos].sort((a, b) => {
        const dateA = a.taken_at || '1900-01-01';
        const dateB = b.taken_at || '1900-01-01';
        return dateA.localeCompare(dateB);
      });

      sortedPhotos.forEach(photo => {
        const decade = photo.decade;
        if (!grouped[decade]) {
          grouped[decade] = [];
        }
        grouped[decade].push(photo);
      });

      setTimelineData(grouped);
    } catch (e) {
      console.error('Chyba pri zostavovaní časovej osi:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTimeline();
  }, []);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Neznámy rok';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return new Date(dateStr).toLocaleDateString('sk-SK', { day: 'numeric', month: 'long', year: 'numeric' });
      } else if (parts.length === 2) {
        const [year, month] = parts;
        return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('sk-SK', { month: 'long', year: 'numeric' });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const getDecadesSorted = () => {
    return Object.keys(timelineData)
      .map(Number)
      .sort((a, b) => a - b);
  };

  if (loading) {
    return (
      <div className="text-center" style={{ padding: '6rem 0' }}>
        <p>Zostavujem rodinnú časovú os...</p>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div style={{ padding: '2.5rem' }}>
        <h1>Časová os</h1>
        <p>Chronologické usporiadanie našej rodinnej histórie.</p>
        
        <div className="empty-state panel" style={{ marginTop: '2rem' }}>
          <AlertCircle size={48} className="empty-state-icon" />
          <h3>Časová os je prázdna</h3>
          <p className="mt-4">Pre zobrazenie časovej osi najprv pridajte nejaké fotografie do rodinného archívu.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '2.5rem' }}>
        <h1>Časová os spomienok</h1>
        <p>Prechádzajte dôležitými okamihmi našej rodiny zoradenými podľa času.</p>
      </div>

      <div className="timeline-container">
        {/* Zvislá stredová línia */}
        <div className="timeline-line"></div>

        {/* Generovanie dekád */}
        {getDecadesSorted().map(decade => {
          const decadePhotos = timelineData[decade];
          
          return (
            <React.Fragment key={decade}>
              {/* Hlavička dekády */}
              <div className="timeline-section-header">
                <span className="timeline-section-badge">Roky {decade} - {decade + 9}</span>
              </div>

              {/* Fotografie v dekáde */}
              {decadePhotos.map((photo, index) => {
                const isEven = index % 2 === 0;
                
                return (
                  <div 
                    key={photo.id} 
                    className={`timeline-item ${isEven ? '' : 'timeline-item-even'}`}
                  >
                    {/* Bodka na časovej osi */}
                    <div className="timeline-dot"></div>

                    {/* Obsahová karta na ľavej alebo pravej strane */}
                    <div className="timeline-content-wrapper">
                      <div 
                        className="panel timeline-card"
                        onClick={() => onSelectPhoto(photo)}
                      >
                        <div style={{ borderRadius: '8px', overflow: 'hidden', maxHeight: '200px', backgroundColor: 'rgba(0,0,0,0.2)', marginBottom: '1rem' }}>
                          <img 
                            src={photo.storage_path} 
                            alt={photo.title} 
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          />
                        </div>
                        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: 'white' }}>{photo.title}</h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {photo.description}
                        </p>
                        
                        <div className="timeline-card-header">
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}>
                            <Calendar size={12} /> {formatDate(photo.taken_at)}
                          </span>
                          {photo.location && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <MapPin size={12} /> {photo.location}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>

      <div style={{ textAlign: 'center', marginTop: '3rem' }}>
        <button 
          className="btn btn-secondary" 
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{ gap: '0.5rem' }}
        >
          <ArrowUp size={16} /> Na začiatok
        </button>
      </div>
    </div>
  );
};
