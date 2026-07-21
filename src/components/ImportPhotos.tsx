import React, { useEffect, useState } from 'react';
import { googlePhotos } from '../services/googlePhotos';
import type { GooglePhotoItem } from '../services/googlePhotos';
import { db } from '../services/db';
import { analyzePhoto } from '../services/gemini';
import { LogIn, Image, CheckCircle, RefreshCw, AlertCircle, Brain } from 'lucide-react';

interface ImportPhotosProps {
  onNavigate: (view: string) => void;
}

export const ImportPhotos: React.FC<ImportPhotosProps> = ({ onNavigate }) => {
  const [photosState, setPhotosState] = useState<{ items: GooglePhotoItem[] }>({ items: [] });
  const [authState, setAuthState] = useState({ authenticated: false, hasClientId: false });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importWithAi, setImportWithAi] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Načítanie stavu prihlásenia a fotiek
  const checkStatusAndLoad = async () => {
    const status = googlePhotos.getStatus();
    setAuthState(status);

    if (status.authenticated) {
      try {
        setLoading(true);
        setErrorMessage(null);
        const data = await googlePhotos.getLibraryPhotos();
        setPhotosState(data);
      } catch (e) {
        console.error('Nepodarilo sa načítať knižnicu Google Photos:', e);
        setErrorMessage((e as Error).message);
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    // Registrácia eventu na zmenu prihlásenia
    window.addEventListener('google-auth-change', checkStatusAndLoad);
    googlePhotos.handleAuthCallback(); // Ak prišlo presmerovanie z Google OAuth
    checkStatusAndLoad();

    return () => {
      window.removeEventListener('google-auth-change', checkStatusAndLoad);
    };
  }, []);

  const handleLogin = () => {
    googlePhotos.login();
  };

  const handleLogout = () => {
    googlePhotos.logout();
    setPhotosState({ items: [] });
    setSelectedIds([]);
    setStatusMessage('');
  };

  const handleSelectPhoto = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === photosState.items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(photosState.items.map(p => p.id));
    }
  };

  const handleImport = async () => {
    if (selectedIds.length === 0) return;

    try {
      setImporting(true);
      setImportProgress(0);
      setStatusMessage('Pripravujem import...');

      const toImport = photosState.items.filter(p => selectedIds.includes(p.id));
      let count = 0;

      for (const item of toImport) {
        count++;
        setImportProgress(Math.round((count / toImport.length) * 100));
        setStatusMessage(`Importujem fotku ${count} z ${toImport.length}: ${item.filename}...`);

        let aiMetadata = undefined;
        let guessedDecade = 1980;

        // Ak chce používateľ AI analýzu, spustíme ju
        if (importWithAi) {
          setStatusMessage(`AI analyzuje fotku ${count} z ${toImport.length}: ${item.filename}...`);
          try {
            // V reálnom kóde stiahneme obrázok a pošleme, v simulácii to spracuje gemini.ts
            // Použijeme simulovaný kód gemini, posielame len URL ako zástupný znak
            const result = await analyzePhoto(item.baseUrl, 'image/jpeg');
            aiMetadata = result;
            if (result.estimated_year) {
              const match = result.estimated_year.match(/\d{4}/);
              if (match) {
                guessedDecade = Math.floor(parseInt(match[0]) / 10) * 10;
              }
            }
          } catch (e) {
            console.warn('AI analýza počas importu zlyhala:', e);
          }
        }

        // Uloženie do databázy
        await db.addPhoto({
          title: item.description || item.filename.split('.')[0].replace(/[-_]/g, ' '),
          description: item.description || `Importované z Google Photos (${item.filename})`,
          taken_at: item.creationTime.split('T')[0],
          decade: guessedDecade,
          location: '',
          storage_path: item.baseUrl,
          is_external: true,
          google_photo_id: item.id,
          ai_metadata: aiMetadata || {
            tags: ['google-photos', 'import'],
            description: `Fotografia importovaná z Google Photos.`,
            detected_text: ''
          }
        });
      }

      setStatusMessage('Import bol úspešne dokončený!');
      setTimeout(() => {
        onNavigate('gallery');
      }, 1500);
    } catch (e) {
      console.error(e);
      const errMsg = (e as Error).message || 'Neznáma chyba.';
      setStatusMessage(`Počas importu nastala chyba: ${errMsg}`);
      alert(`Import zlyhal: ${errMsg}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '2.5rem' }}>
        <h1>Import z Google Photos</h1>
        <p>Prepojte kroniku so svojou knižnicou Google Photos a priamo importujte rodinné albumy.</p>
      </div>

      {/* 1. STAV NEPRIHLÁSENÝ */}
      {!authState.authenticated ? (
        <div className="panel text-center" style={{ maxWidth: '600px', margin: '2rem auto', padding: '3rem 2rem' }}>
          <Image size={64} style={{ color: 'var(--accent)', marginBottom: '1.5rem', filter: 'drop-shadow(0 0 10px var(--accent-glow))' }} />
          <h2>Pripojte svoj účet Google</h2>
          <p className="mt-4" style={{ fontSize: '0.95rem', marginBottom: '2rem' }}>
            Načítajte si svoje digitálne fotky priamo z cloudu Google. Budete ich môcť označiť, popísať a zaradiť na časovú os kroniky.
          </p>

          <div className="panel ai-glow-panel text-left" style={{ marginBottom: '2rem', padding: '1rem 1.5rem', textAlign: 'left' }}>
            <h4 style={{ color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 700, textTransform: 'uppercase' }}>
              💡 Poznámka k simulácii
            </h4>
            <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
              Pokiaľ nemáte nastavené Google Client ID v **Nastaveniach**, systém spustí **bezpečný simulovaný režim** s predpripravenými fotkami, aby ste si import mohli hneď vyskúšať.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button className="btn btn-primary" onClick={handleLogin} style={{ width: '100%', padding: '0.85rem' }}>
              <LogIn size={18} /> Pripojiť k Google Photos
            </button>
            <button className="btn btn-secondary" onClick={() => googlePhotos.enableMockMode()} style={{ width: '100%', padding: '0.85rem' }}>
              <Image size={18} /> Vyskúšať ukážkový (demo) import fotiek
            </button>
          </div>
        </div>
      ) : (
        /* 2. STAV PRIHLÁSENÝ - PREHLIADANIE KNIŽNICE */
        <div>
          <div className="panel" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3>Pripojené ku Google Photos</h3>
              <p style={{ fontSize: '0.85rem' }}>Vyberte fotografie, ktoré si prajete pridať do rodinnej kroniky.</p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-secondary" onClick={checkStatusAndLoad} disabled={loading || importing}>
                <RefreshCw size={16} /> Obnoviť
              </button>
              <button className="btn btn-danger" onClick={handleLogout} disabled={importing}>
                Odpojiť účet
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="panel" style={{ marginBottom: '2rem', borderColor: 'var(--danger)', backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
              <h4 style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <AlertCircle size={18} /> Zlyhalo načítanie knižnice Google Photos
              </h4>
              <p style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>{errorMessage}</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                💡 <strong>Uistite sa, že máte v Google Cloud Console povolenú službu "Photos Library API":</strong><br />
                Prejdite do <em>Google Cloud Console -&gt; APIs &amp; Services -&gt; Enabled APIs &amp; services -&gt; + ENABLE APIS AND SERVICES</em> a vyhľadajte a povoľte <strong>Photos Library API</strong>.
              </p>
              <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <button className="btn btn-secondary" onClick={() => googlePhotos.enableMockMode()} style={{ width: '100%' }}>
                  <Image size={16} /> Prepnúť na ukážkový (demo) režim a vyskúšať AI import
                </button>
              </div>
            </div>
          )}

          {/* Nastavenie importu s AI */}
          <div className="panel" style={{ marginBottom: '2rem', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, color: 'white' }}>
              <input 
                type="checkbox" 
                checked={importWithAi} 
                onChange={(e) => setImportWithAi(e.target.checked)} 
              />
              <Brain size={16} style={{ color: '#a78bfa' }} /> Automaticky analyzovať fotky s Gemini AI počas importu
            </label>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              (Zistí odhadovaný rok, prepíše texty a vytvorí tagy)
            </span>
          </div>

          {/* Ak prebieha import */}
          {importing && (
            <div className="panel ai-glow-panel text-center" style={{ marginBottom: '2rem', padding: '2rem' }}>
              <h2>Prebieha import fotografií...</h2>
              <div 
                style={{ 
                  width: '100%', 
                  backgroundColor: 'rgba(255,255,255,0.05)', 
                  height: '10px', 
                  borderRadius: '5px', 
                  overflow: 'hidden',
                  margin: '1.5rem 0'
                }}
              >
                <div 
                  style={{ 
                    width: `${importProgress}%`, 
                    backgroundColor: 'var(--accent)', 
                    height: '100%', 
                    boxShadow: '0 0 10px var(--accent-glow)',
                    transition: 'width 0.3s ease'
                  }}
                ></div>
              </div>
              <p style={{ fontWeight: 600, color: 'white' }}>{statusMessage}</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Nezatvárajte aplikáciu, kým sa proces nedokončí.</p>
            </div>
          )}

          {/* Ovládacie prvky pre výber */}
          {!importing && photosState.items.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <button className="btn btn-secondary" onClick={handleSelectAll} style={{ fontSize: '0.85rem', padding: '0.4rem 0.85rem' }}>
                {selectedIds.length === photosState.items.length ? 'Zrušiť výber' : 'Vybrať všetky'}
              </button>
              
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Vybrané: <strong>{selectedIds.length}</strong> z <strong>{photosState.items.length}</strong>
              </span>

              <button 
                className="btn btn-primary"
                disabled={selectedIds.length === 0}
                onClick={handleImport}
              >
                Importovať vybrané ({selectedIds.length})
              </button>
            </div>
          )}

          {/* Zobrazenie fotiek z Google Photos */}
          {loading ? (
            <div className="text-center" style={{ padding: '6rem 0' }}>
              <p>Načítavam Google Photos knižnicu...</p>
            </div>
          ) : photosState.items.length === 0 ? (
            <div className="empty-state panel">
              <AlertCircle size={48} className="empty-state-icon" />
              <h3>Vo vašej knižnici sa nenašli žiadne fotky</h3>
              <p className="mt-4">Google Photos API nevrátilo žiadne fotografie.</p>
            </div>
          ) : (
            <div className="google-photo-import-grid">
              {photosState.items.map(photo => {
                const isSelected = selectedIds.includes(photo.id);
                return (
                  <div 
                    key={photo.id}
                    className={`google-photo-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => !importing && handleSelectPhoto(photo.id)}
                  >
                    {isSelected && (
                      <div className="google-photo-checkmark">
                        <CheckCircle size={16} />
                      </div>
                    )}
                    <img src={photo.baseUrl} alt={photo.filename} />
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.65)', color: 'white', fontSize: '0.7rem', padding: '0.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {photo.description || photo.filename}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
