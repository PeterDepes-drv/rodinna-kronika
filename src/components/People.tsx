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
                /* Zobrazenie Rodokmeňa (Vizuálny interaktívny strom) */
                <div className="panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '2rem 1.5rem', background: 'rgba(15, 23, 42, 0.4)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
                  <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                    <h2 style={{ color: '#a78bfa', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', margin: 0 }}>
                      <Users size={22} /> Vizuálny rodokmeň: {selectedPerson.name}
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem', margin: 0 }}>
                      Kliknutím na ľubovoľného člena rodokmeňa sa strom automaticky vycentruje a prekreslí okolo neho.
                    </p>
                  </div>

                  {/* SVG Rodokmeň Canvas s posúvaním na menších obrazovkách */}
                  <div style={{ width: '100%', overflowX: 'auto', background: 'rgba(0, 0, 0, 0.25)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ minWidth: '1000px', padding: '20px 10px' }}>
                      {(() => {
                        const father = people.find(p => p.id === selectedPerson.father_id);
                        const mother = people.find(p => p.id === selectedPerson.mother_id);
                        const spouse = people.find(p => p.id === selectedPerson.spouse_id) || people.find(p => p.spouse_id === selectedPerson.id);
                        const children = people.filter(p => p.father_id === selectedPerson.id || p.mother_id === selectedPerson.id);
                        const siblings = people.filter(p => p.id !== selectedPerson.id && (
                          (selectedPerson.father_id && p.father_id === selectedPerson.father_id) ||
                          (selectedPerson.mother_id && p.mother_id === selectedPerson.mother_id)
                        ));

                        const patGF = father ? (people.find(p => p.id === father.father_id) || null) : null;
                        const patGM = father ? (people.find(p => p.id === father.mother_id) || null) : null;
                        const matGF = mother ? (people.find(p => p.id === mother.father_id) || null) : null;
                        const matGM = mother ? (people.find(p => p.id === mother.mother_id) || null) : null;

                        const centerX = 500;
                        const spouseOffset = 90;
                        
                        const yGrandparents = 50;
                        const yParents = 170;
                        const ySelected = 290;
                        const yChildren = 410;

                        const xSelected = centerX - spouseOffset;
                        const xSpouse = centerX + spouseOffset;

                        const xFather = 320;
                        const xMother = 480;

                        const xPatGF = 160;
                        const xPatGM = 280;
                        const xMatGF = 520;
                        const xMatGM = 640;

                        const siblingXCoords = siblings.map((_, idx) => 240 - idx * 155);

                        const getChildrenX = (count: number) => {
                          if (count === 0) return [];
                          if (count === 1) return [500];
                          const spacing = 155;
                          const startX = 500 - ((count - 1) * spacing) / 2;
                          return Array.from({ length: count }, (_, i) => startX + i * spacing);
                        };
                        const childXCoords = getChildrenX(children.length);

                        const renderNodeCard = (p: Person | null, x: number, y: number, roleLabel: string, isRoot: boolean = false) => {
                          const w = 145;
                          const h = 76;
                          const left = x - w / 2;
                          const top = y - h / 2;

                          if (!p) {
                            return (
                              <foreignObject x={left} y={top} width={w} height={h} key={`${roleLabel}-${x}-${y}`}>
                                <div style={{
                                  width: '100%',
                                  height: '100%',
                                  borderRadius: '10px',
                                  border: '1px dashed rgba(255, 255, 255, 0.12)',
                                  background: 'rgba(255, 255, 255, 0.01)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: 'var(--text-muted)',
                                  fontSize: '0.72rem',
                                  textAlign: 'center',
                                  padding: '4px'
                                }}>
                                  <span style={{ fontWeight: 600, opacity: 0.4 }}>?</span>
                                  <span style={{ fontSize: '0.62rem', opacity: 0.5, marginTop: '2px' }}>{roleLabel}</span>
                                </div>
                              </foreignObject>
                            );
                          }

                          return (
                            <foreignObject x={left} y={top} width={w} height={h} key={p.id}>
                              <div 
                                onClick={() => handleSelectPerson(p)}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  borderRadius: '10px',
                                  border: isRoot ? '2px solid var(--accent)' : '1px solid rgba(255, 255, 255, 0.08)',
                                  background: isRoot 
                                    ? 'linear-gradient(135deg, rgba(124, 58, 237, 0.3) 0%, rgba(76, 29, 149, 0.4) 100%)' 
                                    : 'rgba(15, 23, 42, 0.75)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  padding: '8px',
                                  gap: '8px',
                                  cursor: 'pointer',
                                  userSelect: 'none',
                                  transition: 'transform 0.15s, border-color 0.15s, box-shadow 0.15s',
                                  boxShadow: isRoot ? '0 0 12px rgba(139, 92, 246, 0.35)' : '0 4px 6px -1px rgba(0,0,0,0.1)',
                                  overflow: 'hidden'
                                }}
                                onMouseEnter={(e) => { 
                                  e.currentTarget.style.transform = 'scale(1.04)';
                                  e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.5)';
                                  e.currentTarget.style.boxShadow = '0 0 8px rgba(167, 139, 250, 0.2)';
                                }}
                                onMouseLeave={(e) => { 
                                  e.currentTarget.style.transform = 'scale(1)';
                                  e.currentTarget.style.borderColor = isRoot ? 'var(--accent)' : 'rgba(255, 255, 255, 0.08)';
                                  e.currentTarget.style.boxShadow = isRoot ? '0 0 12px rgba(139, 92, 246, 0.35)' : 'none';
                                }}
                              >
                                <img 
                                  src={p.photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100'} 
                                  alt={p.name} 
                                  style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-color)', flexShrink: 0 }} 
                                />
                                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.name}>
                                    {p.name}
                                  </div>
                                  <div style={{ fontSize: '0.62rem', color: isRoot ? '#c084fc' : 'var(--text-secondary)', marginTop: '1px' }}>
                                    {roleLabel}
                                  </div>
                                  {p.birth_date && (
                                    <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                      * {new Date(p.birth_date).getFullYear()}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </foreignObject>
                          );
                        };

                        return (
                          <svg width="1000" height="470" viewBox="0 0 1000 470" style={{ display: 'block', margin: '0 auto' }}>
                            <defs>
                              <linearGradient id="lineGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                  <stop offset="0%" stopColor="rgba(167, 139, 250, 0.2)" />
                                  <stop offset="100%" stopColor="rgba(167, 139, 250, 0.7)" />
                              </linearGradient>
                            </defs>

                            {/* --- SPOJENIA STARÍ RODIČIA -> RODIČIA --- */}
                            {father && (patGF || patGM) && (
                              <g>
                                <line x1={xPatGF} y1={yGrandparents} x2={xPatGM} y2={yGrandparents} stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" strokeDasharray="3,3" />
                                <line x1={(xPatGF + xPatGM)/2} y1={yGrandparents} x2={(xPatGF + xPatGM)/2} y2={(yGrandparents + yParents)/2} stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
                                <line x1={(xPatGF + xPatGM)/2} y1={(yGrandparents + yParents)/2} x2={xFather} y2={(yGrandparents + yParents)/2} stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
                                <line x1={xFather} y1={(yGrandparents + yParents)/2} x2={xFather} y2={yParents - 38} stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
                              </g>
                            )}

                            {mother && (matGF || matGM) && (
                              <g>
                                <line x1={xMatGF} y1={yGrandparents} x2={xMatGM} y2={yGrandparents} stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" strokeDasharray="3,3" />
                                <line x1={(xMatGF + xMatGM)/2} y1={yGrandparents} x2={(xMatGM + xMatGF)/2} y2={(yGrandparents + yParents)/2} stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
                                <line x1={(xMatGF + xMatGM)/2} y1={(yGrandparents + yParents)/2} x2={xMother} y2={(yGrandparents + yParents)/2} stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
                                <line x1={xMother} y1={(yGrandparents + yParents)/2} x2={xMother} y2={yParents - 38} stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
                              </g>
                            )}

                            {/* --- SPOJENIA RODIČIA -> VYBRANÁ OSOBA & SÚRODENCI --- */}
                            {(father || mother) && (
                              <g>
                                <line x1={xFather} y1={yParents} x2={xMother} y2={yParents} stroke="#fb7185" strokeWidth="1.5" strokeDasharray="3,3" />
                                <text x={(xFather + xMother)/2} y={yParents + 4} textAnchor="middle" style={{ fontSize: '10px', fill: '#fb7185' }}>❤️</text>
                                
                                <line x1={(xFather + xMother)/2} y1={yParents} x2={(xFather + xMother)/2} y2={(yParents + ySelected)/2} stroke="rgba(167, 139, 250, 0.4)" strokeWidth="1.5" />
                                
                                {(() => {
                                  const childXPositions = [xSelected, ...siblingXCoords];
                                  const minX = Math.min(...childXPositions);
                                  const maxX = Math.max(...childXPositions);
                                  return (
                                    <g>
                                      <line x1={minX} y1={(yParents + ySelected)/2} x2={maxX} y2={(yParents + ySelected)/2} stroke="rgba(167, 139, 250, 0.4)" strokeWidth="1.5" />
                                      {childXPositions.map((x, i) => (
                                        <line key={i} x1={x} y1={(yParents + ySelected)/2} x2={x} y2={ySelected - 38} stroke="rgba(167, 139, 250, 0.4)" strokeWidth="1.5" />
                                      ))}
                                    </g>
                                  );
                                })()}
                              </g>
                            )}

                            {/* --- SPOJENIA VYBRANÁ OSOBA & PARTNER -> DETI --- */}
                            {
                              <g>
                                <line x1={xSelected} y1={ySelected} x2={xSpouse} y2={ySelected} stroke="#fb7185" strokeWidth="1.8" strokeDasharray="3,3" />
                                <text x={centerX} y={ySelected + 4} textAnchor="middle" style={{ fontSize: '12px', fill: '#fb7185' }}>❤️</text>
                                
                                {children.length > 0 && (
                                  <g>
                                    <line x1={centerX} y1={ySelected} x2={centerX} y2={(ySelected + yChildren)/2} stroke="rgba(16, 185, 129, 0.5)" strokeWidth="1.8" />
                                    <line x1={Math.min(...childXCoords)} y1={(ySelected + yChildren)/2} x2={Math.max(...childXCoords)} y2={(ySelected + yChildren)/2} stroke="rgba(16, 185, 129, 0.5)" strokeWidth="1.8" />
                                    {childXCoords.map((x, i) => (
                                      <line key={i} x1={x} y1={(ySelected + yChildren)/2} x2={x} y2={yChildren - 38} stroke="rgba(16, 185, 129, 0.5)" strokeWidth="1.8" />
                                    ))}
                                  </g>
                                )}
                              </g>
                            }

                            {/* --- RENDER UZLOV (KARIET) --- */}
                            {/* Generácia 1: Starí rodičia */}
                            {renderNodeCard(patGF, xPatGF, yGrandparents, 'Starý otec')}
                            {renderNodeCard(patGM, xPatGM, yGrandparents, 'Stará mama')}
                            {renderNodeCard(matGF, xMatGF, yGrandparents, 'Starý otec')}
                            {renderNodeCard(matGM, xMatGM, yGrandparents, 'Stará mama')}

                            {/* Generácia 2: Rodičia */}
                            {renderNodeCard(father || null, xFather, yParents, 'Otec')}
                            {renderNodeCard(mother || null, xMother, yParents, 'Matka')}

                            {/* Generácia 3: Vybraná osoba, partner a súrodenci */}
                            {renderNodeCard(selectedPerson, xSelected, ySelected, selectedPerson.relationship || 'Vybraná osoba', true)}
                            {renderNodeCard(spouse || null, xSpouse, ySelected, 'Partner / Manžel')}
                            {siblings.map((sib, i) => renderNodeCard(sib, siblingXCoords[i], ySelected, sib.relationship || 'Súrodenec'))}

                            {/* Generácia 4: Deti */}
                            {children.map((child, i) => renderNodeCard(child, childXCoords[i], yChildren, 'Dieťa'))}
                          </svg>
                        );
                      })()}
                    </div>
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
