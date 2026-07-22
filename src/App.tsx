import { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Image as ImageIcon, 
  Clock, 
  Users, 
  Tv, 
  CloudDownload, 
  Settings as SettingsIcon,
  Heart,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  X,
  User,
  LogIn,
  LogOut,
  Maximize2,
  Minimize2,
  Map
} from 'lucide-react';
import { Dashboard } from './components/Dashboard';
import { Gallery } from './components/Gallery';
import { Timeline } from './components/Timeline';
import { People } from './components/People';
import { Presentations } from './components/Presentations';
import { ImportPhotos } from './components/ImportPhotos';
import { Settings } from './components/Settings';
import { MapMemories } from './components/MapMemories';
import { db } from './services/db';
import type { Photo } from './services/db';
import { authService } from './services/auth';
import type { UserSession } from './services/auth';
import { AuthModal } from './components/AuthModal';

function App() {
  const [activeView, setActiveView] = useState<string>('dashboard');
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  // E-mailové prihlásenie pre rodinu
  const [userSession, setUserSession] = useState<UserSession | null>(authService.getSession());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = authService.subscribe((session) => {
      setUserSession(session);
    });
    return unsubscribe;
  }, []);

  // Spracovanie hlbokých odkazov pri štarte (?photo=ID)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const photoId = params.get('photo');
    if (photoId) {
      const loadLinkedPhoto = async () => {
        try {
          const photosList = await db.getPhotos();
          const found = photosList.find((p: Photo) => p.id === photoId);
          if (found) {
            setSelectedPhoto(found);
            setActiveView('gallery');
          }
        } catch (e) {
          console.error('Nepodarilo sa načítať odkazovanú fotografiu:', e);
        }
      };
      loadLinkedPhoto();
    }
  }, []);

  // Stavy pre celoobrazovkovú prezentáciu (Slideshow)
  const [slideshowPhotos, setSlideshowPhotos] = useState<Photo[]>([]);
  const [slideshowTitle, setSlideshowTitle] = useState('');
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isSlideshowPlaying, setIsSlideshowPlaying] = useState(false);

  // Automatické prepínanie slajdov v prezentácii
  useEffect(() => {
    let interval: any;
    if (isSlideshowPlaying && slideshowPhotos.length > 1) {
      interval = setInterval(() => {
        setCurrentSlideIndex((prevIndex) => 
          prevIndex === slideshowPhotos.length - 1 ? 0 : prevIndex + 1
        );
      }, 5000); // prepnúť každých 5 sekúnd
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isSlideshowPlaying, slideshowPhotos]);

  const handleSelectPhoto = (photo: Photo) => {
    setSelectedPhoto(photo);
    setActiveView('gallery'); // prepne do galérie, kde sa automaticky otvorí modál detailu
  };

  const handleClosePhotoDetail = () => {
    setSelectedPhoto(null);
  };

  const handleStartSlideshow = (photos: Photo[], title: string) => {
    if (photos.length === 0) return;
    setSlideshowPhotos(photos);
    setSlideshowTitle(title);
    setCurrentSlideIndex(0);
    setIsSlideshowPlaying(true);

    // Prechod na celú obrazovku
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  const handleCloseSlideshow = () => {
    setSlideshowPhotos([]);
    setIsSlideshowPlaying(false);
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  };

  const toggleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  const handlePrevSlide = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentSlideIndex((prevIndex) => 
      prevIndex === 0 ? slideshowPhotos.length - 1 : prevIndex - 1
    );
  };

  const handleNextSlide = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentSlideIndex((prevIndex) => 
      prevIndex === slideshowPhotos.length - 1 ? 0 : prevIndex + 1
    );
  };

  // Vykreslenie aktívneho pohľadu
  const renderActiveView = () => {
    switch (activeView) {
      case 'dashboard':
        return (
          <Dashboard 
            onNavigate={setActiveView} 
            onSelectPhoto={handleSelectPhoto}
            onStartSlideshow={handleStartSlideshow}
            userSession={userSession}
          />
        );
      case 'gallery':
        return (
          <Gallery 
            onSelectPhoto={setSelectedPhoto}
            selectedPhoto={selectedPhoto}
            onClosePhotoDetail={handleClosePhotoDetail}
            userSession={userSession}
          />
        );
      case 'timeline':
        return <Timeline onSelectPhoto={handleSelectPhoto} userSession={userSession} />;
      case 'map':
        return <MapMemories onSelectPhoto={handleSelectPhoto} userSession={userSession} />;
      case 'people':
        return <People onSelectPhoto={handleSelectPhoto} userSession={userSession} />;
      case 'presentations':
        return (
          <Presentations 
            onStartSlideshow={handleStartSlideshow} 
            onSelectPhoto={handleSelectPhoto}
            userSession={userSession}
          />
        );
      case 'import':
        return <ImportPhotos onNavigate={setActiveView} />;
      case 'settings':
        return <Settings onNavigate={setActiveView} />;
      default:
        return (
          <Dashboard 
            onNavigate={setActiveView} 
            onSelectPhoto={handleSelectPhoto}
            onStartSlideshow={handleStartSlideshow}
            userSession={userSession}
          />
        );
    }
  };

  return (
    <div className="app-container">
      {/* BOČNÉ NAVIGAČNÉ MENU (Sidebar) */}
      <aside className="sidebar no-print">
        <div className="logo-container">
          <BookOpen className="logo-icon" size={28} />
          <span className="logo-text">Kronika Rodiny</span>
        </div>

        <nav style={{ flexGrow: 1 }}>
          <ul className="menu-list">
            <li className={`menu-item ${activeView === 'dashboard' ? 'active' : ''}`}>
              <button onClick={() => setActiveView('dashboard')}>
                <BookOpen size={18} />
                <span>Prehľad</span>
              </button>
            </li>

            <li className={`menu-item ${activeView === 'gallery' ? 'active' : ''}`}>
              <button onClick={() => setActiveView('gallery')}>
                <ImageIcon size={18} />
                <span>Rodinný archív</span>
              </button>
            </li>

            <li className={`menu-item ${activeView === 'timeline' ? 'active' : ''}`}>
              <button onClick={() => setActiveView('timeline')}>
                <Clock size={18} />
                <span>Časová os</span>
              </button>
            </li>

            <li className={`menu-item ${activeView === 'map' ? 'active' : ''}`}>
              <button onClick={() => setActiveView('map')}>
                <Map size={18} />
                <span>Mapa spomienok</span>
              </button>
            </li>

            <li className={`menu-item ${activeView === 'people' ? 'active' : ''}`}>
              <button onClick={() => setActiveView('people')}>
                <Users size={18} />
                <span>Ľudia a rodokmeň</span>
              </button>
            </li>

            <li className={`menu-item ${activeView === 'presentations' ? 'active' : ''}`}>
              <button onClick={() => setActiveView('presentations')}>
                <Tv size={18} />
                <span>Knihy a prezentácie</span>
              </button>
            </li>

            {userSession && (
              <li className={`menu-item ${activeView === 'import' ? 'active' : ''}`}>
                <button onClick={() => setActiveView('import')}>
                  <CloudDownload size={18} />
                  <span>Import fotiek</span>
                </button>
              </li>
            )}

            {userSession && (
              <li className={`menu-item ${activeView === 'settings' ? 'active' : ''}`}>
                <button onClick={() => setActiveView('settings')}>
                  <SettingsIcon size={18} />
                  <span>Nastavenia</span>
                </button>
              </li>
            )}
          </ul>
        </nav>

        <div className="sidebar-footer">
          {userSession ? (
            <div style={{ marginBottom: '1rem', padding: '0.65rem 0.85rem', backgroundColor: 'rgba(167, 139, 250, 0.1)', border: '1px solid rgba(167, 139, 250, 0.25)', borderRadius: '8px', textAlign: 'left' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#22c55e', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.35rem' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e', display: 'inline-block', boxShadow: '0 0 6px #22c55e' }}></span>
                ✏️ REŽIM SPRÁVCU (ONLINE)
              </div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <User size={14} style={{ color: '#a78bfa' }} /> {userSession.name || userSession.email.split('@')[0]}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {userSession.email}
              </div>
              <button 
                onClick={() => authService.logout()} 
                style={{ marginTop: '0.5rem', background: 'none', border: 'none', color: 'var(--danger)', fontSize: '0.75rem', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              >
                <LogOut size={12} /> Odhlásiť správcu
              </button>
            </div>
          ) : (
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.6rem' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--text-secondary)', display: 'inline-block' }}></span>
                👁️ REŽIM PREZERANIA (ČÍTANIE)
              </div>
              <button 
                onClick={() => setIsAuthModalOpen(true)}
                className="btn btn-secondary"
                style={{ width: '100%', fontSize: '0.8rem', padding: '0.55rem 0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
              >
                <LogIn size={14} /> Prihlásiť správcu (E-mail)
              </button>
            </div>
          )}

          <p>Vyrobené s <Heart size={10} style={{ color: 'red', display: 'inline' }} /> pre našu rodinu</p>
          <p style={{ marginTop: '0.25rem', fontSize: '0.7rem' }}>v. 1.0.0 (2026)</p>
        </div>
      </aside>

      {/* HLAVNÁ OBSAHOVÁ ČASŤ (Main Content) */}
      <main className="main-content">
        {renderActiveView()}
      </main>

      {/* CELOOBRAZOVKOVÁ PREZENTÁCIA (Immersive Fullscreen Slideshow) */}
      {slideshowPhotos.length > 0 && (
        <div className="slideshow-overlay" onClick={handleCloseSlideshow}>
          {/* Hlavička prezentácie */}
          <div className="slideshow-header">
            <div>
              <h2 style={{ fontSize: '1.25rem', color: 'white' }}>{slideshowTitle}</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Snímka {currentSlideIndex + 1} z {slideshowPhotos.length}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button 
                className="btn-icon" 
                style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSlideshowPlaying(!isSlideshowPlaying);
                }}
                title={isSlideshowPlaying ? 'Pozastaviť' : 'Spustiť'}
              >
                {isSlideshowPlaying ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <button 
                className="btn-icon"
                style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                onClick={toggleFullscreen}
                title="Prepnúť celú obrazovku (Fullscreen)"
              >
                {document.fullscreenElement ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>
              <button 
                className="btn-icon"
                style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                onClick={handleCloseSlideshow}
                title="Zatvoriť"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Hlavné telo prezentácie */}
          <div className="slideshow-body">
            <div className="slideshow-img-container">
              <img 
                key={slideshowPhotos[currentSlideIndex].id} // vynúti re-render animácie pri zmene snímky
                src={slideshowPhotos[currentSlideIndex].storage_path} 
                alt={slideshowPhotos[currentSlideIndex].title} 
                className="slideshow-img"
                onClick={(e) => e.stopPropagation()} // zabráni zatvoreniu pri kliknutí na fotku
              />
            </div>

            {/* Šípky na prepínanie slajdov */}
            <div className="slideshow-controls">
              <button className="slideshow-arrow-btn" onClick={handlePrevSlide}>
                <ChevronLeft size={24} />
              </button>
              <button className="slideshow-arrow-btn" onClick={handleNextSlide}>
                <ChevronRight size={24} />
              </button>
            </div>

            {/* Panel s popisom fotky */}
            <div className="slideshow-caption-panel" onClick={(e) => e.stopPropagation()}>
              <h3 className="slideshow-caption-title">{slideshowPhotos[currentSlideIndex].title}</h3>
              <p style={{ fontSize: '0.85rem', color: '#a78bfa', marginBottom: '0.5rem', fontWeight: 600 }}>
                {slideshowPhotos[currentSlideIndex].taken_at} | {slideshowPhotos[currentSlideIndex].location || 'Neznáma lokalita'}
              </p>
              <p className="slideshow-caption-text">
                {slideshowPhotos[currentSlideIndex].description || 'K tejto fotografii nie je zapísaný žiadny rodinný príbeh.'}
              </p>
            </div>
          </div>

          {/* Indikátor priebehu automatického striedania */}
          {isSlideshowPlaying && (
            <div 
              className="slideshow-progress-bar"
              style={{
                width: '100%',
                animation: 'shimmer 5s linear infinite'
              }}
            ></div>
          )}
        </div>
      )}

      {/* MODÁLNE OKNO PRE E-MAILOVÉ PRIHLÁSENIE */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  );
}

export default App;
