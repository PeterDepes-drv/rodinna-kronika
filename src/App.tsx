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
  X
} from 'lucide-react';
import { Dashboard } from './components/Dashboard';
import { Gallery } from './components/Gallery';
import { Timeline } from './components/Timeline';
import { People } from './components/People';
import { Presentations } from './components/Presentations';
import { ImportPhotos } from './components/ImportPhotos';
import { Settings } from './components/Settings';
import type { Photo } from './services/db';

function App() {
  const [activeView, setActiveView] = useState<string>('dashboard');
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

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
  };

  const handleCloseSlideshow = () => {
    setSlideshowPhotos([]);
    setIsSlideshowPlaying(false);
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
          />
        );
      case 'gallery':
        return (
          <Gallery 
            onSelectPhoto={setSelectedPhoto}
            selectedPhoto={selectedPhoto}
            onClosePhotoDetail={handleClosePhotoDetail}
          />
        );
      case 'timeline':
        return <Timeline onSelectPhoto={handleSelectPhoto} />;
      case 'people':
        return <People onSelectPhoto={handleSelectPhoto} />;
      case 'presentations':
        return (
          <Presentations 
            onStartSlideshow={handleStartSlideshow} 
            onSelectPhoto={handleSelectPhoto}
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

            <li className={`menu-item ${activeView === 'import' ? 'active' : ''}`}>
              <button onClick={() => setActiveView('import')}>
                <CloudDownload size={18} />
                <span>Import fotiek</span>
              </button>
            </li>

            <li className={`menu-item ${activeView === 'settings' ? 'active' : ''}`}>
              <button onClick={() => setActiveView('settings')}>
                <SettingsIcon size={18} />
                <span>Nastavenia</span>
              </button>
            </li>
          </ul>
        </nav>

        <div className="sidebar-footer">
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
              >
                {isSlideshowPlaying ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <button 
                className="btn-icon"
                style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                onClick={handleCloseSlideshow}
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
    </div>
  );
}

export default App;
