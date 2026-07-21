// --- Služba pre Google Photos API ---

export interface GooglePhotoItem {
  id: string;
  baseUrl: string;
  filename: string;
  mimeType: string;
  creationTime: string;
  width: string;
  height: string;
  description?: string;
}

// Simulované fotky na import (ak nie sme prihlásení alebo sme v mock režime)
const SIMULATED_GOOGLE_PHOTOS: GooglePhotoItem[] = [
  {
    id: 'g1',
    baseUrl: 'https://images.unsplash.com/photo-1548690312-e3b507d8c110?q=80&w=600',
    filename: 'starka_pletenie.jpg',
    mimeType: 'image/jpeg',
    creationTime: '1975-11-04T12:00:00Z',
    width: '1200',
    height: '900',
    description: 'Stará mama pletie sveter na chalupe v Zázrivej.'
  },
  {
    id: 'g2',
    baseUrl: 'https://images.unsplash.com/photo-1517524006129-4a3a3a34a8c1?q=80&w=600',
    filename: 'stryko_auto.jpg',
    mimeType: 'image/jpeg',
    creationTime: '1983-05-18T14:30:00Z',
    width: '1200',
    height: '800',
    description: 'Strýko Laco so svojím prvým autom (Škoda 120).'
  },
  {
    id: 'g3',
    baseUrl: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=600',
    filename: 'skola_trieda.jpg',
    mimeType: 'image/jpeg',
    creationTime: '1968-06-20T08:00:00Z',
    width: '1200',
    height: '900',
    description: 'Fotka z konca školského roka. Mama v tretej triede základnej školy.'
  },
  {
    id: 'g4',
    baseUrl: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?q=80&w=600',
    filename: 'bicykel_detstvo.jpg',
    mimeType: 'image/jpeg',
    creationTime: '1992-04-12T16:00:00Z',
    width: '1200',
    height: '800',
    description: 'Ja na mojom prvom bicykli BMX pred panelákom.'
  },
  {
    id: 'g5',
    baseUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=600',
    filename: 'obyvacka_vianoce.jpg',
    mimeType: 'image/jpeg',
    creationTime: '1995-12-24T18:30:00Z',
    width: '1200',
    height: '900',
    description: 'Vianoce 1995. Sledovanie rozprávok na starom farebnom televízore.'
  }
];

class GooglePhotosService {
  private accessToken: string | null = null;
  private clientId: string = '';

  constructor() {
    this.accessToken = localStorage.getItem('google_access_token');
    this.clientId = localStorage.getItem('google_client_id') || '';
  }

  public getStatus(): { authenticated: boolean; hasClientId: boolean } {
    return {
      authenticated: !!this.accessToken,
      hasClientId: !!this.clientId
    };
  }

  public setClientId(clientId: string) {
    this.clientId = clientId;
    localStorage.setItem('google_client_id', clientId);
  }

  public getClientId(): string {
    return this.clientId;
  }

