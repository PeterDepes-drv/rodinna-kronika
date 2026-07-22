import { createClient } from '@supabase/supabase-js';

// --- ROZHRANIA (Interfaces) ---

export interface AIAnalysisResult {
  estimated_year?: string;
  tags: string[];
  description: string;
  people_details?: string;
  detected_text?: string;
}

export interface Photo {
  id: string;
  title: string;
  description: string;
  taken_at: string; // Formát YYYY-MM-DD, YYYY-MM alebo YYYY
  decade: number;   // napr. 1970
  location: string;
  storage_path: string; // URL adresa obrázka (Unsplash, Google Photos alebo Supabase Storage URL)
  is_external: boolean;
  google_photo_id?: string;
  ai_metadata?: AIAnalysisResult;
  created_at: string;
  people?: string[]; // Zoznam ID označených ľudí
}

export interface PhotoComment {
  id: string;
  photo_id: string;
  author_name: string;
  comment_text: string;
  created_at: string;
  audio_url?: string;
}

export interface Person {
  id: string;
  name: string;
  birth_date?: string;
  relationship?: string;
  photo_url?: string;
  bio?: string;
  created_at?: string;
  father_id?: string;
  mother_id?: string;
  spouse_id?: string;
}

export interface Album {
  id: string;
  title: string;
  description: string;
  cover_photo_path?: string;
  created_at: string;
  is_public?: boolean;
}

export interface SupabaseConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

// --- POČIATOČNÉ MOCK DÁTA ---
const MOCK_PEOPLE: Person[] = [
  {
    id: 'p1',
    name: 'Ján Kováč st.',
    birth_date: '1928-04-12',
    relationship: 'Prastarý otec',
    photo_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=300',
    bio: 'Narodil sa v Liptovskom Mikuláši. Celý život pracoval ako stolár a miloval prácu s drevom. Bol zakladateľom našej rodinnej tradície.'
  },
  {
    id: 'p2',
    name: 'Mária Kováčová',
    birth_date: '1932-09-18',
    relationship: 'Prastará mama',
    photo_url: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?q=80&w=300',
    bio: 'Vynikajúca kuchárka, ktorej recept na vianočnú kapustnicu dodnes používame. Vychovala tri deti.'
  },
  {
    id: 'p3',
    name: 'Peter Kováč',
    birth_date: '1958-11-23',
    relationship: 'Starý otec',
    photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=300',
    bio: 'Strojný inžinier, vášnivý turista a fotograf. Väčšina starých fotografií z 70. a 80. rokov v tejto kronike pochádza z jeho archívu.'
  },
  {
    id: 'p4',
    name: 'Elena Kováčová',
    birth_date: '1961-02-05',
    relationship: 'Stará mama',
    photo_url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?q=80&w=300',
    bio: 'Učiteľka chémie na dôchodku. Miluje záhradkárstvo a čítanie historických románov.'
  }
];

