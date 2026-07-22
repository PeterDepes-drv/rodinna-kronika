import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import type { Person, Photo } from '../services/db';
import { Plus, Users, Calendar, Award, Trash2, Edit, X, FileText, AlertCircle, ArrowLeft } from 'lucide-react';

interface PeopleProps {
  onSelectPhoto: (photo: Photo) => void;
  userSession: any;
}

export const People: React.FC<PeopleProps> = ({ onSelectPhoto, userSession }) => {
  const [people, setPeople] = useState<Person[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [personPhotos, setPersonPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'profile' | 'tree'>('profile');

  // Formulárové stavy
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    relationship: '',
    birth_date: '',
    photo_url: '',
    bio: '',
    father_id: '',
    mother_id: '',
    spouse_id: ''
  });

  const loadPeopleData = async () => {
    try {
      setLoading(true);
      const peopleList = await db.getPeople();
      const photosList = await db.getPhotos();
      setPeople(peopleList);
      setPhotos(photosList);

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
    setActiveTab('profile');
  };

  const handleBackToList = () => {
    setSelectedPerson(null);
    setPersonPhotos([]);
    setIsEditMode(false);
    setActiveTab('profile');
  };

  const handleOpenAddModal = () => {
    setFormData({
      name: '',
      relationship: '',
      birth_date: '',
      photo_url: '',
      bio: '',
      father_id: '',
      mother_id: '',
      spouse_id: ''
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
      bio: selectedPerson.bio || '',
      father_id: selectedPerson.father_id || '',
      mother_id: selectedPerson.mother_id || '',
      spouse_id: selectedPerson.spouse_id || ''
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
        bio: formData.bio,
        father_id: formData.father_id || undefined,
        mother_id: formData.mother_id || undefined,
        spouse_id: formData.spouse_id || undefined
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
        bio: formData.bio,
        father_id: formData.father_id || undefined,
        mother_id: formData.mother_id || undefined,
        spouse_id: formData.spouse_id || undefined
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
              {/* Prepínanie tabov */}
              <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1px' }}>
                <button 
                  className={`btn ${activeTab === 'profile' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ borderRadius: 'var(--radius-md) var(--radius-md) 0 0', padding: '0.6rem 1.25rem' }}
                  onClick={() => setActiveTab('profile')}
                >
                  <FileText size={16} style={{ marginRight: '0.5rem' }} /> Osobné údaje a príbehy
                </button>
                <button 
                  className={`btn ${activeTab === 'tree' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ borderRadius: 'var(--radius-md) var(--radius-md) 0 0', padding: '0.6rem 1.25rem' }}
                  onClick={() => setActiveTab('tree')}
                >
                  <Users size={16} style={{ marginRight: '0.5rem' }} /> Rodokmeň (Strom vzťahov)
                </button>
              </div>

              {activeTab === 'profile' ? (
                <>
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

                        {userSession && (
                          <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button className="btn btn-danger" onClick={() => handleDeletePerson(selectedPerson.id)}>
                              <Trash2 size={16} /> Vymazať
                            </button>
                            <button className="btn btn-secondary" onClick={handleOpenEdit}>
                              <Edit size={16} /> Editovať profil
                            </button>
                          </div>
                        )}
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
                </>
              ) : (
                /* Zobrazenie Rodokmeňa (Vizuálny strom vzťahov) */
                <div className="panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem', padding: '2.5rem 1.5rem', background: 'rgba(30, 27, 75, 0.25)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
                  <h2 style={{ color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                    <Users size={22} /> Rodokmeň pre: {selectedPerson.name}
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', maxWidth: '600px', margin: '0 0 1rem 0' }}>
                    Kliknutím na príbuzného sa okamžite presuniete na jeho profil a rodokmeň.
                  </p>

                  {/* Level 1: Rodičia */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#a78bfa', marginBottom: '0.75rem' }}>Rodičia</span>
                    <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                      {/* Otec */}
                      {(() => {
                        const father = people.find(p => p.id === selectedPerson.father_id);
                        return father ? (
                          <div className="stat-card" style={{ cursor: 'pointer', border: '1px solid rgba(167, 139, 250, 0.2)', padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: '200px', background: 'rgba(255,255,255,0.02)' }} onClick={() => handleSelectPerson(father)}>
                            <img src={father.photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100'} alt={father.name} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                            <div style={{ textAlign: 'left' }}>
                              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'white' }}>{father.name}</div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Otec</div>
                            </div>
                          </div>
                        ) : (
                          <div className="stat-card" style={{ opacity: 0.4, padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: '200px', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border-color)' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontWeight: 'bold' }}>?</div>
                            <div style={{ textAlign: 'left' }}>
                              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Neznámy otec</div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Otec</div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Matka */}
                      {(() => {
                        const mother = people.find(p => p.id === selectedPerson.mother_id);
                        return mother ? (
                          <div className="stat-card" style={{ cursor: 'pointer', border: '1px solid rgba(167, 139, 250, 0.2)', padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: '200px', background: 'rgba(255,255,255,0.02)' }} onClick={() => handleSelectPerson(mother)}>
                            <img src={mother.photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100'} alt={mother.name} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                            <div style={{ textAlign: 'left' }}>
                              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'white' }}>{mother.name}</div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Matka</div>
                            </div>
                          </div>
                        ) : (
                          <div className="stat-card" style={{ opacity: 0.4, padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: '200px', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border-color)' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontWeight: 'bold' }}>?</div>
                            <div style={{ textAlign: 'left' }}>
                              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Neznáma matka</div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Matka</div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Spojovacia šípka */}
                  <div style={{ fontSize: '1.5rem', color: 'rgba(167, 139, 250, 0.4)', marginTop: '-1rem', marginBottom: '-1rem' }}>↓</div>

                  {/* Level 2: Vybraná osoba & Partner */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#fb7185', marginBottom: '0.75rem' }}>Vybraná osoba a Partner</span>
                    <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
                      
                      {/* Vybraná osoba */}
                      <div className="stat-card active-person" style={{ border: '2px solid #a78bfa', background: 'linear-gradient(135deg, rgba(46, 16, 101, 0.5) 0%, rgba(30, 27, 75, 0.5) 100%)', padding: '0.85rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: '220px', boxShadow: '0 0 15px rgba(167, 139, 250, 0.25)' }}>
                        <img src={selectedPerson.photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100'} alt={selectedPerson.name} style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #a78bfa' }} />
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'white' }}>{selectedPerson.name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#a78bfa', fontWeight: 600 }}>{selectedPerson.relationship || 'Člen rodiny'}</div>
                        </div>
                      </div>

                      {/* Ikona srdca */}
                      <div style={{ fontSize: '1.25rem', color: '#fb7185', animation: 'pulse 2s infinite' }}>❤️</div>

                      {/* Partner */}
                      {(() => {
                        const spouse = people.find(p => p.id === selectedPerson.spouse_id) || people.find(p => p.spouse_id === selectedPerson.id);
                        return spouse ? (
                          <div className="stat-card" style={{ cursor: 'pointer', border: '1px solid rgba(251, 113, 133, 0.3)', padding: '0.85rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: '220px', background: 'rgba(255,255,255,0.02)' }} onClick={() => handleSelectPerson(spouse)}>
                            <img src={spouse.photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100'} alt={spouse.name} style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} />
                            <div style={{ textAlign: 'left' }}>
                              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'white' }}>{spouse.name}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Partner / Manžel</div>
                            </div>
                          </div>
                        ) : (
                          <div className="stat-card" style={{ opacity: 0.4, padding: '0.85rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: '220px', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border-color)' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontWeight: 'bold' }}>?</div>
                            <div style={{ textAlign: 'left' }}>
                              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Nepriradený partner</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Partner / Manžel</div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Spojovacia šípka */}
                  <div style={{ fontSize: '1.5rem', color: 'rgba(167, 139, 250, 0.4)', marginTop: '-1rem', marginBottom: '-1rem' }}>↓</div>

                  {/* Level 3: Deti */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#10b981', marginBottom: '0.75rem' }}>Deti</span>
                    {(() => {
                      const children = people.filter(p => p.father_id === selectedPerson.id || p.mother_id === selectedPerson.id);
                      return children.length > 0 ? (
                        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                          {children.map(child => (
                            <div key={child.id} className="stat-card" style={{ cursor: 'pointer', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: '200px', background: 'rgba(255,255,255,0.02)' }} onClick={() => handleSelectPerson(child)}>
                              <img src={child.photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100'} alt={child.name} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                              <div style={{ textAlign: 'left' }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'white' }}>{child.name}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Dieťa</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontStyle: 'italic' }}>Zatiaľ neboli zaznamenané žiadne deti.</p>
                      );
                    })()}
                  </div>
                </div>
              )}
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

              <div className="form-row" style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <div className="form-group">
                  <label>Otec</label>
                  <select 
                    className="select-field" 
                    value={formData.father_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, father_id: e.target.value }))}
                  >
                    <option value="">-- Vyberte otca --</option>
                    {people.filter(p => p.id !== (selectedPerson?.id || '')).map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Matka</label>
                  <select 
                    className="select-field" 
                    value={formData.mother_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, mother_id: e.target.value }))}
                  >
                    <option value="">-- Vyberte matku --</option>
                    {people.filter(p => p.id !== (selectedPerson?.id || '')).map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label>Partner / Partnerka (Manžel/ka)</label>
                <select 
                  className="select-field" 
                  value={formData.spouse_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, spouse_id: e.target.value }))}
                >
                  <option value="">-- Vyberte partnera --</option>
                  {people.filter(p => p.id !== (selectedPerson?.id || '')).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
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
            {userSession && (
              <button className="btn btn-primary" onClick={handleOpenAddModal}>
                <Plus size={18} /> Pridať člena rodiny
              </button>
            )}
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

                <div className="form-row" style={{ marginTop: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                  <div className="form-group">
                    <label>Otec</label>
                    <select 
                      className="select-field" 
                      value={formData.father_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, father_id: e.target.value }))}
                    >
                      <option value="">-- Vyberte otca --</option>
                      {people.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Matka</label>
                    <select 
                      className="select-field" 
                      value={formData.mother_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, mother_id: e.target.value }))}
                    >
                      <option value="">-- Vyberte matku --</option>
                      {people.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                  <label>Partner / Partnerka (Manžel/ka)</label>
                  <select 
                    className="select-field" 
                    value={formData.spouse_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, spouse_id: e.target.value }))}
                  >
                    <option value="">-- Vyberte partnera --</option>
                    {people.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
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
