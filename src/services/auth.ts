// --- Služba pre autentifikáciu používateľov (E-mailové prihlásenie pre rôzne zariadenia) ---
import { db } from './db';

export interface UserSession {
  email: string;
  name?: string;
  avatar_url?: string;
  mode: 'SUPABASE' | 'LOCAL';
}

class AuthService {
  private currentSession: UserSession | null = null;
  private listeners: Array<(session: UserSession | null) => void> = [];

  constructor() {
    this.initSession();
  }

  private initSession() {
    const stored = localStorage.getItem('kronika_user_session');
    if (stored) {
      try {
        this.currentSession = JSON.parse(stored);
      } catch (e) {
        this.currentSession = null;
      }
    }
  }

  public getSession(): UserSession | null {
    return this.currentSession;
  }

  public subscribe(listener: (session: UserSession | null) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l(this.currentSession));
  }

  // Prihlásenie e-mailom
  public async loginWithEmail(email: string, name?: string): Promise<UserSession> {
    const cleanedEmail = email.trim().toLowerCase();
    if (!cleanedEmail || !cleanedEmail.includes('@')) {
      throw new Error('Zadajte platnú e-mailovú adresu.');
    }

    const userName = name || cleanedEmail.split('@')[0];
    const session: UserSession = {
      email: cleanedEmail,
      name: userName,
      mode: db.getStatus().connected ? 'SUPABASE' : 'LOCAL'
    };

    // Ak je pripojená Supabase, skúsime prihlásenie cez Supabase Auth
    if (db.getStatus().connected && (db as any).supabase) {
      try {
        const supabase = (db as any).supabase;
        // Skúsime odoslať Magic Link / OTP kódy na e-mail
        await supabase.auth.signInWithOtp({
          email: cleanedEmail,
          options: {
            emailRedirectTo: window.location.origin
          }
        });
      } catch (e) {
        console.warn('Supabase Auth warning:', e);
      }
    }

    this.currentSession = session;
    localStorage.setItem('kronika_user_session', JSON.stringify(session));
    this.notify();
    return session;
  }

  // Odhlásenie
  public logout() {
    this.currentSession = null;
    localStorage.removeItem('kronika_user_session');
    
    if (db.getStatus().connected && (db as any).supabase) {
      try {
        (db as any).supabase.auth.signOut();
      } catch {}
    }
    this.notify();
  }
}

export const authService = new AuthService();
