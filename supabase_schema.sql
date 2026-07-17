-- Tabuľka fotografií (Photos)
create table if not exists photos (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  taken_at text, -- Formát: YYYY-MM-DD, YYYY-MM, YYYY (približný dátum)
  decade int, -- Pre jednoduchšie filtrovanie na časovej osi (napr. 1970)
  location text,
  storage_path text not null, -- Cesta v Supabase Storage alebo externá Google Photos URL
  is_external boolean default false,
  google_photo_id text,
  ai_metadata jsonb, -- Automatické dáta z Gemini AI (tagy, popisy, OCR)
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tabuľka ľudí (People)
create table if not exists people (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  birth_date date,
  relationship text, -- napr. "starý otec", "mama", "sestra"
  photo_url text, -- profilová fotka (cesta alebo url)
  bio text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Spojovacia tabuľka pre označovanie ľudí na fotkách (Photo People)
create table if not exists photo_people (
  photo_id uuid references photos(id) on delete cascade,
  person_id uuid references people(id) on delete cascade,
  bounding_box jsonb, -- {x, y, w, h} pre označenie tváre (voliteľné)
  primary key (photo_id, person_id)
);

-- Tabuľka albumov / prezentácií (Albums)
create table if not exists albums (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  cover_photo_path text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Spojovacia tabuľka pre priradenie fotiek do albumov s určeným poradím
create table if not exists album_photos (
  album_id uuid references albums(id) on delete cascade,
  photo_id uuid references photos(id) on delete cascade,
  sort_order int not null,
  primary key (album_id, photo_id)
);

-- Nastavenie indexov pre rýchlejšie vyhľadávanie
create index if not exists idx_photos_decade on photos(decade);
create index if not exists idx_photos_taken_at on photos(taken_at);
create index if not exists idx_photo_people_person on photo_people(person_id);
create index if not exists idx_album_photos_order on album_photos(album_id, sort_order);

-- POZNÁMKA K SUPABASE STORAGE:
-- Budete musieť vytvoriť storage bucket s názvom "photos" v Supabase konzole a nastaviť ho ako PUBLIC.
-- Pre plnú funkčnosť nahrávania súborov nastavte nasledujúce RLS (Row Level Security) pravidlá pre bucket "photos":
-- Umožniť čítanie (SELECT) pre všetkých.
-- Umožniť nahrávanie (INSERT/UPDATE) pre všetkých (ak je kronika pre rodinu bez zložitej registrácie),
-- prípadne len pre prihlásených používateľov.
