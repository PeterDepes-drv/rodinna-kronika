import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import type { Photo, Person } from '../services/db';
import { Image, Users, BookOpen, Calendar, MapPin, Play, Gift, Sparkles, Clock, RotateCw, Mail, MessageSquare, Brain } from 'lucide-react';

interface DashboardProps {
  onNavigate: (view: string) => void;
  onSelectPhoto: (photo: Photo) => void;
  onStartSlideshow: (photos: Photo[], title: string) => void;
  userSession?: any;
}

interface BirthdayItem {
  id: string;
  name: string;
  photo_url?: string;
  daysLeft: number;
  age: number;
  birthDate: string;
}

const monthsNames = [
  'Január', 'Február', 'Marec', 'Apríl', 'Máj', 'Jún',
  'Júl', 'August', 'September', 'Október', 'November', 'December'
];

interface AnniversaryItem {
  photo: Photo;
  yearsAgo: number;
  dateFormatted: string;
  isToday: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate, onSelectPhoto, onStartSlideshow, userSession }) => {
  const [stats, setStats] = useState({ photos: 0, people: 0, albums: 0 });
  const [randomMemory, setRandomMemory] = useState<Photo | null>(null);
  const [recentPhotos, setRecentPhotos] = useState<Photo[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [allPhotos, setAllPhotos] = useState<Photo[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [dashboardTab, setDashboardTab] = useState<'overview' | 'insights'>('overview');

  const getInsightsData = () => {
    const total = allPhotos.length || 1;

    // 1. Dekády
    const decadesMap: Record<number, number> = {};
    allPhotos.forEach(p => {
      const dec = p.decade;
      decadesMap[dec] = (decadesMap[dec] || 0) + 1;
    });
    const decadesStats = Object.keys(decadesMap)
      .map(Number)
      .map(dec => ({
        decade: dec,
        count: decadesMap[dec],
        percentage: Math.round((decadesMap[dec] / total) * 100)
      }))
      .sort((a, b) => b.decade - a.decade);

    // 2. Najčastejšie fotení
    const peopleMap: Record<string, number> = {};
    allPhotos.forEach(p => {
      if (p.people) {
        p.people.forEach(pid => {
          peopleMap[pid] = (peopleMap[pid] || 0) + 1;
        });
      }
    });
    const maxPersonCount = Math.max(...Object.values(peopleMap), 1);
    const topPeople = Object.keys(peopleMap)
      .map(pid => {
        const person = people.find(pers => pers.id === pid);
        return {
          id: pid,
          name: person ? person.name : 'Neznámy člen',
          photo_url: person ? person.photo_url : null,
          count: peopleMap[pid],
          percentage: Math.round((peopleMap[pid] / maxPersonCount) * 100)
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 3. Lokality
    const locMap: Record<string, number> = {};
    allPhotos.forEach(p => {
      if (p.location && p.location.trim().length > 0 && p.location !== 'Neznáme miesto') {
        const loc = p.location.trim();
        locMap[loc] = (locMap[loc] || 0) + 1;
      }
    });
    const maxLocCount = Math.max(...Object.values(locMap), 1);
    const topLocations = Object.keys(locMap)
      .map(loc => ({
        name: loc,
        count: locMap[loc],
        percentage: Math.round((locMap[loc] / maxLocCount) * 100)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 4. AI Tagy
    const tagMap: Record<string, number> = {};
    allPhotos.forEach(p => {
      if (p.ai_metadata?.tags) {
        p.ai_metadata.tags.forEach(tag => {
          tagMap[tag] = (tagMap[tag] || 0) + 1;
        });
      }
    });
    const maxTagCount = Math.max(...Object.values(tagMap), 1);
    const topTags = Object.keys(tagMap)
      .map(tag => ({
        name: tag,
        count: tagMap[tag],
        percentage: Math.round((tagMap[tag] / maxTagCount) * 100)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      decadesStats,
      topPeople,
      topLocations,
      topTags
    };
  };

  // Stavy pre kalendár a výročia
  const [upcomingBirthdays, setUpcomingBirthdays] = useState<BirthdayItem[]>([]);
  const [anniversaries, setAnniversaries] = useState<AnniversaryItem[]>([]);

  // Stav pre výzvu (Fotka týždňa)
  const [challengePhoto, setChallengePhoto] = useState<Photo | null>(null);
  const [sendingStatus, setSendingStatus] = useState<string | null>(null);

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

  const getMonthMemories = () => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const grouped: Record<number, Photo[]> = {};

    allPhotos.forEach(photo => {
      const parsed = parsePhotoDate(photo.taken_at);
      if (!parsed) return;

      if (parsed.month === selectedMonth) {
        const yearsAgo = currentYear - parsed.year;
        if (yearsAgo > 0) {
          if (!grouped[yearsAgo]) {
            grouped[yearsAgo] = [];
          }
          grouped[yearsAgo].push(photo);
        }
      }
    });

    return grouped;
  };

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        const rawPhotos = await db.getPhotos();
        const privatePhotoIds = await db.getPrivatePhotoIds(userSession);
        const photosList = privatePhotoIds.size > 0 
          ? rawPhotos.filter(p => !privatePhotoIds.has(p.id))
          : rawPhotos;

        setAllPhotos(photosList);
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

        // Výber fotky pre výzvu (Fotka týždňa)
        if (photosList.length > 0) {
          let candidates = photosList.filter(p => !p.description || p.description.trim().length < 10 || !p.people || p.people.length === 0);
          if (candidates.length === 0) {
            candidates = photosList;
          }
          candidates.sort((a, b) => a.decade - b.decade);
          const sliceSize = Math.max(1, Math.floor(candidates.length / 2));
          const oldestHalf = candidates.slice(0, sliceSize);
          const randomIndex = Math.floor(Math.random() * oldestHalf.length);
          setChallengePhoto(oldestHalf[randomIndex]);
        }

      } catch (e) {
        console.error('Chyba pri načítaní dát pre nástenku:', e);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  const handleRotateChallenge = async () => {
    try {
      const photosList = await db.getPhotos();
      if (photosList.length === 0) return;
      
      let candidates = photosList.filter(p => !p.description || p.description.trim().length < 10 || !p.people || p.people.length === 0);
      if (candidates.length === 0) {
        candidates = photosList;
      }
      candidates.sort((a, b) => a.decade - b.decade);
      const sliceSize = Math.max(1, Math.floor(candidates.length / 2));
      const oldestHalf = candidates.slice(0, sliceSize);
      
      const filtered = oldestHalf.filter(p => p.id !== challengePhoto?.id);
      const pool = filtered.length > 0 ? filtered : oldestHalf;
      
      const randomIndex = Math.floor(Math.random() * pool.length);
      setChallengePhoto(pool[randomIndex]);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendEmail = () => {
    if (!challengePhoto) return;
    const emailsList = localStorage.getItem('kronika_settings_emails') || '';
    const resendApiKey = localStorage.getItem('kronika_settings_resend_api_key') || '';
    const resendSender = localStorage.getItem('kronika_settings_resend_sender') || 'onboarding@resend.dev';

    const deepLink = window.location.origin + window.location.pathname + '?photo=' + challengePhoto.id;
    
    const subject = encodeURIComponent(`Rodinná výzva: Spoznávate túto spomienku? (${challengePhoto.title})`);
    const body = encodeURIComponent(
      `Ahoj rodina!\n\n` +
      `Pomôžte nám doplniť príbeh a históriu v našej rodinnej kronike. Spoznávate túto fotografiu?\n\n` +
      `Názov: ${challengePhoto.title}\n` +
      `Kedy vznikla: ${challengePhoto.taken_at || 'Neznámy dátum'}\n` +
      `Kde to bolo: ${challengePhoto.location || 'Neznáme miesto'}\n\n` +
      `Ak viete, kto je na fotke alebo čo sa vtedy dialo, doplňte to priamo tu kliknutím na odkaz:\n` +
      `${deepLink}\n\n` +
      `S láskou,\n` +
      `Vaša rodinná kronika`
    );

    if (resendApiKey && emailsList) {
      setSendingStatus('Odosielam e-mail...');
      const recipients = emailsList.split(',').map(e => e.trim());
      
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        mode: 'cors',
        body: JSON.stringify({
          from: resendSender,
          to: recipients,
          subject: `Rodinná výzva: ${challengePhoto.title}`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; max-width: 600px; border: 1px solid #e2e8f0; border-radius: 8px; background: #0f172a; color: #f8fafc;">
              <h2 style="color: #c084fc;">Ahoj rodina!</h2>
              <p>Pomôžte nám doplniť príbeh a označiť ľudí na tejto fotografii v našej rodinnej kronike:</p>
              <div style="background: #1e293b; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #334155;">
                <h3 style="margin-top: 0; color: white;">${challengePhoto.title}</h3>
                <p><strong>Dátum:</strong> ${challengePhoto.taken_at || 'Neznámy'}</p>
                <p><strong>Miesto:</strong> ${challengePhoto.location || 'Neznáme'}</p>
                <img src="${challengePhoto.storage_path}" alt="${challengePhoto.title}" style="max-width: 100%; border-radius: 4px; max-height: 300px; object-fit: cover;" />
              </div>
              <p>Ak viete, kto je na fotke alebo aké spomienky sa k nej viažu, kliknite na odkaz nižšie a doplňte ich:</p>
              <a href="${deepLink}" style="display: inline-block; background: #8b5cf6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 10px;">Doplniť informácie</a>
            </div>
          `
        })
      })
      .then(async res => {
        if (res.ok) {
          setSendingStatus('E-mail bol úspešne odoslaný!');
          setTimeout(() => setSendingStatus(null), 3000);
        } else {
          throw new Error('Resend zlyhal (pravdepodobne CORS)');
        }
      })
      .catch(() => {
        setSendingStatus('Resend obmedzený CORS. Otváram e-mailový program...');
        window.open(`mailto:${emailsList}?subject=${subject}&body=${body}`, '_blank');
        setTimeout(() => setSendingStatus(null), 3000);
      });
    } else {
      window.open(`mailto:${emailsList}?subject=${subject}&body=${body}`, '_blank');
      setSendingStatus('Otvoril sa e-mailový klient!');
      setTimeout(() => setSendingStatus(null), 3000);
    }
  };

  const handleCopyChatTemplate = () => {
    if (!challengePhoto) return;
    const deepLink = window.location.origin + window.location.pathname + '?photo=' + challengePhoto.id;
    const text = 
      `📸 *Rodinná výzva: Spoznávate túto spomienku?*\n\n` +
      `Pomôžte nám doplniť príbeh v našej rodinnej kronike k tejto starej fotke:\n` +
      `*${challengePhoto.title}*\n` +
      `📅 Dátum: ${challengePhoto.taken_at || 'Neznámy'}\n` +
      `📍 Miesto: ${challengePhoto.location || 'Neznáme'}\n\n` +
      `Ak viete, kto na nej je alebo čo sa vtedy dialo, doplňte to priamo tu:\n` +
      `👉 ${deepLink}`;
    
    navigator.clipboard.writeText(text);
    setSendingStatus('Šablóna skopírovaná! Vložte ju do WhatsAppu.');
    setTimeout(() => setSendingStatus(null), 3000);
  };

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>Ahoj v našej rodinnej kronike</h1>
          <p>Uchovávame spomienky a históriu našej rodiny pre budúce generácie.</p>
        </div>
        
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', padding: '0.25rem', borderRadius: '12px', gap: '0.25rem' }}>
          <button 
            type="button"
            className="btn" 
            onClick={() => setDashboardTab('overview')}
            style={{ 
              fontSize: '0.85rem', 
              padding: '0.5rem 1rem', 
              borderRadius: '8px', 
              background: dashboardTab === 'overview' ? 'var(--accent)' : 'transparent',
              color: 'white',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: dashboardTab === 'overview' ? '0 4px 10px rgba(167, 139, 250, 0.25)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            📋 Aktuality a prehľad
          </button>
          <button 
            type="button"
            className="btn" 
            onClick={() => setDashboardTab('insights')}
            style={{ 
              fontSize: '0.85rem', 
              padding: '0.5rem 1rem', 
              borderRadius: '8px', 
              background: dashboardTab === 'insights' ? 'var(--accent)' : 'transparent',
              color: 'white',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: dashboardTab === 'insights' ? '0 4px 10px rgba(167, 139, 250, 0.25)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            📊 Rodinné štatistiky
          </button>
        </div>
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

      {dashboardTab === 'overview' && (
        <>
          {/* PANEL: Kalendár rodinných výročí (Ročný súhrn) */}
          <div className="panel" style={{ marginTop: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <h2 className="panel-title" style={{ color: '#c084fc', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={22} /> Kalendár rodinných výročí (V tento mesiac)
          </h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Čo sa udialo v našej rodine v mesiaci: <strong>{monthsNames[selectedMonth]}</strong>
          </span>
        </div>

        {/* Mesiačné tlačidlá prepínača */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {monthsNames.map((name, idx) => {
            const isSelected = selectedMonth === idx;
            const isCurrent = new Date().getMonth() === idx;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedMonth(idx)}
                className="btn"
                style={{
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.8rem',
                  borderRadius: '20px',
                  background: isSelected 
                    ? 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)' 
                    : 'rgba(255, 255, 255, 0.04)',
                  borderColor: isSelected 
                    ? 'transparent' 
                    : isCurrent 
                      ? 'rgba(167, 139, 250, 0.4)' 
                      : 'rgba(255, 255, 255, 0.08)',
                  color: isSelected ? 'white' : 'var(--text-secondary)',
                  boxShadow: isSelected ? '0 0 10px rgba(167, 139, 250, 0.3)' : 'none',
                  cursor: 'pointer',
                  fontWeight: isSelected || isCurrent ? 700 : 500,
                  transition: 'all 0.2s ease',
                  outline: 'none'
                }}
              >
                {name.substring(0, 3)}
              </button>
            );
          })}
        </div>

        {/* Zoznam spomienok z daného mesiaca */}
        {(() => {
          const memoriesGrouped = getMonthMemories();
          const years = Object.keys(memoriesGrouped).map(Number).sort((a, b) => b - a);

          if (years.length === 0) {
            return (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontStyle: 'italic', padding: '1.5rem 0', textAlign: 'center', width: '100%' }}>
                V mesiaci {monthsNames[selectedMonth]} zatiaľ nemáme zaznamenané žiadne rodinné spomienky predchádzajúcich rokov.
              </p>
            );
          }

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {years.map(yearsAgo => {
                const year = new Date().getFullYear() - yearsAgo;
                const photos = memoriesGrouped[yearsAgo];
                return (
                  <div key={yearsAgo} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '1.25rem' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.75rem' }}>
                      <Clock size={14} /> Pred {yearsAgo} {yearsAgo === 1 ? 'rokom' : (yearsAgo >= 2 && yearsAgo <= 4) ? 'rokmi' : 'rokmi'} ({monthsNames[selectedMonth]} {year})
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
                      {photos.map(photo => (
                        <div 
                          key={photo.id} 
                          className="photo-card" 
                          style={{ cursor: 'pointer', margin: 0 }}
                          onClick={() => onSelectPhoto(photo)}
                        >
                          <div className="photo-wrapper" style={{ aspectRatio: '1.4' }}>
                            <img src={photo.storage_path} alt={photo.title} className="photo-img" />
                          </div>
                          <div className="photo-card-info" style={{ padding: '0.5rem' }}>
                            <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'white', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {photo.title}
                            </h4>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: '0.15rem 0 0 0' }}>
                              {photo.taken_at} {photo.location ? `• ${photo.location}` : ''}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
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

      {/* PANEL: Výzva týždňa / Spoznaj spomienku */}
      {challengePhoto && (
        <div className="panel ai-glow-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '2rem', border: '1px solid rgba(167, 139, 250, 0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 className="panel-title" style={{ color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <Sparkles size={20} /> Rodinná výzva: Spoznáte túto spomienku?
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem', margin: 0 }}>
                Našli sme v archíve starú fotografiu, ktorá nemá priradený príbeh alebo označených ľudí. Pomôžte nám zistiť, čo sa vtedy dialo!
              </p>
            </div>
            {userSession && (
              <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', height: '28px', display: 'flex', alignItems: 'center', gap: '0.25rem' }} onClick={handleRotateChallenge}>
                <RotateCw size={12} /> Iná fotka
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', cursor: 'pointer' }} onClick={() => onSelectPhoto(challengePhoto)}>
            <img src={challengePhoto.storage_path} alt={challengePhoto.title} style={{ width: '100px', height: '100px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--border-color)' }} />
            <div style={{ flexGrow: 1, minWidth: '240px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'white' }}>{challengePhoto.title}</h3>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div>🗓️ Rok/Dátum: <strong>{challengePhoto.taken_at || 'Neznámy'}</strong></div>
                <div>📍 Lokalita: <strong>{challengePhoto.location || 'Neznáma'}</strong></div>
                <div style={{ color: '#fb7185', fontWeight: 600, marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  ⚠️ Chýba: {(!challengePhoto.description || challengePhoto.description.length < 10) ? 'Príbeh/Popis' : ''} 
                  {(!challengePhoto.people || challengePhoto.people.length === 0) ? ((!challengePhoto.description || challengePhoto.description.length < 10) ? ' a označení ľudia' : 'Označení ľudia') : ''}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {userSession && (
              <button className="btn btn-primary" onClick={handleSendEmail} style={{ gap: '0.5rem', fontSize: '0.85rem', height: '36px' }}>
                <Mail size={16} /> Poslať e-mailom rodine
              </button>
            )}
            <button className="btn btn-secondary" onClick={handleCopyChatTemplate} style={{ gap: '0.5rem', fontSize: '0.85rem', height: '36px' }}>
              <MessageSquare size={16} /> Kopírovať do rodinného četu (WhatsApp)
            </button>
            {sendingStatus && (
              <span style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 600 }}>{sendingStatus}</span>
            )}
          </div>
        </div>
      )}

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
      </>)}

      {dashboardTab === 'insights' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', marginTop: '2rem' }}>
          {(() => {
            const { decadesStats, topPeople, topLocations, topTags } = getInsightsData();
            return (
              <>
                {/* 1. DEKÁDY */}
                <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
                  <h2 className="panel-title" style={{ color: '#a78bfa', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Clock size={20} /> Spomienky v čase (Dekády)
                  </h2>
                  {decadesStats.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Žiadne dáta o rokoch fotenia.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {decadesStats.map(stat => (
                        <div key={stat.decade}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                            <span style={{ fontWeight: 600, color: 'white' }}>{stat.decade}-te roky</span>
                            <span style={{ color: 'var(--text-secondary)' }}>{stat.count} {stat.count === 1 ? 'fotka' : (stat.count >= 2 && stat.count <= 4) ? 'fotky' : 'fotiek'} ({stat.percentage}%)</span>
                          </div>
                          <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${stat.percentage}%`, height: '100%', background: 'linear-gradient(90deg, #c084fc 0%, #a78bfa 100%)', borderRadius: '4px' }}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. NAJČASTEJŠIE FOTENÍ */}
                <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
                  <h2 className="panel-title" style={{ color: '#fb7185', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Users size={20} /> Najčastejšie fotografovaní
                  </h2>
                  {topPeople.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Žiadni rodinní príslušníci nie sú označení na fotkách.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {topPeople.map(p => (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <img 
                            src={p.photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100'} 
                            alt={p.name} 
                            style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-color)' }}
                          />
                          <div style={{ flexGrow: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                              <span style={{ fontWeight: 600, color: 'white' }}>{p.name}</span>
                              <span style={{ color: 'var(--text-secondary)' }}>{p.count}x na fotke</span>
                            </div>
                            <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${p.percentage}%`, height: '100%', background: 'linear-gradient(90deg, #fb7185 0%, #f43f5e 100%)', borderRadius: '3px' }}></div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. LOKALITY */}
                <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
                  <h2 className="panel-title" style={{ color: '#34d399', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <MapPin size={20} /> Hlavné miesta spomienok
                  </h2>
                  {topLocations.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Žiadne fotky s vyplnenou lokalitou.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {topLocations.map(loc => (
                        <div key={loc.name}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                            <span style={{ fontWeight: 600, color: 'white' }}>{loc.name}</span>
                            <span style={{ color: 'var(--text-secondary)' }}>{loc.count}x</span>
                          </div>
                          <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${loc.percentage}%`, height: '100%', background: 'linear-gradient(90deg, #34d399 0%, #10b981 100%)', borderRadius: '3px' }}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 4. AI TAGY */}
                <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
                  <h2 className="panel-title" style={{ color: '#38bdf8', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Brain size={20} /> Časté témy (AI Analýza)
                  </h2>
                  {topTags.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Zatiaľ neboli analyzované žiadne fotky pomocou Gemini AI.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {topTags.map(tag => (
                        <div key={tag.name}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                            <span style={{ fontWeight: 600, color: 'white' }}>#{tag.name}</span>
                            <span style={{ color: 'var(--text-secondary)' }}>{tag.count}x</span>
                          </div>
                          <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${tag.percentage}%`, height: '100%', background: 'linear-gradient(90deg, #38bdf8 0%, #0ea5e9 100%)', borderRadius: '3px' }}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
};
