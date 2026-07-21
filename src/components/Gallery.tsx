import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import type { Photo, Person, AIAnalysisResult } from '../services/db';
import { analyzePhoto, fileToBase64 } from '../services/gemini';
import { Search, Plus, Calendar, MapPin, Users, Trash2, Edit, X, Brain, AlertCircle, Maximize2 } from 'lucide-react';

interface GalleryProps {
  onSelectPhoto: (photo: Photo) => void;
  selectedPhoto: Photo | null;
  onClosePhotoDetail: () => void;
  userSession: any;
}

export const validateYearOrDate = (dateStr: string): { isValid: boolean; error?: string } => {
  const trimmed = dateStr ? dateStr.trim().replace(/\s+/g, '') : '';
  if (!trimmed) return { isValid: true };

  const yearPattern = /^(\d{4})$/;
  const monthYearPattern = /^(\d{1,2})\.(\d{4})$/;
  const fullDatePattern = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;

  const legacyFullDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
  const legacyMonthYearPattern = /^(\d{4})-(\d{2})$/;

  let year = 0;
  let month = 1;
  let day = 1;
  let matches = false;
  const currentYear = new Date().getFullYear();

  if (yearPattern.test(trimmed)) {
    year = parseInt(trimmed);
    matches = true;
  } else if (monthYearPattern.test(trimmed)) {
    const m = trimmed.match(monthYearPattern)!;
    month = parseInt(m[1]);
    year = parseInt(m[2]);
    matches = true;
  } else if (fullDatePattern.test(trimmed)) {
    const m = trimmed.match(fullDatePattern)!;
    day = parseInt(m[1]);
    month = parseInt(m[2]);
    year = parseInt(m[3]);
    matches = true;
  } else if (legacyFullDatePattern.test(trimmed)) {
    const m = trimmed.match(legacyFullDatePattern)!;
    year = parseInt(m[1]);
    month = parseInt(m[2]);
    day = parseInt(m[3]);
    matches = true;
  } else if (legacyMonthYearPattern.test(trimmed)) {
    const m = trimmed.match(legacyMonthYearPattern)!;
    year = parseInt(m[1]);
    month = parseInt(m[2]);
    matches = true;
  }

  if (!matches) {
    return { 
      isValid: false, 
      error: 'Formát dátumu musí byť: DD.MM.RRRR (napr. 15.06.1974), MM.RRRR (napr. 06.1974) alebo len RRRR (napr. 1974).' 
    };
  }

  if (year < 1900 || year > currentYear) {
    return { 
      isValid: false, 
      error: `Rok musí byť medzi 1900 a ${currentYear}. Zadaný rok: ${year}.` 
    };
  }

  if (month < 1 || month > 12) {
    return { isValid: false, error: 'Mesiac musí byť medzi 01 a 12.' };
  }

  if (day < 1 || day > 31) {
    return { isValid: false, error: 'Deň musí byť medzi 01 a 31.' };
  }

  return { isValid: true };
};

export const extractDecadeFromDate = (dateStr: string, fallbackDecade = 1980): number => {
  if (!dateStr) return fallbackDecade;
  const trimmed = dateStr.trim().replace(/\s+/g, '');

  const fullDatePattern = /(\d{1,2})\.(\d{1,2})\.(\d{4})/;
  const monthYearPattern = /(\d{1,2})\.(\d{4})/;
  const yearPattern = /(\d{4})/;
  const isoPattern = /(\d{4})-(\d{2})/;

  let year = 0;
  if (fullDatePattern.test(trimmed)) {
    const m = trimmed.match(fullDatePattern)!;
    year = parseInt(m[3]);
  } else if (monthYearPattern.test(trimmed)) {
    const m = trimmed.match(monthYearPattern)!;
    year = parseInt(m[2]);
  } else if (isoPattern.test(trimmed)) {
    const m = trimmed.match(isoPattern)!;
    year = parseInt(m[1]);
  } else if (yearPattern.test(trimmed)) {
    const m = trimmed.match(yearPattern)!;
    year = parseInt(m[1]);
  }

  if (year >= 1900 && year <= new Date().getFullYear()) {
    return Math.floor(year / 10) * 10;
  }

  return fallbackDecade;
};

