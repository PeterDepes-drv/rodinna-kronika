import type { AIAnalysisResult } from './db';

// Pomocná funkcia na prevod súboru do Base64
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = (error) => reject(error);
  });
}

export async function analyzePhoto(base64Image: string, mimeType: string = 'image/jpeg'): Promise<AIAnalysisResult> {
  // Načítanie API kľúča z LocalStorage
  let apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
  const storedConfig = localStorage.getItem('gemini_config');
  if (storedConfig) {
    try {
      const parsed = JSON.parse(storedConfig);
      if (parsed.apiKey) {
        apiKey = parsed.apiKey;
      }
    } catch (e) {
      console.error('Chyba pri načítaní Gemini kľúča z localStorage', e);
    }
  }

  // --- SIMULOVANÝ REŽIM (ak chýba API kľúč) ---
  if (!apiKey) {
    console.log('Gemini API kľúč nie je nastavený. Beží simulovaná AI analýza.');
    await new Promise((resolve) => setTimeout(resolve, 1800)); // Simulácia oneskorenia siete

    // Vráti náhodné, no realisticky vyzerajúce dáta pre rodinnú fotku
    const mockTags = ['rodina', 'domov', 'retro', 'portrét', 'historické', 'čiernobiela', 'záhrada', 'leto'];
    const selectedTags = mockTags.sort(() => 0.5 - Math.random()).slice(0, 4 + Math.round(Math.random() * 3));
    
    return {
      estimated_year: `${1950 + Math.floor(Math.random() * 4) * 10}-te roky`,
      tags: [...selectedTags, 'simulované-ai'],
      description: 'Simulovaná AI analýza: Na fotografii je zachytená rodinná skupina vo vidieckom prostredí počas pekného dňa. Svetelné podmienky naznačujú popoludňajšie slnko. Detaily oblečenia zodpovedajú druhej polovici 20. storočia. (Pre reálnu analýzu zadajte Gemini API kľúč v Nastaveniach).',
      people_details: 'V popredí stojí skupina osôb: dospelý muž v strednom veku, žena v dobových šatách a dieťa sediace na stoličke.',
      detected_text: 'Zadná strana: "Spomienka na leto"'
    };
  }

  // Ak bol ako prvý argument odovzdaný URL odkaz (napr. z Google Photos alebo Unsplash), stiahneme ho a prevedieme na Base64
  let finalBase64 = base64Image;
  if (base64Image.startsWith('http://') || base64Image.startsWith('https://')) {
    try {
      const res = await fetch(base64Image);
      const blob = await res.blob();
      finalBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
      });
    } catch (e) {
      console.warn('Nepodarilo sa stiahnuť obrázok z URL pre AI analýzu:', e);
    }
  }

  // --- REÁLNY REŽIM (volanie Gemini API) ---
  try {
    const model = 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const prompt = `Analyzuj túto starú rodinnú fotografiu a poskytni podrobné informácie v slovenskom jazyku. 
Zameraj sa na to, aby si odhadol rok alebo dekádu fotenia, popísal atmosféru, prostredie, objekty, 
navrhol zoznam tagov (kľúčových slov) pre neskoršie vyhľadávanie, popísal osoby na fotke (napr. ich približný vek, pozíciu na snímke, oblečenie) 
a prepísal akýkoľvek text alebo ručne písané písmo, ktoré na fotke alebo na jej okrajoch/zadnej strane vidíš (ak tam nejaké je).

Výstup MUSÍ byť vo formáte JSON s presne týmito kľúčmi:
{
  "estimated_year": "odhadovaný rok alebo dekáda, napr. 1974 alebo 1970-te roky",
  "tags": ["zoznam", "tagov", "ako", "pole", "reťazcov"],
  "description": "podrobný popis scény, detailov a atmosféry v slovenčine",
  "people_details": "popis a rozloženie osôb na snímke v slovenčine",
  "detected_text": "prepísaný text z fotky, ak existuje, inak prázdny reťazec"
}

Uisti sa, že vrátiš IBA čistý, platný JSON. Nevracaj žiadne vysvetlenia mimo JSON, ani značky \`\`\`json a \`\`\`.`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: finalBase64
                }
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error?.message || 'Zlyhalo volanie Gemini API');
    }

    const resData = await response.json();
    const responseText = resData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Parsovanie JSONu
    const cleanText = responseText.trim().replace(/^```json/, '').replace(/```$/, '').trim();
    const result = JSON.parse(cleanText) as AIAnalysisResult;
    
    return result;
  } catch (error) {
    console.error('Chyba pri AI analýze obrázka:', error);
    throw new Error('AI analýza zlyhala: ' + (error as Error).message);
  }
}

