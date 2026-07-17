import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import type { Person, Photo } from '../services/db';
import { Plus, Users, Calendar, Award, Trash2, Edit, X, FileText, AlertCircle, ArrowLeft } from 'lucide-react';

interface PeopleProps {
  onSelectPhoto: (photo: Photo) => void;
}

export const People: React.FC<PeopleProps> = ({ onSelectPhoto }) => {
  const [people, setPeople] = useState<Person[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [personPhotos, setPersonPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);

  // Formulárové stavy
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    relationship: '',
    birth_date: '',
    photo_url: '',
    bio: ''
  });

  const loadPeopleData = async () => {
    try {
      setLoading(true);
      const peopleList = await db.getPeople();
      const photosList = await db.getPhotos();
      setPeople(peopleList);
      setPhotos(photosList);

      // Aktualizovať zobrazenie vybranej osoby ak nejaká bola vybratá
      if (selectedPerson) {
        const updatedPerson = peopleList.find(p => p.id === selectedPerson.id);
        if (updatedPerson) {
          setSelectedPerson(updatedPerson);
          const pPhotos = photosList.filter(photo => photo.people?.includes(updatedPerson.id));
          setPersonPhotos(pPhotos);
        }
      }
    } catch (e) {
      console.error('Chyba pri načítaní rodiny:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPeopleData();
  }, []);

  const handleSelectPerson = (person: Person) => {
    setSelectedPerson(person);
    const pPhotos = photos.filter(photo => photo.people?.includes(person.id));
    setPersonPhotos(pPhotos);
  };

  const handleBackToList = () => {
    setSelectedPerson(null);
    setPersonPhotos([]);
    setIsEditMode(false);
  };

  const handleOpenAddModal = () => {
    setFormData({
      name: '',
      relationship: '',
      birth_date: '',
      photo_url: '',
      bio: ''
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = () => {
    if (!selectedPerson) return;
    setFormData({
      name: selectedPerson.name,
      relationship: selectedPerson.relationship || '',
      birth_date: selectedPerson.birth_date || '',
      photo_url: selectedPerson.photo_url || '',
      bio: selectedPerson.bio || ''
    });
    setIsEditMode(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const defaultAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=300';
      const personToSave = {
        name: formData.name,
        relationship: formData.relationship,
        birth_date: formData.birth_date || undefined,
        photo_url: formData.photo_url || defaultAvatar,
        bio: formData.bio
      };

      await db.addPerson(personToSave);
      setIsAddModalOpen(false);
      loadPeopleData();
    } catch (e) {
      console.error(e);
      alert('Nepodarilo sa pridať člena rodiny.');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPerson) return;
    try {
      const updates = {
        name: formData.name,
        relationship: formData.relationship,
        birth_date: formData.birth_date || undefined,
        photo_url: formData.photo_url,
        bio: formData.bio
      };

      const updated = await db.updatePerson(selectedPerson.id, updates);
      setSelectedPerson(updated);
      setIsEditMode(false);
      loadPeopleData();
    } catch (e) {
      console.error(e);
      alert('Nepodarilo sa uložiť úpravy.');
    }
  };

  const handleDeletePerson = async (id: string) => {
    if (window.confirm('Naozaj chcete vymazať tohto člena rodiny? Odstráni sa aj jeho označenie na všetkých fotografiách.')) {
      try {
        await db.deletePerson(id);
        handleBackToList();
        loadPeopleData();
      } catch (e) {
        console.error(e);
        alert('Chyba pri mazaní osoby.');
      }
    }
  };

  const formatBirthDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('sk-SK', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div>
      {/* 1. DETAIL VYBRATEJ OSOBY */}
      {selectedPerson ? (
        <div>
          <button className="btn btn-secondary" onClick={handleBackToList} style={{ marginBottom: '2rem' }}>
            <ArrowLeft size={16} /> Späť na zoznam
          </button>

          {!isEditMode ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {/* Profilová karta člena */}
              <div className="panel flex" style={{ gap: '2.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <img 
                  src={selectedPerson.photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=300'} 
                  alt={selectedPerson.name} 
                  style={{ width: '160px', height: '160px', borderRadius: '50%', objectFit: 'cover', border: '4px solid var(--accent)' }}
                />
                
                <div style={{ flexGrow: 1, minWidth: '280px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                      <h1 style={{ marginBottom: '0.25rem' }}>{selectedPerson.name}</h1>
                      <div className="tag-badge tag-badge-accent" style={{ fontSize: '0.9rem' }}>
                        <Award size={14} /> {selectedPerson.relationship || 'Člen rodiny'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button className="btn btn-danger" onClick={() => handleDeletePerson(selectedPerson.id)}>
                        <Trash2 size={16} /> Vymazať
                      </button>
                      <button className="btn btn-secondary" onClick={handleOpenEdit}>
                        <Edit size={16} /> Editovať profil
                      </button>
                    </div>
                  </div>

                  {selectedPerson.birth_date && (
                    <div style={{ marginTop: '1.25rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem' }}>
                      <Calendar size={16} /> 
                      <span>Narodený/á: <strong>{formatBirthDate(selectedPerson.birth_date)}</strong></span>
                    </div>
                  )}

                  <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '0.5rem' }}>
                      <FileText size={16} /> Životopis / Informácie
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', whiteSpace: 'pre-line' }}>
                      {selectedPerson.bio || 'K tejto osobe zatiaľ nemáme priradený životopis.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Fotky s touto osobou */}
              <div>
                <h2>Spomienky s: {selectedPerson.name} ({personPhotos.length})</h2>
                {personPhotos.length === 0 ? (
                  <div className="empty-state panel mt-4">
                    <AlertCircle size={48} className="empty-state-icon" />
                    <h3>Žiadne označené fotografie</h3>
                    <p className="mt-4">Táto osoba zatiaľ nie je označená na žiadnej fotografii v archíve.</p>
                  </div>
                ) : (
                  <div className="gallery-grid" style={{ marginTop: '1.5rem' }}>
                    {personPhotos.map(photo => (
                      <div 
                        key={photo.id} 
                        className="photo-card"
                        onClick={() => onSelectPhoto(photo)}
                      >
                        <div className="photo-wrapper">
                          <img src={photo.storage_path} alt={photo.title} className="photo-img" />
                          <span className="photo-badge">{photo.decade}s</span>
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
            </div>
          ) : (
            /* FORMULÁR PRE EDITÁCIU PROFILU */
            <form onSubmit={handleEditSubmit} className="panel max-width-600" style={{ maxWidth: '600px', margin: '0 auto' }}>
              <div className="panel-header" style={{ marginBottom: '2rem' }}>
                <h2 className="panel-title"><Edit size={20} /> Editovať profil člena rodiny</h2>
                <button type="button" className="modal-close-btn" onClick={() => setIsEditMode(false)}>
                  <X size={20} />
                </button>
              </div>

              <div className="form-group">
                <label>Meno a priezvisko *</label>
                <input 
                  type="text" 
                  className="input-field" 
                  style={{ paddingLeft: '1rem' }}
                  required
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Príbuzenský vzťah (napr. otec, sestra)</label>
                  <input 
                    type="text" 
                    className="input-field"
                    style={{ paddingLeft: '1rem' }}
                    placeholder="napr. prababička"
                    value={formData.relationship}
                    onChange={(e) => setFormData(prev => ({ ...prev, relationship: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label>Dátum narodenia</label>
                  <input 
                    type="date" 
                    className="input-field"
                    style={{ paddingLeft: '1rem' }}
                    value={formData.birth_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, birth_date: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>URL adresa profilovej fotky</label>
                <input 
                  type="text" 
                  className="input-field"
                  style={{ paddingLeft: '1rem' }}
                  placeholder="Zadajte URL odkazu na fotku alebo nechajte prázdne"
                  value={formData.photo_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, photo_url: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label>Životopis / Príbeh života</label>
                <textarea 
                  className="textarea-field"
                  placeholder="Napíšte krátky príbeh, životopis, zaujímavosti, čomu sa osoba venovala..."
                  value={formData.bio}
                  onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                />
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
      ) : (
        /* 2. HLAVNÝ ZOZNAM RODINY */
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
            <div>
              <h1>Rodokmeň a ľudia</h1>
              <p>Zoznam členov našej rodiny a ich osobné profily so spomienkami.</p>
            </div>
            <button className="btn btn-primary" onClick={handleOpenAddModal}>
              <Plus size={18} /> Pridať člena rodiny
            </button>
          </div>

          {loading ? (
            <div className="text-center" style={{ padding: '4rem 0' }}>
              <p>Načítavam zoznam rodiny...</p>
            </div>
          ) : people.length === 0 ? (
            <div className="empty-state panel">
              <Users size={48} className="empty-state-icon" />
              <h3>Zoznam je prázdny</h3>
              <p className="mt-4">Zatiaľ ste nepridali žiadnych členov rodiny. Vytvorte prvého člena rodiny tlačidlom hore.</p>
            </div>
          ) : (
            <div className="people-grid">
              {people.map(person => (
                <div 
                  key={person.id} 
                  className="person-card"
                  onClick={() => handleSelectPerson(person)}
                >
                  <img 
                    src={person.photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=300'} 
                    alt={person.name} 
                    className="person-avatar"
                  />
                  <h3 className="person-name">{person.name}</h3>
                  <span className="person-relationship">{person.relationship || 'Člen rodiny'}</span>
                  {person.birth_date && (
                    <span className="person-dates">
                      * {new Date(person.birth_date).getFullYear()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* MODÁL: PRIDANIE OSOBY */}
          {isAddModalOpen && (
            <div className="modal-overlay">
              <form onSubmit={handleSubmit} className="modal-content" style={{ display: 'flex', flexDirection: 'column', maxWidth: '550px', padding: '2rem', gap: '1.25rem' }}>
                <div className="modal-header">
                  <h2>Nový člen rodiny</h2>
                  <button type="button" className="modal-close-btn" onClick={() => setIsAddModalOpen(false)}>
                    <X size={20} />
                  </button>
                </div>

                <div className="form-group">
                  <label>Meno a priezvisko *</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    style={{ paddingLeft: '1rem' }}
                    required
                    placeholder="napr. Ján Kováč ml."
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Vzťah k rodine</label>
                    <input 
                      type="text" 
                      className="input-field"
                      style={{ paddingLeft: '1rem' }}
                      placeholder="napr. starý otec"
                      value={formData.relationship}
                      onChange={(e) => setFormData(prev => ({ ...prev, relationship: e.target.value }))}
                    />
                  </div>

                  <div className="form-group">
                    <label>Dátum narodenia</label>
                    <input 
                      type="date" 
                      className="input-field"
                      style={{ paddingLeft: '1rem' }}
                      value={formData.birth_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, birth_date: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>URL adresa profilovej fotky</label>
                  <input 
                    type="text" 
                    className="input-field"
                    style={{ paddingLeft: '1rem' }}
                    placeholder="Zadajte odkaz na fotku alebo nechajte prázdne"
                    value={formData.photo_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, photo_url: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label>Životopis / Zaujímavosti</label>
                  <textarea 
                    className="textarea-field"
                    placeholder="Čo by sme mali vedieť o jeho/jej živote? (Práca, záujmy, rodina...)"
                    value={formData.bio}
                    onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                  />
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button type="button" className="btn btn-secondary w-full" onClick={() => setIsAddModalOpen(false)}>
                    Zrušiť
                  </button>
                  <button type="submit" className="btn btn-primary w-full">
                    Uložiť profil
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
