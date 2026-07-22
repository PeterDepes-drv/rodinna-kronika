import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import type { Photo, Person, AIAnalysisResult, PhotoComment } from '../services/db';
import { analyzePhoto, fileToBase64, transcribeAudio, semanticSearchPhotos } from '../services/gemini';
import { Search, Plus, Calendar, MapPin, Users, Trash2, Edit, X, Brain, AlertCircle, Maximize2, Link, MessageSquare, Mic, Square, RefreshCw, Check } from 'lucide-react';

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
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [matchAllPeople, setMatchAllPeople] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string>('all');
  
  // Sémantické AI vyhľadávanie
  const [isAISearch, setIsAISearch] = useState(false);
  const [aiSearchLoading, setAiSearchLoading] = useState(false);
  const [aiSearchResultIds, setAiSearchResultIds] = useState<string[] | null>(null);

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

  // Komentáre a zdieľanie
  const [photoComments, setPhotoComments] = useState<PhotoComment[]>([]);
  const [newCommentAuthor, setNewCommentAuthor] = useState('');
  const [newCommentText, setNewCommentText] = useState('');
  const [showShareToast, setShowShareToast] = useState(false);

  // Nahrávanie zvuku a prepis reči
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [transcribedText, setTranscribedText] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [sendingStatus, setSendingStatus] = useState<string | null>(null);

  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = React.useRef<any>(null);

  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stream.getTracks().forEach(t => t.stop());
      };
      
      setAudioUrl(null);
      setAudioBlob(null);
      setTranscribedText(null);
      setRecordingDuration(0);
      setIsRecording(true);
      
      recorder.start();
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      
    } catch (err) {
      console.error('Nepodarilo sa spustiť mikrofón:', err);
      alert('Nepodarilo sa spustiť mikrofón. Uistite sa, že ste povolili prístup k mikrofónu.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  const handleTranscribeAudio = async () => {
    if (!audioBlob) return;
    try {
      setIsTranscribing(true);
      
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        try {
          const text = await transcribeAudio(base64, 'audio/webm');
          setTranscribedText(text);
        } catch (err) {
          console.error(err);
          alert('Prepis reči zlyhal: ' + (err as Error).message);
        } finally {
          setIsTranscribing(false);
        }
      };
    } catch (err) {
      console.error(err);
      setIsTranscribing(false);
    }
  };

  const handleSaveAudioAsDescription = async () => {
    if (!selectedPhoto || !transcribedText) return;
    try {
      const updated = await db.updatePhoto(selectedPhoto.id, { description: transcribedText });
      onSelectPhoto(updated);
      loadData();
      setTranscribedText(null);
      setAudioUrl(null);
      setAudioBlob(null);
      alert('Prepísaný text bol nastavený ako popis spomienky!');
    } catch (err) {
      console.error(err);
      alert('Nepodarilo sa aktualizovať popis.');
    }
  };

  const handleSaveAudioAsComment = async () => {
    if (!selectedPhoto || !transcribedText || !audioBlob) return;
    try {
      let finalAudioUrl: string | undefined = undefined;
      setSendingStatus('Ukladám nahrávku...');
      try {
        finalAudioUrl = await db.uploadAudioFile(audioBlob);
      } catch (err) {
        console.warn('Nepodarilo sa nahrať audio súbor do úložiska. Komentár sa uloží len ako text.', err);
      }
      
      const author = newCommentAuthor.trim() || (userSession ? userSession.email.split('@')[0] : 'Starý rodič');
      const text = transcribedText;
      
      const added = await db.addComment(selectedPhoto.id, author, text, finalAudioUrl);
      setPhotoComments(prev => [...prev, added]);
      setTranscribedText(null);
      setAudioUrl(null);
      setAudioBlob(null);
      setSendingStatus(null);
      alert('Hlasová spomienka bola uložená ako komentár!');
    } catch (err) {
      console.error(err);
      setSendingStatus(null);
      alert('Nepodarilo sa uložiť komentár.');
    }
  };

  const loadPhotoComments = async (photoId: string) => {
    try {
      const comments = await db.getComments(photoId);
      setPhotoComments(comments);
    } catch (e) {
      console.warn('Nepodarilo sa načítať komentáre:', e);
    }
  };

  useEffect(() => {
    if (selectedPhoto) {
      loadPhotoComments(selectedPhoto.id);
      if (userSession?.email) {
        setNewCommentAuthor(userSession.email.split('@')[0]);
      } else {
        setNewCommentAuthor('');
      }
      setNewCommentText('');
    } else {
      setPhotoComments([]);
    }
  }, [selectedPhoto, userSession]);

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
      let photosList = await db.getPhotos();
      const privatePhotoIds = await db.getPrivatePhotoIds(userSession);
      if (privatePhotoIds.size > 0) {
        photosList = photosList.filter(p => !privatePhotoIds.has(p.id));
      }
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

  const handleAISearch = async () => {
    if (!searchQuery.trim()) {
      setAiSearchResultIds(null);
      return;
    }

    try {
      setAiSearchLoading(true);
      
      const metadata = photos.map(photo => ({
        id: photo.id,
        title: photo.title,
        description: photo.description || '',
        location: photo.location || '',
        taken_at: photo.taken_at || '',
        people: (photo.people || []).map(pid => {
          const p = people.find(pers => pers.id === pid);
          return p ? p.name : '';
        }).filter(Boolean),
        tags: photo.ai_metadata?.tags || [],
        detected_text: photo.ai_metadata?.detected_text || ''
      }));

      const matchingIds = await semanticSearchPhotos(searchQuery, metadata);
      setAiSearchResultIds(matchingIds);
    } catch (e) {
      console.error('Sémantické vyhľadávanie zlyhalo:', e);
      alert('Nepodarilo sa vykonať inteligentné vyhľadávanie.');
    } finally {
      setAiSearchLoading(false);
    }
  };

  useEffect(() => {
    if (!isAISearch || !searchQuery.trim()) {
      setAiSearchResultIds(null);
    }
  }, [searchQuery, isAISearch]);

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
  const getFilteredPhotos = () => {
    let basePhotos = photos;
    
    if (isAISearch && aiSearchResultIds !== null) {
      basePhotos = aiSearchResultIds
        .map(id => photos.find(p => p.id === id))
        .filter((p): p is Photo => !!p);
    }

    return basePhotos.filter(photo => {
      let matchesSearch = true;
      if (!isAISearch && searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        matchesSearch = 
          photo.title.toLowerCase().includes(query) ||
          photo.description.toLowerCase().includes(query) ||
          photo.location.toLowerCase().includes(query) ||
          !!(photo.ai_metadata?.tags && photo.ai_metadata.tags.some(t => t.toLowerCase().includes(query))) ||
          !!(photo.people && photo.people.some(pid => {
            const p = people.find(person => person.id === pid);
            return p ? p.name.toLowerCase().includes(query) : false;
          }));
      }

      // Decade filter
      const matchesDecade = selectedDecade === 'all' || photo.decade.toString() === selectedDecade;

      // Person filter
      const matchesPerson = 
        selectedPersonIds.length === 0 || 
        (photo.people && (
          matchAllPeople
            ? selectedPersonIds.every(pid => photo.people?.includes(pid))
            : selectedPersonIds.some(pid => photo.people?.includes(pid))
        ));

      // Tag filter
      const matchesTag = selectedTag === 'all' || (photo.ai_metadata?.tags && photo.ai_metadata.tags.includes(selectedTag));

      return matchesSearch && matchesDecade && matchesPerson && matchesTag;
    });
  };

  const filteredPhotos = getFilteredPhotos();

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', maxWidth: '400px' }}>
          <div className="search-input-wrapper" style={{ position: 'relative', width: '100%' }}>
            <Search size={18} />
            <input 
              type="text" 
              placeholder={isAISearch ? "Hľadajte sémanticky (napr. 'dedko v lete')..." : "Vyhľadajte spomienku, osobu, tag alebo miesto..."} 
              className="input-field"
              style={{ paddingRight: isAISearch && searchQuery.trim() ? '5.5rem' : '1.5rem' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && isAISearch) {
                  handleAISearch();
                }
              }}
            />
            {isAISearch && searchQuery.trim() && (
              <button 
                type="button" 
                onClick={handleAISearch} 
                disabled={aiSearchLoading}
                className="btn btn-primary"
                style={{ 
                  position: 'absolute', 
                  right: '0.25rem', 
                  top: '0.25rem', 
                  bottom: '0.25rem', 
                  fontSize: '0.75rem', 
                  padding: '0 0.75rem', 
                  height: 'auto', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.25rem',
                  borderRadius: '6px'
                }}
              >
                <Brain size={12} /> {aiSearchLoading ? 'Hľadám...' : 'Hľadať'}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setIsAISearch(!isAISearch)}
            className="btn"
            style={{
              fontSize: '0.75rem',
              padding: '0.25rem 0.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              alignSelf: 'flex-start',
              background: isAISearch ? 'linear-gradient(135deg, rgba(167, 139, 250, 0.15) 0%, rgba(124, 58, 237, 0.15) 100%)' : 'rgba(255, 255, 255, 0.03)',
              borderColor: isAISearch ? 'var(--accent)' : 'rgba(255,255,255,0.08)',
              color: isAISearch ? '#c084fc' : 'var(--text-secondary)',
              fontWeight: 600,
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            <Brain size={12} /> ✨ Inteligentné AI vyhľadávanie: {isAISearch ? 'ZAPNUTÉ' : 'VYPNUTÉ'}
          </button>
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

      {/* Vizuálny filter ľudí (Pokročilé filtre) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '2rem', background: 'rgba(30, 27, 75, 0.2)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.85rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Filtrovať podľa osôb (vyberte jedného alebo viacerých príbuzných):</span>
          {selectedPersonIds.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontWeight: 500 }}>
                <input 
                  type="checkbox" 
                  checked={matchAllPeople} 
                  onChange={(e) => setMatchAllPeople(e.target.checked)} 
                  style={{ cursor: 'pointer' }}
                /> 
                Zobraziť len fotky kde sú všetci naraz (AND)
              </label>
              <button className="btn btn-secondary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', height: 'auto' }} onClick={() => setSelectedPersonIds([])}>
                Vymazať filter ({selectedPersonIds.length})
              </button>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
          {people.map(p => {
            const isSelected = selectedPersonIds.includes(p.id);
            return (
              <div 
                key={p.id}
                onClick={() => {
                  if (isSelected) {
                    setSelectedPersonIds(prev => prev.filter(id => id !== p.id));
                  } else {
                    setSelectedPersonIds(prev => [...prev, p.id]);
                  }
                }}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.45rem', 
                  padding: '0.35rem 0.75rem', 
                  borderRadius: '20px', 
                  border: isSelected ? '1px solid #a78bfa' : '1px solid var(--border-color)', 
                  background: isSelected ? 'rgba(167, 139, 250, 0.2)' : 'rgba(255,255,255,0.02)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontSize: '0.8rem',
                  color: isSelected ? 'white' : 'var(--text-secondary)'
                }}
              >
                <img 
                  src={p.photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100'} 
                  alt={p.name} 
                  style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover', border: isSelected ? '1px solid #a78bfa' : '1px solid transparent' }} 
                />
                <span style={{ fontWeight: isSelected ? 600 : 400 }}>{p.name}</span>
              </div>
            );
          })}
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
          <div className="modal-content" style={{ maxWidth: '950px' }}>
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
            <form onSubmit={handleSubmit} className="modal-details-section">
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
                <div className="modal-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'flex-start' }}>
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

                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '-0.25rem' }}>
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', height: '28px' }}
                      onClick={() => {
                        const url = window.location.origin + window.location.pathname + '?photo=' + selectedPhoto.id;
                        navigator.clipboard.writeText(url);
                        setShowShareToast(true);
                        setTimeout(() => setShowShareToast(false), 2000);
                      }}
                    >
                      <Link size={12} /> Kopírovať odkaz
                    </button>
                    {showShareToast && (
                      <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>Odkaz skopírovaný!</span>
                    )}
                  </div>
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

                {/* Hlasové nahrávanie a prepis pre starých rodičov */}
                <div style={{ marginTop: '1.5rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '8px', padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <Mic size={18} style={{ color: '#fb7185' }} />
                    <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'white' }}>🎙️ Hlasové spomienky starých rodičov</h4>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    {!isRecording && !audioUrl && (
                      <button className="btn btn-secondary" onClick={startRecording} style={{ gap: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>
                        <Mic size={16} /> Spustiť nahrávanie
                      </button>
                    )}

                    {isRecording && (
                      <button className="btn btn-danger" onClick={stopRecording} style={{ gap: '0.5rem', display: 'flex', alignItems: 'center', animation: 'pulse 1.5s infinite' }}>
                        <Square size={16} /> Zastaviť ({Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')})
                      </button>
                    )}

                    {audioUrl && !isRecording && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                          <audio src={audioUrl} controls style={{ height: '36px', maxWidth: '280px' }} />
                          <button className="btn btn-secondary" onClick={startRecording} style={{ gap: '0.25rem', fontSize: '0.8rem', padding: '0.35rem 0.75rem', height: '36px' }}>
                            <RefreshCw size={14} /> Nahrať znova
                          </button>
                          <button className="btn btn-primary" onClick={handleTranscribeAudio} disabled={isTranscribing} style={{ gap: '0.25rem', fontSize: '0.8rem', padding: '0.35rem 0.75rem', height: '36px' }}>
                            <Brain size={14} /> {isTranscribing ? 'Prepisujem...' : '✨ Prepísať do textu (AI)'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {transcribedText && (
                    <div style={{ marginTop: '1rem', background: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.85rem' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Náhľad prepísaného textu:</div>
                      <p style={{ margin: 0, color: 'white', fontStyle: 'italic', fontSize: '0.9rem', lineHeight: '1.4' }}>
                        "{transcribedText}"
                      </p>
                      
                      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        {userSession && (
                          <button className="btn btn-primary" onClick={handleSaveAudioAsDescription} style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', height: '32px' }}>
                            <Check size={14} /> Nastaviť ako hlavný popis fotky
                          </button>
                        )}
                        <button className="btn btn-secondary" onClick={handleSaveAudioAsComment} style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', height: '32px' }}>
                          <MessageSquare size={14} /> Pridať ako komentár so zvukom
                        </button>
                        {sendingStatus && (
                          <span style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 600 }}>{sendingStatus}</span>
                        )}
                      </div>
                    </div>
                  )}
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
                {/* Komentáre a príbehy rodiny */}
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                    <MessageSquare size={16} /> Spomienky a komentáre ({photoComments.length})
                  </div>
                  
                  {/* Zoznam komentárov */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '180px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                    {photoComments.length === 0 ? (
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Zatiaľ žiadne komentáre. Pridajte svoju spomienku ako prvý!</p>
                    ) : (
                      photoComments.map((comment) => (
                        <div key={comment.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', padding: '0.6rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#a78bfa' }}>{comment.author_name}</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              {new Date(comment.created_at).toLocaleDateString('sk-SK', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', margin: 0, whiteSpace: 'pre-wrap' }}>{comment.comment_text}</p>
                          {comment.audio_url && (
                            <div style={{ marginTop: '0.4rem' }}>
                              <audio src={comment.audio_url} controls style={{ height: '24px', maxWidth: '220px' }} />
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Formulár pre komentár */}
                  <form 
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!newCommentAuthor.trim() || !newCommentText.trim()) return;
                      try {
                        const added = await db.addComment(selectedPhoto.id, newCommentAuthor.trim(), newCommentText.trim());
                        setPhotoComments(prev => [...prev, added]);
                        setNewCommentText('');
                      } catch (err) {
                        console.error(err);
                        alert('Nepodarilo sa pridať komentár.');
                      }
                    }} 
                    style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}
                  >
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input 
                        type="text" 
                        placeholder="Vaše meno (napr. Strýko Peter)" 
                        className="input-field" 
                        style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem', height: '32px', paddingLeft: '0.75rem' }}
                        required
                        value={newCommentAuthor}
                        disabled={!!userSession}
                        onChange={(e) => setNewCommentAuthor(e.target.value)}
                      />
                    </div>
                    <textarea 
                      placeholder="Sem napíšte svoje spomienky alebo info k fotke..." 
                      className="textarea-field" 
                      style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem', minHeight: '50px', height: '50px' }}
                      required
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                    />
                    <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-end', fontSize: '0.8rem', padding: '0.3rem 1rem', height: '32px' }}>
                      Pridať komentár
                    </button>
                  </form>
                </div>

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
