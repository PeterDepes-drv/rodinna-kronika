import React, { useEffect, useState } from 'react';
import { googlePhotos } from '../services/googlePhotos';
import type { GooglePhotoItem } from '../services/googlePhotos';
import { db } from '../services/db';
import { analyzePhoto, fileToBase64 } from '../services/gemini';
import { 
  LogIn, 
  Image, 
  CheckCircle, 
  RefreshCw, 
  AlertCircle, 
  Brain, 
  Upload, 
  Smartphone, 
  Monitor, 
  Trash2, 
  Sparkles,
  CloudDownload
} from 'lucide-react';

interface ImportPhotosProps {
  onNavigate: (view: string) => void;
}

interface LocalFileItem {
  id: string;
  file: File;
  previewUrl: string;
  name: string;
  sizeFormatted: string;
}

export const ImportPhotos: React.FC<ImportPhotosProps> = ({ onNavigate }) => {
  // Tab režim: 'device' (Mobil/PC) alebo 'google' (Google Photos)
  const [importSource, setImportSource] = useState<'device' | 'google'>('device');

  // --- STAVY PRE VOĽBU 1: MIESTNE SÚBORY (Mobil/PC) ---
  const [localFiles, setLocalFiles] = useState<LocalFileItem[]>([]);
  const [selectedLocalIds, setSelectedLocalIds] = useState<string[]>([]);

  // --- STAVY PRE VOĽBU 2: GOOGLE PHOTOS ---
  const [photosState, setPhotosState] = useState<{ items: GooglePhotoItem[] }>({ items: [] });
  const [authState, setAuthState] = useState({ authenticated: false, hasClientId: false });
  const [selectedGoogleIds, setSelectedGoogleIds] = useState<string[]>([]);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // --- SPOLOČNÉ STAVY PRE IMPORT & AI ---
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importWithAi, setImportWithAi] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');

  // Načítanie stavu prihlásenia pre Google
  const checkStatusAndLoad = async () => {
    const status = googlePhotos.getStatus();
    setAuthState(status);

    if (status.authenticated) {
      try {
        setLoadingGoogle(true);
        setErrorMessage(null);
        const data = await googlePhotos.getLibraryPhotos();
        setPhotosState(data);
      } catch (e) {
        console.error('Nepodarilo sa načítať knižnicu Google Photos:', e);
        setErrorMessage((e as Error).message);
      } finally {
        setLoadingGoogle(false);
      }
    }
  };

  useEffect(() => {
    window.addEventListener('google-auth-change', checkStatusAndLoad);
    googlePhotos.handleAuthCallback();
    checkStatusAndLoad();

    return () => {
      window.removeEventListener('google-auth-change', checkStatusAndLoad);
    };
  }, []);

  // --- SPRÁVA MIESTNYCH SÚBOROV (Mobil / PC) ---
  const handleLocalFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addLocalFiles(e.target.files);
    }
  };

  const handleLocalFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      addLocalFiles(e.dataTransfer.files);
    }
  };

  const addLocalFiles = (filesList: FileList | File[]) => {
    const newItems: LocalFileItem[] = [];
    const newIds: string[] = [];

    Array.from(filesList).forEach((file) => {
      if (file.type.startsWith('image/')) {
        const id = 'local_' + Math.random().toString(36).substr(2, 9);
        const previewUrl = URL.createObjectURL(file);
        const sizeFormatted = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
        newItems.push({ id, file, previewUrl, name: file.name, sizeFormatted });
        newIds.push(id);
      }
    });

    setLocalFiles(prev => [...prev, ...newItems]);
    setSelectedLocalIds(prev => [...prev, ...newIds]);
  };

  const toggleSelectLocal = (id: string) => {
    setSelectedLocalIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllLocal = () => {
    if (selectedLocalIds.length === localFiles.length) {
      setSelectedLocalIds([]);
    } else {
      setSelectedLocalIds(localFiles.map(f => f.id));
    }
  };

  const handleClearLocal = () => {
    localFiles.forEach(f => URL.revokeObjectURL(f.previewUrl));
    setLocalFiles([]);
    setSelectedLocalIds([]);
  };

  const handleRemoveLocalItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const target = localFiles.find(f => f.id === id);
    if (target) URL.revokeObjectURL(target.previewUrl);
    setLocalFiles(prev => prev.filter(f => f.id !== id));
    setSelectedLocalIds(prev => prev.filter(item => item !== id));
  };

  // --- EXECUTE IMPORT FOR LOCAL FILES ---
  const handleImportLocalFiles = async () => {
    const toImport = localFiles.filter(item => selectedLocalIds.includes(item.id));
    if (toImport.length === 0) return;

    try {
      setImporting(true);
      setImportProgress(0);
      setStatusMessage('Pripravujem hromadný import súborov...');

      let count = 0;
      for (const item of toImport) {
        count++;
        setImportProgress(Math.round((count / toImport.length) * 100));
        setStatusMessage(`Spracovávam fotku ${count} z ${toImport.length}: ${item.name}...`);

        // Prevod do Base64 pre uloženie aj AI analýzu
        const base64 = await fileToBase64(item.file);
        const dataUrl = `data:${item.file.type || 'image/jpeg'};base64,${base64}`;

        let aiMetadata = undefined;
        let guessedDecade = 1980;

        if (importWithAi) {
          setStatusMessage(`AI analyzuje fotku ${count} z ${toImport.length}: ${item.name}...`);
          try {
            const result = await analyzePhoto(base64, item.file.type || 'image/jpeg');
            aiMetadata = result;
            if (result.estimated_year) {
              const match = result.estimated_year.match(/\d{4}/);
              if (match) {
                guessedDecade = Math.floor(parseInt(match[0]) / 10) * 10;
              }
            }
          } catch (e) {
            console.warn('AI analýza zlyhala pre súbor:', item.name, e);
          }
        }

        // Uloženie do databázy (Supabase alebo LocalDB)
        await db.addPhoto({
          title: item.name.split('.')[0].replace(/[-_]/g, ' '),
          description: `Nahrané zo zariadenia (${item.name})`,
          taken_at: new Date().toISOString().split('T')[0],
          decade: guessedDecade,
          location: '',
          storage_path: dataUrl,
          is_external: false,
          ai_metadata: aiMetadata || {
            tags: ['rodina', 'nahrane-zo-zariadenia'],
            description: `Fotografia nahraná zo zariadenia ${item.name}.`,
            detected_text: ''
          }
        });
      }

      setStatusMessage('Všetky vybrané fotky boli úspešne importované do rodinnej kroniky!');
      setTimeout(() => {
        onNavigate('gallery');
      }, 1500);
    } catch (e) {
      console.error(e);
      const errMsg = (e as Error).message || 'Neznáma chyba.';
      setStatusMessage(`Import zlyhal: ${errMsg}`);
      alert(`Import zlyhal: ${errMsg}`);
    } finally {
      setImporting(false);
    }
  };

  // --- GOOGLE PHOTOS METÓDY ---
  const handleGoogleLogin = () => googlePhotos.login();

  const handleOpenGooglePicker = async () => {
    try {
      setLoadingGoogle(true);
      const geminiConfig = localStorage.getItem('gemini_config');
      let apiKey = '';
      if (geminiConfig) {
        try { apiKey = JSON.parse(geminiConfig).apiKey || ''; } catch {}
      }
      await googlePhotos.openPicker(apiKey, (pickedItems) => {
        setPhotosState(prev => ({ items: [...pickedItems, ...prev.items] }));
        setSelectedGoogleIds(pickedItems.map(p => p.id));
      });
    } catch (e) {
      alert('Nie je možné otvoriť Google Photos Picker: ' + (e as Error).message);
    } finally {
      setLoadingGoogle(false);
    }
  };

  const handleGoogleLogout = () => {
    googlePhotos.logout();
    setPhotosState({ items: [] });
    setSelectedGoogleIds([]);
    setStatusMessage('');
  };

  const handleSelectGooglePhoto = (id: string) => {
    setSelectedGoogleIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllGoogle = () => {
    if (selectedGoogleIds.length === photosState.items.length) {
      setSelectedGoogleIds([]);
    } else {
      setSelectedGoogleIds(photosState.items.map(p => p.id));
    }
  };

  const handleImportGooglePhotos = async () => {
    if (selectedGoogleIds.length === 0) return;

    try {
      setImporting(true);
      setImportProgress(0);
      setStatusMessage('Pripravujem import...');

      const toImport = photosState.items.filter(p => selectedGoogleIds.includes(p.id));
      let count = 0;

      for (const item of toImport) {
        count++;
        setImportProgress(Math.round((count / toImport.length) * 100));
        setStatusMessage(`Importujem fotku ${count} z ${toImport.length}: ${item.filename}...`);

        let aiMetadata = undefined;
        let guessedDecade = 1980;

        if (importWithAi) {
          setStatusMessage(`AI analyzuje fotku ${count} z ${toImport.length}: ${item.filename}...`);
          try {
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
      <div style={{ marginBottom: '2rem' }}>
        <h1>Import fotografií do kroniky</h1>
        <p>Nahrajte staré naskenované rodinné fotografie priamo zo zariadenia alebo pripojte Google Photos.</p>
      </div>

      {/* PREPÍNAČ ZDROJOV IMPORTU (TABS) */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <button
          className={`btn ${importSource === 'device' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setImportSource('device')}
          style={{ flex: 1, minWidth: '220px', padding: '1rem', justifyContent: 'center', fontSize: '0.95rem' }}
        >
          <Smartphone size={20} /> <Monitor size={20} /> Nahrať z mobilu / PC
        </button>

        <button
          className={`btn ${importSource === 'google' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setImportSource('google')}
          style={{ flex: 1, minWidth: '220px', padding: '1rem', justifyContent: 'center', fontSize: '0.95rem' }}
        >
          <CloudDownload size={20} /> Google Photos (Cloud)
        </button>
      </div>

      {/* NASTAVENIE GEMINI AI PRE OBA ZDROJE */}
      <div className="panel" style={{ marginBottom: '2rem', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, color: 'white' }}>
          <input 
            type="checkbox" 
            checked={importWithAi} 
            onChange={(e) => setImportWithAi(e.target.checked)} 
          />
          <Brain size={18} style={{ color: '#a78bfa' }} /> Automaticky analyzovať fotky s Gemini AI počas importu
        </label>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          (AI určí odhadovaný rok, vypíše scenériu, pretiahne text a vygeneruje kľúčové slová)
        </span>
      </div>

      {/* POKIAĽ PREBIEHA IMPORT PROCES */}
      {importing && (
        <div className="panel ai-glow-panel text-center" style={{ marginBottom: '2rem', padding: '2rem' }}>
          <h2>Prebieha hromadný import fotografií...</h2>
          <div style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', height: '10px', borderRadius: '5px', overflow: 'hidden', margin: '1.5rem 0' }}>
            <div style={{ width: `${importProgress}%`, backgroundColor: 'var(--accent)', height: '100%', boxShadow: '0 0 10px var(--accent-glow)', transition: 'width 0.3s ease' }}></div>
          </div>
          <p style={{ fontWeight: 600, color: 'white' }}>{statusMessage}</p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Nezatvárajte aplikáciu, kým sa proces nedokončí.</p>
        </div>
      )}

      {/* --- VOĽBA 1: NAHRÁVANIE Z ZARIADENIA (MOBIL / PC) --- */}
      {importSource === 'device' && (
        <div>
          {/* DRAG & DROP DROPZONE */}
          <div 
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleLocalFileDrop}
            className="panel text-center" 
            style={{ 
              border: '2px dashed var(--accent)', 
              backgroundColor: 'rgba(167, 139, 250, 0.05)', 
              padding: '3rem 2rem',
              cursor: 'pointer',
              marginBottom: '2rem',
              borderRadius: '16px'
            }}
            onClick={() => document.getElementById('local-file-input')?.click()}
          >
            <Upload size={56} style={{ color: 'var(--accent)', marginBottom: '1rem', filter: 'drop-shadow(0 0 8px var(--accent-glow))' }} />
            <h3 style={{ fontSize: '1.25rem' }}>Potiahnite rodinné fotky sem alebo kliknite pre výber</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
              Môžete vybrať desiatky až stovky fotografií naraz z galérie mobilu alebo priečinka v počítači.
            </p>
            <input 
              id="local-file-input"
              type="file" 
              multiple 
              accept="image/*" 
              onChange={handleLocalFileSelect}
              style={{ display: 'none' }}
            />
          </div>

          {/* ZOZNAM VYBRANÝCH SÚBOROV Z ZARIADENIA */}
          {localFiles.length > 0 && !importing && (
            <div className="panel" style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem' }}>Pripravené na import ({selectedLocalIds.length} z {localFiles.length})</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Skontrolujte zoznam pred odoslaním do databázy kroniky.</p>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button className="btn btn-secondary" onClick={handleSelectAllLocal} style={{ fontSize: '0.85rem' }}>
                    {selectedLocalIds.length === localFiles.length ? 'Zrušiť výber' : 'Vybrať všetky'}
                  </button>
                  <button className="btn btn-danger" onClick={handleClearLocal} style={{ fontSize: '0.85rem' }}>
                    <Trash2 size={14} /> Vyčistiť zoznam
                  </button>
                  <button 
                    className="btn btn-primary"
                    disabled={selectedLocalIds.length === 0}
                    onClick={handleImportLocalFiles}
                    style={{ fontSize: '0.9rem', fontWeight: 600 }}
                  >
                    <Sparkles size={16} /> Importovať vybrané ({selectedLocalIds.length})
                  </button>
                </div>
              </div>

              {/* Mriežka náhľadov súborov */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem' }}>
                {localFiles.map((item) => {
                  const isSelected = selectedLocalIds.includes(item.id);
                  return (
                    <div 
                      key={item.id} 
                      onClick={() => toggleSelectLocal(item.id)}
                      style={{
                        position: 'relative',
                        aspectRatio: '1',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        border: isSelected ? '3px solid var(--accent)' : '1px solid rgba(255,255,255,0.1)',
                        boxShadow: isSelected ? '0 0 12px var(--accent-glow)' : 'none',
                        backgroundColor: '#111'
                      }}
                    >
                      <img src={item.previewUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

                      {isSelected && (
                        <div style={{ position: 'absolute', top: '6px', right: '6px', backgroundColor: 'var(--accent)', borderRadius: '50%', color: 'white', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CheckCircle size={14} />
                        </div>
                      )}

                      <button
                        onClick={(e) => handleRemoveLocalItem(item.id, e)}
                        style={{ position: 'absolute', top: '6px', left: '6px', backgroundColor: 'rgba(0,0,0,0.6)', border: 'none', color: 'white', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        title="Odstrániť zo zoznamu"
                      >
                        <Trash2 size={12} />
                      </button>

                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.75)', color: 'white', fontSize: '0.65rem', padding: '0.2rem 0.4rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.name}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- VOĽBA 2: GOOGLE PHOTOS --- */}
      {importSource === 'google' && (
        <div>
          {!authState.authenticated ? (
            <div className="panel text-center" style={{ maxWidth: '600px', margin: '2rem auto', padding: '3rem 2rem' }}>
              <Image size={64} style={{ color: 'var(--accent)', marginBottom: '1.5rem', filter: 'drop-shadow(0 0 10px var(--accent-glow))' }} />
              <h2>Pripojte svoj účet Google</h2>
              <p className="mt-4" style={{ fontSize: '0.95rem', marginBottom: '2rem' }}>
                Načítajte svoje digitálne fotky priamo z cloudu Google. Budete ich môcť označiť, popísať a zaradiť na časovú os kroniky.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <button className="btn btn-primary" onClick={handleGoogleLogin} style={{ width: '100%', padding: '0.85rem' }}>
                  <LogIn size={18} /> Pripojiť k Google Photos
                </button>
                <button className="btn btn-secondary" onClick={() => googlePhotos.enableMockMode()} style={{ width: '100%', padding: '0.85rem' }}>
                  <Image size={18} /> Vyskúšať ukážkový (demo) import fotiek
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="panel" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h3>Pripojené ku Google Photos</h3>
                  <p style={{ fontSize: '0.85rem' }}>Vyberte fotografie, ktoré si prajete pridať do rodinnej kroniky.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" onClick={handleOpenGooglePicker} disabled={loadingGoogle || importing}>
                    <Image size={16} /> Otvoriť výber Google Photos (Picker)
                  </button>
                  <button className="btn btn-secondary" onClick={checkStatusAndLoad} disabled={loadingGoogle || importing}>
                    <RefreshCw size={16} /> Obnoviť
                  </button>
                  <button className="btn btn-danger" onClick={handleGoogleLogout} disabled={importing}>
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
                  <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <button className="btn btn-secondary" onClick={() => googlePhotos.enableMockMode()} style={{ width: '100%' }}>
                      <Image size={16} /> Prepnúť na ukážkový (demo) režim a vyskúšať AI import
                    </button>
                  </div>
                </div>
              )}

              {!importing && photosState.items.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <button className="btn btn-secondary" onClick={handleSelectAllGoogle} style={{ fontSize: '0.85rem', padding: '0.4rem 0.85rem' }}>
                    {selectedGoogleIds.length === photosState.items.length ? 'Zrušiť výber' : 'Vybrať všetky'}
                  </button>
                  
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    Vybrané: <strong>{selectedGoogleIds.length}</strong> z <strong>{photosState.items.length}</strong>
                  </span>

                  <button className="btn btn-primary" disabled={selectedGoogleIds.length === 0} onClick={handleImportGooglePhotos}>
                    Importovať vybrané ({selectedGoogleIds.length})
                  </button>
                </div>
              )}

              {loadingGoogle ? (
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
                    const isSelected = selectedGoogleIds.includes(photo.id);
                    return (
                      <div 
                        key={photo.id}
                        className={`google-photo-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => !importing && handleSelectGooglePhoto(photo.id)}
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
      )}
    </div>
  );
};
