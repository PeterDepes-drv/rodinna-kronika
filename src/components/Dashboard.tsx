import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import type { Photo, Person } from '../services/db';
import { Image, Users, BookOpen, Calendar, MapPin, Play } from 'lucide-react';

interface DashboardProps {
  onNavigate: (view: string) => void;
  onSelectPhoto: (photo: Photo) => void;
  onStartSlideshow: (photos: Photo[], title: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate, onSelectPhoto, onStartSlideshow }) => {
  const [stats, setStats] = useState({ photos: 0, people: 0, albums: 0 });
  const [randomMemory, setRandomMemory] = useState<Photo | null>(null);
  const [recentPhotos, setRecentPhotos] = useState<Photo[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        const photosList = await db.getPhotos();
        const peopleList = await db.getPeople();
        const albumsList = await db.getAlbums();

        setStats({
          photos: photosList.length,
          people: peopleList.length,
          albums: albumsList.length
        });

        // Vyberieme náhodnú spomienku
        if (photosList.length > 0) {
          const randomIndex = Math.floor(Math.random() * photosList.length);
          setRandomMemory(photosList[randomIndex]);
        }

        // Posledné 4 pridané fotky
        const sorted = [...photosList].sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setRecentPhotos(sorted.slice(0, 4));
        setPeople(peopleList.slice(0, 5));
      } catch (e) {
        console.error('Chyba pri načítaní dát pre nástenku:', e);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Neznámy dátum';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return new Date(dateStr).toLocaleDateString('sk-SK', { day: 'numeric', month: 'long', year: 'numeric' });
      } else if (parts.length === 2) {
        const [year, month] = parts;
        const date = new Date(parseInt(year), parseInt(month) - 1);
        return date.toLocaleDateString('sk-SK', { month: 'long', year: 'numeric' });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="text-center" style={{ padding: '6rem 0' }}>
        <p>Načítavam kroniku...</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '2.5rem' }}>
        <h1>Ahoj v našej rodinnej kronike</h1>
        <p>Uchovávame spomienky a históriu našej rodiny pre budúce generácie.</p>
      </div>

      {/* Riadok so štatistikami */}
      <div className="stats-row">
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => onNavigate('gallery')}>
          <div className="stat-icon-wrapper">
            <Image size={24} />
          </div>
          <div>
            <div className="stat-value">{stats.photos}</div>
            <div className="stat-label">Fotografií</div>
          </div>
        </div>

        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => onNavigate('people')}>
          <div className="stat-icon-wrapper">
            <Users size={24} />
          </div>
          <div>
            <div className="stat-value">{stats.people}</div>
            <div className="stat-label">Rodinných príslušníkov</div>
          </div>
        </div>

        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => onNavigate('presentations')}>
          <div className="stat-icon-wrapper">
            <BookOpen size={24} />
          </div>
          <div>
            <div className="stat-value">{stats.albums}</div>
            <div className="stat-label">Tematických albumov</div>
          </div>
        </div>
      </div>

      {/* Hlavný obsah nástenky */}
      <div className="dashboard-grid">
        {/* Náhodná zlatá spomienka */}
        {randomMemory && (
          <div className="panel ai-glow-panel" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="panel-header">
              <h2 className="panel-title" style={{ color: '#a78bfa' }}>
                <Calendar size={20} /> Zlatá rodinná spomienka
              </h2>
              <button 
                className="btn btn-secondary btn-icon"
                title="Spustiť prezentáciu"
                onClick={() => onStartSlideshow([randomMemory], 'Zlatá spomienka')}
              >
                <Play size={16} />
              </button>
            </div>

            <div 
              style={{
                position: 'relative',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                aspectRatio: '16/9',
                backgroundColor: 'rgba(0,0,0,0.4)',
                cursor: 'pointer',
                marginBottom: '1.25rem'
              }}
              onClick={() => onSelectPhoto(randomMemory)}
            >
              <img 
                src={randomMemory.storage_path} 
                alt={randomMemory.title} 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div 
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: 'linear-gradient(to top, rgba(7,9,19,0.95) 0%, rgba(7,9,19,0) 100%)',
                  padding: '1.5rem 1rem 1rem'
                }}
              >
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{randomMemory.title}</h3>
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <span>{formatDate(randomMemory.taken_at)}</span>
                  {randomMemory.location && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <MapPin size={12} /> {randomMemory.location}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <p style={{ flexGrow: 1, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              {randomMemory.description || 'K tejto fotografii zatiaľ nemáme priradený žiadny príbeh.'}
            </p>
          </div>
        )}

        {/* Bočný panel - nedávno pridané & zoznam ľudí */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="panel">
            <h2 className="panel-title" style={{ marginBottom: '1rem' }}>
              Nedávne úpravy
            </h2>
            {recentPhotos.length === 0 ? (
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>V kronike zatiaľ nie sú žiadne fotografie.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {recentPhotos.map(photo => (
                  <div 
                    key={photo.id}
                    className="btn-secondary"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.5rem',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      border: '1px solid var(--border-color)'
                    }}
                    onClick={() => onSelectPhoto(photo)}
                  >
                    <img 
                      src={photo.storage_path} 
                      alt={photo.title}
                      style={{ width: '48px', height: '48px', borderRadius: '4px', objectFit: 'cover' }}
                    />
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {photo.title}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {formatDate(photo.taken_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="panel">
            <h2 className="panel-title" style={{ marginBottom: '1rem' }}>
              Členovia rodiny
            </h2>
            {people.length === 0 ? (
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Žiadne osoby.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {people.map(person => (
                  <div 
                    key={person.id}
                    className="tag-badge"
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.75rem' }}
                    onClick={() => onNavigate('people')}
                  >
                    {person.photo_url && (
                      <img 
                        src={person.photo_url} 
                        alt={person.name}
                        style={{ width: '18px', height: '18px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                    )}
                    <span>{person.name}</span>
                  </div>
                ))}
                <button 
                  className="tag-badge tag-badge-accent"
                  style={{ cursor: 'pointer' }}
                  onClick={() => onNavigate('people')}
                >
                  Zobraziť všetkých
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