const MOCK_PHOTOS: Photo[] = [
  {
    id: 'f1',
    title: 'Prastarí rodičia na lúke',
    description: 'Ján a Mária krátko po zásnubách na lúkach nad obcou Vyšná Boca. Odfotené na starý mechový fotoaparát.',
    taken_at: '1952-06-15',
    decade: 1950,
    location: 'Vyšná Boca',
    storage_path: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=1200',
    is_external: true,
    created_at: new Date('2026-01-01').toISOString(),
    people: ['p1', 'p2'],
    ai_metadata: {
      estimated_year: '1952',
      tags: ['pár', 'lúka', 'retro', 'obleky', 'príroda', 'čiernobiela'],
      description: 'Čiernobiela fotografia mladého muža a ženy stojacich na trávnatej lúke s horami v pozadí. Muž má oblečený slávnostný oblek, žena má na sebe svetlé šaty.',
      detected_text: ''
    }
  },
  {
    id: 'f2',
    title: 'Stavba rodinného domu',
    description: 'Prastarý otec Ján st. so susedmi pri betónovaní základov nového rodinného domu na Liptove. Náročná ručná práca bez ťažkých strojov.',
    taken_at: '1961-08-20',
    decade: 1960,
    location: 'Liptovský Mikuláš',
    storage_path: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?q=80&w=1200',
    is_external: true,
    created_at: new Date('2026-01-02').toISOString(),
    people: ['p1'],
    ai_metadata: {
      estimated_year: '1961',
      tags: ['stavba', 'dom', 'práca', 'muži', 'betónovanie', 'svpomocne'],
      description: 'Skupina mužov pracujúcich na stavenisku domu. Jeden z nich, prastarý otec Ján, drží lopatu a usmieva sa do objektívu. Rozostavaná drevená konštrukcia v pozadí.',
      detected_text: ''
    }
  },
  {
    id: 'f3',
    title: 'Svadobný deň Petra a Eleny',
    description: 'Svadobný portrét starých rodičov pred kostolom. Elena mala oblečené šaty, ktoré si sama ušila podľa strihu z nemeckého časopisu.',
    taken_at: '1981-10-10',
    decade: 1980,
    location: 'Ružomberok',
    storage_path: 'https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=1200',
    is_external: true,
    created_at: new Date('2026-01-03').toISOString(),
    people: ['p3', 'p4'],
    ai_metadata: {
      estimated_year: '1981',
      tags: ['svadba', 'nevesta', 'ženích', 'šaty', 'kytica', 'kostol', 'retro'],
      description: 'Farebná svadobná fotografia. Ženích v tmavom obleku s bielou košeľou a nevesta v bielych svadobných šatách s kyticou ruží v ruke.',
      detected_text: ''
    }
  },
  {
    id: 'f4',
    title: 'Spoločná rodinná opekačka',
    description: 'Letné prázdniny a opekanie slaniny v Demänovskej doline. Prastarý otec Peter hrá na gitare rodinné piesne.',
    taken_at: '1988-07-15',
    decade: 1980,
    location: 'Demänovská Dolina',
    storage_path: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?q=80&w=1200',
    is_external: true,
    created_at: new Date('2026-01-04').toISOString(),
    people: ['p1', 'p3', 'p4'],
    ai_metadata: {
      estimated_year: '1988',
      tags: ['opekačka', 'les', 'oheň', 'gitara', 'hudba', 'rodina', 'leto'],
      description: 'Rodinná skupina okolo lesného ohniska. Starý otec drží gitaru, ostatní sedia na drevených kmeňoch a spievajú. Všade navôkol sú vysoké smreky.',
      detected_text: ''
    }
  }
];

const MOCK_ALBUMS: Album[] = [
  {
    id: 'a1',
    title: 'Naše korene (1950 - 1970)',
    description: 'Najstaršie zachované rodinné fotografie z obdobia svadby prastarých rodičov, stavby domu a detstva ich detí.',
    cover_photo_path: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=600',
    created_at: new Date('2026-01-01').toISOString()
  },
  {
    id: 'a2',
    title: 'Zlaté osemdesiate roky',
    description: 'Fotografie z výletov, svadby starých rodičov a rodinných osláv na chate.',
    cover_photo_path: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?q=80&w=600',
    created_at: new Date('2026-01-02').toISOString()
  }
];

const MOCK_ALBUM_PHOTOS: Record<string, string[]> = {
  'a1': ['f1', 'f2'],
  'a2': ['f3', 'f4']
};