  // Spustenie Google OAuth 2.0 prihlásenia (Redirect tok)
  public login() {
    if (!this.clientId) {
      // Ak nie je zadané klientske ID, budeme simulovať prihlásenie
      console.log('Chýba Google Client ID. Aktivujem SIMULOVANÉ prihlásenie Google Photos.');
      this.accessToken = 'mock_google_token_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('google_access_token', this.accessToken!);
      window.dispatchEvent(new Event('google-auth-change'));
      return;
    }

    const redirectUri = window.location.origin;
    const scope = 'https://www.googleapis.com/auth/photoslibrary.readonly https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file';
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
      this.clientId
    )}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(scope)}&prompt=consent`;

    // Presmerovanie na Google prihlasovaciu stránku
    window.location.href = authUrl;
  }

  // Zachytenie prístupového tokenu z hash adresy URL po presmerovaní
  public handleAuthCallback() {
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1));
      const token = params.get('access_token');
      if (token) {
        this.accessToken = token;
        localStorage.setItem('google_access_token', token);
        // Vyčistenie hash z adresného riadka
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        window.dispatchEvent(new Event('google-auth-change'));
      }
    }
  }

  public enableMockMode() {
    this.accessToken = 'mock_google_token_manual';
    localStorage.setItem('google_access_token', this.accessToken);
    window.dispatchEvent(new Event('google-auth-change'));
  }

  public loadGapiScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if ((window as any).gapi && (window as any).google?.picker) {
        return resolve();
      }
      const existingScript = document.getElementById('gapi-picker-script');
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve());
        return;
      }
      const script = document.createElement('script');
      script.id = 'gapi-picker-script';
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        (window as any).gapi.load('picker', () => resolve());
      };
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }

  public async openPicker(developerKey: string, onSelect: (items: GooglePhotoItem[]) => void): Promise<void> {
    await this.loadGapiScript();
    
    const token = this.accessToken;
    if (!token) {
      throw new Error('Pre otvorenie Google Picker je potrebné prihlásenie.');
    }

    // Extrahovanie čísla projektu z Client ID
    const projectId = this.clientId ? this.clientId.split('-')[0] : '';

    try {
      const pickerBuilder = new (window as any).google.picker.PickerBuilder()
        .addView((window as any).google.picker.ViewId.PHOTOS)
        .addView((window as any).google.picker.ViewId.PHOTO_ALBUMS)
        .setOAuthToken(token);

      if (projectId) {
        pickerBuilder.setAppId(projectId);
      }
      if (developerKey) {
        pickerBuilder.setDeveloperKey(developerKey);
      }

      const picker = pickerBuilder
        .setCallback((data: any) => {
          if (data.action === (window as any).google.picker.Action.PICKED) {
            const documents = data.docs || [];
            const items: GooglePhotoItem[] = documents.map((doc: any) => ({
              id: doc.id || ('gpicker_' + Math.random().toString(36).substr(2, 9)),
              baseUrl: doc.url || doc.thumbnails?.[0]?.url || '',
              filename: doc.name || 'google_photo.jpg',
              mimeType: doc.mimeType || 'image/jpeg',
              creationTime: new Date().toISOString(),
              width: doc.width || '1200',
              height: doc.height || '900',
              description: doc.description || doc.name || ''
            }));
            onSelect(items);
          }
        })
        .build();

      picker.setVisible(true);
    } catch (e) {
      console.error('Chyba pri spúšťaní Google Picker:', e);
      throw e;
    }
  }

  public logout() {
    this.accessToken = null;
    localStorage.removeItem('google_access_token');
    window.dispatchEvent(new Event('google-auth-change'));
  }

  // Načítanie fotografií z Google Photos
  public async getLibraryPhotos(pageSize: number = 20, nextPageToken?: string): Promise<{ items: GooglePhotoItem[]; nextToken?: string }> {
    // Ak máme fiktívny mock token, vraciame simulované fotky
    if (this.accessToken && this.accessToken.startsWith('mock_')) {
      await new Promise((resolve) => setTimeout(resolve, 800)); // Simulácia načítania
      return {
        items: SIMULATED_GOOGLE_PHOTOS
      };
    }

    if (!this.accessToken) {
      // Ak nie sme prihlásení vôbec, takisto môžeme zobraziť ukážku (simulované fotky)
      return {
        items: SIMULATED_GOOGLE_PHOTOS
      };
    }

    try {
      // Reálne volanie Google Photos API (vyžaduje povolenú knižnicu Google Photos Library API v Google Cloud)
      let url = `https://photoslibrary.googleapis.com/v1/mediaItems?pageSize=${pageSize}`;
      if (nextPageToken) {
        url += `&pageToken=${nextPageToken}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      });

      if (!response.ok) {
        let errorMsg = `Zlyhalo načítanie fotografií z Google Photos (Kód: ${response.status}).`;
        try {
          const errData = await response.json();
          if (errData.error?.message) {
            errorMsg = `Google Photos API Chyba: ${errData.error.message}`;
          }
        } catch {}

        if (response.status === 401) {
          this.logout();
          throw new Error('Vaša relácia Google Photos vypršala. Prihláste sa znova.');
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      const mediaItems = data.mediaItems || [];

      const items: GooglePhotoItem[] = mediaItems.map((item: any) => ({
        id: item.id,
        baseUrl: item.baseUrl,
        filename: item.filename,
        mimeType: item.mimeType,
        creationTime: item.mediaMetadata?.creationTime || new Date().toISOString(),
        width: item.mediaMetadata?.width || '0',
        height: item.mediaMetadata?.height || '0',
        description: item.description || ''
      }));

      return {
        items,
        nextToken: data.nextPageToken
      };
    } catch (e) {
      console.error('Chyba Google Photos API:', e);
      throw e; // Vyhodíme reálnu chybu, aby používateľ videl presnú príčinu
    }
  }
}

export const googlePhotos = new GooglePhotosService();
