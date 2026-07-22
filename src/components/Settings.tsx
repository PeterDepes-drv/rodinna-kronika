import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import type { SupabaseConfig } from '../services/db';
import { googlePhotos } from '../services/googlePhotos';
import { Save, Download, Upload, SlidersHorizontal, Brain, Info, Database } from 'lucide-react';

interface SettingsProps {
  onNavigate: (view: string) => void;
}

export const Settings: React.FC<SettingsProps> = ({ onNavigate }) => {
  const [dbStatus, setDbStatus] = useState({ connected: false, mode: 'LOCAL' });
  
  // Stavy formulárov
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [googleClientId, setGoogleClientId] = useState('');

  // Nastavenia pre rodinné výzvy (Fotka týždňa)
  const [emailsList, setEmailsList] = useState('');
  const [resendApiKey, setResendApiKey] = useState('');
  const [resendSender, setResendSender] = useState('');

  // Info správy
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    // Načítanie existujúcich konfigurácií
    setDbStatus(db.getStatus());

    const storedSupa = localStorage.getItem('supabase_config');
    if (storedSupa) {
      try {
        const parsed = JSON.parse(storedSupa) as SupabaseConfig;
        setSupabaseUrl(parsed.supabaseUrl || '');
        setSupabaseKey(parsed.supabaseAnonKey || '');
      } catch {}
    }

    const storedGemini = localStorage.getItem('gemini_config');
    if (storedGemini) {
      try {
        const parsed = JSON.parse(storedGemini);
        setGeminiKey(parsed.apiKey || '');
      } catch {}
    }

    setGoogleClientId(googlePhotos.getClientId());

    // E-maily
    setEmailsList(localStorage.getItem('kronika_settings_emails') || '');
    setResendApiKey(localStorage.getItem('kronika_settings_resend_api_key') || '');
    setResendSender(localStorage.getItem('kronika_settings_resend_sender') || 'onboarding@resend.dev');
  }, []);

  const handleSaveConfigs = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaveStatus('Ukladám nastavenia...');

      // 1. Supabase
      if (supabaseUrl.trim() && supabaseKey.trim()) {
        const supaConfig: SupabaseConfig = {
          supabaseUrl: supabaseUrl.trim(),
          supabaseAnonKey: supabaseKey.trim()
        };
        localStorage.setItem('supabase_config', JSON.stringify(supaConfig));
      } else {
        localStorage.removeItem('supabase_config');
      }

      // 2. Gemini API Key
      if (geminiKey.trim()) {
        localStorage.setItem('gemini_config', JSON.stringify({ apiKey: geminiKey.trim() }));
      } else {
        localStorage.removeItem('gemini_config');
      }

      // 3. Google Client ID
      if (googleClientId.trim()) {
        googlePhotos.setClientId(googleClientId.trim());
      } else {
        localStorage.removeItem('google_client_id');
        googlePhotos.setClientId('');
      }

      // 4. Resend / Fotka týždňa
      if (emailsList.trim()) {
        localStorage.setItem('kronika_settings_emails', emailsList.trim());
      } else {
        localStorage.removeItem('kronika_settings_emails');
      }
      if (resendApiKey.trim()) {
        localStorage.setItem('kronika_settings_resend_api_key', resendApiKey.trim());
      } else {
        localStorage.removeItem('kronika_settings_resend_api_key');
      }
      if (resendSender.trim()) {
        localStorage.setItem('kronika_settings_resend_sender', resendSender.trim());
      } else {
        localStorage.removeItem('kronika_settings_resend_sender');
      }

      // Re-inicializácia DB klienta
      db.initClient();
      setDbStatus(db.getStatus());

      setSaveStatus('Nastavenia boli úspešne uložené!');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (e) {
      console.error(e);
      setSaveStatus('Nastala chyba pri ukladaní.');
    }
  };

  const handleClearLocalDb = () => {
    if (window.confirm('Naozaj chcete resetovať lokálnu databázu a vrátiť do nej pôvodné vzorové fotky? Všetky vaše lokálne pridané fotky sa vymažú.')) {
      db.clearLocalDb();
      alert('Lokálna databáza bola resetovaná.');
      onNavigate('dashboard');
    }
  };

  const handleExport = async () => {
    try {
      const backupData = await db.exportBackup();
      const blob = new Blob([backupData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `kronika_zaloha_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error(e);
      alert('Zlyhal export zálohy.');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = event.target?.result as string;
        await db.importBackup(json);
        alert('Import zálohy prebehol úspešne!');
        onNavigate('dashboard');
      } catch (err) {
        alert((err as Error).message);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2.5rem' }}>
        <h1>Nastavenia kroniky</h1>
        <p>Spravujte pripojenia ku cloudovým službám, API kľúče a zálohovanie rodinného archívu.</p>
      </div>

      {saveStatus && (
        <div className="panel ai-glow-panel" style={{ padding: '1rem', marginBottom: '2rem', border: '1px solid var(--accent)' }}>
          <p style={{ fontWeight: 600, color: 'white', textAlign: 'center' }}>{saveStatus}</p>
        </div>
      )}

      {/* Stav databázy */}
      <div className="panel flex justify-between align-center" style={{ marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Database size={32} style={{ color: dbStatus.mode === 'SUPABASE' ? 'var(--success)' : 'var(--warning)' }} />
          <div>
            <h3 style={{ fontSize: '1.15rem' }}>Aktuálny stav úložiska</h3>
            <p style={{ fontSize: '0.85rem' }}>
              Režim: <strong>{dbStatus.mode === 'SUPABASE' ? 'Supabase Cloud (Živá databáza)' : 'LocalStorage Fallback (Iba lokálne na tomto PC)'}</strong>
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <span 
            className="tag-badge"
            style={{ 
              backgroundColor: dbStatus.mode === 'SUPABASE' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
              borderColor: dbStatus.mode === 'SUPABASE' ? 'var(--success)' : 'var(--warning)',
              color: dbStatus.mode === 'SUPABASE' ? '#34d399' : '#fbbf24',
              fontWeight: 700
            }}
          >
            {dbStatus.mode === 'SUPABASE' ? 'ONLINE CLOUD' : 'LOKÁLNY REŽIM'}
          </span>
        </div>
      </div>

      <form onSubmit={handleSaveConfigs} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Supabase nastavenia */}
        <div className="panel">
          <h2 className="panel-title" style={{ marginBottom: '1.25rem' }}>
            <Database size={20} /> 1. Pripojenie Supabase Databázy (Cloud)
          </h2>
          <p style={{ fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            Ak chcete kroniku zdieľať online s celou rodinou, vytvorte si projekt na <a href="https://supabase.com" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>supabase.com</a> zadarmo a vložte údaje sem. Storage bucket pre fotky nazvite <strong>photos</strong> a nastavte ho ako public.
          </p>

          <div className="form-group">
            <label>Supabase URL projektu</label>
            <input 
              type="text" 
              className="input-field" 
              style={{ paddingLeft: '1rem' }}
              placeholder="https://xxxxxx.supabase.co"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Supabase Anon Key (API kľúč)</label>
            <input 
              type="password" 
              className="input-field" 
              style={{ paddingLeft: '1rem' }}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={supabaseKey}
              onChange={(e) => setSupabaseKey(e.target.value)}
            />
          </div>
        </div>

        {/* Gemini AI nastavenia */}
        <div className="panel ai-glow-panel">
          <h2 className="panel-title" style={{ marginBottom: '1.25rem', color: '#a78bfa' }}>
            <Brain size={20} /> 2. Inteligentné funkcie Google Gemini AI
          </h2>
          <p style={{ fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            Získajte automatické popisy, tagovanie a prepis textov na starých fotkách pomocou najnovších modelov Google. Kľúč k API získate zadarmo na <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" style={{ color: '#a78bfa', textDecoration: 'underline' }}>Google AI Studio</a>.
          </p>

          <div className="form-group">
            <label>Gemini API kľúč</label>
            <input 
              type="password" 
              className="input-field" 
              style={{ paddingLeft: '1rem' }}
              placeholder="AIzaSy..."
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
            />
          </div>
        </div>

        {/* Google Photos nastavenia */}
        <div className="panel">
          <h2 className="panel-title" style={{ marginBottom: '1.25rem' }}>
            <SlidersHorizontal size={20} /> 3. Import Google Photos (OAuth 2.0)
          </h2>
          <p style={{ fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            Pre reálny import zadajte svoje <strong>OAuth 2.0 Client ID</strong> vygenerované v Google Cloud Console pre túto webovú adresu. Ak ho nevyplníte, aplikácia pobeží v bezpečnom mock/simulovanom režime.
          </p>

          <div className="form-group">
            <label>Google Client ID</label>
            <input 
              type="text" 
              className="input-field" 
              style={{ paddingLeft: '1rem' }}
              placeholder="xxxxxx-xxxxxxxx.apps.googleusercontent.com"
              value={googleClientId}
              onChange={(e) => setGoogleClientId(e.target.value)}
            />
          </div>
        </div>

        {/* Nastavenia E-mailových výziev */}
        <div className="panel flex" style={{ flexDirection: 'column' }}>
          <h2 className="panel-title" style={{ marginBottom: '1.25rem', color: '#38bdf8' }}>
            <Info size={20} /> 4. Rodinné výzvy ("Fotka týždňa")
          </h2>
          <p style={{ fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            Nastavte zoznam e-mailov rodinných príslušníkov, ktorým chcete posielať náhodné staré fotky s výzvou na doplnenie chýbajúcich príbehov.
          </p>

          <div className="form-group">
            <label>E-maily príjemcov (oddelené čiarkou)</label>
            <input 
              type="text" 
              className="input-field" 
              style={{ paddingLeft: '1rem' }}
              placeholder="mama@email.cz, otec@email.cz, dedko@email.cz"
              value={emailsList}
              onChange={(e) => setEmailsList(e.target.value)}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Resend API Kľúč (Nepovinné - pre automatické posielanie)</label>
              <input 
                type="password" 
                className="input-field" 
                style={{ paddingLeft: '1rem' }}
                placeholder="re_xxxxxxxx"
                value={resendApiKey}
                onChange={(e) => setResendApiKey(e.target.value)}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                Získate zadarmo na <a href="https://resend.com" target="_blank" rel="noreferrer" style={{ color: '#38bdf8' }}>resend.com</a> pre posielanie priamo z prehliadača.
              </span>
            </div>

            <div className="form-group">
              <label>Odosielateľ e-mailu (iba ak máte Resend kľúč)</label>
              <input 
                type="text" 
                className="input-field" 
                style={{ paddingLeft: '1rem' }}
                placeholder="onboarding@resend.dev"
                value={resendSender}
                onChange={(e) => setResendSender(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Uložiť tlačidlo */}
        <div style={{ textAlign: 'right' }}>
          <button type="submit" className="btn btn-primary" style={{ padding: '0.85rem 2rem' }}>
            <Save size={18} /> Uložiť všetky konfigurácie
          </button>
        </div>
      </form>

      {/* Správa lokálnych dát */}
      <div className="panel" style={{ marginTop: '3rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
        <h2 className="panel-title" style={{ marginBottom: '1.25rem', color: 'var(--danger)' }}>
          <Info size={20} /> Správa dát a zálohovanie
        </h2>
        <p style={{ fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          Zálohujte si celú kroniku (fotky, príbehy, označených ľudí a albumy) do jedného JSON súboru, ktorý si môžete kedykoľvek stiahnuť a neskôr obnoviť.
        </p>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={handleExport} style={{ gap: '0.5rem' }}>
            <Download size={16} /> Exportovať kompletnú zálohu
          </button>
          
          <label className="btn btn-secondary" style={{ gap: '0.5rem', cursor: 'pointer' }}>
            <Upload size={16} /> Importovať zálohu zo súboru
            <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
          </label>

          <button className="btn btn-danger" onClick={handleClearLocalDb} style={{ marginLeft: 'auto' }}>
            Resetovať lokálnu databázu
          </button>
        </div>
      </div>
    </div>
  );
};