export async function transcribeAudio(base64Audio: string, mimeType: string = 'audio/webm'): Promise<string> {
  let apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
  const storedConfig = localStorage.getItem('gemini_config');
  if (storedConfig) {
    try {
      const parsed = JSON.parse(storedConfig);
      if (parsed.apiKey) {
        apiKey = parsed.apiKey;
      }
    } catch (e) {
      console.error('Chyba pri načítaní Gemini kľúča z localStorage', e);
    }
  }

  if (!apiKey) {
    console.log('Gemini API kľúč nie je nastavený. Beží simulovaný prepis reči.');
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return 'Simulovaný prepis: (Starý otec spomína) Vtedy sme boli všetci na chalupe u strýka Fera v Bojnej. Bolo strašné horúco, deti sa kúpali v kadi a my sme s chlapcami sedeli pod orechom a rozoberali politiku. Krásne časy to boli. (Pre reálny prepis zadajte Gemini API kľúč v Nastaveniach).';
  }

  try {
    const model = 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const prompt = 'Prepíš túto nahrávku hovoreného slova doslova do slovenského textu. Vráť iba čistý prepis v slovenčine bez akýchkoľvek úvodných alebo záverečných viet, poznámok alebo úvodzoviek.';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Audio
                }
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error?.message || 'Zlyhalo volanie Gemini API');
    }

    const resData = await response.json();
    const responseText = resData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return responseText.trim();
  } catch (error) {
    console.error('Chyba pri prepise zvuku:', error);
    throw new Error('Prepis zvuku zlyhal: ' + (error as Error).message);
  }
}

export async function semanticSearchPhotos(
  query: string,
  photosMetadata: Array<{
    id: string;
    title: string;
    description: string;
    location: string;
    taken_at: string;
    people: string[];
    tags: string[];
    detected_text?: string;
  }>
): Promise<string[]> {
  let apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
  const storedConfig = localStorage.getItem('gemini_config');
  if (storedConfig) {
    try {
      const parsed = JSON.parse(storedConfig);
      if (parsed.apiKey) {
        apiKey = parsed.apiKey;
      }
    } catch (e) {
      console.error('Chyba pri načítaní Gemini kľúča z localStorage', e);
    }
  }

  if (!apiKey) {
    console.log('Gemini API kľúč nie je nastavený. Beží simulované sémantické vyhľadávanie.');
    const queryLower = query.toLowerCase();
    const matches = photosMetadata.filter(p => {
      const titleMatch = p.title.toLowerCase().includes(queryLower);
      const descMatch = p.description.toLowerCase().includes(queryLower);
      const locMatch = p.location.toLowerCase().includes(queryLower);
      const peopleMatch = p.people.some(name => name.toLowerCase().includes(queryLower));
      const tagsMatch = p.tags.some(tag => tag.toLowerCase().includes(queryLower));
      
      const isSummerQuery = queryLower.includes('leto') || queryLower.includes('letn');
      const isSummerPhoto = isSummerQuery && (p.taken_at.includes('-06-') || p.taken_at.includes('-07-') || p.taken_at.includes('-08-') || p.tags.includes('leto') || p.description.toLowerCase().includes('leto'));
      
      const isWinterQuery = queryLower.includes('zima') || queryLower.includes('zimn');
      const isWinterPhoto = isWinterQuery && (p.taken_at.includes('-12-') || p.taken_at.includes('-01-') || p.taken_at.includes('-02-') || p.tags.includes('zima') || p.description.toLowerCase().includes('zima'));

      const isOldQuery = queryLower.includes('star') || queryLower.includes('histor');
      const isOldPhoto = isOldQuery && (p.taken_at.startsWith('19') && parseInt(p.taken_at.substring(0, 4)) < 1980);

      return titleMatch || descMatch || locMatch || peopleMatch || tagsMatch || isSummerPhoto || isWinterPhoto || isOldPhoto;
    });

    return matches.map(m => m.id);
  }

  try {
    const model = 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const prompt = `Si inteligentný vyhľadávací asistent pre rodinnú kroniku. Používateľ hľadá spomienku pomocou dopytu: "${query}"

Máš k dispozícii nasledujúci zoznam fotografií s ich metadátami:
${JSON.stringify(photosMetadata, null, 2)}

Úloha:
1. Analyzuj každú fotografiu a urči, či sémanticky zodpovedá dopytu. 
2. Premýšľaj sémanticky v kontexte rodiny a slovenského jazyka:
   - "dedko" alebo "starý otec" zodpovedá starším mužom, alebo ak je v popise spomenuté "starý otec" / "dedko".
   - "leto", "na pláži", "pri vode" sa spája s letnými mesiacmi (jún, júl, august) alebo letnými tagmi.
   - "zima", "na lyžiach", "sneh" sa spája so zimnými mesiacmi (december, január, február) alebo zimnými športmi.
   - "svadba" sa spája so sobášom, svadobnými šatami, kyticami.
3. Zorad zodpovedajúce fotografie od najrelevantnejšej po najmenej relevantnú. 

Výstup MUSÍ byť vo formáte JSON s poľom ID nájdených fotografií:
["id1", "id2", "id3", ...]

Vráť iba čisté JSON pole bez okolitého textu alebo markdown značiek (nepoužívaj \`\`\`json).`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error?.message || 'Zlyhalo volanie Gemini API pri sémantickom vyhľadávaní');
    }

    const resData = await response.json();
    const responseText = resData.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    const cleanText = responseText.trim().replace(/^```json/, '').replace(/```$/, '').trim();
    const result = JSON.parse(cleanText) as string[];
    return result;
  } catch (error) {
    console.error('Chyba pri sémantickom vyhľadávaní:', error);
    return [];
  }
}
