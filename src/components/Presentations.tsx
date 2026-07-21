import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import type { Album, Photo } from '../services/db';
import { Plus, BookOpen, Play, Printer, X, PlusCircle, CheckCircle, Trash2, ArrowLeft } from 'lucide-react';

interface PresentationsProps {
  onStartSlideshow: (photos: Photo[], title: string) => void;
  onSelectPhoto: (photo: Photo) => void;
}

export const Presentations: React.FC<PresentationsProps> = ({ onStartSlideshow, onSelectPhoto }) => {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [albumPhotos, setAlbumPhotos] = useState<Photo[]>([]);


  // Režimy
  const [isAddAlbumOpen, setIsAddAlbumOpen] = useState(false);
  const [isManagePhotosOpen, setIsManagePhotosOpen] = useState(false);
  const [isPhotobookPreviewOpen, setIsPhotobookPreviewOpen] = useState(false);

  // Formulár pre album
  const [newAlbumTitle, setNewAlbumTitle] = useState('');
  const [newAlbumDesc, setNewAlbumDesc] = useState('');

  const loadAlbumsData = async () => {
    try {
      const albumsList = await db.getAlbums();
      const photosList = await db.getPhotos();
      setAlbums(albumsList);
      setPhotos(photosList);

      if (selectedAlbum) {
        const updatedAlbum = albumsList.find(a => a.id === selectedAlbum.id);
        if (updatedAlbum) {
          setSelectedAlbum(updatedAlbum);
          const aPhotos = await db.getAlbumPhotos(updatedAlbum.id);
          setAlbumPhotos(aPhotos);
        }
      }
    } catch (e) {
      console.error('Chyba pri načítaní prezentácií:', e);
    } finally {
      // done
    }
  };

  useEffect(() => {
    loadAlbumsData();
  }, []);

  const handleSelectAlbum = async (album: Album) => {
    setSelectedAlbum(album);
    const aPhotos = await db.getAlbumPhotos(album.id);
    setAlbumPhotos(aPhotos);
  };

  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlbumTitle.trim()) return;
    try {
      await db.addAlbum(newAlbumTitle, newAlbumDesc);
      setNewAlbumTitle('');
      setNewAlbumDesc('');
      setIsAddAlbumOpen(false);
      loadAlbumsData();
    } catch (e) {
      console.error(e);
      alert('Nepodarilo sa vytvoriť album: ' + ((e as Error).message || 'Neznáma chyba.'));
    }
  };

  const handleDeleteAlbum = async (albumId: string) => {
    if (window.confirm('Naozaj chcete vymazať tento album? Fotografie z archívu sa nevymažú, iba sa odstráni ich priradenie do albumu.')) {
      try {
        await db.deleteAlbum(albumId);
        setSelectedAlbum(null);
        setAlbumPhotos([]);
        loadAlbumsData();
      } catch (e) {
        console.error(e);
        alert('Nepodarilo sa vymazať album.');
      }
    }
  };

  const handleTogglePhotoInAlbum = async (photoId: string) => {
    if (!selectedAlbum) return;
    try {
      const isAlreadyIn = albumPhotos.some(p => p.id === photoId);
      if (isAlreadyIn) {
        await db.removePhotoFromAlbum(selectedAlbum.id, photoId);
      } else {
        await db.addPhotoToAlbum(selectedAlbum.id, photoId);
      }
      // Aktualizovať zoznam fotiek v albume
      const updatedPhotos = await db.getAlbumPhotos(selectedAlbum.id);
      setAlbumPhotos(updatedPhotos);
      loadAlbumsData();
    } catch (e) {
      console.error(e);
      alert('Chyba pri úprave fotky v albume: ' + ((e as Error).message || 'Neznáma chyba.'));
    }
  };

  const handleBackToList = () => {
    setSelectedAlbum(null);
    setAlbumPhotos([]);
    setIsPhotobookPreviewOpen(false);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div>
      {/* 1. DETAIL ALBUMU S MOŽNOSŤAMI PREZENTÁCIE A FOTOKNIHY */}
      {selectedAlbum ? (
        <div>
          {/* Vytlačená kniha - Skryté v normálnom zobrazení, viditeľné v print režime */}
          {isPhotobookPreviewOpen ? (
            <div className="photobook-preview-overlay">
              <div className="no-print" style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3>Náhľad fotoknihy na tlač</h3>
                  <p style={{ fontSize: '0.85rem' }}>Kliknutím na tlač môžete knihu vytlačiť na papier alebo exportovať do formátu PDF.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button className="btn btn-secondary" onClick={() => setIsPhotobookPreviewOpen(false)}>
                    Návrat k albumu
                  </button>
                  <button className="btn btn-primary" onClick={handlePrint}>
                    <Printer size={16} /> Tlačiť / PDF export
                  </button>
                </div>
              </div>

              {/* Tlačová kniha (Print-optimized HTML structure) */}
              <div className="photobook-container">
                <div className="photobook-cover-page">
                  <h1 className="photobook-cover-title">{selectedAlbum.title}</h1>
                  <p className="photobook-cover-subtitle">Rodinná fotokniha spomienok</p>
                  {selectedAlbum.cover_photo_path && (
                    <img src={selectedAlbum.cover_photo_path} alt="Cover" className="photobook-cover-img" />
                  )}
                  <p style={{ marginTop: '3rem', fontSize: '1rem', fontStyle: 'italic' }}>Vygenerované digitálnou rodinnou kronikou</p>
                </div>

                {albumPhotos.map((photo, idx) => (
                  <div key={photo.id} className="photobook-page">
                    <div className="photobook-page-image-section">
                      <img src={photo.storage_path} alt={photo.title} />
                    </div>
                    <div className="photobook-page-text-section">
                      <div className="photobook-page-meta">
                        Strana {idx + 1} | {photo.taken_at} | {photo.location || 'Bez miesta'}
                      </div>
                      <h2 className="photobook-page-title">{photo.title}</h2>
                      <p className="photobook-page-story">{photo.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                <button className="btn btn-secondary" onClick={handleBackToList}>
                  <ArrowLeft size={16} /> Späť na albumy
                </button>
                <button 
                  className="btn btn-primary"
                  disabled={albumPhotos.length === 0}
                  onClick={() => onStartSlideshow(albumPhotos, selectedAlbum.title)}
                >
                  <Play size={16} /> Spustiť prezentáciu
                </button>
                <button 
                  className="btn btn-secondary"
                  disabled={albumPhotos.length === 0}
                  onClick={() => setIsPhotobookPreviewOpen(true)}
                  style={{ gap: '0.5rem', fontWeight: 600, borderColor: 'var(--accent)' }}
                >
                  <Printer size={16} /> 🖨️ Export do PDF / Tlač fotoknihy
                </button>
                
                <button className="btn btn-danger" style={{ marginLeft: 'auto' }} onClick={() => handleDeleteAlbum(selectedAlbum.id)}>
                  <Trash2 size={16} /> Vymazať album
                </button>
              </div>

              <div className="panel" style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{selectedAlbum.title}</h1>
                <p>{selectedAlbum.description || 'K tomuto albumu zatiaľ nie je priradený popis.'}</p>
                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    Počet fotografií: <strong>{albumPhotos.length}</strong>
                  </span>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => setIsManagePhotosOpen(true)}
                    style={{ fontSize: '0.85rem', padding: '0.4rem 0.85rem' }}
                  >
                    Pridať / Odobrať fotky
                  </button>
                </div>
              </div>

              {/* Fotky v albume */}
              {albumPhotos.length === 0 ? (
                <div className="empty-state panel">
                  <BookOpen size={48} className="empty-state-icon" />
                  <h3>Album je prázdny</h3>
                  <p className="mt-4">Pridajte do tohto albumu fotky kliknutím na tlačidlo "Pridať / Odobrať fotky".</p>
                </div>
              ) : (
                <div className="gallery-grid">
                  {albumPhotos.map(photo => (
                    <div key={photo.id} className="photo-card" onClick={() => onSelectPhoto(photo)}>
                      <div className="photo-wrapper">
                        <img src={photo.storage_path} alt={photo.title} className="photo-img" />
                      </div>
                      <div className="photo-card-info">
                        <h3 className="photo-title">{photo.title}</h3>
                        <div className="photo-meta">
                          <span>{photo.taken_at}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* MODÁL: SPRÁVA FOTIEK V ALBUME */}
          {isManagePhotosOpen && (
            <div className="modal-overlay">
              <div className="modal-content" style={{ display: 'flex', flexDirection: 'column', maxWidth: '750px', maxHeight: '80vh', padding: '2rem' }}>
                <div className="modal-header" style={{ marginBottom: '1.5rem' }}>
                  <h2>Vybrať fotografie do albumu</h2>
                  <button className="modal-close-btn" onClick={() => setIsManagePhotosOpen(false)}>
                    <X size={20} />
                  </button>
                </div>
                
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  Kliknutím na fotografiu ju priradíte alebo odoberiete z albumu <strong>{selectedAlbum.title}</strong>.
                </p>

                <div style={{ flexGrow: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '1rem', padding: '0.5rem' }}>
                  {photos.map(photo => {
                    const isSelected = albumPhotos.some(p => p.id === photo.id);
                    return (
                      <div 
                        key={photo.id}
                        onClick={() => handleTogglePhotoInAlbum(photo.id)}
                        style={{
                          borderRadius: '8px',
                          overflow: 'hidden',
                          aspectRatio: '1',
                          cursor: 'pointer',
                          position: 'relative',
                          border: isSelected ? '3px solid var(--accent)' : '2px solid transparent',
                          boxShadow: isSelected ? '0 0 10px var(--accent-glow)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <img src={photo.storage_path} alt={photo.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        {isSelected ? (
                          <div style={{ position: 'absolute', top: '0.35rem', right: '0.35rem', backgroundColor: 'var(--accent)', color: 'white', borderRadius: '50%', padding: '0.1rem' }}>
                            <CheckCircle size={14} />
                          </div>
                        ) : (
                          <div style={{ position: 'absolute', top: '0.35rem', right: '0.35rem', backgroundColor: 'rgba(0,0,0,0.5)', color: 'white', borderRadius: '50%', padding: '0.1rem' }}>
                            <PlusCircle size={14} />
                          </div>
                        )}
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.75)', color: 'white', fontSize: '0.7rem', padding: '0.25rem', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {photo.title}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
                  <button className="btn btn-primary" onClick={() => setIsManagePhotosOpen(false)}>
                    Hotovo
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* 2. ZOZNAM ALBUMOV */
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
            <div>
              <h1>Prezentácie a fotoknihy</h1>
              <p>Zoskupujte spomienky do tematických kníh a spúšťajte plynulé prezentácie.</p>
            </div>
            <button className="btn btn-primary" onClick={() => setIsAddAlbumOpen(true)}>
              <Plus size={18} /> Vytvoriť nový album
            </button>
          </div>

          {albums.length === 0 ? (
            <div className="empty-state panel">
              <BookOpen size={48} className="empty-state-icon" />
              <h3>Žiadne albumy</h3>
              <p className="mt-4">Zatiaľ ste nevytvorili žiadny album. Začnite kliknutím na tlačidlo hore.</p>
            </div>
          ) : (
            <div className="gallery-grid">
              {albums.map(album => (
                <div 
                  key={album.id} 
                  className="photo-card"
                  onClick={() => handleSelectAlbum(album)}
                >
                  <div className="photo-wrapper">
                    <img 
                      src={album.cover_photo_path || 'https://images.unsplash.com/photo-1513694203232-719a280e022f?q=80&w=600'} 
                      alt={album.title} 
                      className="photo-img" 
                    />
                    <span className="photo-badge" style={{ backgroundColor: 'var(--accent)' }}>Album</span>
                  </div>
                  <div className="photo-card-info">
                    <h3 className="photo-title">{album.title}</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: '36px' }}>
                      {album.description || 'Bez popisu.'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* MODÁL: NOVÝ ALBUM */}
          {isAddAlbumOpen && (
            <div className="modal-overlay">
              <form onSubmit={handleCreateAlbum} className="modal-content" style={{ display: 'flex', flexDirection: 'column', maxWidth: '500px', padding: '2rem', gap: '1.25rem' }}>
                <div className="modal-header">
                  <h2>Nový album spomienok</h2>
                  <button type="button" className="modal-close-btn" onClick={() => setIsAddAlbumOpen(false)}>
                    <X size={20} />
                  </button>
                </div>

                <div className="form-group">
                  <label>Názov albumu *</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    style={{ paddingLeft: '1rem' }}
                    required
                    placeholder="napr. Letné prázdniny u babky"
                    value={newAlbumTitle}
                    onChange={(e) => setNewAlbumTitle(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Popis albumu</label>
                  <textarea 
                    className="textarea-field" 
                    placeholder="Krátko popíšte, aké rodinné fotografie tento album zjednocuje..."
                    value={newAlbumDesc}
                    onChange={(e) => setNewAlbumDesc(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button type="button" className="btn btn-secondary w-full" onClick={() => setIsAddAlbumOpen(false)}>
                    Zrušiť
                  </button>
                  <button type="submit" className="btn btn-primary w-full">
                    Vytvoriť album
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Špeciálne štýly pre tlač fotoknihy (zabudované do CSS prostredníctvom prídavných elementov) */}
      <style>{`
        /* Náhľad fotoknihy */
        .photobook-preview-overlay {
          background-color: #0b0c16;
          min-height: 100vh;
          padding: 1rem 2rem;
        }

        .photobook-container {
          background-color: white;
          color: black;
          max-width: 800px;
          margin: 2rem auto;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          font-family: 'Times New Roman', serif;
        }

        .photobook-cover-page {
          height: 100vh;
          max-height: 1000px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 4rem;
          text-align: center;
          border-bottom: 2px double #ccc;
          page-break-after: always;
        }

        .photobook-cover-title {
          font-size: 3rem;
          margin-bottom: 1rem;
          font-family: serif;
          background: none;
          -webkit-text-fill-color: initial;
          color: #111;
        }

        .photobook-cover-subtitle {
          font-size: 1.5rem;
          color: #555;
          margin-bottom: 3rem;
        }

        .photobook-cover-img {
          width: 80%;
          max-height: 400px;
          object-fit: cover;
          border: 1px solid #999;
          padding: 8px;
          background-color: white;
          box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }

        .photobook-page {
          height: 100vh;
          max-height: 1000px;
          display: grid;
          grid-template-rows: 1.3fr 1fr;
          padding: 3rem;
          border-bottom: 1px solid #ddd;
          page-break-after: always;
          box-sizing: border-box;
        }

        .photobook-page-image-section {
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          padding-bottom: 1.5rem;
        }

        .photobook-page-image-section img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
          border: 1px solid #777;
          box-shadow: 0 2px 5px rgba(0,0,0,0.15);
        }

        .photobook-page-text-section {
          padding-top: 1.5rem;
          border-top: 1px solid #eee;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .photobook-page-meta {
          font-size: 0.85rem;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .photobook-page-title {
          font-size: 1.75rem;
          font-family: serif;
          color: #222;
          margin-bottom: 0.5rem;
        }

        .photobook-page-story {
          font-size: 1.1rem;
          line-height: 1.5;
          color: #333;
          white-space: pre-line;
        }

        /* Tlačové optimalizácie */
        @media print {
          body {
            background-color: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          .sidebar, .main-content {
            display: none !important;
          }
          .photobook-preview-overlay {
            padding: 0 !important;
            background-color: white !important;
          }
          .photobook-container {
            box-shadow: none !important;
            max-width: 100% !important;
            margin: 0 !important;
          }
          .photobook-cover-page, .photobook-page {
            height: 100vh !important;
            page-break-after: always !important;
            border: none !important;
            padding: 2cm !important;
            box-sizing: border-box !important;
          }
        }
      `}</style>
    </div>
  );
};
