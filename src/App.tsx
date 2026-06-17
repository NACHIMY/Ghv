import { useState, useMemo, useEffect } from 'react';
import {
  Activity,
  Brain,
  ShieldAlert,
  Footprints,
  UserCheck,
  FileText,
  Printer,
  Sparkles,
  User,
  Calendar,
  Clock,
  Heart,
  Stethoscope,
  Info,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  RotateCcw,
  Download
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// Helper function to convert oklch & oklab colors to standard HSL/RGB/RGBA, as html2canvas doesn't support them
function replaceModernColors(cssText: string): string {
  if (!cssText) return cssText;
  
  // 1. Replace oklch(...)
  let patched = cssText.replace(/oklch\(\s*([0-9.]+%?)[,\s]+([0-9.]+)[,\s]+([-0-9.]+)(?:\s*[,\s\/]+\s*([0-9.]+%?))?\s*\)/gi, (match, lVal, cVal, hVal, aVal) => {
    let l = parseFloat(lVal);
    if (!lVal.endsWith('%')) {
      l = l * 100;
    }
    l = Math.max(0, Math.min(100, l));
    const c = parseFloat(cVal);
    const h = parseFloat(hVal);
    const s = Math.max(0, Math.min(100, c * 250));

    if (aVal !== undefined) {
      let a = parseFloat(aVal);
      if (aVal.endsWith('%')) {
        a = a / 100;
      }
      return `hsla(${h.toFixed(1)}, ${s.toFixed(1)}%, ${l.toFixed(1)}%, ${a})`;
    } else {
      return `hsl(${h.toFixed(1)}, ${s.toFixed(1)}%, ${l.toFixed(1)}%)`;
    }
  });

  // 2. Replace oklab(...)
  patched = patched.replace(/oklab\(\s*([0-9.]+%?)[,\s]+([-0-9.]+)[,\s]+([-0-9.]+)(?:\s*[,\s\/]+\s*([0-9.]+%?))?\s*\)/gi, (match, lVal, aVal, bVal, alphaVal) => {
    let l = parseFloat(lVal);
    if (lVal.endsWith('%')) {
      l = l / 100;
    }
    const a = parseFloat(aVal);
    const b = parseFloat(bVal);

    // Approximate conversion from oklab to RGB
    const rVal = l + 0.3963377774 * a + 0.2158037573 * b;
    const gVal = l - 0.1055613458 * a - 0.0638541728 * b;
    const bValRGB = l - 0.0894841775 * a - 1.291485548 * b;

    const r = Math.max(0, Math.min(255, Math.round(rVal * 255)));
    const g = Math.max(0, Math.min(255, Math.round(gVal * 255)));
    const blue = Math.max(0, Math.min(255, Math.round(bValRGB * 255)));

    if (alphaVal !== undefined) {
      let alpha = parseFloat(alphaVal);
      if (alphaVal.endsWith('%')) {
        alpha = alpha / 100;
      }
      return `rgba(${r}, ${g}, ${blue}, ${alpha})`;
    } else {
      return `rgb(${r}, ${g}, ${blue})`;
    }
  });

  return patched;
}

// Function to temporarily patch all document stylesheets to avoid OKLCH and OKLAB crashes with html2canvas
async function patchAllStyleSheets(): Promise<() => void> {
  const originalStates: { element: HTMLStyleElement | HTMLLinkElement; wasDisabled: boolean }[] = [];
  const tempElements: HTMLStyleElement[] = [];

  const styleSheets = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'));

  for (const el of styleSheets) {
    let cssText = '';

    if (el.tagName.toLowerCase() === 'style') {
      cssText = el.textContent || '';
    } else {
      try {
        const link = el as HTMLLinkElement;
        const sheet = link.sheet as CSSStyleSheet | null;
        if (sheet) {
          try {
            const rules = Array.from(sheet.cssRules);
            cssText = rules.map(r => r.cssText).join('\n');
          } catch (e) {
            if (link.href) {
              const res = await fetch(link.href);
              cssText = await res.text();
            }
          }
        }
      } catch (e) {
        console.warn('Could not read external stylesheet:', e);
      }
    }

    if (cssText && (cssText.includes('oklch') || cssText.includes('oklab'))) {
      const patchedStyle = document.createElement('style');
      patchedStyle.className = 'html2canvas-patch-style';
      patchedStyle.textContent = replaceModernColors(cssText);
      document.head.appendChild(patchedStyle);
      tempElements.push(patchedStyle);

      if (el instanceof HTMLStyleElement) {
        originalStates.push({ element: el, wasDisabled: el.disabled });
        el.disabled = true;
      } else if (el instanceof HTMLLinkElement) {
        originalStates.push({ element: el, wasDisabled: el.disabled });
        el.disabled = true;
      }
    }
  }

  return () => {
    originalStates.forEach(({ element, wasDisabled }) => {
      element.disabled = wasDisabled;
    });
    tempElements.forEach(el => el.remove());
  };
}

export default function App() {
  // Navigation / Tabs of indicators
  const [activeTab, setActiveTab] = useState<'profile' | 'gcs' | 'news2' | 'braden' | 'morse' | 'barthel' | 'summary'>('profile');

  // Load sample patient function
  const handleLoadSample = () => {
    setPatientInfo({
      lastName: 'Dupont',
      firstName: 'Jean-Marc',
      medicalId: 'HOSP-2026-8841',
      age: '68',
      gender: 'Homme',
      department: 'Soins Intensifs / USI',
      room: 'Chambre 104'
    });
    setEvaluatorInfo({
      name: 'Dr. Audrey Martin',
      role: 'Médecin Coordinateur',
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().slice(0, 5)
    });
    
    // Set typical USI patient scores
    setGcs({ eyes: '3', verbal: '4', motor: '5' });
    setNews2({
      rr: '22', // High
      spo2: '93', // Medium
      oxygen: 'yes', // +2
      pas: '98', // Medium
      hr: '102', // High
      temp: '38.4', // High
      cvpu: 'alert', // Normal
      scaleType: 'STANDARD'
    });
    setBraden({
      sensory: '3',
      moisture: '3',
      activity: '1',
      mobility: '2',
      nutrition: '2',
      friction: '2'
    });
    setMorse({
      history: 'yes',
      secondary: 'yes',
      aid: 'crutches',
      iv: 'yes',
      gait: 'weak',
      mental: 'realistic'
    });
    setBarthel({
      eating: '5',
      bathing: '0',
      grooming: '0',
      dressing: '5',
      bowels: '5',
      bladder: '5',
      toilet: '5',
      transfer: '10',
      mobility: '5',
      stairs: '0'
    });
    
    setActiveTab('summary');
  };

  // Reset function
  const handleReset = () => {
    setPatientInfo({
      lastName: '',
      firstName: '',
      medicalId: '',
      age: '',
      gender: 'Homme',
      department: '',
      room: ''
    });
    setEvaluatorInfo({
      name: '',
      role: 'Infirmier(e)',
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().slice(0, 5)
    });
    setGcs({ eyes: '4', verbal: '5', motor: '6' });
    setNews2({
      rr: '16',
      spo2: '98',
      oxygen: 'no',
      pas: '120',
      hr: '72',
      temp: '36.7',
      cvpu: 'alert',
      scaleType: 'STANDARD'
    });
    setBraden({
      sensory: '4',
      moisture: '4',
      activity: '4',
      mobility: '4',
      nutrition: '4',
      friction: '3'
    });
    setMorse({
      history: 'no',
      secondary: 'no',
      aid: 'bed',
      iv: 'no',
      gait: 'normal',
      mental: 'realistic'
    });
    setBarthel({
      eating: '10',
      bathing: '5',
      grooming: '5',
      dressing: '10',
      bowels: '10',
      bladder: '10',
      toilet: '10',
      transfer: '15',
      mobility: '15',
      stairs: '10'
    });
    setAiReport('');
    setErrorMessage('');
    setActiveTab('profile');
  };

  // Patient profile info state
  const [patientInfo, setPatientInfo] = useState({
    lastName: '',
    firstName: '',
    medicalId: '',
    age: '',
    gender: 'Homme',
    department: '',
    room: '',
    diagnosisAndSigns: ''
  });

  const [evaluatorInfo, setEvaluatorInfo] = useState({
    name: '',
    role: 'Infirmier(e)',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 5)
  });

  // GCS State
  const [gcs, setGcs] = useState({
    eyes: '4',    // 1 to 4
    verbal: '5',  // 1 to 5
    motor: '6'    // 1 to 6
  });

  // NEWS2 State
  const [news2, setNews2] = useState({
    rr: '16',       // breath/min
    spo2: '98',     // oxygen%
    oxygen: 'no',   // 'yes' or 'no'
    pas: '120',     // mmHg systolic
    hr: '74',       // bpm heart rate
    temp: '36.8',   // C temperature
    cvpu: 'alert',  // 'alert' or 'confused'
    scaleType: 'STANDARD' // 'STANDARD' or 'COPD' 
  });

  // Braden State (1-4, friction is 1-3)
  const [braden, setBraden] = useState({
    sensory: '4',
    moisture: '4',
    activity: '4',
    mobility: '4',
    nutrition: '4',
    friction: '3'
  });

  // Morse State
  const [morse, setMorse] = useState({
    history: 'no',     // "no" (0) or "yes" (25)
    secondary: 'no',   // "no" (0) or "yes" (15)
    aid: 'bed',        // "bed" (0), "crutches" (15), "furniture" (30)
    iv: 'no',          // "no" (0) or "yes" (20)
    gait: 'normal',    // "normal" (0), "weak" (10), "impaired" (20)
    mental: 'realistic' // "realistic" (0), "forgetful" (15)
  });

  // Barthel State
  const [barthel, setBarthel] = useState({
    eating: '10',   // 0, 5, 10
    bathing: '5',    // 0, 5
    grooming: '5',   // 0, 5
    dressing: '10',  // 0, 5, 10
    bowels: '10',    // 0, 5, 10
    bladder: '10',   // 0, 5, 10
    toilet: '10',    // 0, 5, 10
    transfer: '15',  // 0, 5, 10, 15
    mobility: '15',  // 0, 5, 10, 15
    stairs: '10'     // 0, 5, 10
  });

  // API Call state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiReport, setAiReport] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // ----------------------------------------------------
  // CALCULATORS & INTERPRETATIONS
  // ----------------------------------------------------

  // 1. Glasgow Coma Scale Calculation
  const calculatedGcs = useMemo(() => {
    const e = parseInt(gcs.eyes) || 4;
    const v = parseInt(gcs.verbal) || 5;
    const m = parseInt(gcs.motor) || 6;
    const total = e + v + m;
    
    let severity = 'Léger (Vigilance normale)';
    let colorClass = 'bg-emerald-150 text-emerald-800 border-emerald-300';
    let alertText = 'Vigilance préservée. Continuer l\'évaluation périodique.';

    if (total <= 8) {
      severity = 'Grave (Coma précoce)';
      colorClass = 'bg-rose-100 text-rose-800 border-rose-300 font-bold animate-pulse';
      alertText = '🚨 URGENCE CRITIQUE : Voies aériennes compromises. Alerter l\'anesthésiste-réanimateur immédiatement.';
    } else if (total <= 12) {
      severity = 'Modéré';
      colorClass = 'bg-amber-100 text-amber-800 border-amber-300';
      alertText = '⚠️ Vigilance altérée. Monitorage renforcé toutes les heures nécessitant investigation neurologique.';
    }

    return { total, severity, colorClass, alertText };
  }, [gcs]);

  // 2. NEWS2 Score Calculation
  const calculatedNews2 = useMemo(() => {
    let score = 0;
    const breakDown: Record<string, number> = {};

    // Respiratory Rate
    const rrVal = parseInt(news2.rr) || 16;
    let rrScore = 0;
    if (rrVal <= 8 || rrVal >= 25) {
      rrScore = 3;
    } else if (rrVal >= 21 && rrVal <= 24) {
      rrScore = 2;
    } else if (rrVal >= 9 && rrVal <= 11) {
      rrScore = 1;
    }
    score += rrScore;
    breakDown['FR'] = rrScore;

    // SpO2 Scale 1 or Scale 2
    const spo2Val = parseInt(news2.spo2) || 98;
    const hasOxygen = news2.oxygen === 'yes';
    let spo2Score = 0;

    if (news2.scaleType === 'COPD') {
      // Scale 2 (COPD)
      if (spo2Val <= 83) {
        spo2Score = 3;
      } else if (spo2Val === 84 || spo2Val === 85) {
        spo2Score = 2;
      } else if (spo2Val === 86 || spo2Val === 87) {
        spo2Score = 1;
      } else if (spo2Val >= 88 && spo2Val <= 92) {
        spo2Score = 0;
      } else if (spo2Val === 93 || spo2Val === 94) {
        spo2Score = hasOxygen ? 1 : 0;
      } else if (spo2Val === 95 || spo2Val === 96) {
        spo2Score = hasOxygen ? 2 : 0;
      } else if (spo2Val >= 97) {
        spo2Score = hasOxygen ? 3 : 0;
      }
    } else {
      // Scale 1 (Standard)
      if (spo2Val <= 91) {
        spo2Score = 3;
      } else if (spo2Val === 92 || spo2Val === 93) {
        spo2Score = 2;
      } else if (spo2Val === 94 || spo2Val === 95) {
        spo2Score = 1;
      }
    }
    score += spo2Score;
    breakDown['SpO2'] = spo2Score;

    // Supplemental Oxygen
    let o2score = hasOxygen ? 2 : 0;
    score += o2score;
    breakDown['Oxygène'] = o2score;

    // Temperature
    const tempVal = parseFloat(news2.temp) || 36.7;
    let tempScore = 0;
    if (tempVal <= 35.0) {
      tempScore = 3;
    } else if (tempVal >= 39.1) {
      tempScore = 2;
    } else if ((tempVal >= 35.1 && tempVal <= 36.0) || (tempVal >= 38.1 && tempVal <= 39.0)) {
      tempScore = 1;
    }
    score += tempScore;
    breakDown['T°'] = tempScore;

    // Systolic Blood Pressure
    const pasVal = parseInt(news2.pas) || 120;
    let pasScore = 0;
    if (pasVal <= 90 || pasVal >= 220) {
      pasScore = 3;
    } else if (pasVal >= 91 && pasVal <= 100) {
      pasScore = 2;
    } else if (pasVal >= 101 && pasVal <= 110) {
      pasScore = 1;
    }
    score += pasScore;
    breakDown['PAS'] = pasScore;

    // Heart Rate
    const hrVal = parseInt(news2.hr) || 72;
    let hrScore = 0;
    if (hrVal <= 40 || hrVal >= 131) {
      hrScore = 3;
    } else if (hrVal >= 111 && hrVal <= 130) {
      hrScore = 2;
    } else if ((hrVal >= 41 && hrVal <= 50) || (hrVal >= 91 && hrVal <= 110)) {
      hrScore = 1;
    }
    score += hrScore;
    breakDown['FC'] = hrScore;

    // Neurological Alt / CVPU
    let cvpuScore = news2.cvpu === 'confused' ? 3 : 0;
    score += cvpuScore;
    breakDown['Sens / CVPU'] = cvpuScore;

    // Check individual severe metric
    const hasAny3 = rrScore === 3 || spo2Score === 3 || tempScore === 3 || pasScore === 3 || hrScore === 3 || cvpuScore === 3;

    let riskLevel = 'Faible';
    let riskColor = 'bg-emerald-50 text-emerald-800 border-emerald-300';
    let alertText = 'Risque vital faible. Surveillance périodique standard (toutes les 12 heures).';

    if (score >= 7) {
      riskLevel = 'Élevé (Rouge)';
      riskColor = 'bg-rose-100 text-rose-800 border-rose-300 font-bold';
      alertText = '🚨 ALERTE ROUGE : Score >=7. Seuil d\'intervention critique immédiate par le médecin réanimateur senior ou l\'équipe d\'urgence.';
    } else if (score >= 5 || hasAny3) {
      riskLevel = 'Moyen (Orange)';
      riskColor = 'bg-amber-100 text-amber-800 border-amber-300';
      alertText = '⚠️ RISQUE MOYEN : Score 5-6 ou score unitaire de 3. Alerter d\'urgence un clinicien médical senior sous 1 heure.';
    }

    return { score, riskLevel, riskColor, alertText, breakDown };
  }, [news2]);

  // 3. Braden Scale Score Calculation
  const calculatedBraden = useMemo(() => {
    const s = parseInt(braden.sensory) || 4;
    const m = parseInt(braden.moisture) || 4;
    const a = parseInt(braden.activity) || 4;
    const mob = parseInt(braden.mobility) || 4;
    const n = parseInt(braden.nutrition) || 4;
    const f = parseInt(braden.friction) || 3;
    
    const total = s + m + a + mob + n + f;

    let riskLevel = 'Aucun risque';
    let riskColor = 'bg-emerald-50 text-emerald-800 border-emerald-300';
    let alertText = 'Pas de risque d\'escarre identified. Garder les mesures générales d\'hygiène.';

    if (total <= 9) {
      riskLevel = 'Très Élevé';
      riskColor = 'bg-rose-100 text-rose-850 border-rose-300 font-extrabold';
      alertText = '🔴 Risque critique d\'escarres (Score <= 9). Mettre en place d\'urgence un matelas à air dynamique, et alterner les positions de décharge toutes les 2 heures.';
    } else if (total <= 12) {
      riskLevel = 'Élevé';
      riskColor = 'bg-rose-50 text-rose-700 border-rose-200';
      alertText = '🟠 Risque élevé d\'escarres (Score 10-12). Support mousse visco-élastique, décharges fréquentes, et bilan nutritionnel systématique.';
    } else if (total <= 14) {
      riskLevel = 'Modéré';
      riskColor = 'bg-amber-100 text-amber-800 border-amber-300';
      alertText = '🟡 Risque modéré d\'escarres (Score 13-14). Dispositifs de décharge aux points d\'appui vulnérables (talons, sacrum).';
    } else if (total <= 18) {
      riskLevel = 'Léger';
      riskColor = 'bg-sky-50 text-sky-800 border-sky-300';
      alertText = '🔵 Risque léger (Score 15-18). Maintien d\'une excellente autonomie et hydratation cutanée fréquente.';
    }

    return { total, riskLevel, riskColor, alertText };
  }, [braden]);

  // 4. Morse Fall Score Calculation
  const calculatedMorse = useMemo(() => {
    let score = 0;
    
    // History
    score += morse.history === 'yes' ? 25 : 0;
    // Secondary Diagnosis
    score += morse.secondary === 'yes' ? 15 : 0;
    // Walk Aid
    if (morse.aid === 'crutches') score += 15;
    else if (morse.aid === 'furniture') score += 30;
    // IV / Lock
    score += morse.iv === 'yes' ? 20 : 0;
    // Gait
    if (morse.gait === 'weak') score += 10;
    else if (morse.gait === 'impaired') score += 20;
    // Mental State
    score += morse.mental === 'forgetful' ? 15 : 0;

    let riskLevel = 'Faible';
    let riskColor = 'bg-emerald-50 text-emerald-800 border-emerald-300';
    let alertText = 'Risque de chute minimal. S\'assurer de la bonne visibilité de l\'éclairage de chevet.';

    if (score >= 45) {
      riskLevel = 'Élevé';
      riskColor = 'bg-rose-100 text-rose-850 border-rose-300 font-bold';
      alertText = '🔴 RISQUE DE CHUTES ÉLEVÉ : Mettre en œuvre le protocole anti-chute (lit bas, sonnette d\'appel immédiatement disponible, accompagnement médical pour tout déplacement, bandes antidérapantes).';
    } else if (score >= 25) {
      riskLevel = 'Moyen';
      riskColor = 'bg-amber-100 text-amber-800 border-amber-300';
      alertText = '⚠️ RISQUE DE CHUTES MOYEN : Assister le patient lors des allers-retours aux toilettes et dégager la chambre de tout obstacle.';
    }

    return { score, riskLevel, riskColor, alertText };
  }, [morse]);

  // 5. Barthel Index Score Calculation
  const calculatedBarthel = useMemo(() => {
    const total = 
      (parseInt(barthel.eating) || 0) +
      (parseInt(barthel.bathing) || 0) +
      (parseInt(barthel.grooming) || 0) +
      (parseInt(barthel.dressing) || 0) +
      (parseInt(barthel.bowels) || 0) +
      (parseInt(barthel.bladder) || 0) +
      (parseInt(barthel.toilet) || 0) +
      (parseInt(barthel.transfer) || 0) +
      (parseInt(barthel.mobility) || 0) +
      (parseInt(barthel.stairs) || 0);

    let dependencyLevel = 'Indépendance totale';
    let dependencyColor = 'bg-emerald-50 text-emerald-800 border-emerald-300';
    let alertText = 'Le patient est totalement autonome pour les actes de la vie quotidienne.';

    if (total <= 20) {
      dependencyLevel = 'Dépendance Totale';
      dependencyColor = 'bg-rose-100 text-rose-850 border-rose-300 font-bold';
      alertText = '🔴 Assistance humaine constante requise pour tous les besoins vitaux et d\'hygiène (alimentation, soins corporels, éliminations).';
    } else if (total <= 60) {
      dependencyLevel = 'Dépendance Sévère';
      dependencyColor = 'bg-amber-100 text-amber-800 border-amber-200';
      alertText = '🟠 Aide au transfert et aide humaine majeure requise pour les soins quotidiens de base.';
    } else if (total <= 90) {
      dependencyLevel = 'Dépendance Modérée';
      dependencyColor = 'bg-blue-50 text-blue-800 border-blue-200';
      alertText = '🟡 Besoin d\'aides partielles de supervision active pour l\'habillage ou la montée des escaliers.';
    } else if (total <= 99) {
      dependencyLevel = 'Dépendance Légère';
      dependencyColor = 'bg-teal-50 text-teal-800 border-teal-200';
      alertText = '🔵 Presque autonome mais garde une légère gêne nécessitant occasionnellement des conseils d\'ergothérapie.';
    }

    return { total, dependencyLevel, dependencyColor, alertText };
  }, [barthel]);

  // ----------------------------------------------------
  // GEMINI SERVER-SIDE ANALYZER
  // ----------------------------------------------------
  const handleGenerateAiReport = async () => {
    setIsAnalyzing(true);
    setErrorMessage('');
    setAiReport('');
    try {
      const payload = {
        patientInfo,
        evaluatorInfo,
        scores: {
          gcs: {
            score: calculatedGcs.total,
            eyes: gcs.eyes,
            verbal: gcs.verbal,
            motor: gcs.motor,
            severity: calculatedGcs.severity
          },
          news2: {
            score: calculatedNews2.score,
            riskLevel: calculatedNews2.riskLevel,
            scaleType: news2.scaleType,
            parameters: news2
          },
          braden: {
            score: calculatedBraden.total,
            riskLevel: calculatedBraden.riskLevel,
            parameters: braden
          },
          morse: {
            score: calculatedMorse.score,
            riskLevel: calculatedMorse.riskLevel,
            parameters: morse
          },
          barthel: {
            score: calculatedBarthel.total,
            dependencyLevel: calculatedBarthel.dependencyLevel,
            parameters: barthel
          }
        }
      };

      const response = await fetch('/api/analyze-patient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let errMsg = 'Erreur lors de la communication avec le serveur clinique.';
        try {
          const errData = await response.json();
          if (errData && errData.error) {
            errMsg = errData.error;
          }
        } catch (e) {}
        throw new Error(errMsg);
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      setAiReport(data.analysis);
    } catch (err: any) {
      setErrorMessage(err.message || 'Impossible d\'obtenir l\'analyse IA.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Client-side PDF generation using html2canvas & jsPDF (works inside iframes!)
  const exportReportToPdf = async () => {
    const element = document.getElementById('printable-report-area');
    if (!element) return;

    setIsExportingPdf(true);
    let restoreStyleSheets: (() => void) | null = null;
    try {
      // Temporarily clean/replace stylesheets containing oklch colors before html2canvas runs
      restoreStyleSheets = await patchAllStyleSheets();

      // Temporarily expand height or styles for rendering if necessary
      const originalStyle = element.style.cssText;
      element.style.maxHeight = 'none';
      element.style.overflow = 'visible';

      // We capture the canvas at scale 2 for crisp vector text
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (clonedDoc) => {
          // Replace OKLCH colors in all style tags of the cloned document
          const styles = clonedDoc.querySelectorAll('style');
          styles.forEach(style => {
            if (style.textContent) {
              style.textContent = replaceOklch(style.textContent);
            }
          });

          // Also replace inside inline styles
          const inlineStyles = clonedDoc.querySelectorAll('[style]');
          inlineStyles.forEach(el => {
            const styleAttr = el.getAttribute('style');
            if (styleAttr) {
              el.setAttribute('style', replaceOklch(styleAttr));
            }
          });
        }
      });

      // Restore original container state
      element.style.cssText = originalStyle;

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210; // A4 Width in mm
      const pageHeight = 297; // A4 Height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      // Page 1
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;

      // Add other pages if content height exceeds A4 height
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
      }

      const patientName = `${patientInfo.lastName || 'Patient'}_${patientInfo.firstName || ''}`
        .replace(/\s+/g, '_')
        .toUpperCase();
      const filename = `MediSCORE_Rapport_${patientName}.pdf`;
      pdf.save(filename);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Une erreur est survenue lors du téléchargement direct du PDF. Veuillez utiliser l\'option "Imprimer" ou réessayer.');
    } finally {
      if (restoreStyleSheets) {
        restoreStyleSheets();
      }
      setIsExportingPdf(false);
    }
  };

  // Trigger AI Report automatically when clicking the summary tab for the first time *if* name is filled
  useEffect(() => {
    if (activeTab === 'summary' && !aiReport && patientInfo.lastName && !isAnalyzing) {
      handleGenerateAiReport();
    }
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      
      {/* ----------------- APP BAR (BANNER) (Hides on standard print) ----------------- */}
      <header className="no-print bg-slate-900 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="bg-emerald-500 text-slate-900 p-2.5 rounded-xl shadow-inner flex items-center justify-center">
              <Activity className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">
                MediSCORE
              </h1>
              <p className="text-xs text-slate-400 font-medium">Portail d'Évaluation Clinique & Scores Multidimensionnels</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              id="btn-sample-data"
              onClick={handleLoadSample}
              className="bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all text-xs font-semibold px-4 py-2.5 rounded-lg border border-slate-700 text-slate-200 flex items-center gap-2 cursor-pointer"
            >
              <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
              Charger un patient type
            </button>
            
            <button
              id="btn-reset-data"
              onClick={handleReset}
              className="bg-transparent hover:bg-slate-800 text-xs font-semibold px-3 py-2.5 rounded-lg text-slate-400 hover:text-slate-200 flex items-center gap-2 transition-colors cursor-pointer"
              title="Réinitialiser"
            >
              <RotateCcw className="h-4 w-4" />
              Effacer
            </button>
          </div>
        </div>
      </header>

      {/* ----------------- MAIN PORTAL AREA ----------------- */}
      <main className="flex-grow max-w-7xl w-full mx-auto p-4 md:py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT NAV PANEL (Hides on print) */}
        <nav className="no-print lg:col-span-3 space-y-2.5">
          <div className="bg-white rounded-xl py-3 border border-slate-200 shadow-xs">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-4 py-1.5 mb-1">Étapes & Modules</p>
            
            <button
              id="nav-profile"
              onClick={() => setActiveTab('profile')}
              className={`w-full flex items-center px-4 py-3 text-sm font-semibold transition-all border-l-4 ${
                activeTab === 'profile'
                  ? 'bg-slate-100 border-slate-800 text-slate-900'
                  : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <User className="h-4 w-4 mr-3 text-slate-500" />
              1. Enregistrement Patient
              {(patientInfo.lastName || patientInfo.firstName) && (
                <span className="ml-auto bg-slate-200 text-slate-800 text-[10px] px-1.5 py-0.5 rounded-full">Prêt</span>
              )}
            </button>

            <div className="border-t border-slate-100 my-2"></div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-4 py-1.5 mb-1">Calculateur de scores</p>

            {/* Glasgow (GCS) */}
            <button
              id="nav-gcs"
              onClick={() => setActiveTab('gcs')}
              className={`w-full flex items-center px-4 py-3 text-sm font-semibold transition-all border-l-4 ${
                activeTab === 'gcs'
                  ? 'bg-emerald-50 border-emerald-600 text-emerald-950'
                  : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Brain className="h-4 w-4 mr-3 text-amber-600" />
              🧠 Échelle de Glasgow
              <span className="ml-auto font-mono font-bold text-emerald-850">{calculatedGcs.total}/15</span>
            </button>

            {/* NEWS2 */}
            <button
              id="nav-news2"
              onClick={() => setActiveTab('news2')}
              className={`w-full flex items-center px-4 py-3 text-sm font-semibold transition-all border-l-4 ${
                activeTab === 'news2'
                  ? 'bg-emerald-50 border-emerald-600 text-emerald-950'
                  : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Activity className="h-4 w-4 mr-3 text-rose-500" />
              🫁 Score Vital NEWS2
              <span className={`ml-auto font-mono font-bold px-1.5 py-0.5 rounded-md text-xs ${
                calculatedNews2.score >= 5 ? 'bg-orange-100 text-orange-850' : 'text-slate-705'
              }`}>
                {calculatedNews2.score}/20
              </span>
            </button>

            {/* Braden Scale */}
            <button
              id="nav-braden"
              onClick={() => setActiveTab('braden')}
              className={`w-full flex items-center px-4 py-3 text-sm font-semibold transition-all border-l-4 ${
                activeTab === 'braden'
                  ? 'bg-emerald-50 border-emerald-600 text-emerald-950'
                  : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <ShieldAlert className="h-4 w-4 mr-3 text-indigo-500" />
              🛏️ Escarres (Braden)
              <span className="ml-auto font-mono font-bold text-slate-700">{calculatedBraden.total}/23</span>
            </button>

            {/* Morse Fall Scale */}
            <button
              id="nav-morse"
              onClick={() => setActiveTab('morse')}
              className={`w-full flex items-center px-4 py-3 text-sm font-semibold transition-all border-l-4 ${
                activeTab === 'morse'
                  ? 'bg-emerald-50 border-emerald-600 text-emerald-950'
                  : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Footprints className="h-4 w-4 mr-3 text-emerald-600" />
              🚶‍♂️ Chutes (Morse)
              <span className="ml-auto font-mono font-bold text-slate-700">{calculatedMorse.score}/125</span>
            </button>

            {/* Barthel */}
            <button
              id="nav-barthel"
              onClick={() => setActiveTab('barthel')}
              className={`w-full flex items-center px-4 py-3 text-sm font-semibold transition-all border-l-4 ${
                activeTab === 'barthel'
                  ? 'bg-emerald-50 border-emerald-600 text-emerald-950'
                  : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <UserCheck className="h-4 w-4 mr-3 text-teal-600" />
              🛀 Autonomie (Barthel)
              <span className="ml-auto font-mono font-bold text-slate-700">{calculatedBarthel.total}/100</span>
            </button>

            <div className="border-t border-slate-100 my-2"></div>
            
            <button
              id="nav-summary"
              onClick={() => setActiveTab('summary')}
              className={`w-full flex items-center px-4 py-3 text-sm font-bold transition-all border-l-4 ${
                activeTab === 'summary'
                  ? 'bg-amber-50 border-amber-600 text-amber-950'
                  : 'border-transparent text-slate-800 hover:bg-slate-50 hover:text-slate-950'
              }`}
            >
              <FileText className="h-4 w-4 mr-3 text-amber-500" />
              3. Rapport & Synthèse IA
              <ChevronRight className="h-3.5 w-3.5 ml-auto text-slate-400" />
            </button>
          </div>

          <div className="bg-slate-100 p-4 rounded-xl border border-slate-200">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 text-slate-500" />
              Consignes d'usage
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Saisissez les constantes de votre patient dans chaque onglet. Les scores sont calculés instantanément selon les guidelines cliniques de référence. L'analyse IA vous fournit ensuite une synthèse globale à imprimer en PDF.
            </p>
          </div>
        </nav>

        {/* MIDDLE CONTENT PANEL & DESKTOP FORM */}
        <div className="lg:col-span-9 space-y-6">
          
          {/* ----------------- 1. REGISTER PATIENT TAB ----------------- */}
          {activeTab === 'profile' && (
            <section id="panel-profile" className="no-print bg-white rounded-xl border border-slate-200 shadow-xs p-6">
              <div className="flex items-center space-x-2 border-b border-slate-100 pb-4 mb-6">
                <User className="h-5.5 w-5.5 text-slate-500" />
                <h3 className="text-lg font-bold text-slate-900">1. Profil Patient & Informations d'Évaluation</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">Nom de famille *</label>
                  <input
                    type="text"
                    value={patientInfo.lastName}
                    onChange={(e) => setPatientInfo({ ...patientInfo, lastName: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-emerald-500 focus:ring-emerald-200"
                    placeholder="ex: Dupont"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">Prénom *</label>
                  <input
                    type="text"
                    value={patientInfo.firstName}
                    onChange={(e) => setPatientInfo({ ...patientInfo, firstName: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-emerald-500 focus:ring-emerald-200"
                    placeholder="ex: Jean-Marc"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">N° Dossier Médical / ID *</label>
                  <input
                    type="text"
                    value={patientInfo.medicalId}
                    onChange={(e) => setPatientInfo({ ...patientInfo, medicalId: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-emerald-500 focus:ring-emerald-200"
                    placeholder="ex: hosp-1982-xxx"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">Âge (années) *</label>
                  <input
                    type="number"
                    value={patientInfo.age}
                    onChange={(e) => setPatientInfo({ ...patientInfo, age: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-emerald-500 focus:ring-emerald-200"
                    placeholder="ex: 68"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">Genre</label>
                  <select
                    value={patientInfo.gender}
                    onChange={(e) => setPatientInfo({ ...patientInfo, gender: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-emerald-500 focus:ring-emerald-200"
                  >
                    <option>Homme</option>
                    <option>Femme</option>
                    <option>Autre</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">Unité / Service de Soins</label>
                  <input
                    type="text"
                    value={patientInfo.department}
                    onChange={(e) => setPatientInfo({ ...patientInfo, department: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-emerald-500 focus:ring-emerald-200"
                    placeholder="ex: Service de Soins Intensifs (USI)"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">Numéro de Chambre / Lit</label>
                  <input
                    type="text"
                    value={patientInfo.room}
                    onChange={(e) => setPatientInfo({ ...patientInfo, room: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-emerald-500 focus:ring-emerald-200"
                    placeholder="ex: Lit 4B"
                  />
                </div>
              </div>

              {/* Diagnosis and clinical signs input */}
              <div className="mt-5 p-4 bg-slate-50 rounded-xl border border-slate-200/60">
                <label className="block text-xs font-bold text-slate-800 mb-1.5 uppercase flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-emerald-600" />
                  Diagnostic d'Admission & Signes Cliniques Actuels (Pris en compte par la synthèse IA)
                </label>
                <div className="relative">
                  <textarea
                    value={patientInfo.diagnosisAndSigns}
                    onChange={(e) => setPatientInfo({ ...patientInfo, diagnosisAndSigns: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white p-3 pl-10 text-sm focus:border-emerald-500 focus:ring-emerald-200 min-h-[100px] text-slate-800 placeholder-slate-400"
                    placeholder="Saisissez ici le diagnostic principal (ex: AVC ischémique, BPCO décompensée, Sepsis d'origine urinaire, Insuffisance cardiaque congestive...) ainsi que les signes cliniques majeurs observés s'il y en a (ex: dyspnée de repos, hémiplégie droite, encombrement bronchique...). Ces informations contextualiseront avec précision l'analyse de synthèse de l'IA."
                  />
                  <div className="absolute top-3.5 left-3 pointer-events-none">
                    <FileText className="h-4 w-4 text-slate-400" />
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  💡 En combinant ces données narratives avec les scores validés (Glasgow, NEWS2, Braden, etc.), l'IA fournira des recommandations de surveillance et d'intervention extrêmement personnalisées et adaptées au tableau clinique réel de votre patient.
                </p>
              </div>

              <div className="border-t border-slate-100 my-6"></div>
              
              <div className="flex items-center space-x-2 pb-2 mb-4">
                <Stethoscope className="h-5 w-5 text-slate-500" />
                <h4 className="text-sm font-bold text-slate-900 uppercase">Évaluateur & Métadonnées</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">Évaluateur (Nom, Titre)</label>
                  <input
                    type="text"
                    value={evaluatorInfo.name}
                    onChange={(e) => setEvaluatorInfo({ ...evaluatorInfo, name: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-emerald-500 focus:ring-emerald-200"
                    placeholder="Dr. Martin, de garde"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">Fonction</label>
                  <select
                    value={evaluatorInfo.role}
                    onChange={(e) => setEvaluatorInfo({ ...evaluatorInfo, role: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-emerald-500 focus:ring-emerald-200"
                  >
                    <option>Infirmier(e)</option>
                    <option>Médecin Généraliste</option>
                    <option>Médecin Spécialiste / Réanimateur</option>
                    <option>Kinésithérapeute</option>
                    <option>Cadre de Santé</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">Date de l'évaluation</label>
                  <input
                    type="date"
                    value={evaluatorInfo.date}
                    onChange={(e) => setEvaluatorInfo({ ...evaluatorInfo, date: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-emerald-500 focus:ring-emerald-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">Heure de l'évaluation</label>
                  <input
                    type="time"
                    value={evaluatorInfo.time}
                    onChange={(e) => setEvaluatorInfo({ ...evaluatorInfo, time: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-emerald-500 focus:ring-emerald-200"
                  />
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <button
                  id="btn-goto-gcs"
                  type="button"
                  onClick={() => setActiveTab('gcs')}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm px-6 py-3 rounded-lg shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                >
                  Continuer vers Glasgow
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </section>
          )}

          {/* ----------------- GCS (GLASGOW) TAB ----------------- */}
          {activeTab === 'gcs' && (
            <section id="panel-gcs" className="no-print bg-white rounded-xl border border-slate-200 shadow-xs p-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                <div className="flex items-center space-x-2">
                  <Brain className="h-5.5 w-5.5 text-amber-500 animate-pulse" />
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Échelle de Glasgow (Coma Scale)</h3>
                    <p className="text-xs text-slate-500">Évaluation fine de l'état de conscience et neurologique</p>
                  </div>
                </div>
                <div className="bg-emerald-550 bg-slate-900 text-white px-4 py-2 rounded-xl text-right">
                  <span className="text-xs text-slate-300 block uppercase font-bold tracking-wider">Score GCS</span>
                  <span className="text-2xl font-mono font-extrabold">{calculatedGcs.total} / 15</span>
                </div>
              </div>

              {/* EYE OPENING */}
              <div className="mb-6">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">👁️ 1. Ouverture des yeux (E)</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
                  {[
                    { val: '4', label: 'Spontanée (4)', desc: 'Yeux ouverts spontanément' },
                    { val: '3', label: 'Au bruit (3)', desc: 'À la demande verbale / bruit' },
                    { val: '2', label: 'À la douleur (2)', desc: 'À la pression de l\'ongle ou cutanée' },
                    { val: '1', label: 'Nulle (1)', desc: 'Aucune ouverture oculaire' }
                  ].map((opt) => (
                    <button
                      id={`gcs-eyes-${opt.val}`}
                      key={opt.val}
                      type="button"
                      onClick={() => setGcs({ ...gcs, eyes: opt.val })}
                      className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                        gcs.eyes === opt.val
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold ring-2 ring-emerald-500/20'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="text-sm">{opt.label}</div>
                      <div className="text-[11px] text-slate-500 font-normal mt-1 leading-tight">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* VERBAL RESPONSE */}
              <div className="mb-6">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">💬 2. Réponse verbale (V)</h4>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5 font-sans">
                  {[
                    { val: '5', label: 'Orientée (5)', desc: 'Répond correctement (nom, lieu, date)' },
                    { val: '4', label: 'Confuse (4)', desc: 'Parle mais conversation confuse' },
                    { val: '3', label: 'Inappropriée (3)', desc: 'Mots intelligibles mais décousus' },
                    { val: '2', label: 'Incompréhensible (2)', desc: 'Sons émis, cris mais pas de mots' },
                    { val: '1', label: 'Nulle (1)', desc: 'Aucune émission sonore' }
                  ].map((opt) => (
                    <button
                      id={`gcs-verbal-${opt.val}`}
                      key={opt.val}
                      type="button"
                      onClick={() => setGcs({ ...gcs, verbal: opt.val })}
                      className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                        gcs.verbal === opt.val
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold ring-2 ring-emerald-500/20'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="text-sm">{opt.label}</div>
                      <div className="text-[11px] text-slate-500 font-normal mt-1 leading-tight">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* MOTOR RESPONSE */}
              <div className="mb-6">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">🦾 3. Réponse motrice (M)</h4>
                <div className="grid grid-cols-1 md:grid-cols-6 gap-2.5">
                  {[
                    { val: '6', label: 'Aux ordres (6)', desc: 'Exécute les consignes motrices simples' },
                    { val: '5', label: 'Localise (5)', desc: 'Localise et repousse le stimulus douloureux' },
                    { val: '4', label: 'Évitement (4)', desc: 'Flexion non spécifique, retrait à la douleur' },
                    { val: '3', label: 'Flexion anormale (3)', desc: 'Décortication (flexion rigide)' },
                    { val: '2', label: 'Extension (2)', desc: 'Décérébration (enroulement interne)' },
                    { val: '1', label: 'Nulle (1)', desc: 'Aucune réponse motrice' }
                  ].map((opt) => (
                    <button
                      id={`gcs-motor-${opt.val}`}
                      key={opt.val}
                      type="button"
                      onClick={() => setGcs({ ...gcs, motor: opt.val })}
                      className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                        gcs.motor === opt.val
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold ring-2 ring-emerald-500/20'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="text-sm">{opt.label}</div>
                      <div className="text-[11px] text-slate-500 font-normal mt-1 leading-tight">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* CLINICAL SUMMARY GCS */}
              <div className={`p-4 rounded-xl border mt-8 ${calculatedGcs.colorClass}`}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
                  <div>
                    <h5 className="font-bold text-sm">Interprétation clinique Glasgow : État {calculatedGcs.severity?.toUpperCase()}</h5>
                    <p className="text-sm mt-1">{calculatedGcs.alertText}</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-between">
                <button
                  type="button"
                  onClick={() => setActiveTab('profile')}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-sm px-5 py-3 rounded-lg transition-colors cursor-pointer"
                >
                  Retour
                </button>
                <button
                  id="btn-goto-news2"
                  type="button"
                  onClick={() => setActiveTab('news2')}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm px-6 py-3 rounded-lg shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                >
                  Continuer vers NEWS2
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </section>
          )}

          {/* ----------------- NEWS2 TAB ----------------- */}
          {activeTab === 'news2' && (
            <section id="panel-news2" className="no-print bg-white rounded-xl border border-slate-200 shadow-xs p-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                <div className="flex items-center space-x-2">
                  <Activity className="h-5.5 w-5.5 text-rose-500 animate-pulse" />
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Score NEWS2 (Sécurité Vital / Alerte)</h3>
                    <p className="text-xs text-slate-500">Standard de détection précoce des détériorations aiguës</p>
                  </div>
                </div>
                <div className="bg-slate-900 text-white px-4 py-2 rounded-xl text-right">
                  <span className="text-xs text-slate-300 block uppercase font-bold tracking-wider">Score NEWS2</span>
                  <span className="text-2xl font-mono font-extrabold">{calculatedNews2.score} / 20</span>
                </div>
              </div>

              {/* Scale Type Toggle */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl mb-6">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Configurez la cible respiratoire selon la pathologie :</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setNews2({ ...news2, scaleType: 'STANDARD' })}
                    className={`flex-1 py-2.5 text-center px-4 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      news2.scaleType === 'STANDARD'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Échelle 1 Standard (Tout patient)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNews2({ ...news2, scaleType: 'COPD' })}
                    className={`flex-1 py-2.5 text-center px-4 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      news2.scaleType === 'COPD'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Échelle 2 BPCO (Visez SpO2 88-92%)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Respiratory Rate */}
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-2xs">
                  <label className="block text-xs font-bold text-slate-700 mb-2 uppercase">1. Fréquence respiratoire ({news2.rr} c/m)</label>
                  <input
                    type="range"
                    min="6"
                    max="35"
                    value={news2.rr}
                    onChange={(e) => setNews2({ ...news2, rr: e.target.value })}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900"
                  />
                  <div className="flex justify-between text-[11px] text-slate-500 font-mono mt-1">
                    <span>&lt;8 (Critique)</span>
                    <span className="font-bold text-slate-800 text-sm align-middle">{news2.rr} cycles/min</span>
                    <span>&gt;25 (Détresse)</span>
                  </div>
                </div>

                {/* SpO2 */}
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-2xs">
                  <label className="block text-xs font-bold text-slate-700 mb-2 uppercase">2. Saturation en Oxygène SpO2 ({news2.spo2} %)</label>
                  <input
                    type="range"
                    min="75"
                    max="100"
                    value={news2.spo2}
                    onChange={(e) => setNews2({ ...news2, spo2: e.target.value })}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900"
                  />
                  <div className="flex justify-between text-[11px] text-slate-500 font-mono mt-1">
                    <span>75% (Hypoxie)</span>
                    <span className="font-bold text-slate-800 text-sm">{news2.spo2} %</span>
                    <span>100%</span>
                  </div>
                </div>

                {/* Oxygen delivery */}
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-2xs">
                  <label className="block text-xs font-bold text-slate-700 mb-2 uppercase">3. Oxygène Thérapeutique / Apport d'O2</label>
                  <div className="flex gap-2.5">
                    <button
                      type="button"
                      onClick={() => setNews2({ ...news2, oxygen: 'no' })}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold cursor-pointer border ${
                        news2.oxygen === 'no'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Air ambiant (0 pt)
                    </button>
                    <button
                      type="button"
                      onClick={() => setNews2({ ...news2, oxygen: 'yes' })}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold cursor-pointer border ${
                        news2.oxygen === 'yes'
                          ? 'border-orange-500 bg-orange-50 text-orange-950 font-bold'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Oxygène prescrit (+2 pts)
                    </button>
                  </div>
                </div>

                {/* PAS */}
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-2xs">
                  <label className="block text-xs font-bold text-slate-700 mb-2 uppercase">4. Pression Artérielle Systolique ({news2.pas} mmHg)</label>
                  <input
                    type="range"
                    min="60"
                    max="240"
                    value={news2.pas}
                    onChange={(e) => setNews2({ ...news2, pas: e.target.value })}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900"
                  />
                  <div className="flex justify-between text-[11px] text-slate-500 font-mono mt-1">
                    <span>&lt;90 mmHg (Choc)</span>
                    <span className="font-bold text-slate-800 text-sm">{news2.pas} mmHg</span>
                    <span>&gt;220 mmHg</span>
                  </div>
                </div>

                {/* Heart Rate */}
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-2xs">
                  <label className="block text-xs font-bold text-slate-700 mb-2 uppercase">5. Fréquence Cardiaque ({news2.hr} bpm)</label>
                  <input
                    type="range"
                    min="30"
                    max="180"
                    value={news2.hr}
                    onChange={(e) => setNews2({ ...news2, hr: e.target.value })}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900"
                  />
                  <div className="flex justify-between text-[11px] text-slate-500 font-mono mt-1">
                    <span>&lt;40 bpm (Bradycardie)</span>
                    <span className="font-bold text-slate-800 text-sm">{news2.hr} bpm</span>
                    <span>&gt;131 bpm (Tachycardie)</span>
                  </div>
                </div>

                {/* Temperature */}
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-2xs">
                  <label className="block text-xs font-bold text-slate-700 mb-2 uppercase">6. Température Basale ({news2.temp} °C)</label>
                  <input
                    type="range"
                    min="34"
                    max="41"
                    step="0.1"
                    value={news2.temp}
                    onChange={(e) => setNews2({ ...news2, temp: e.target.value })}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900"
                  />
                  <div className="flex justify-between text-[11px] text-slate-500 font-mono mt-1">
                    <span>&lt;35.0 °C (Hypothermie)</span>
                    <span className="font-bold text-slate-800 text-sm">{news2.temp} °C</span>
                    <span>&gt;39.1 °C (Fièvre forte)</span>
                  </div>
                </div>

                {/* CVPU Consciousness */}
                <div className="col-span-1 md:col-span-2 bg-white p-4 rounded-xl border border-slate-100 shadow-2xs">
                  <label className="block text-xs font-bold text-slate-700 mb-2 uppercase">7. Niveau Clinique de Conscience / Confusion Nouvelle</label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setNews2({ ...news2, cvpu: 'alert' })}
                      className={`flex-1 py-3 px-4 rounded-lg text-xs font-semibold cursor-pointer border text-left transition-all ${
                        news2.cvpu === 'alert'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Alerte (A)
                      <span className="block text-[10px] text-slate-500 font-normal mt-0.5">Le patient suit des yeux et répond normalement (0 pt)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNews2({ ...news2, cvpu: 'confused' })}
                      className={`flex-1 py-3 px-4 rounded-lg text-xs font-semibold cursor-pointer border text-left transition-all ${
                        news2.cvpu === 'confused'
                          ? 'border-rose-500 bg-rose-50 text-rose-950 font-bold'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Confusion Nouvelle (CVPU)
                      <span className="block text-[10px] text-slate-500 font-normal mt-0.5">Confusion subite, réactivité verbale difficile, douleur seule ou inréactif (+3 pts)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* CLINICAL SUMMARY NEWS2 */}
              <div className={`p-4 rounded-xl border mt-8 ${calculatedNews2.riskColor}`}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
                  <div>
                    <h5 className="font-bold text-sm">Niveau de risque NEWS2 : {calculatedNews2.riskLevel?.toUpperCase()}</h5>
                    <p className="text-sm mt-1">{calculatedNews2.alertText}</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-between">
                <button
                  type="button"
                  onClick={() => setActiveTab('gcs')}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-sm px-5 py-3 rounded-lg transition-colors cursor-pointer"
                >
                  Retour
                </button>
                <button
                  id="btn-goto-braden"
                  type="button"
                  onClick={() => setActiveTab('braden')}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm px-6 py-3 rounded-lg shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                >
                  Continuer vers Braden
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </section>
          )}

          {/* ----------------- BRADEN SCALE TAB ----------------- */}
          {activeTab === 'braden' && (
            <section id="panel-braden" className="no-print bg-white rounded-xl border border-slate-200 shadow-xs p-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                <div className="flex items-center space-x-2">
                  <ShieldAlert className="h-5.5 w-5.5 text-indigo-500 animate-pulse" />
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Échelle de Braden (Risque d'Escarres)</h3>
                    <p className="text-xs text-slate-500">Outil de prédiction des ulcères de pression cutanés</p>
                  </div>
                </div>
                <div className="bg-slate-900 text-white px-4 py-2 rounded-xl text-right">
                  <span className="text-xs text-slate-300 block uppercase font-bold tracking-wider">Score Braden</span>
                  <span className="text-2xl font-mono font-extrabold">{calculatedBraden.total} / 23</span>
                </div>
              </div>

              <div className="space-y-6">
                {/* Sensory perception */}
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">1. Perception sensorielle</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    {[
                      { val: '1', label: '1. Complètement limitée', desc: 'Inconscient ou forte sédation' },
                      { val: '2', label: '2. Très limitée', desc: 'Répond uniquement aux stimuli vigoureux' },
                      { val: '3', label: '3. Légèrement limitée', desc: 'Répond aux ordres verbaux mais engourdissement' },
                      { val: '4', label: '4. Sans anomalie', desc: 'Répond normalement, acuité intacte' }
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setBraden({ ...braden, sensory: opt.val })}
                        className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                          braden.sensory === opt.val
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-semibold ring-2 ring-emerald-500/10'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="text-xs font-bold">{opt.label}</div>
                        <div className="text-[10px] text-slate-500 mt-1 leading-normal">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Moisture */}
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">2. Humidité de la peau</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    {[
                      { val: '1', label: '1. Constamment mouillée', desc: 'Transpiration majeure/incontinence permanente' },
                      { val: '2', label: '2. Très mouillée', desc: 'Linge changé au moins une fois par poste/service' },
                      { val: '3', label: '3. Parfois mouillée', desc: 'Humide occasionnellement (e.g. miction)' },
                      { val: '4', label: '4. Rarement mouillée', desc: 'Peau sèche et saine, linge normal' }
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setBraden({ ...braden, moisture: opt.val })}
                        className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                          braden.moisture === opt.val
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-semibold ring-2 ring-emerald-500/10'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="text-xs font-bold">{opt.label}</div>
                        <div className="text-[10px] text-slate-500 mt-1 leading-normal">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Activity */}
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">3. Activité physique</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    {[
                      { val: '1', label: '1. Alité de façon stricte', desc: 'Patient confiné au lit en permanence' },
                      { val: '2', label: '2. Confiné au fauteuil', desc: 'Assis sur chaise, déambulation impossible' },
                      { val: '3', label: '3. Marche parfois', desc: 'Déambule de courtes distances avec ou sans aide' },
                      { val: '4', label: '4. Marche fréquemment', desc: 'À l\'extérieur de la chambre régulièrement' }
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setBraden({ ...braden, activity: opt.val })}
                        className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                          braden.activity === opt.val
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-semibold ring-2 ring-emerald-500/10'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="text-xs font-bold">{opt.label}</div>
                        <div className="text-[10px] text-slate-500 mt-1 leading-normal">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mobility */}
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">4. Mobilité autonome</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    {[
                      { val: '1', label: '1. Totalement immobile', desc: 'Ne peut faire aucun ajustement postural' },
                      { val: '2', label: '2. Très limitée', desc: 'Ajustements posturaux minimes et occasionnels' },
                      { val: '3', label: '3. Légèrement limitée', desc: 'Changements de position réguliers bien que restreints' },
                      { val: '4', label: '4. Sans limitation', desc: 'Mouvements autonomes frequents et complets' }
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setBraden({ ...braden, mobility: opt.val })}
                        className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                          braden.mobility === opt.val
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-semibold ring-2 ring-emerald-500/10'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="text-xs font-bold">{opt.label}</div>
                        <div className="text-[10px] text-slate-500 mt-1 leading-normal">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Nutrition */}
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">5. Habitudes de nutrition</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    {[
                      { val: '1', label: '1. Très pauvre', desc: 'Refuse bcp ou nutrition entérale/NPT insuffisante' },
                      { val: '2', label: '2. Probablement inadéquate', desc: 'Ne mange que la moitié des rations servies' },
                      { val: '3', label: '3. Adéquate', desc: 'Mange plus de la moitié de ses repas habituels' },
                      { val: '4', label: '4. Excellente', desc: 'Mange la totalité des repas, refuse rarement' }
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setBraden({ ...braden, nutrition: opt.val })}
                        className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                          braden.nutrition === opt.val
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-semibold ring-2 ring-emerald-500/10'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="text-xs font-bold">{opt.label}</div>
                        <div className="text-[10px] text-slate-500 mt-1 leading-normal">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Friction and Shear */}
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">6. Friction et cisaillement</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {[
                      { val: '1', label: '1. Problème avéré', desc: 'Glisse constamment dans le lit, frotte fort' },
                      { val: '2', label: '2. Problème potentiel', desc: 'Se déplace avec un peu de friction / aide minime' },
                      { val: '3', label: '3. Aucun problème apparent', desc: 'Bonne force de poussée, transfert sain' }
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setBraden({ ...braden, friction: opt.val })}
                        className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                          braden.friction === opt.val
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-semibold ring-2 ring-emerald-500/10'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="text-xs font-bold">{opt.label}</div>
                        <div className="text-[10px] text-slate-500 mt-1 leading-normal">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* SUMMARY BRADEN */}
              <div className={`p-4 rounded-xl border mt-8 ${calculatedBraden.riskColor}`}>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0" />
                  <div>
                    <h5 className="font-bold text-sm">Risque d'escarres : {calculatedBraden.riskLevel?.toUpperCase()}</h5>
                    <p className="text-sm mt-1">{calculatedBraden.alertText}</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-between">
                <button
                  type="button"
                  onClick={() => setActiveTab('news2')}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-sm px-5 py-3 rounded-lg transition-colors cursor-pointer"
                >
                  Retour
                </button>
                <button
                  id="btn-goto-morse"
                  type="button"
                  onClick={() => setActiveTab('morse')}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm px-6 py-3 rounded-lg shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                >
                  Continuer vers Morse
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </section>
          )}

          {/* ----------------- MORSE FALL SCALE TAB ----------------- */}
          {activeTab === 'morse' && (
            <section id="panel-morse" className="no-print bg-white rounded-xl border border-slate-200 shadow-xs p-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                <div className="flex items-center space-x-2">
                  <Footprints className="h-5.5 w-5.5 text-emerald-600 animate-pulse" />
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Échelle de Chute de Morse (Morse Fall Scale)</h3>
                    <p className="text-xs text-slate-500">Dépistage clinique du risque de chute traumatique</p>
                  </div>
                </div>
                <div className="bg-slate-900 text-white px-4 py-2 rounded-xl text-right">
                  <span className="text-xs text-slate-300 block uppercase font-bold tracking-wider">Score Morse</span>
                  <span className="text-2xl font-mono font-extrabold">{calculatedMorse.score} / 125</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. History of Falls */}
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-2xs">
                  <label className="block text-xs font-bold text-slate-700 mb-2 uppercase">1. Antécédents de chute (3 derniers mois)</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setMorse({ ...morse, history: 'no' })}
                      className={`flex-1 py-3 rounded-lg text-xs font-semibold cursor-pointer border ${
                        morse.history === 'no'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Non (0 pt)
                    </button>
                    <button
                      type="button"
                      onClick={() => setMorse({ ...morse, history: 'yes' })}
                      className={`flex-1 py-3 rounded-lg text-xs font-semibold cursor-pointer border ${
                        morse.history === 'yes'
                          ? 'border-rose-500 bg-rose-50 text-rose-950 font-bold'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Oui (+25 pts)
                    </button>
                  </div>
                </div>

                {/* 2. Secondary Diagnosis */}
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-2xs">
                  <label className="block text-xs font-bold text-slate-700 mb-2 uppercase">2. Diagnostic clinique secondaire ou multiple</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setMorse({ ...morse, secondary: 'no' })}
                      className={`flex-1 py-3 rounded-lg text-xs font-semibold cursor-pointer border ${
                        morse.secondary === 'no'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Non (0 pt)
                    </button>
                    <button
                      type="button"
                      onClick={() => setMorse({ ...morse, secondary: 'yes' })}
                      className={`flex-1 py-3 rounded-lg text-xs font-semibold cursor-pointer border ${
                        morse.secondary === 'yes'
                          ? 'border-orange-500 bg-orange-50 text-orange-950 font-bold'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Oui (+15 pts)
                    </button>
                  </div>
                </div>

                {/* 3. Walk Aid */}
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-2xs">
                  <label className="block text-xs font-bold text-slate-700 mb-2 uppercase">3. Assistance pour déambulation</label>
                  <select
                    value={morse.aid}
                    onChange={(e) => setMorse({ ...morse, aid: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-emerald-500"
                  >
                    <option value="bed">Aucun / Alité stricte / Fauteuil roulant (0 pt)</option>
                    <option value="crutches">Cannes / Béquilles / Déambulateur (+15 pts)</option>
                    <option value="furniture">S'appuie sur les meubles en marchant (+30 pts)</option>
                  </select>
                </div>

                {/* 4. IV saline lock */}
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-2xs">
                  <label className="block text-xs font-bold text-slate-700 mb-2 uppercase">4. Présence d'une Voie Veineuse / Perfusion / Lock</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setMorse({ ...morse, iv: 'no' })}
                      className={`flex-1 py-3 rounded-lg text-xs font-semibold cursor-pointer border ${
                        morse.iv === 'no'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Non (0 pt)
                    </button>
                    <button
                      type="button"
                      onClick={() => setMorse({ ...morse, iv: 'yes' })}
                      className={`flex-1 py-3 rounded-lg text-xs font-semibold cursor-pointer border ${
                        morse.iv === 'yes'
                          ? 'border-orange-500 bg-orange-50 text-orange-950 font-bold'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Oui (+20 pts)
                    </button>
                  </div>
                </div>

                {/* 5. Gait */}
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-2xs">
                  <label className="block text-xs font-bold text-slate-700 mb-2 uppercase">5. Allure / Démarche motrice</label>
                  <select
                    value={morse.gait}
                    onChange={(e) => setMorse({ ...morse, gait: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-emerald-500"
                  >
                    <option value="normal">Normale / Ne se lève pas / Alité (0 pt)</option>
                    <option value="weak">Faible / Posture voutée, pas traînants (+10 pts)</option>
                    <option value="impaired">Altérée / Perte d'équilibre, s'accroche au mobilier (+20 pts)</option>
                  </select>
                </div>

                {/* 6. Mental Status */}
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-2xs">
                  <label className="block text-xs font-bold text-slate-700 mb-2 uppercase">6. État cognitif / Vigilance de ses limites</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setMorse({ ...morse, mental: 'realistic' })}
                      className={`flex-1 py-3 rounded-lg text-xs font-semibold cursor-pointer border ${
                        morse.mental === 'realistic'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Conscient de ses limites (0 pt)
                    </button>
                    <button
                      type="button"
                      onClick={() => setMorse({ ...morse, mental: 'forgetful' })}
                      className={`flex-1 py-3 rounded-lg text-xs font-semibold cursor-pointer border ${
                        morse.mental === 'forgetful'
                          ? 'border-rose-500 bg-rose-50 text-rose-950 font-bold'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Oublie ou surestime ses capacités (+15 pts)
                    </button>
                  </div>
                </div>
              </div>

              {/* MORSE INTERPRETATION */}
              <div className={`p-4 rounded-xl border mt-8 ${calculatedMorse.riskColor}`}>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0" />
                  <div>
                    <h5 className="font-bold text-sm">Alerte Morse : Risque {calculatedMorse.riskLevel}</h5>
                    <p className="text-sm mt-1">{calculatedMorse.alertText}</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-between">
                <button
                  type="button"
                  onClick={() => setActiveTab('braden')}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-sm px-5 py-3 rounded-lg transition-colors cursor-pointer"
                >
                  Retour
                </button>
                <button
                  id="btn-goto-barthel"
                  type="button"
                  onClick={() => setActiveTab('barthel')}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm px-6 py-3 rounded-lg shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                >
                  Continuer vers Barthel
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </section>
          )}

          {/* ----------------- BARTHEL INDEX TAB ----------------- */}
          {activeTab === 'barthel' && (
            <section id="panel-barthel" className="no-print bg-white rounded-xl border border-slate-200 shadow-xs p-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                <div className="flex items-center space-x-2">
                  <UserCheck className="h-5.5 w-5.5 text-teal-600 animate-pulse" />
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Indice de Barthel (Évaluation de l'Autonomie)</h3>
                    <p className="text-xs text-slate-500">Capacités fonctionnelles dans les actes quotidiens</p>
                  </div>
                </div>
                <div className="bg-slate-900 text-white px-4 py-2 rounded-xl text-right">
                  <span className="text-xs text-slate-300 block uppercase font-bold tracking-wider">Score Barthel</span>
                  <span className="text-2xl font-mono font-extrabold">{calculatedBarthel.total} / 100</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Eating */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <label className="block text-xs font-bold text-slate-800 mb-2 uppercase">1. Alimentation / Repas</label>
                  <select
                    value={barthel.eating}
                    onChange={(e) => setBarthel({ ...barthel, eating: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:border-emerald-500 focus:ring-emerald-200"
                  >
                    <option value="10">Independent (Totalement autonome) (10 pt)</option>
                    <option value="5">Besoin d'aide (ex: couper la viande, beurrer le pain) (5 pt)</option>
                    <option value="0">Dépendant total (0 pt)</option>
                  </select>
                </div>

                {/* Grooming */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <label className="block text-xs font-bold text-slate-800 mb-2 uppercase">2. Toilette personnelle / Visage / Dents</label>
                  <select
                    value={barthel.grooming}
                    onChange={(e) => setBarthel({ ...barthel, grooming: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:border-emerald-500 focus:ring-emerald-200"
                  >
                    <option value="5">Autonome (se rase, se coiffe seul) (5 pt)</option>
                    <option value="0">Dépendant (a besoin d'une aide) (0 pt)</option>
                  </select>
                </div>

                {/* Bathing */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <label className="block text-xs font-bold text-slate-800 mb-2 uppercase">3. Prendre un bain ou douche</label>
                  <select
                    value={barthel.bathing}
                    onChange={(e) => setBarthel({ ...barthel, bathing: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:border-emerald-500 focus:ring-emerald-200"
                  >
                    <option value="5">Autonome (se lave entierement sans aide) (5 pt)</option>
                    <option value="0">Dépendant d'autrui (0 pt)</option>
                  </select>
                </div>

                {/* Dressing */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <label className="block text-xs font-bold text-slate-800 mb-2 uppercase">4. Habillage & Chaussage</label>
                  <select
                    value={barthel.dressing}
                    onChange={(e) => setBarthel({ ...barthel, dressing: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:border-emerald-500 focus:ring-emerald-200"
                  >
                    <option value="10">Independent (S'habille et se chausse avec lacets seuls) (10 pt)</option>
                    <option value="5">Besoin d'aide (fait au moins la moitié seul) (5 pt)</option>
                    <option value="0">Refus ou dépendance absolue (0 pt)</option>
                  </select>
                </div>

                {/* Bowels */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <label className="block text-xs font-bold text-slate-800 mb-2 uppercase">5. Continence Intestinale / Selles</label>
                  <select
                    value={barthel.bowels}
                    onChange={(e) => setBarthel({ ...barthel, bowels: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:border-emerald-500"
                  >
                    <option value="10">Continent (Aucun accident) (10 pt)</option>
                    <option value="5">Incontinence occasionnelle (&lt;1 accident / semaine) (5 pt)</option>
                    <option value="0">Incontinent total ou lavements réguliers (0 pt)</option>
                  </select>
                </div>

                {/* Bladder */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <label className="block text-xs font-bold text-slate-800 mb-2 uppercase">6. Continence Urinaire / Urines</label>
                  <select
                    value={barthel.bladder}
                    onChange={(e) => setBarthel({ ...barthel, bladder: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:border-emerald-500"
                  >
                    <option value="10">Continent (Aucun accident durant la semaine) (10 pt)</option>
                    <option value="5">Incontinence occasionnelle ou accident mineur (5 pt)</option>
                    <option value="0">Sonde urinaire ou incontinence complète (0 pt)</option>
                  </select>
                </div>

                {/* Toilet Use */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <label className="block text-xs font-bold text-slate-800 mb-2 uppercase">7. Utilisation des WC / Toilette</label>
                  <select
                    value={barthel.toilet}
                    onChange={(e) => setBarthel({ ...barthel, toilet: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:border-emerald-500"
                  >
                    <option value="10">Independent (S'essuie, s'habille seul, tire la chasse) (10 pt)</option>
                    <option value="5">Besoin d'un soutien pour se déshabiller ou s'essuyer aux WC (5 pt)</option>
                    <option value="0">Dépendant total (0 pt)</option>
                  </select>
                </div>

                {/* Transfers */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <label className="block text-xs font-bold text-slate-800 mb-2 uppercase">8. Transfert lit-fauteuil et retour</label>
                  <select
                    value={barthel.transfer}
                    onChange={(e) => setBarthel({ ...barthel, transfer: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:border-emerald-500"
                  >
                    <option value="15">Autonome (Se lève seul, s'assoit sainement sans aide) (15 pt)</option>
                    <option value="10">Aide mineure (Aide d'une personne physique pour rassurer) (10 pt)</option>
                    <option value="5">Aide majeure (Nécessite le support de 2 soignants) (5 pt)</option>
                    <option value="0">Dépendant absolu (Reste alité) (0 pt)</option>
                  </select>
                </div>

                {/* Locomotion */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <label className="block text-xs font-bold text-slate-800 mb-2 uppercase">9. Locomotion / Déplacement</label>
                  <select
                    value={barthel.mobility}
                    onChange={(e) => setBarthel({ ...barthel, mobility: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:border-emerald-500"
                  >
                    <option value="15">Totalement autonome (&gt;50 mètres sans béquilles) (15 pt)</option>
                    <option value="10">Aide physique active d'1 soignant (&gt;50 mètres) (10 pt)</option>
                    <option value="5">Propulsion indépendante du fauteuil roulant (&gt;50 mètres) (5 pt)</option>
                    <option value="0">Fauteuil roulant dépendant ou alité (0 pt)</option>
                  </select>
                </div>

                {/* Stairs */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <label className="block text-xs font-bold text-slate-800 mb-2 uppercase">10. Monter et monter des escaliers</label>
                  <select
                    value={barthel.stairs}
                    onChange={(e) => setBarthel({ ...barthel, stairs: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:border-emerald-500"
                  >
                    <option value="10">Independent (Monte et descend les étages seul) (10 pt)</option>
                    <option value="5">Aide nécessaire (Besoin de surveillance physique) (5 pt)</option>
                    <option value="0">Impossible (Incapable de gravir des marches) (0 pt)</option>
                  </select>
                </div>
              </div>

              {/* BARTHEL SUMMARY */}
              <div className={`p-4 rounded-xl border mt-8 ${calculatedBarthel.dependencyColor}`}>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0" />
                  <div>
                    <h5 className="font-bold text-sm">Niveau d'autonomie Barthel : {calculatedBarthel.dependencyLevel}</h5>
                    <p className="text-sm mt-1">{calculatedBarthel.alertText}</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-between">
                <button
                  type="button"
                  onClick={() => setActiveTab('morse')}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-sm px-5 py-3 rounded-lg transition-colors cursor-pointer"
                >
                  Retour
                </button>
                <button
                  id="btn-goto-summary"
                  type="button"
                  onClick={() => setActiveTab('summary')}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm px-6 py-3 rounded-lg shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                >
                  Générer le rapport final
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </section>
          )}

          {/* ----------------- SUMMARY & PROFESSIONAL REPORT GENERATOR ----------------- */}
          {activeTab === 'summary' && (
            <div className="space-y-6">
              
              {/* Report Controls (Hides on print) */}
              <div className="no-print bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <FileText className="h-5 w-5 text-emerald-600" />
                      Exporter & Imprimer le Rapport Clinique
                    </h3>
                    <p className="text-xs text-slate-500">Générez un rapport PDF professionnel ou imprimez-le via votre navigateur</p>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      id="btn-download-pdf-direct"
                      onClick={exportReportToPdf}
                      disabled={isExportingPdf}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-4 py-2.5 rounded-lg shadow-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-70"
                    >
                      {isExportingPdf ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                          Génération du PDF...
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4" />
                          Télécharger le PDF
                        </>
                      )}
                    </button>

                    <button
                      id="btn-print-report"
                      onClick={() => window.print()}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold text-sm px-4 py-2.5 rounded-lg shadow-xs flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <Printer className="h-4 w-4" />
                      Imprimer / PDF Système
                    </button>
                    
                    <button
                      id="btn-trigger-ai"
                      onClick={handleGenerateAiReport}
                      disabled={isAnalyzing}
                      className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm px-4 py-2.5 rounded-lg shadow-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Sparkles className="h-4 w-4 text-amber-400" />
                      {isAnalyzing ? "Analyse IA en cours..." : "Re-générer Synthèse IA"}
                    </button>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200/60 leading-relaxed flex items-start gap-2">
                  <Info className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-700">Conseil d'utilisation :</span> Le bouton <strong className="text-emerald-700">Télécharger le PDF</strong> effectue une compilation visuelle directe et télécharge un document sécurisé et universel. Si vous l'utilisez au sein d'une interface d'aperçu et que l'impression système est restreinte, cette méthode directe est recommandée par MediSCORE.
                  </div>
                </div>
              </div>

              {/* ---------------------------------------------------- */}
              {/* MEDICAL CHART FOR PRINTING OR PREVIEWING             */}
              {/* ---------------------------------------------------- */}
              <div id="printable-report-area" className="bg-white p-6 md:p-10 rounded-2xl border border-slate-200 shadow-sm print-card space-y-8 font-serif text-slate-950">
                
                {/* Header Chart */}
                <div className="border-b-4 border-slate-900 pb-5">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h2 className="text-2xl font-extrabold tracking-tight uppercase text-slate-950">
                        RAPPORT CLINIQUE MULTIDIMENSIONNEL
                      </h2>
                      <p className="text-xs font-mono text-slate-500 tracking-wider">
                        RÉFÉRENCE DOSSIER SPÉCIFIQUE • CLINIQUE MÉDIQ
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-xs text-slate-600 font-sans">
                        Généré le <strong>{evaluatorInfo.date || '---'}</strong> à <strong>{evaluatorInfo.time || '---'}</strong>
                      </p>
                      <p className="text-xs text-indigo-700 font-sans font-bold">
                        Dossier : {patientInfo.medicalId || 'NON SPÉCIFIÉ'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Patient / Evaluator Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-5 rounded-xl border border-slate-200 font-sans text-sm">
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-200 pb-1">
                      INFORMATIONS PATIENT
                    </h4>
                    <table className="w-full text-slate-800">
                      <tbody>
                        <tr className="border-b border-slate-100/50">
                          <td className="py-1 font-bold text-slate-500 w-1/3">Nom complet :</td>
                          <td className="py-1 font-extrabold text-slate-900">{patientInfo.lastName?.toUpperCase() || '---'} {patientInfo.firstName || '---'}</td>
                        </tr>
                        <tr className="border-b border-slate-100/50 flex-none">
                          <td className="py-1 font-bold text-slate-500">Âge & Genre :</td>
                          <td className="py-1 text-slate-900">{patientInfo.age ? `${patientInfo.age} ans` : '---'} • {patientInfo.gender || '---'}</td>
                        </tr>
                        <tr>
                          <td className="py-1 font-bold text-slate-500">Service / Lit :</td>
                          <td className="py-1 text-slate-900">{patientInfo.department || '---'} {patientInfo.room ? `/ ${patientInfo.room}` : ''}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-200 pb-1">
                      DÉTAILS DE L'ÉVALUATION
                    </h4>
                    <table className="w-full text-slate-800">
                      <tbody>
                        <tr className="border-b border-slate-100/50">
                          <td className="py-1 font-bold text-slate-500 w-1/3">Évaluateur :</td>
                          <td className="py-1 font-extrabold text-slate-900">{evaluatorInfo.name || '---'}</td>
                        </tr>
                        <tr className="border-b border-slate-100/50">
                          <td className="py-1 font-bold text-slate-500">Fonction :</td>
                          <td className="py-1 text-slate-900">{evaluatorInfo.role || '---'}</td>
                        </tr>
                        <tr>
                          <td className="py-1 font-bold text-slate-500">Statut Dossier :</td>
                          <td className="py-1"><span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Validé et Signé</span></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Clinical Context / Signs (Only if entered) */}
                {patientInfo.diagnosisAndSigns && (
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl font-sans text-sm">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 border-b border-slate-200 pb-1">
                      CONTEXTE CLINIQUE & DIAGNOSTIC DE SÉJOUR
                    </h4>
                    <p className="text-slate-800 italic bg-white p-3 rounded-lg border border-slate-150 whitespace-pre-wrap leading-relaxed">
                      {patientInfo.diagnosisAndSigns}
                    </p>
                  </div>
                )}

                {/* Scores Matrix Dashboard */}
                <div>
                  <h3 className="text-lg font-bold uppercase tracking-wider mb-4 border-b border-slate-200 pb-1 text-slate-900">
                    SÉRIE DE SCORES CLINIQUES VALIDÉS
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5 font-sans">
                    {/* GCS */}
                    <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-2xs">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">GLASGOW (GCS)</div>
                      <div className="text-2xl font-mono font-black mt-1 text-slate-900">{calculatedGcs.total} / 15</div>
                      <div className="text-[10px] mt-1 font-semibold text-slate-500 uppercase">{calculatedGcs.severity}</div>
                      <div className="mt-3 text-[10px] text-slate-500 leading-tight">Y: {gcs.eyes} • V: {gcs.verbal} • M: {gcs.motor}</div>
                    </div>

                    {/* NEWS2 */}
                    <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-2xs">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">NEWS2 (Vital)</div>
                      <div className="text-2xl font-mono font-black mt-1 text-red-600">{calculatedNews2.score} / 20</div>
                      <div className="text-[10px] mt-1 font-semibold text-slate-650 uppercase">Risque {calculatedNews2.riskLevel}</div>
                      <div className="mt-3 text-[10px] text-slate-500 leading-tight">SpO2: {news2.spo2}% • O2: {news2.oxygen === 'yes' ? 'Oui' : 'Non'}</div>
                    </div>

                    {/* Braden */}
                    <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-2xs">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">BRADEN (Cutané)</div>
                      <div className="text-2xl font-mono font-black mt-1 text-slate-900">{calculatedBraden.total} / 23</div>
                      <div className="text-[10px] mt-1 font-semibold text-slate-500 uppercase">R: {calculatedBraden.riskLevel}</div>
                      <div className="mt-3 text-[10px] text-slate-500 leading-tight">Mob: {braden.mobility}/4 • Hum: {braden.moisture}/4</div>
                    </div>

                    {/* Morse */}
                    <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-2xs">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">MORSE (Chutes)</div>
                      <div className="text-2xl font-mono font-black mt-1 text-slate-900">{calculatedMorse.score} / 125</div>
                      <div className="text-[10px] mt-1 font-semibold text-slate-500 uppercase">R: {calculatedMorse.riskLevel}</div>
                      <div className="mt-3 text-[10px] text-slate-500 leading-tight">Hist: {morse.history} • IV: {morse.iv}</div>
                    </div>

                    {/* Barthel */}
                    <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-2xs">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">BARTHEL (Indice)</div>
                      <div className="text-2xl font-mono font-black mt-1 text-slate-900">{calculatedBarthel.total} / 100</div>
                      <div className="text-[10px] mt-1 font-semibold text-slate-500 uppercase">{calculatedBarthel.dependencyLevel}</div>
                      <div className="mt-3 text-[10px] text-slate-500 leading-tight">Alim: {barthel.eating}/10 • WC: {barthel.toilet}/10</div>
                    </div>
                  </div>
                </div>

                {/* Expert Guidance Box */}
                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 font-sans">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Recommandations Cliniques Automatiques de Sécurité</h4>
                  <ul className="text-xs text-slate-700 space-y-1.5 list-disc pl-4 leading-normal">
                    {calculatedGcs.total <= 8 && (
                      <li className="font-semibold text-red-600">Protéger impérativement les voies aériennes supérieures (GCS &le; 8).</li>
                    )}
                    {calculatedNews2.score >= 5 && (
                      <li className="font-semibold text-orange-600">Fréquence de surveillance NEWS2 portée à au moins une fois toutes les 1h. Alerte requise auprès du médecin senior.</li>
                    )}
                    {calculatedBraden.total <= 12 && (
                      <li>Mettre en place un protocole d'effleurage et de changement de posture toutes les 2h avec matelas dynamique de décharge.</li>
                    )}
                    {calculatedMorse.score >= 45 && (
                      <li>Patient à haut risque de traumatisme par chute. Protocol anti-chute activé avec interdiction de déambulation non accompagnée.</li>
                    )}
                    {calculatedBarthel.total <= 60 && (
                      <li>Aide complète requise pour les transferts et la toilette. Organiser la présence de 2 soignants lors des mobilisations.</li>
                    )}
                    <li>Surveiller en permanence l'état neurologique (Glasgow) et vital global (Escale NEWS2).</li>
                  </ul>
                </div>

                {/* Gemini AI Clinical Synthesis Result */}
                <div className="border-t border-slate-200 pt-6">
                  <h3 className="text-lg font-bold uppercase tracking-wider mb-4 text-slate-900 flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-amber-500" />
                    SYNTHÈSE SYNTHÉTIQUE IA - INTERPRÉTATION MULTIDIMENSIONNELLE
                  </h3>

                  {isAnalyzing ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-3 font-sans">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
                      <p className="text-xs text-slate-500 animate-pulse font-semibold">Génération de la synthèse d'évaluation médicale...</p>
                    </div>
                  ) : errorMessage ? (
                    <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl text-xs font-sans">
                      {errorMessage}
                    </div>
                  ) : aiReport ? (
                    <div className="prose prose-slate max-w-none text-xs md:text-sm leading-relaxed prose-headings:text-slate-900 prose-strong:text-slate-950 font-sans whitespace-pre-line text-slate-800 bg-slate-50/50 p-5 rounded-xl border border-slate-100">
                      {aiReport}
                    </div>
                  ) : (
                    <div className="text-center py-8 font-sans text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                      Aucune analyse IA disponible. Veuillez cliquer sur "Générer la Synthèse Clinique IA" pour lancer l'expert.
                    </div>
                  )}
                </div>

                {/* Hospital Stamp / Signature zone */}
                <div className="border-t border-slate-200 pt-8 mt-12 grid grid-cols-2 gap-8 text-xs font-sans">
                  <div>
                    <p className="font-bold text-slate-400 uppercase tracking-widest mb-12">CACHET CLINIQUE / SERVICE</p>
                    <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 h-24 text-center flex items-center justify-center text-slate-350">
                      Service de Médecine Clinique
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-400 uppercase tracking-widest mb-12">SIGNATURE THERAPEUTE / EVALUATEUR</p>
                    <div className="pr-4 italic text-slate-800 font-serif">
                      {evaluatorInfo.name || '---'} {evaluatorInfo.role ? `(${evaluatorInfo.role})` : ''}
                      <div className="w-1/2 ml-auto border-b border-slate-300 mt-6"></div>
                    </div>
                  </div>
                </div>

              </div>
              
              {/* Back to Tabs button */}
              <div className="no-print flex justify-start">
                <button
                  type="button"
                  onClick={() => setActiveTab('barthel')}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-sm px-5 py-3 rounded-lg transition-colors cursor-pointer"
                >
                  Retour aux calculs
                </button>
              </div>

            </div>
          )}

        </div>
      </main>

      {/* Footer copyright */}
      <footer className="no-print py-6 mt-12 border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-400">
          <p>© 2026 Portail Clinique MediSCORE. Développé pour la saisie et l'évaluation clinique multidimensionnelle (Glasgow, NEWS2, Braden, Morse, Barthel).</p>
        </div>
      </footer>
    </div>
  );
}