// --- POMOCNÉ FUNKCIE COMPRESS ---
export function compressImageDataUrl(dataUrl: string, maxWidth = 1600, maxHeight = 1600, quality = 0.8): Promise<string> {
  return new Promise((resolve) => {
    if (!dataUrl || !dataUrl.startsWith('data:image')) {
      return resolve(dataUrl);
    }
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxWidth || height > maxHeight) {
        if (width > height) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } else {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

const GLOBAL_SUPABASE_URL = 'https://hqfbfqfynvisnhadzmgb.supabase.co';
const GLOBAL_SUPABASE_KEY = 'sb_publishable_1vNsq6q08bM5hflzol9CoQ_OBWWFFsT';

// --- BEŽECKÉ NASTAVENIE DATABÁZY ---
class DatabaseService {
  private supabase: any = null;
  private isUsingSupabase = false;

  constructor() {
    this.initClient();
  }

  // Inicializácia klienta na základe hodnôt v LocalStorage, env alebo globálnej konfigurácii
  public initClient() {
    let url = import.meta.env.VITE_SUPABASE_URL || GLOBAL_SUPABASE_URL;
    let key = import.meta.env.VITE_SUPABASE_ANON_KEY || GLOBAL_SUPABASE_KEY;

    // Skúsime načítať vlastnú konfiguráciu z LocalStorage ak existuje
    const storedConfig = localStorage.getItem('supabase_config');
    if (storedConfig) {
      try {
        const parsed = JSON.parse(storedConfig) as SupabaseConfig;
        if (parsed.supabaseUrl && parsed.supabaseAnonKey) {
          url = parsed.supabaseUrl;
          key = parsed.supabaseAnonKey;
        }
      } catch (e) {
        console.error('Chyba pri načítaní Supabase konfigurácie z localStorage', e);
      }
    }

    if (url && key) {
      try {
        this.supabase = createClient(url, key);
        this.isUsingSupabase = true;
        console.log('Supabase klient bol úspešne pripojený k centrálnej cloudovej databáze.');
      } catch (e) {
        console.error('Zlyhala inicializácia Supabase klienta. Prechádzam na lokálny režim.', e);
        this.isUsingSupabase = false;
      }
    } else {
      console.log('Chýbajú Supabase prihlasovacie údaje. Aplikácia beží v LOKÁLNOM REŽIME.');
      this.isUsingSupabase = false;
      this.initLocalStorageMock();
    }
  }

  private initLocalStorageMock() {
    if (!localStorage.getItem('kronika_photos')) {
      localStorage.setItem('kronika_photos', JSON.stringify(MOCK_PHOTOS));
    }
    if (!localStorage.getItem('kronika_people')) {
      localStorage.setItem('kronika_people', JSON.stringify(MOCK_PEOPLE));
    }
    if (!localStorage.getItem('kronika_albums')) {
      localStorage.setItem('kronika_albums', JSON.stringify(MOCK_ALBUMS));
    }
    if (!localStorage.getItem('kronika_album_photos')) {
      localStorage.setItem('kronika_album_photos', JSON.stringify(MOCK_ALBUM_PHOTOS));
    }
  }

  public getStatus(): { connected: boolean; mode: 'SUPABASE' | 'LOCAL' } {
    return {
      connected: this.isUsingSupabase,
      mode: this.isUsingSupabase ? 'SUPABASE' : 'LOCAL'
    };
  }

  // --- METÓDY PRE FOTOGRAFIE (Photos) ---

  async getPhotos(): Promise<Photo[]> {
    if (this.isUsingSupabase) {
      const { data, error } = await this.supabase
        .from('photos')
        .select('*')
        .order('taken_at', { ascending: false });

      if (error) throw error;
      
      // Získame aj označených ľudí pre každú fotku
      const photos = data as Photo[];
      for (const photo of photos) {
        const { data: peopleData, error: peopleErr } = await this.supabase
          .from('photo_people')
          .select('person_id')
          .eq('photo_id', photo.id);
        
        if (!peopleErr && peopleData) {
          photo.people = peopleData.map((pd: any) => pd.person_id);
        }
      }
      return photos;
    } else {
      const local = localStorage.getItem('kronika_photos');
      return local ? JSON.parse(local) : [];
    }
  }

  async addPhoto(photo: Omit<Photo, 'id' | 'created_at'>): Promise<Photo> {
    let storagePath = photo.storage_path;
    if (storagePath && storagePath.startsWith('data:image')) {
      try {
        storagePath = await compressImageDataUrl(storagePath, 1600, 1600, 0.8);
      } catch (e) {
        console.warn('Kompresia obrázka zlyhala:', e);
      }
    }

    const newId = 'f_' + Math.random().toString(36).substr(2, 9);
    const newPhoto: Photo = {
      ...photo,
      storage_path: storagePath,
      id: newId,
      created_at: new Date().toISOString()
    };

    if (this.isUsingSupabase) {
      const { people, ...dbPhoto } = newPhoto as any;
      const { data, error } = await this.supabase
        .from('photos')
        .insert([dbPhoto])
        .select();

      if (error) throw error;
      const insertedPhoto = data[0] as Photo;

      // Vložíme označených ľudí
      if (people && people.length > 0) {
        const relations = people.map((personId: string) => ({
          photo_id: insertedPhoto.id,
          person_id: personId
        }));
        await this.supabase.from('photo_people').insert(relations);
        insertedPhoto.people = people;
      }
      return insertedPhoto;
    } else {
      const photos = await this.getPhotos();
      photos.push(newPhoto);
      
      try {
        localStorage.setItem('kronika_photos', JSON.stringify(photos));
      } catch (quotaError) {
        console.warn('LocalStorage Quota Exceeded. Safely compressing storage payload to fit.');
        // Bezpečné orezanie starých veľkých náhľadov pre záchranu pamäte
        const compactPhotos = photos.map(p => ({
          ...p,
          storage_path: p.storage_path.length > 200000 ? p.storage_path.substring(0, 100) : p.storage_path
        }));
        try {
          localStorage.setItem('kronika_photos', JSON.stringify(compactPhotos));
        } catch {}
      }
      return newPhoto;
    }
  }

  async updatePhoto(id: string, updates: Partial<Omit<Photo, 'id' | 'created_at'>>): Promise<Photo> {
    if (this.isUsingSupabase) {
      const { people, ...dbUpdates } = updates as any;
      const { data, error } = await this.supabase
        .from('photos')
        .update(dbUpdates)
        .eq('id', id)
        .select();

      if (error) throw error;

      if (people !== undefined) {
        // Vymazať staré relácie
        await this.supabase.from('photo_people').delete().eq('photo_id', id);
        // Vložiť nové
        if (people.length > 0) {
          const relations = people.map((personId: string) => ({
            photo_id: id,
            person_id: personId
          }));
          await this.supabase.from('photo_people').insert(relations);
        }
      }

      const updated = data[0] as Photo;
      updated.people = people;
      return updated;
    } else {
      const photos = await this.getPhotos();
      const idx = photos.findIndex(p => p.id === id);
      if (idx === -1) throw new Error('Fotografia nebola nájdená.');
      const updatedPhoto = { ...photos[idx], ...updates };
      photos[idx] = updatedPhoto;
      localStorage.setItem('kronika_photos', JSON.stringify(photos));
      return updatedPhoto;
    }
  }

  async bulkUpdatePhotoPeople(photoIds: string[], personIds: string[], action: 'add' | 'remove'): Promise<void> {
    if (this.isUsingSupabase) {
      for (const photoId of photoIds) {
        // Získanie súčasných relácií pre danú fotografiu
        const { data: currentRelations } = await this.supabase
          .from('photo_people')
          .select('person_id')
          .eq('photo_id', photoId);
          
        const currentPersonIds = currentRelations ? currentRelations.map((r: any) => r.person_id) : [];
        
        let newPersonIds = [...currentPersonIds];
        if (action === 'add') {
          personIds.forEach(pid => {
            if (!newPersonIds.includes(pid)) {
              newPersonIds.push(pid);
            }
          });
        } else {
          newPersonIds = newPersonIds.filter(pid => !personIds.includes(pid));
        }
        
        // Vymazať relácie
        await this.supabase.from('photo_people').delete().eq('photo_id', photoId);
        
        // Vložiť znova
        if (newPersonIds.length > 0) {
          const relations = newPersonIds.map((pid: string) => ({
            photo_id: photoId,
            person_id: pid
          }));
          await this.supabase.from('photo_people').insert(relations);
        }
      }
    } else {
      const photos = await this.getPhotos();
      const updatedPhotos = photos.map(p => {
        if (photoIds.includes(p.id)) {
          let newPeople = p.people ? [...p.people] : [];
          if (action === 'add') {
            personIds.forEach(pid => {
              if (!newPeople.includes(pid)) newPeople.push(pid);
            });
          } else {
            newPeople = newPeople.filter(pid => !personIds.includes(pid));
          }
          return { ...p, people: newPeople };
        }
        return p;
      });
      localStorage.setItem('kronika_photos', JSON.stringify(updatedPhotos));
    }
  }

  async deletePhoto(id: string): Promise<void> {
    if (this.isUsingSupabase) {
      const { error } = await this.supabase.from('photos').delete().eq('id', id);
      if (error) throw error;
    } else {
      let photos = await this.getPhotos();
      photos = photos.filter(p => p.id !== id);
      localStorage.setItem('kronika_photos', JSON.stringify(photos));

      // Vymazať aj z albumov
      const albumPhotos = localStorage.getItem('kronika_album_photos');
      if (albumPhotos) {
        const parsed = JSON.parse(albumPhotos) as Record<string, string[]>;
        Object.keys(parsed).forEach(albumId => {
          parsed[albumId] = parsed[albumId].filter(pid => pid !== id);
        });
        localStorage.setItem('kronika_album_photos', JSON.stringify(parsed));
      }
    }
  }

  // Nahrávanie reálneho súboru (len pre Supabase)
  async uploadPhotoFile(file: File): Promise<string> {
    if (!this.isUsingSupabase) {
      // V lokálnom režime vygenerujeme lokálnu DataURL pre náhľad
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.readAsDataURL(file);
      });
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    const filePath = `uploads/${fileName}`;

    const { error: uploadError } = await this.supabase.storage
      .from('photos')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = this.supabase.storage
      .from('photos')
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  // --- METÓDY PRE ĽUDÍ (People) ---

  async getPeople(): Promise<Person[]> {
    if (this.isUsingSupabase) {
      const { data, error } = await this.supabase
        .from('people')
        .select('*')
        .order('name');
      if (error) throw error;

      const localRelsRaw = localStorage.getItem('kronika_local_relationships');
      const localRels = localRelsRaw ? JSON.parse(localRelsRaw) : {};

      const people = (data as Person[]).map(p => {
        if (localRels[p.id]) {
          return {
            ...p,
            father_id: p.father_id || localRels[p.id].father_id,
            mother_id: p.mother_id || localRels[p.id].mother_id,
            spouse_id: p.spouse_id || localRels[p.id].spouse_id
          };
        }
        return p;
      });
      return people;
    } else {
      const local = localStorage.getItem('kronika_people');
      return local ? JSON.parse(local) : [];
    }
  }

  async addPerson(person: Omit<Person, 'id'>): Promise<Person> {
    const newId = 'p_' + Math.random().toString(36).substr(2, 9);
    const newPerson: Person = {
      ...person,
      id: newId,
      created_at: new Date().toISOString()
    };

    if (this.isUsingSupabase) {
      try {
        const { data, error } = await this.supabase
          .from('people')
          .insert([newPerson])
          .select();
        if (error) throw error;
        return data[0] as Person;
      } catch (err) {
        console.warn('Nepodarilo sa uložiť vzťahy do Supabase. Ukladám lokálne...', err);
        const { father_id, mother_id, spouse_id, ...supabasePerson } = newPerson as any;
        const { data, error } = await this.supabase
          .from('people')
          .insert([supabasePerson])
          .select();
        if (error) throw error;

        const localRelsRaw = localStorage.getItem('kronika_local_relationships');
        const localRels = localRelsRaw ? JSON.parse(localRelsRaw) : {};
        localRels[newId] = { father_id, mother_id, spouse_id };
        localStorage.setItem('kronika_local_relationships', JSON.stringify(localRels));

        return { ...data[0], father_id, mother_id, spouse_id } as Person;
      }
    } else {
      const people = await this.getPeople();
      people.push(newPerson);
      localStorage.setItem('kronika_people', JSON.stringify(people));
      return newPerson;
    }
  }

  async updatePerson(id: string, updates: Partial<Omit<Person, 'id'>>): Promise<Person> {
    if (this.isUsingSupabase) {
      try {
        const { data, error } = await this.supabase
          .from('people')
          .update(updates)
          .eq('id', id)
          .select();
        if (error) throw error;
        return data[0] as Person;
      } catch (err) {
        console.warn('Nepodarilo sa aktualizovať vzťahy v Supabase. Ukladám lokálne...', err);
        const { father_id, mother_id, spouse_id, ...supabaseUpdates } = updates as any;
        const { data, error } = await this.supabase
          .from('people')
          .update(supabaseUpdates)
          .eq('id', id)
          .select();
        if (error) throw error;

        const localRelsRaw = localStorage.getItem('kronika_local_relationships');
        const localRels = localRelsRaw ? JSON.parse(localRelsRaw) : {};
        localRels[id] = {
          ...localRels[id],
          father_id: father_id !== undefined ? father_id : localRels[id]?.father_id,
          mother_id: mother_id !== undefined ? mother_id : localRels[id]?.mother_id,
          spouse_id: spouse_id !== undefined ? spouse_id : localRels[id]?.spouse_id
        };
        localStorage.setItem('kronika_local_relationships', JSON.stringify(localRels));

        return {
          ...data[0],
          father_id: father_id !== undefined ? father_id : localRels[id]?.father_id,
          mother_id: mother_id !== undefined ? mother_id : localRels[id]?.mother_id,
          spouse_id: spouse_id !== undefined ? spouse_id : localRels[id]?.spouse_id
        } as Person;
      }
    } else {
      const people = await this.getPeople();
      const idx = people.findIndex(p => p.id === id);
      if (idx === -1) throw new Error('Osoba nebola nájdená.');
      const updatedPerson = { ...people[idx], ...updates };
      people[idx] = updatedPerson;
      localStorage.setItem('kronika_people', JSON.stringify(people));
      return updatedPerson;
    }
  }

  async deletePerson(id: string): Promise<void> {
    if (this.isUsingSupabase) {
      const { error } = await this.supabase.from('people').delete().eq('id', id);
      if (error) throw error;
    } else {
      let people = await this.getPeople();
      people = people.filter(p => p.id !== id);
      localStorage.setItem('kronika_people', JSON.stringify(people));

      // Odstrániť označenie z fotiek
      const photos = await this.getPhotos();
      photos.forEach(photo => {
        if (photo.people) {
          photo.people = photo.people.filter(pid => pid !== id);
        }
      });
      localStorage.setItem('kronika_photos', JSON.stringify(photos));
    }
  }

  // --- METÓDY PRE ALBUMY (Albums) ---

  async getAlbums(): Promise<Album[]> {
    if (this.isUsingSupabase) {
      const { data, error } = await this.supabase
        .from('albums')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      
      const processed = (data || []).map((album: any) => {
        const isPrivateDesc = album.description && album.description.startsWith('[PRIVATE_ALBUM]');
        return {
          ...album,
          is_public: album.is_public !== undefined ? album.is_public : !isPrivateDesc
        } as Album;
      });
      return processed;
    } else {
      const local = localStorage.getItem('kronika_albums');
      const parsed = local ? JSON.parse(local) as Album[] : [];
      return parsed.map(album => {
        const isPrivateDesc = album.description && album.description.startsWith('[PRIVATE_ALBUM]');
        return {
          ...album,
          is_public: album.is_public !== undefined ? album.is_public : !isPrivateDesc
        };
      });
    }
  }

  async getAlbumPhotos(albumId: string): Promise<Photo[]> {
    if (this.isUsingSupabase) {
      try {
        const { data, error } = await this.supabase
          .from('album_photos')
          .select('photo_id, photos(*)')
          .eq('album_id', albumId);
        
        if (error) throw error;
        return (data || []).map((d: any) => d.photos).filter(Boolean) as Photo[];
      } catch (e) {
        console.error('Chyba pri načítaní fotiek albumu:', e);
        return [];
      }
    } else {
      const albumPhotos = localStorage.getItem('kronika_album_photos');
      if (!albumPhotos) return [];
      const parsed = JSON.parse(albumPhotos) as Record<string, string[]>;
      const photoIds = parsed[albumId] || [];
      const photos = await this.getPhotos();
      return photoIds
        .map(id => photos.find(p => p.id === id))
        .filter((p): p is Photo => !!p);
    }
  }

  async getPrivatePhotoIds(userSession: any): Promise<Set<string>> {
    const privateSet = new Set<string>();
    if (userSession) return privateSet;

    try {
      const albums = await this.getAlbums();
      const privateAlbums = albums.filter(album => album.is_public === false || album.description?.startsWith('[PRIVATE_ALBUM]'));
      const publicAlbums = albums.filter(album => album.is_public !== false && !album.description?.startsWith('[PRIVATE_ALBUM]'));

      let albumPhotosMap: Record<string, string[]> = {};
      if (this.isUsingSupabase) {
        const { data, error } = await this.supabase.from('album_photos').select('*');
        if (!error && data) {
          data.forEach((row: any) => {
            if (!albumPhotosMap[row.album_id]) albumPhotosMap[row.album_id] = [];
            albumPhotosMap[row.album_id].push(row.photo_id);
          });
        }
      } else {
        const raw = localStorage.getItem('kronika_album_photos');
        if (raw) albumPhotosMap = JSON.parse(raw);
      }

      const privatePhotoIds = new Set<string>();
      privateAlbums.forEach(album => {
        const pIds = albumPhotosMap[album.id] || [];
        pIds.forEach(id => privatePhotoIds.add(id));
      });

      const publicPhotoIds = new Set<string>();
      publicAlbums.forEach(album => {
        const pIds = albumPhotosMap[album.id] || [];
        pIds.forEach(id => publicPhotoIds.add(id));
      });

      privatePhotoIds.forEach(id => {
        if (!publicPhotoIds.has(id)) {
          privateSet.add(id);
        }
      });
    } catch (e) {
      console.error('Chyba pri zisťovaní súkromných fotiek:', e);
    }

    return privateSet;
  }

  async addAlbum(title: string, description: string, isPublic: boolean = true): Promise<Album> {
    const newId = 'a_' + Math.random().toString(36).substr(2, 9);
    const newAlbum: Album = {
      id: newId,
      title,
      description: isPublic ? description : '[PRIVATE_ALBUM]' + description,
      created_at: new Date().toISOString(),
      is_public: isPublic
    };

    if (this.isUsingSupabase) {
      try {
        const { data, error } = await this.supabase
          .from('albums')
          .insert([newAlbum])
          .select();
        if (error) throw error;
        return data[0] as Album;
      } catch (err) {
        console.warn('Nepodarilo sa vložiť is_public stĺpec do Supabase. Skúšam fallback...', err);
        const { is_public, ...omittedAlbum } = newAlbum;
        const { data, error } = await this.supabase
          .from('albums')
          .insert([omittedAlbum])
          .select();
        if (error) throw error;
        return { ...data[0], is_public: isPublic } as Album;
      }
    } else {
      const albums = await this.getAlbums();
      albums.push(newAlbum);
      localStorage.setItem('kronika_albums', JSON.stringify(albums));

      const albumPhotos = localStorage.getItem('kronika_album_photos') 
        ? JSON.parse(localStorage.getItem('kronika_album_photos')!) 
        : {};
      albumPhotos[newId] = [];
      localStorage.setItem('kronika_album_photos', JSON.stringify(albumPhotos));

      return newAlbum;
    }
  }

  async addPhotoToAlbum(albumId: string, photoId: string): Promise<void> {
    if (this.isUsingSupabase) {
      const { error } = await this.supabase.from('album_photos').insert([{
        album_id: albumId,
        photo_id: photoId
      }]);
      
      if (error && !error.message?.includes('duplicate')) {
        console.error('Chyba pridania fotky do albumu v Supabase:', error);
      }

      // Nastaviť prvú fotku ako titulku albumu (ak nie je nastavená)
      try {
        const { data: album } = await this.supabase.from('albums').select('cover_photo_path').eq('id', albumId).single();
        if (album && !album.cover_photo_path) {
          const { data: photo } = await this.supabase.from('photos').select('storage_path').eq('id', photoId).single();
          if (photo) {
            await this.supabase.from('albums').update({ cover_photo_path: photo.storage_path }).eq('id', albumId);
          }
        }
      } catch (e) {
        console.warn('Titulný obrázok sa nepodarilo nastaviť:', e);
      }
    } else {
      const albumPhotos = JSON.parse(localStorage.getItem('kronika_album_photos') || '{}');
      if (!albumPhotos[albumId]) albumPhotos[albumId] = [];
      if (!albumPhotos[albumId].includes(photoId)) {
        albumPhotos[albumId].push(photoId);
      }
      localStorage.setItem('kronika_album_photos', JSON.stringify(albumPhotos));

      // Nastaviť cover fotku
      const albums = await this.getAlbums();
      const idx = albums.findIndex(a => a.id === albumId);
      if (idx !== -1 && !albums[idx].cover_photo_path) {
        const photos = await this.getPhotos();
        const photo = photos.find(p => p.id === photoId);
        if (photo) {
          albums[idx].cover_photo_path = photo.storage_path;
          localStorage.setItem('kronika_albums', JSON.stringify(albums));
        }
      }
    }
  }

  async removePhotoFromAlbum(albumId: string, photoId: string): Promise<void> {
    if (this.isUsingSupabase) {
      await this.supabase.from('album_photos').delete().eq('album_id', albumId).eq('photo_id', photoId);
    } else {
      const albumPhotos = JSON.parse(localStorage.getItem('kronika_album_photos') || '{}');
      if (albumPhotos[albumId]) {
        albumPhotos[albumId] = albumPhotos[albumId].filter((id: string) => id !== photoId);
      }
      localStorage.setItem('kronika_album_photos', JSON.stringify(albumPhotos));
    }
  }

  async deleteAlbum(id: string): Promise<void> {
    if (this.isUsingSupabase) {
      await this.supabase.from('albums').delete().eq('id', id);
    } else {
      let albums = await this.getAlbums();
      albums = albums.filter(a => a.id !== id);
      localStorage.setItem('kronika_albums', JSON.stringify(albums));

      const albumPhotos = JSON.parse(localStorage.getItem('kronika_album_photos') || '{}');
      delete albumPhotos[id];
      localStorage.setItem('kronika_album_photos', JSON.stringify(albumPhotos));
    }
  }

  // --- METÓDY PRE KOMENTÁRE (Comments) ---
  async getComments(photoId: string): Promise<PhotoComment[]> {
    if (this.isUsingSupabase) {
      try {
        const { data, error } = await this.supabase
          .from('comments')
          .select('*')
          .eq('photo_id', photoId)
          .order('created_at', { ascending: true });
        if (error) throw error;
        return data as PhotoComment[];
      } catch (err) {
        console.warn('Nepodarilo sa stiahnuť komentáre zo Supabase. Načítavam lokálne...', err);
      }
    }
    
    const localComments = localStorage.getItem('kronika_comments');
    if (localComments) {
      const parsed = JSON.parse(localComments) as PhotoComment[];
      return parsed.filter(c => c.photo_id === photoId).sort((a, b) => a.created_at.localeCompare(b.created_at));
    }
    return [];
  }

  async uploadAudioFile(blob: Blob): Promise<string> {
    if (!this.isUsingSupabase) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    }

    const fileExt = 'webm';
    const fileName = `audio-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    const filePath = `uploads/audio/${fileName}`;

    const { error: uploadError } = await this.supabase.storage
      .from('photos')
      .upload(filePath, blob, {
        contentType: 'audio/webm'
      });

    if (uploadError) throw uploadError;

    const { data } = this.supabase.storage
      .from('photos')
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  async addComment(photoId: string, authorName: string, commentText: string, audioUrl?: string): Promise<PhotoComment> {
    const newComment: PhotoComment = {
      id: 'c_' + Math.random().toString(36).substr(2, 9),
      photo_id: photoId,
      author_name: authorName,
      comment_text: commentText,
      created_at: new Date().toISOString(),
      audio_url: audioUrl
    };

    if (this.isUsingSupabase) {
      try {
        const { data, error } = await this.supabase
          .from('comments')
          .insert([newComment])
          .select();
        if (error) throw error;
        return data[0] as PhotoComment;
      } catch (err) {
        console.warn('Nepodarilo sa vložiť komentár s audio_url do Supabase (chýba stĺpec). Skúšam fallback...', err);
        const { audio_url, ...omittedComment } = newComment;
        let fallbackText = commentText;
        if (audioUrl) {
          fallbackText += `\n\n🔊 Hlasová nahrávka: ${audioUrl}`;
        }
        try {
          const { data, error } = await this.supabase
            .from('comments')
            .insert([{ ...omittedComment, comment_text: fallbackText }])
            .select();
          if (error) throw error;
          return { ...data[0], audio_url: audioUrl } as PhotoComment;
        } catch (retryErr) {
          console.error('Zlyhalo aj náhradné uloženie do Supabase. Ukladám lokálne...', retryErr);
        }
      }
    }

    const localCommentsRaw = localStorage.getItem('kronika_comments');
    const localComments = localCommentsRaw ? JSON.parse(localCommentsRaw) : [];
    localComments.push(newComment);
    localStorage.setItem('kronika_comments', JSON.stringify(localComments));
    return newComment;
  }

  // --- KOPÍROVANIE / NÁHRADA LOKÁLNYCH DÁT ZA SUPABASE ---
  async exportBackup(): Promise<string> {
    const photos = await this.getPhotos();
    const people = await this.getPeople();
    const albums = await this.getAlbums();
    
    let albumPhotos: Record<string, string[]> = {};
    if (this.isUsingSupabase) {
      for (const album of albums) {
        const pList = await this.getAlbumPhotos(album.id);
        albumPhotos[album.id] = pList.map(p => p.id);
      }
    } else {
      albumPhotos = JSON.parse(localStorage.getItem('kronika_album_photos') || '{}');
    }

    let comments: PhotoComment[] = [];
    if (this.isUsingSupabase) {
      try {
        const { data } = await this.supabase.from('comments').select('*');
        if (data) comments = data as PhotoComment[];
      } catch {
        // ignore
      }
    }
    const localCommentsRaw = localStorage.getItem('kronika_comments');
    const localComments = localCommentsRaw ? JSON.parse(localCommentsRaw) : [];
    const combinedComments = [...comments];
    localComments.forEach((lc: PhotoComment) => {
      if (!combinedComments.some(cc => cc.id === lc.id)) {
        combinedComments.push(lc);
      }
    });

    const backup = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      photos,
      people,
      albums,
      albumPhotos,
      comments: combinedComments
    };

    return JSON.stringify(backup, null, 2);
  }

  async importBackup(backupJson: string): Promise<void> {
    try {
      const backup = JSON.parse(backupJson);
      if (!backup.photos || !backup.people || !backup.albums) {
        throw new Error('Neplatný zálohovací súbor.');
      }

      if (this.isUsingSupabase) {
        throw new Error('Import do živej databázy Supabase cez zálohu nie je momentálne podporovaný priamo z UI. Použite lokálny režim.');
      } else {
        localStorage.setItem('kronika_photos', JSON.stringify(backup.photos));
        localStorage.setItem('kronika_people', JSON.stringify(backup.people));
        localStorage.setItem('kronika_albums', JSON.stringify(backup.albums));
        localStorage.setItem('kronika_album_photos', JSON.stringify(backup.albumPhotos || {}));
        if (backup.comments) {
          localStorage.setItem('kronika_comments', JSON.stringify(backup.comments));
        }
      }
    } catch (e) {
      console.error(e);
      throw new Error('Zlyhal import zálohy: ' + (e as Error).message);
    }
  }

  clearLocalDb() {
    localStorage.removeItem('kronika_photos');
    localStorage.removeItem('kronika_people');
    localStorage.removeItem('kronika_albums');
    localStorage.removeItem('kronika_album_photos');
    localStorage.removeItem('kronika_comments');
    localStorage.removeItem('kronika_local_relationships');
    this.initLocalStorageMock();
  }
}

export const db = new DatabaseService();