export const Gallery: React.FC<GalleryProps> = ({ onSelectPhoto, selectedPhoto, onClosePhotoDetail, userSession }) => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtre
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDecade, setSelectedDecade] = useState<string>('all');
  const [selectedPersonId, setSelectedPersonId] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');

  // Modály
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Hromadné označovanie
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [bulkPeopleToUpdate, setBulkPeopleToUpdate] = useState<string[]>([]);

  // AI loading
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Formulárové stavy pre pridanie/editáciu
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    taken_at: '',
    decade: 1980,
    location: '',
    storage_path: '',
    is_external: true,
    people: [] as string[],
    tags: [] as string[]
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleBulkTagAction = async (action: 'add' | 'remove') => {
    if (selectedPhotoIds.length === 0) {
      alert('Najprv vyberte aspoň jednu fotografiu kliknutím na ňu.');
      return;
    }
    if (bulkPeopleToUpdate.length === 0) {
      alert('Vyberte aspoň jedného člena rodiny.');
      return;
    }

    try {
      setLoading(true);
      await db.bulkUpdatePhotoPeople(selectedPhotoIds, bulkPeopleToUpdate, action);
      setSelectedPhotoIds([]);
      setBulkPeopleToUpdate([]);
      await loadData();
      alert('Zmeny boli úspešne uložené.');
    } catch (e) {
      console.error('Chyba pri hromadnej úprave:', e);
      alert('Nepodarilo sa vykonať hromadnú úpravu.');
    } finally {
      setLoading(false);
    }
  };

  // Načítanie všetkých fotiek a ľudí
  const loadData = async () => {
    try {
      setLoading(true);
      const photosList = await db.getPhotos();
      const peopleList = await db.getPeople();
      setPhotos(photosList);
      setPeople(peopleList);
    } catch (e) {
      console.error('Chyba pri načítaní galérie:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Extrahuje všetky unikátne tagy z fotiek pre filter
  const getAllTags = () => {
    const tagsSet = new Set<string>();
    photos.forEach(p => {
      if (p.ai_metadata?.tags) {
        p.ai_metadata.tags.forEach(t => tagsSet.add(t));
      }
    });
    return Array.from(tagsSet);
  };

  // Filtrácia fotiek
  const filteredPhotos = photos.filter(photo => {
    // Search filter (title, description, location, tags, person name)
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      photo.title.toLowerCase().includes(query) ||
      photo.description.toLowerCase().includes(query) ||
      photo.location.toLowerCase().includes(query) ||
      (photo.ai_metadata?.tags && photo.ai_metadata.tags.some(t => t.toLowerCase().includes(query))) ||
      (photo.people && photo.people.some(pid => {
        const p = people.find(person => person.id === pid);
        return p ? p.name.toLowerCase().includes(query) : false;
      }));

    // Decade filter
    const matchesDecade = selectedDecade === 'all' || photo.decade.toString() === selectedDecade;

    // Person filter
    const matchesPerson = selectedPersonId === 'all' || (photo.people && photo.people.includes(selectedPersonId));

    // Tag filter
    const matchesTag = selectedTag === 'all' || (photo.ai_metadata?.tags && photo.ai_metadata.tags.includes(selectedTag));

    return matchesSearch && matchesDecade && matchesPerson && matchesTag;
  });

  const handleOpenAddModal = () => {
    setFormData({
      title: '',
      description: '',
      taken_at: new Date().toISOString().split('T')[0],
      decade: 1980,
      location: '',
      storage_path: '',
      is_external: true,
      people: [],
      tags: []
    });
    setSelectedFile(null);
    setAiError(null);
    setIsAddModalOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      // Vytvoríme lokálnu URL pre okamžitý náhľad
      const localUrl = URL.createObjectURL(file);
      setFormData(prev => ({
        ...prev,
        storage_path: localUrl,
        is_external: false,
        title: prev.title || file.name.split('.')[0].replace(/[-_]/g, ' ')
      }));
    }
  };

  // Spustenie AI analýzy cez Gemini
  const handleAIAnalyze = async () => {
    if (!selectedFile && !formData.storage_path) {
      setAiError('Najprv vyberte fotografiu.');
      return;
    }

    try {
      setAiAnalyzing(true);
      setAiError(null);
      let base64String = '';
      let mimeType = 'image/jpeg';

      if (selectedFile) {
        mimeType = selectedFile.type;
        base64String = await fileToBase64(selectedFile);
      } else {
        // Pre externé URL (napr. Unsplash) môžeme poslať požiadavku alebo simulovať,
        // no v klientskom JS kvôli CORS načítame obrázok cez proxy, 
        // pre jednoduchosť stiahneme obrázok a prevedieme na base64, alebo spustíme simuláciu.
        setAiAnalyzing(true);
        // Pošleme simuláciu ak ide o nepodporovaný CORS link
        await new Promise(resolve => setTimeout(resolve, 1500));
        base64String = 'MOCK_BASE64';
      }

      const aiResult = await analyzePhoto(base64String, mimeType);
      
      // Doplnenie dát z AI do formulára
      let guessedDecade = 1980;
      if (aiResult.estimated_year) {
        const match = aiResult.estimated_year.match(/\d{4}/);
        if (match) {
          guessedDecade = Math.floor(parseInt(match[0]) / 10) * 10;
        }
      }

      setFormData(prev => ({
        ...prev,
        title: prev.title || aiResult.estimated_year ? `Rodina (${aiResult.estimated_year})` : prev.title,
        description: aiResult.description,
        decade: guessedDecade,
        tags: aiResult.tags,
        taken_at: aiResult.estimated_year?.match(/\d{4}/) ? `${aiResult.estimated_year.match(/\d{4}/)![0]}-06-15` : prev.taken_at
      }));

      // Uložíme AI výsledok do metadát formulára
      (formData as any).ai_metadata = aiResult;

    } catch (e) {
      console.error(e);
      setAiError('AI analýza zlyhala. Môžete popísať fotku ručne. Skontrolujte API kľúč.');
    } finally {
      setAiAnalyzing(false);
    }
  };

  const handleAIGenerateForExisting = async () => {
    if (!selectedPhoto) return;
    try {
      setAiAnalyzing(true);
      setAiError(null);

      const aiResult = await analyzePhoto(selectedPhoto.storage_path);

      let guessedDecade = 1980;
      if (aiResult.estimated_year) {
        const match = aiResult.estimated_year.match(/\d{4}/);
        if (match) {
          guessedDecade = Math.floor(parseInt(match[0]) / 10) * 10;
        }
      }

      setFormData(prev => ({
        ...prev,
        description: aiResult.description || prev.description,
        tags: aiResult.tags || prev.tags,
        decade: guessedDecade || prev.decade,
        taken_at: prev.taken_at || (aiResult.estimated_year?.match(/\d{4}/) ? aiResult.estimated_year.match(/\d{4}/)![0] : prev.taken_at),
        location: prev.location
      }));

      // Uložíme AI výsledok do metadát formulára
      (formData as any).ai_metadata = aiResult;

      alert('Gemini AI úspešne zanalyzovala fotografiu a doplnila údaje do formulára!');
    } catch (e) {
      console.error(e);
      setAiError('Zlyhala AI analýza spomienky.');
      alert('Nepodarilo sa spustiť AI analýzu. Skontrolujte nastavenie Gemini kľúča.');
    } finally {
      setAiAnalyzing(false);
    }
  };

  const handlePeopleCheckboxChange = (personId: string) => {
    setFormData(prev => {
      const alreadyTagged = prev.people.includes(personId);
      const updated = alreadyTagged 
        ? prev.people.filter(id => id !== personId) 
        : [...prev.people, personId];
      return { ...prev, people: updated };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const dateVal = validateYearOrDate(formData.taken_at);
    if (!dateVal.isValid) {
      alert(dateVal.error);
      return;
    }

    try {
      let finalStoragePath = formData.storage_path;

      if (selectedFile) {
        // Ak máme lokálny súbor, nahráme ho do Supabase (alebo dostaneme DataURL v mock režime)
        finalStoragePath = await db.uploadPhotoFile(selectedFile);
      }

      if (!finalStoragePath) {
        alert('Chýba obrázok fotky!');
        return;
      }

      const calculatedDecade = extractDecadeFromDate(formData.taken_at, Number(formData.decade));

      const photoToSave = {
        title: formData.title || 'Bez názvu',
        description: formData.description,
        taken_at: formData.taken_at,
        decade: calculatedDecade,
        location: formData.location,
        storage_path: finalStoragePath,
        is_external: formData.is_external,
        people: formData.people,
        ai_metadata: (formData as any).ai_metadata || {
          tags: formData.tags.length > 0 ? formData.tags : ['manuálne-nahrané'],
          description: formData.description,
          detected_text: ''
        }
      };

      await db.addPhoto(photoToSave);
      setIsAddModalOpen(false);
      loadData();
    } catch (e) {
      console.error('Chyba pri ukladaní fotky:', e);
      alert('Nepodarilo sa uložiť fotografiu.');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPhoto) return;

    const dateVal = validateYearOrDate(formData.taken_at);
    if (!dateVal.isValid) {
      alert(dateVal.error);
      return;
    }

    try {
      const calculatedDecade = extractDecadeFromDate(formData.taken_at, Number(formData.decade));

      const updates = {
        title: formData.title,
        description: formData.description,
        taken_at: formData.taken_at,
        decade: calculatedDecade,
        location: formData.location,
        people: formData.people,
        ai_metadata: {
          ...selectedPhoto.ai_metadata,
          tags: formData.tags,
          description: formData.description
        } as AIAnalysisResult
      };

      const updated = await db.updatePhoto(selectedPhoto.id, updates);
      setIsEditMode(false);
      onSelectPhoto(updated); // Aktualizácia detailu
      loadData(); // Obnovenie mriežky
    } catch (e) {
      console.error('Chyba pri aktualizácii fotky:', e);
      alert('Nepodarilo sa aktualizovať údaje.');
    }
  };

  const handleDeletePhoto = async (id: string) => {
    if (window.confirm('Naozaj chcete vymazať túto fotografiu z kroniky?')) {
      try {
        await db.deletePhoto(id);
        onClosePhotoDetail();
        loadData();
      } catch (e) {
        console.error(e);
        alert('Zlyhalo vymazanie fotky.');
      }
    }
  };

  const handleEnterEditMode = () => {
    if (!selectedPhoto) return;
    setFormData({
      title: selectedPhoto.title,
      description: selectedPhoto.description,
      taken_at: selectedPhoto.taken_at,
      decade: selectedPhoto.decade,
      location: selectedPhoto.location || '',
      storage_path: selectedPhoto.storage_path,
      is_external: selectedPhoto.is_external,
      people: selectedPhoto.people || [],
      tags: selectedPhoto.ai_metadata?.tags || []
    });
    setIsEditMode(true);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Neznámy dátum';
    const trimmed = dateStr.trim().replace(/\s+/g, '');
    
    const slovakMonths = [
      'január', 'február', 'marec', 'apríl', 'máj', 'jún',
      'júl', 'august', 'september', 'október', 'november', 'december'
    ];

    const genitiveMonths = [
      'januára', 'februára', 'marca', 'apríla', 'mája', 'júna',
      'júla', 'augusta', 'septembra', 'októbra', 'novembra', 'decembra'
    ];

    try {
      // 1. Kontrola formátu DD.MM.RRRR
      const fullDatePattern = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;
      if (fullDatePattern.test(trimmed)) {
        const m = trimmed.match(fullDatePattern)!;
        const day = parseInt(m[1]);
        const monthIdx = parseInt(m[2]) - 1;
        const year = m[3];
        const monthName = genitiveMonths[monthIdx] || slovakMonths[monthIdx] || 'n/a';
        return `${day}. ${monthName} ${year}`;
      }

      // 2. Kontrola formátu MM.RRRR
      const monthYearPattern = /^(\d{1,2})\.(\d{4})$/;
      if (monthYearPattern.test(trimmed)) {
        const m = trimmed.match(monthYearPattern)!;
        const monthIdx = parseInt(m[1]) - 1;
        const year = m[2];
        return `${slovakMonths[monthIdx] || 'n/a'} ${year}`;
      }

      // 3. Kontrola formátu RRRR
      const yearPattern = /^(\d{4})$/;
      if (yearPattern.test(trimmed)) {
        return trimmed;
      }

      // 4. Starý formát fallback (ISO: YYYY-MM-DD / YYYY-MM)
      const parts = trimmed.split('-');
      if (parts.length === 3) {
        return new Date(trimmed).toLocaleDateString('sk-SK', { day: 'numeric', month: 'long', year: 'numeric' });
      } else if (parts.length === 2) {
        const [year, month] = parts;
        return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('sk-SK', { month: 'long', year: 'numeric' });
      }

      return dateStr;
    } catch {
      return dateStr;
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <div>
          <h1>Rodinný archív</h1>
          <p>Prehliadajte, filtrujte a popisujte rodinné spomienky.</p>
        </div>
        {userSession && (
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button 
              className={`btn ${isBulkMode ? 'btn-primary' : 'btn-secondary'}`} 
              onClick={() => {
                setIsBulkMode(!isBulkMode);
                setSelectedPhotoIds([]);
                setBulkPeopleToUpdate([]);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
            >
              <Users size={16} /> 
              {isBulkMode ? 'Zrušiť hromadný režim' : 'Hromadné označovanie ľudí'}
            </button>
            <button className="btn btn-primary" onClick={handleOpenAddModal}>
              <Plus size={18} /> Pridať spomienku
            </button>
          </div>
        )}
      </div>

      {/* Riadok s filtrami */}
      <div className="filter-bar">
        <div className="search-input-wrapper">
          <Search size={18} />
          <input 
            type="text" 
            placeholder="Vyhľadajte spomienku, osobu, tag alebo miesto..." 
            className="input-field"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <select 
            className="select-field"
            value={selectedDecade}
            onChange={(e) => setSelectedDecade(e.target.value)}
          >
            <option value="all">Všetky dekády</option>
            <option value="1930">1930-te roky</option>
            <option value="1940">1940-te roky</option>
            <option value="1950">1950-te roky</option>
            <option value="1960">1960-te roky</option>
            <option value="1970">1970-te roky</option>
            <option value="1980">1980-te roky</option>
            <option value="1990">1990-te roky</option>
            <option value="2000">2000-te roky</option>
            <option value="2010">2010-te roky</option>
            <option value="2020">2020-te roky</option>
          </select>

          <select 
            className="select-field"
            value={selectedPersonId}
            onChange={(e) => setSelectedPersonId(e.target.value)}
          >
            <option value="all">Všetci ľudia</option>
            {people.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <select 
            className="select-field"
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
          >
            <option value="all">Všetky tagy</option>
            {getAllTags().map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Mriežka fotiek */}
      {loading ? (
        <div className="text-center" style={{ padding: '4rem 0' }}>
          <p>Načítavam rodinný archív...</p>
        </div>
      ) : filteredPhotos.length === 0 ? (
        <div className="empty-state panel">
          <AlertCircle size={48} className="empty-state-icon" />
          <h3>Nenašli sa žiadne spomienky</h3>
          <p className="mt-4">Skúste upraviť filtre vyhľadávania alebo pridajte novú fotografiu.</p>
        </div>
      ) : (
        <div className="gallery-grid">
          {filteredPhotos.map(photo => {
            const isSelected = selectedPhotoIds.includes(photo.id);
            return (
              <div 
                key={photo.id} 
                className={`photo-card ${isBulkMode ? 'bulk-active' : ''} ${isSelected ? 'selected' : ''}`}
                onClick={() => {
                  if (isBulkMode) {
                    setSelectedPhotoIds(prev => 
                      prev.includes(photo.id) 
                        ? prev.filter(id => id !== photo.id) 
                        : [...prev, photo.id]
                    );
                  } else {
                    onSelectPhoto(photo);
                  }
                }}
                style={isSelected ? { border: '2px solid var(--accent)', boxShadow: '0 0 15px rgba(167, 139, 250, 0.4)' } : undefined}
              >
                <div className="photo-wrapper" style={{ position: 'relative' }}>
                  <img src={photo.storage_path} alt={photo.title} className="photo-img" />
                  <span className="photo-badge">{photo.decade}s</span>
                  {isBulkMode && (
                    <div style={{
                      position: 'absolute',
                      top: '0.75rem',
                      left: '0.75rem',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: isSelected ? 'var(--accent)' : 'rgba(0,0,0,0.5)',
                      border: '2px solid white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 'bold',
                      fontSize: '0.8rem',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                    }}>
                      {isSelected ? '✓' : ''}
                    </div>
                  )}
                </div>
                <div className="photo-card-info">
                  <h3 className="photo-title">{photo.title}</h3>
                  <div className="photo-meta">
                    <span>{formatDate(photo.taken_at)}</span>
                    {photo.location && (
                      <span className="photo-location">
                        <MapPin size={12} /> {photo.location}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SPOJOVACÍ PANEL HROMADNÝCH ÚPRAV */}
      {isBulkMode && (
        <div style={{
          position: 'fixed',
          bottom: '1.5rem',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(90%, 800px)',
          backgroundColor: 'rgba(23, 23, 27, 0.95)',
          border: '1px solid rgba(167, 139, 250, 0.3)',
          borderRadius: '16px',
          padding: '1.25rem',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(12px)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          color: 'white'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent)' }}>
                <Users size={16} /> Hromadné priraďovanie členov rodiny
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                Vybraných fotografií: <strong style={{ color: 'white' }}>{selectedPhotoIds.length}</strong>
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                className="btn btn-secondary" 
                style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                onClick={() => setSelectedPhotoIds(filteredPhotos.map(p => p.id))}
              >
                Vybrať všetky zobrazené
              </button>
              <button 
                className="btn btn-secondary" 
                style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                onClick={() => setSelectedPhotoIds([])}
              >
                Zrušiť výber
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Vyberte rodinu:</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', flex: 1 }}>
              {people.map(p => {
                const isChecked = bulkPeopleToUpdate.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setBulkPeopleToUpdate(prev => 
                        prev.includes(p.id) 
                          ? prev.filter(id => id !== p.id) 
                          : [...prev, p.id]
                      );
                    }}
                    className={`tag-badge ${isChecked ? 'tag-badge-accent' : ''}`}
                    style={{ 
                      cursor: 'pointer',
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.8rem',
                      backgroundColor: isChecked ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: isChecked ? 'white' : 'var(--text-primary)',
                      borderRadius: '8px'
                    }}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
            <button 
              className="btn btn-secondary"
              onClick={() => handleBulkTagAction('remove')}
              disabled={selectedPhotoIds.length === 0 || bulkPeopleToUpdate.length === 0}
              style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
            >
              Odobrať vybraných ľudí
            </button>
            <button 
              className="btn btn-primary"
              onClick={() => handleBulkTagAction('add')}
              disabled={selectedPhotoIds.length === 0 || bulkPeopleToUpdate.length === 0}
              style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
            >
              Priradiť vybraných ľudí
            </button>
          </div>
        </div>
      )}

      {/* MODÁL: PRIDANIE FOTOGRAFIE */}
      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ gridTemplateColumns: '1fr 1.2fr', maxWidth: '950px' }}>
            {/* Ľavá strana: Výber fotky a AI tlačidlo */}
            <div className="modal-photo-section" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', justifyContent: 'center' }}>
              {formData.storage_path ? (
                <div style={{ width: '100%', position: 'relative' }}>
                  <img 
                    src={formData.storage_path} 
                    alt="Náhľad" 
                    style={{ width: '100%', maxHeight: '320px', objectFit: 'contain', borderRadius: 'var(--radius-md)' }} 
                  />
                  <button 
                    type="button"
                    style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', backgroundColor: 'rgba(0,0,0,0.7)', border: 'none', color: 'white', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer' }}
                    onClick={() => {
                      setSelectedFile(null);
                      setFormData(prev => ({ ...prev, storage_path: '' }));
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <label className="upload-zone w-full">
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleFileChange} 
                    style={{ display: 'none' }} 
                  />
                  <Plus size={36} className="upload-icon" />
                  <h4>Vyberte rodinnú fotografiu</h4>
                  <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Kliknutím prehľadávajte počítač</p>
                </label>
              )}

              {/* Tlačidlo pre AI analýzu */}
              <button
                type="button"
                className="btn btn-secondary w-full"
                style={{
                  background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.25) 0%, rgba(124, 58, 237, 0.25) 100%)',
                  borderColor: 'rgba(139, 92, 246, 0.4)',
                  color: '#c084fc'
                }}
                disabled={aiAnalyzing || (!selectedFile && !formData.storage_path)}
                onClick={handleAIAnalyze}
              >
                <Brain size={18} />
                {aiAnalyzing ? 'Analyzujem s AI...' : 'Popísať s Gemini AI'}
              </button>

              {aiError && (
                <p style={{ color: 'var(--danger)', fontSize: '0.8rem', textAlign: 'center' }}>
                  {aiError}
                </p>
              )}
            </div>

            {/* Pravá strana: Formulár */}
            <form onSubmit={handleSubmit} className="modal-details-section" style={{ borderLeft: '1px solid var(--border-color)' }}>
              <div className="modal-header">
                <h2>Nová spomienka</h2>
                <button type="button" className="modal-close-btn" onClick={() => setIsAddModalOpen(false)}>
                  <X size={20} />
                </button>
              </div>

              <div className="form-group">
                <label>Názov fotografie *</label>
                <input 
                  type="text" 
                  className="input-field" 
                  style={{ paddingLeft: '1rem' }}
                  required
                  placeholder="napr. Svadobný deň Márie a Jána"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Približný dátum fotenia</label>
                  <input 
                    type="text" 
                    className="input-field"
                    style={{ paddingLeft: '1rem' }}
                    placeholder="napr. 15.06.1974, 06.1974 alebo 1974"
                    value={formData.taken_at}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData(prev => ({ 
                        ...prev, 
                        taken_at: val,
                        decade: extractDecadeFromDate(val, prev.decade)
                      }));
                    }}
                  />
                </div>

                <div className="form-group">
                  <label>Dekáda (na časovú os)</label>
                  <select 
                    className="select-field"
                    value={formData.decade}
                    onChange={(e) => setFormData(prev => ({ ...prev, decade: Number(e.target.value) }))}
                  >
                    <option value="1930">1930s</option>
                    <option value="1940">1940s</option>
                    <option value="1950">1950s</option>
                    <option value="1960">1960s</option>
                    <option value="1970">1970s</option>
                    <option value="1980">1980s</option>
                    <option value="1990">1990s</option>
                    <option value="2000">2000s</option>
                    <option value="2010">2010s</option>
                    <option value="2020">2020s</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Miesto / Lokalita</label>
                <input 
                  type="text" 
                  className="input-field"
                  style={{ paddingLeft: '1rem' }}
                  placeholder="napr. Demänovská Dolina"
                  value={formData.location}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label>Príbeh / Popis spomienky</label>
                <textarea 
                  className="textarea-field"
                  placeholder="Napíšte príbeh, okolnosti alebo detaily spomienky k tejto fotke..."
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              {/* Označenie ľudí */}
              <div className="form-group">
                <label>Kto je na fotografii?</label>
                {people.length === 0 ? (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Nemáte vytvorených žiadnych rodinných príslušníkov.</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', maxHeight: '100px', overflowY: 'auto', padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                    {people.map(p => (
                      <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={formData.people.includes(p.id)}
                          onChange={() => handlePeopleCheckboxChange(p.id)}
                        />
                        {p.name}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Tagy vygenerované z AI */}
              {formData.tags.length > 0 && (
                <div className="form-group">
                  <label>Zistené štítky (Tags)</label>
                  <div className="tag-list">
                    {formData.tags.map(tag => (
                      <span key={tag} className="tag-badge">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary w-full" onClick={() => setIsAddModalOpen(false)}>
                  Zrušiť
                </button>
                <button type="submit" className="btn btn-primary w-full">
                  Uložiť spomienku
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODÁL: DETAIL FOTOGRAFIE */}
      {selectedPhoto && (
        <div className="modal-overlay">
          <div className="modal-content">
            {/* Ľavá strana: Fotka */}
            <div className="modal-photo-section" style={{ position: 'relative' }}>
              <img id="detail-modal-photo-img" src={selectedPhoto.storage_path} alt={selectedPhoto.title} className="modal-photo-img" />
              <span className="photo-badge" style={{ top: '1rem', right: '1rem', fontSize: '0.85rem' }}>{selectedPhoto.decade}s</span>
              
              <button
                type="button"
                onClick={() => {
                  const imgEl = document.getElementById('detail-modal-photo-img');
                  if (imgEl && imgEl.requestFullscreen) {
                    imgEl.requestFullscreen().catch(() => {});
                  } else if (document.documentElement.requestFullscreen) {
                    document.documentElement.requestFullscreen().catch(() => {});
                  }
                }}
                className="btn btn-secondary"
                style={{
                  position: 'absolute',
                  bottom: '1rem',
                  left: '1rem',
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  borderColor: 'rgba(255,255,255,0.2)',
                  fontSize: '0.8rem',
                  padding: '0.4rem 0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  borderRadius: '8px'
                }}
              >
                <Maximize2 size={15} /> Celá obrazovka
              </button>
            </div>

            {/* Pravá strana: Detail alebo Editácia */}
            {!isEditMode ? (
              <div className="modal-details-section">
                <div className="modal-header">
                  <div>
                    <h2 style={{ fontSize: '1.6rem' }}>{selectedPhoto.title}</h2>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      Pridané {new Date(selectedPhoto.created_at).toLocaleDateString('sk-SK')}
                    </p>
                  </div>
                  <button className="modal-close-btn" onClick={onClosePhotoDetail}>
                    <X size={24} />
                  </button>
                </div>

                <div className="metadata-grid">
                  <div>
                    <div className="meta-item-label">Kedy</div>
                    <div className="meta-item-value">
                      <Calendar size={14} /> {formatDate(selectedPhoto.taken_at)}
                    </div>
                  </div>
                  <div>
                    <div className="meta-item-label">Kde</div>
                    <div className="meta-item-value">
                      <MapPin size={14} /> {selectedPhoto.location || 'Neznáme miesto'}
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div className="meta-item-label">Príbeh / Popis spomienky</div>
                    {userSession && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.25rem 0.5rem',
                          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(124, 58, 237, 0.15) 100%)',
                          borderColor: 'rgba(139, 92, 246, 0.3)',
                          color: '#c084fc',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}
                        disabled={aiAnalyzing}
                        onClick={async () => {
                          handleEnterEditMode();
                          setTimeout(() => {
                            handleAIGenerateForExisting();
                          }, 150);
                        }}
                        title="Spustiť Gemini AI na rozpoznanie textov, dátumu, lokality a príbehu tejto fotografie"
                      >
                        <Brain size={12} /> {aiAnalyzing ? 'Analyzujem...' : 'Doplniť cez Gemini AI'}
                      </button>
                    )}
                  </div>
                  <p style={{ color: 'var(--text-primary)', whiteSpace: 'pre-line', fontSize: '0.95rem' }}>
                    {selectedPhoto.description || 'Táto fotografia zatiaľ nemá priradený príbeh. Kliknutím na tlačidlo vyššie môžete spustiť Gemini AI analýzu.'}
                  </p>
                </div>

                {/* Označení ľudia */}
                <div>
                  <div className="meta-item-label" style={{ marginBottom: '0.5rem' }}>Na fotografii</div>
                  {selectedPhoto.people && selectedPhoto.people.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {selectedPhoto.people.map(pid => {
                        const person = people.find(p => p.id === pid);
                        return person ? (
                          <div key={pid} className="tag-badge tag-badge-accent">
                            <Users size={12} /> {person.name}
                          </div>
                        ) : null;
                      })}
                    </div>
                  ) : (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Nikto z rodiny nie je označený.</p>
                  )}
                </div>

                {/* AI Metadáta */}
                {selectedPhoto.ai_metadata && (
                  <div className="panel ai-glow-panel" style={{ padding: '1rem', marginTop: 'auto' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: '#a78bfa' }}>
                      <Brain size={16} />
                      <h4 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase' }}>Analýza Gemini AI</h4>
                    </div>
                    {selectedPhoto.ai_metadata.tags && (
                      <div className="tag-list" style={{ marginBottom: '0.75rem' }}>
                        {selectedPhoto.ai_metadata.tags.map(t => (
                          <span key={t} className="tag-badge" style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem' }}>
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    {selectedPhoto.ai_metadata.detected_text && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <strong>Rozpoznaný písaný text:</strong>
                        <p style={{ fontStyle: 'italic', marginTop: '0.25rem', color: 'white' }}>
                          "{selectedPhoto.ai_metadata.detected_text}"
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {userSession && (
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                    <button className="btn btn-danger" onClick={() => handleDeletePhoto(selectedPhoto.id)}>
                      <Trash2 size={16} /> Vymazať
                    </button>
                    <button className="btn btn-secondary" style={{ marginLeft: 'auto' }} onClick={handleEnterEditMode}>
                      <Edit size={16} /> Editovať spomienku
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Formulár na editáciu fotky */
              <form onSubmit={handleEditSubmit} className="modal-details-section">
                <div className="modal-header">
                  <h2>Editovať spomienku</h2>
                  <button type="button" className="modal-close-btn" onClick={() => setIsEditMode(false)}>
                    <X size={20} />
                  </button>
                </div>

                <div className="form-group">
                  <label>Názov fotografie *</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    style={{ paddingLeft: '1rem' }}
                    required
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Kedy (rok / dátum)</label>
                    <input 
                      type="text" 
                      className="input-field"
                      style={{ paddingLeft: '1rem' }}
                      placeholder="napr. 15.06.1974, 06.1974 alebo 1974"
                      value={formData.taken_at}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData(prev => ({ 
                          ...prev, 
                          taken_at: val,
                          decade: extractDecadeFromDate(val, prev.decade)
                        }));
                      }}
                    />
                  </div>

                  <div className="form-group">
                    <label>Dekáda</label>
                    <select 
                      className="select-field"
                      value={formData.decade}
                      onChange={(e) => setFormData(prev => ({ ...prev, decade: Number(e.target.value) }))}
                    >
                      <option value="1930">1930s</option>
                      <option value="1940">1940s</option>
                      <option value="1950">1950s</option>
                      <option value="1960">1960s</option>
                      <option value="1970">1970s</option>
                      <option value="1980">1980s</option>
                      <option value="1990">1990s</option>
                      <option value="2000">2000s</option>
                      <option value="2010">2010s</option>
                      <option value="2020">2020s</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Miesto</label>
                  <input 
                    type="text" 
                    className="input-field"
                    style={{ paddingLeft: '1rem' }}
                    value={formData.location}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  />
                </div>

                 <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <label style={{ margin: 0 }}>Príbeh / Popis spomienky</label>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.25rem 0.5rem',
                        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(124, 58, 237, 0.15) 100%)',
                        borderColor: 'rgba(139, 92, 246, 0.3)',
                        color: '#c084fc',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}
                      disabled={aiAnalyzing}
                      onClick={handleAIGenerateForExisting}
                      title="Spustiť Gemini AI na rozpoznanie textov, dátumu, lokality a príbehu tejto fotografie"
                    >
                      <Brain size={12} /> {aiAnalyzing ? 'Analyzujem...' : 'Doplniť cez Gemini AI'}
                    </button>
                  </div>
                  <textarea 
                    className="textarea-field"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Popis spomienky..."
                  />
                </div>

                <div className="form-group">
                  <label>Označiť rodinných príslušníkov</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', maxHeight: '100px', overflowY: 'auto', padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                    {people.map(p => (
                      <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={formData.people.includes(p.id)}
                          onChange={() => handlePeopleCheckboxChange(p.id)}
                        />
                        {p.name}
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                  <button type="button" className="btn btn-secondary w-full" onClick={() => setIsEditMode(false)}>
                    Zrušiť
                  </button>
                  <button type="submit" className="btn btn-primary w-full">
                    Uložiť zmeny
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
