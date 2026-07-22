import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import type { Photo, Person } from '../services/db';
import { Image, Users, BookOpen, Calendar, MapPin, Play, Gift, Sparkles, Clock } from 'lucide-react';

interface DashboardProps {
  onNavigate: (view: string) => void;
  onSelectPhoto: (photo: Photo) => void;
  onStartSlideshow: (photos: Photo[], title: string) => void;
}

interface BirthdayItem {
  id: string;
  name: string;
  photo_url?: string;
  daysLeft: number;
  age: number;
  birthDate: string;
}

interface AnniversaryItem {
  photo: Photo;
  yearsAgo: number;
  dateFormatted: string;
  isToday: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate, onSelectPhoto, onStartSlideshow }) => {
  const [stats, setStats] = useState({ photos: 0, people: 0, albums: 0 });
  const [randomMemory, setRandomMemory] = useState<Photo | null>(null);
  const [recentPhotos, setRecentPhotos] = useState<Photo[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  // Stavy pre kalendár a výročia
  const [upcomingBirthdays, setUpcomingBirthdays] = useState<BirthdayItem[]>([]);
  const [anniversaries, setAnniversaries] = useState<AnniversaryItem[]>([]);

  const parseBirthDate = (dateStr?: string) => {
    if (!dateStr) return null;
    const trimmed = dateStr.trim().replace(/\s+/g, '');
    
    // YYYY-MM-DD
    const isoPattern = /^(\d{4})-(\d{2})-(\d{2})$/;
    if (isoPattern.test(trimmed)) {
      const m = trimmed.match(isoPattern)!;
      return { year: parseInt(m[1]), month: parseInt(m[2]) - 1, day: parseInt(m[3]) };
    }

    // DD.MM.YYYY
    const slovakPattern = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;
    if (slovakPattern.test(trimmed)) {
      const m = trimmed.match(slovakPattern)!;
      return { year: parseInt(m[3]), month: parseInt(m[2]) - 1, day: parseInt(m[1]) };
    }

    // DD.MM.
    const slovakNoYearPattern = /^(\d{1,2})\.(\d{1,2})\.?$/;
    if (slovakNoYearPattern.test(trimmed)) {
      const m = trimmed.match(slovakNoYearPattern)!;
      return { year: new Date().getFullYear(), month: parseInt(m[2]) - 1, day: parseInt(m[1]) };
    }

    return null;
  };

  const parsePhotoDate = (dateStr?: string) => {
    if (!dateStr) return null;
    const trimmed = dateStr.trim().replace(/\s+/g, '');
    
    const fullDatePattern = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;
    if (fullDatePattern.test(trimmed)) {
      const m = trimmed.match(fullDatePattern)!;
      return { year: parseInt(m[3]), month: parseInt(m[2]) - 1, day: parseInt(m[1]) };
    }

    const isoPattern = /^(\d{4})-(\d{2})-(\d{2})$/;
    if (isoPattern.test(trimmed)) {
      const m = trimmed.match(isoPattern)!;
      return { year: parseInt(m[1]), month: parseInt(m[2]) - 1, day: parseInt(m[3]) };
    }

    return null;
  };

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

        // Prepočet narodenín v najbližších 30 dňoch
        const today = new Date();
        const bdays: BirthdayItem[] = [];

        peopleList.forEach(person => {
          const parsed = parseBirthDate(person.birth_date);
          if (!parsed) return;

          let nextBday = new Date(today.getFullYear(), parsed.month, parsed.day);
          const todayCompare = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          if (nextBday < todayCompare) {
            nextBday.setFullYear(today.getFullYear() + 1);
          }

          const diffTime = nextBday.getTime() - todayCompare.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          const isToday = today.getMonth() === parsed.month && today.getDate() === parsed.day;
          const daysLeft = isToday ? 0 : diffDays;
          const age = nextBday.getFullYear() - parsed.year;

          if (isToday || daysLeft <= 30) {
            bdays.push({
              id: person.id,
              name: person.name,
              photo_url: person.photo_url,
              daysLeft,
              age,
              birthDate: person.birth_date || ''
            });
          }
        });

        bdays.sort((a, b) => a.daysLeft - b.daysLeft);
        setUpcomingBirthdays(bdays);

        // Prepočet výročí fotografií (V tento deň)
        const annivs: AnniversaryItem[] = [];
        const todayMonth = today.getMonth();
        const todayDate = today.getDate();

        photosList.forEach(photo => {
          const parsed = parsePhotoDate(photo.taken_at);
          if (!parsed) return;

          if (parsed.month === todayMonth && parsed.day === todayDate) {
            const yearsAgo = today.getFullYear() - parsed.year;
            if (yearsAgo > 0) {
              annivs.push({
                photo,
                yearsAgo,
                dateFormatted: `${parsed.day}.${parsed.month + 1}.${parsed.year}`,
                isToday: true
              });
            }
          }
        });

        // Fallback: ak nie sú dnešné výročia, zoberieme najstaršie fotky s dátumom
        if (annivs.length === 0) {
          const sortedByAge = [...photosList]
            .filter(p => parsePhotoDate(p.taken_at) !== null)
            .map(photo => {
              const parsed = parsePhotoDate(photo.taken_at)!;
              return {
                photo,
                yearsAgo: today.getFullYear() - parsed.year,
                dateFormatted: photo.taken_at
              };
            })
            .filter(item => item.yearsAgo > 0)
            .sort((a, b) => b.yearsAgo - a.yearsAgo);

          sortedByAge.slice(0, 2).forEach(item => {
            annivs.push({
              photo: item.photo,
              yearsAgo: item.yearsAgo,
              dateFormatted: item.dateFormatted,
              isToday: false
            });
          });
        }

        setAnniversaries(annivs);

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

      {/* Rodinné pripomienky a historické výročia */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginTop: '2rem' }}>
        
        {/* PANEL: Dnešné výročia a spomienky */}
        <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 className="panel-title" style={{ color: '#a78bfa', marginBottom: '1.25rem' }}>
            <Sparkles size={20} /> V tento deň v minulosti
          </h2>
          {anniversaries.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Žiadne historické spomienky na tento deň.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {anniversaries.map((anniv, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '0.75rem', cursor: 'pointer', transition: 'transform 0.2s' }} onClick={() => onSelectPhoto(anniv.photo)}>
                  <img src={anniv.photo.storage_path} alt={anniv.photo.title} style={{ width: '60px', height: '60px', borderRadius: '6px', objectFit: 'cover' }} />
                  <div style={{ minWidth: 0, flexGrow: 1 }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: anniv.isToday ? '#f43f5e' : '#a78bfa', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Clock size={12} /> {anniv.isToday ? `Dnes je to presne ${anniv.yearsAgo} rokov!` : `Z histórie rodiny (pred ${anniv.yearsAgo} rokmi)`}
                    </div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'white', marginTop: '0.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {anniv.photo.title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                      {anniv.dateFormatted} {anniv.photo.location ? `• ${anniv.photo.location}` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* PANEL: Narodeniny a oslavy */}
        <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 className="panel-title" style={{ color: '#fb7185', marginBottom: '1.25rem' }}>
            <Gift size={20} /> Blížiace sa oslavy a narodeniny
          </h2>
          {upcomingBirthdays.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>V najbližších 30 dňoch nikto neoslavuje narodeniny.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '180px', overflowY: 'auto' }}>
              {upcomingBirthdays.map((bday, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: bday.daysLeft === 0 ? 'linear-gradient(135deg, rgba(251, 113, 133, 0.15) 0%, rgba(244, 63, 94, 0.15) 100%)' : 'rgba(255,255,255,0.02)', border: bday.daysLeft === 0 ? '1px solid rgba(251, 113, 133, 0.4)' : '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '0.6rem 0.85rem' }}>
                  <img src={bday.photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100'} alt={bday.name} style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: bday.daysLeft === 0 ? '2px solid #fb7185' : '1px solid var(--border-color)' }} />
                  <div style={{ flexGrow: 1 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'white' }}>
                      {bday.name} {bday.daysLeft === 0 && '🎉 vek: ' + bday.age}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: bday.daysLeft === 0 ? '#fb7185' : 'var(--text-secondary)' }}>
                      {bday.daysLeft === 0 ? '🎂 DNES oslavuje narodeniny!' : `${bday.birthDate} (o ${bday.daysLeft} dní - oslávi ${bday.age} rokov)`}
                    </div>
                  </div>
                  {bday.daysLeft === 0 && (
                    <div style={{ animation: 'bounce 1s infinite', color: '#fb7185' }}>
                      <Gift size={20} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
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
