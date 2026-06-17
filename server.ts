import express from 'express';
import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Initialize Gemini SDK lazily to avoid startup crashes if key is missing
let aiClient: GoogleGenAI | null = null;
function getAiClient() {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key && key !== 'MY_GEMINI_API_KEY') {
      aiClient = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
  }
  return aiClient;
}

// REST route for analyzing patient clinician scores
app.post('/api/analyze-patient', async (req, res) => {
  try {
    const { patientInfo, evaluatorInfo, scores } = req.body;

    const patientDesc = `
================ PATIENT ================
Nom: ${patientInfo.lastName || 'Non spécifié'}
Prénom: ${patientInfo.firstName || 'Non spécifié'}
ID / N° de Dossier: ${patientInfo.medicalId || 'Non spécifié'}
Âge: ${patientInfo.age || 'Non spécifié'} ans
Genre: ${patientInfo.gender || 'Non spécifié'}
Service: ${patientInfo.department || 'Non spécifié'}
Diagnostic d'admission / Signes cliniques actuels: ${patientInfo.diagnosisAndSigns || 'Aucun renseigné'}
Date/Heure Éval: ${evaluatorInfo.date || 'Non spécifiée'} à ${evaluatorInfo.time || 'Non spécifiée'}
Évaluateur: ${evaluatorInfo.name || 'Non spécifié'} (Profession: ${evaluatorInfo.role || 'Non spécifiée'})

================ ÉCHELLES DE SCORE ================
1. SCORE DE GLASGOW (GCS): ${scores.gcs.score}/15 (${scores.gcs.severity})
   - Ouverture des yeux: ${scores.gcs.eyes}/4
   - Réponse verbale: ${scores.gcs.verbal}/5
   - Réponse motrice: ${scores.gcs.motor}/6

2. NEWS2 (Alerte précoce vitale): ${scores.news2.score}/20 (Risque: ${scores.news2.riskLevel})
   - Fréquence respiratoire: ${scores.news2.parameters.rr}
   - SaO2 / SpO2: ${scores.news2.parameters.spo2} (Échelle: ${scores.news2.scaleType === 'COPD' ? 'Échelle 2 BPCO' : 'Échelle 1 Standard'})
   - Oxygénothérapie: ${scores.news2.parameters.oxygen === 'yes' ? 'Oxygène' : 'Air ambiant'}
   - Température: ${scores.news2.parameters.temp} °C
   - Pression artérielle systolique: ${scores.news2.parameters.pas} mmHg
   - Fréquence cardiaque: ${scores.news2.parameters.hr} bpm
   - État neurologique: ${scores.news2.parameters.cvpu === 'alert' ? 'Alerte' : 'Confusion Nouvelle / Réactivité réduite (CVPU)'}

3. ÉCHELLE DE BRADEN (Risque d'escarres): ${scores.braden.score}/23 (Risque: ${scores.braden.riskLevel})
   - Perception sensorielle: ${scores.braden.parameters.sensory}/4
   - Humidité de la peau: ${scores.braden.parameters.moisture}/4
   - Activité physique: ${scores.braden.parameters.activity}/4
   - Mobilité: ${scores.braden.parameters.mobility}/4
   - Nutrition: ${scores.braden.parameters.nutrition}/4
   - Friction et cisaillement: ${scores.braden.parameters.friction}/3

4. ÉCHELLE DE MORSE (Risque de chute): ${scores.morse.score}/125 (Risque: ${scores.morse.riskLevel})
   - Antécédents de chute (3 mois): ${scores.morse.parameters.history === 'yes' ? 'Oui (25 pts)' : 'Non (0 pt)'}
   - Diagnostics secondaires: ${scores.morse.parameters.secondary === 'yes' ? 'Oui (15 pts)' : 'Non (0 pt)'}
   - Assistant à la marche: ${scores.morse.parameters.aid === 'bed' ? 'Aucun / Alité / Fauteuil' : scores.morse.parameters.aid === 'crutches' ? 'Cannes / Déambulateur' : 'S\'appuie sur le mobilier'}
   - Voie veineuse périphérique / Perfusion: ${scores.morse.parameters.iv === 'yes' ? 'Oui (20 pts)' : 'Non (0 pt)'}
   - Démarche / Transferts: ${scores.morse.parameters.gait === 'normal' ? 'Normale / Alité' : scores.morse.parameters.gait === 'weak' ? 'Faible / Fatiguée' : 'Altérée / Instable'}
   - État mental / Conscience des limites: ${scores.morse.parameters.mental === 'realistic' ? 'Conscient de ses limites' : 'Surestime ses capacités / Oublie ses limites'}

5. INDICE DE BARTHEL (Autonomie / Act. vie quotidienne): ${scores.barthel.score}/100 (Dépendance: ${scores.barthel.dependencyLevel})
   - Alimentation: ${scores.barthel.parameters.eating}/10
   - Lavage / Toilette: ${scores.barthel.parameters.bathing}/5
   - Habillage: ${scores.barthel.parameters.dressing}/10
   - Toilette intime/Grooming: ${scores.barthel.parameters.grooming}/5
   - Selle (continence): ${scores.barthel.parameters.bowels}/10
   - Urine (continence): ${scores.barthel.parameters.bladder}/10
   - Utilisation des WC: ${scores.barthel.parameters.toilet}/10
   - Transferts (lit/fauteuil): ${scores.barthel.parameters.transfer}/15
   - Déplacement (marche/fauteuil): ${scores.barthel.parameters.mobility}/15
   - Utilisation des escaliers: ${scores.barthel.parameters.stairs}/10
`;

    const promptMessage = `
Vous êtes un expert clinicien senior et médecin coordinateur. Votre tâche consiste à rédiger un rapport formel d'analyse clinique et de synthèse de dossier en français, fondé sur l'évaluation multidimensionnelle reçue.

Prenez impérativement en compte le diagnostic d'admission et les signes cliniques actuels du patient renseignés par le soignant pour contextualiser, pondérer et affiner l'analyse de risque multidisciplinaire croisée ainsi que pour adapter vos recommandations cliniques prioritaires.

Voici les données du patient :
${patientDesc}

Veuillez structurer votre rapport en sections claires sous format Markdown :
1. **Introduction et Profil Clinique Global** : Résumez l'état clinique global de manière synthétique, en reliant les scores cliniques observés au diagnostic d'admission et aux signes décrits, et évaluez l'urgence de prise en charge éventuelle.
2. **Analyse de Risque Multidimensionnelle Croisée** :
   - Risque Neurologique & Vigilance (GCS)
   - Statut Vital et Hémodynamique (NEWS2)
   - Intégrité Cutanée (Braden)
   - Sécurité motrice & Risque de chute (Morse)
   - Degré d'autonomie / Dépendance fonctionnelle (Barthel)
3. **Plan d'Actions Cliniques et de Surveillance (Prioritaire)** : Proposez des soins ciblés, fréquences de monitorage (e.g. continu, toutes les 4h, par équipe), recommandations de mobilisations, de nutrition ou de kinésithérapie, en rapport avec le profil et les signes du patient.
4. **Signaux d'Alerte Cruciaux ("Red Flags")** : Liste précise des indicateurs qui justifieraient un appel immédiat du médecin de garde ou du réanimateur, y compris les complications spécifiques liées au diagnostic ou aux signes mentionnés.

Rédigez d'un ton neutre, rigoureux et hautement professionnel. N'utilisez pas de conjectures évasives. Concentrez-vous sur des mesures actionnables cliniquement.
`;

    const client = getAiClient();
    if (!client) {
      // Rule-based fallback if no API key is set
      console.log("No Gemini API key found, generating high-quality rules-based synthesis.");
      const fallbackReport = generateRulesBasedSynthesis(patientInfo, scores);
      return res.json({ analysis: fallbackReport, isFallback: true });
    }

    let responseText = "";
    let isFallback = false;
    let attempts = 3;
    let delay = 500; // start with 500ms delay

    for (let i = 0; i < attempts; i++) {
      try {
        const response = await client.models.generateContent({
          model: "gemini-2.5-flash",
          contents: promptMessage,
        });
        responseText = response.text || "";
        break; // Success, exit loop
      } catch (err: any) {
        console.warn(`Gemini API call attempt ${i + 1} failed:`, err);
        const isTransient = err.status === 503 || err.status === 429 || String(err.message).includes("503") || String(err.message).includes("demand");
        
        if (i < attempts - 1 && isTransient) {
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2.5; // Exponential backoff scaling
        } else {
          // No more attempts or not a transient error, trigger graceful algorithmic fallback
          console.log("Gemini API persistently unavailable or failed. Falling back to rule-based clinical engine.");
          const fallbackReport = generateRulesBasedSynthesis(patientInfo, scores);
          responseText = `⚠️ **Note Clinique : Le service de synthèse IA est actuellement surchargé.** Afin de garantir la continuité des soins, une analyse experte d'urgence a été générée instantanément par le moteur algorithmique clinique de secours (basé sur les scores GCS, NEWS2, Braden, Morse et Barthel).\n\n${fallbackReport}`;
          isFallback = true;
          break;
        }
      }
    }

    res.json({ analysis: responseText || "Erreur de génération d'analyse clinique.", isFallback });
  } catch (error: any) {
    console.error("Gemini analysis error:", error);
    res.status(500).json({ error: error.message || "Erreur serveur lors de la génération" });
  }
});

// A rule-based medical synthesis engine in French to guarantee the app's usefulness offline/pre-configured keys
function generateRulesBasedSynthesis(info: any, scores: any): string {
  const gcs = scores.gcs;
  const news2 = scores.news2;
  const braden = scores.braden;
  const morse = scores.morse;
  const barthel = scores.barthel;

  let report = `### RAPPORT COMPLÉMENTAIRE DE SYNTHÈSE EXPERTE (MÉCANIQUE)

*Ce rapport de synthèse clinique a été généré de manière algorithmique sur la base des seuils standardisés de référence.*

---

#### 1. Synthèse Globale du Patient
Le patient **${info.lastName?.toUpperCase()} ${info.firstName}** âgé de **${info.age || 'N/A'} ans** fait l'objet d'un examen multidimensionnel dans le service **${info.department || 'Non spécifié'}**.
* **Diagnostic d'admission / Signes cliniques actuels** : *${info.diagnosisAndSigns || 'Aucun renseigné'}*
- **Urgence vitale (NEWS2)** : **Risque ${news2.riskLevel}** (${news2.score}/20). ${news2.score >= 5 ? "⚠️ Une prise en charge médicale urgente est requise." : "Statut hémodynamique stable pour le moment."}
- **État clinique général** : Présente un score de dépendance fonctionnelle de **${barthel.score}/100** définissant une **dépendance ${barthel.dependencyLevel.toLowerCase()}**, couplé à un risque de chute **${morse.riskLevel.toLowerCase()}** (Score Morse: ${morse.score}) et un risque d'escarres **${braden.riskLevel.toLowerCase()}** (Score Braden: ${braden.score}).

---

#### 2. Analyse Croisée des Risques Cliniques

- **Neurologique (GCS : ${gcs.score}/15 - ${gcs.severity})** :
  ${gcs.score <= 8 ? "🔴 **Alerte réanimation critique :** Score <= 8 suggère un coma ou une incapacité à protéger les voies aériennes. Ventilation mécanique à évaluer en urgence." : gcs.score <= 12 ? "🟡 Vigilance modérée. Risque de détérioration neurologique. Monitorage neurologique rapproché nécessaire." : "🟢 Vigilance normale ou subnormale."}

- **Hémodynamique et Respiratoire (NEWS2 : ${news2.score}/20 - Risque ${news2.riskLevel})** :
  ${news2.score >= 7 ? "🔴 **Risque Clinique Élevé (NEWS2-Rouge) :** Alerte majeure. Requiert une évaluation immédiate par une équipe de réanimation ou une unité de soins continus." : news2.score >= 5 ? "🟡 **Risque Clinique Moyen (NEWS2-Orange) :** Requiert une visite médicale d'un praticien senior sous 1h ou l'alerte d'un médecin de garde." : "🟢 **Risque Clinique Faible (NEWS2-Vert) :** Surveillance de routine par l'équipe infirmière."}

- **Prévention Cutanée / Risque d'Escarre (Braden : ${braden.score}/23 - Risque ${braden.riskLevel})** :
  ${braden.score <= 12 ? "🔴 **Risque Fort à Très Élevé :** Mise en place urgente d'un matelas à air dynamique, micro-changements de position toutes les 2h obligatoires, hydratation de la peau et bilan nutritionnel systématique." : braden.score <= 18 ? "🟡 **Risque Modéré à Léger :** Matelas de décharge type mousse visco-élastique, aide à la mobilisation active/passive, maintien d'une hygiène cutanée rigoureuse." : "🟢 **Risque Faible ou Nul :** Surveillance cutanée quotidienne lors de la toilette."}

- **Sécurité et Risques de Chute (Morse : ${morse.score}/125 - Risque ${morse.riskLevel})** :
  ${morse.score >= 45 ? "🔴 **Risque Élevé de Chute :** Lit en position basse, barrières de sécurité si prescrit, aide humaine obligatoire pour tout déplacement, dispositif antidérapant, éclairage de veille nocturne." : morse.score >= 25 ? "🟡 **Risque Moyen :** Accompagnement aux WC, environnement dégagé, canne ou déambulateur à portée de main." : "🟢 **Risque Faible :** Conseils généraux de sécurité."}

- **Autonomie Motrice et Fonctionnelle (Barthel : ${barthel.score}/100 - Dépendance ${barthel.dependencyLevel})** :
  Le patient présente une dépendance ${barthel.dependencyLevel.toLowerCase()} pour les gestes de la vie courante. ${barthel.score <= 60 ? "Les transferts et la locomotion exigent une assistance physique humaine ou des aides techniques lourdes." : "Le niveau d'indépendance est préservé sur la majorité des domaines ou nécessite de simples stimulations."}

---

#### 3. Plan d'Interventions Prioritaires

1. **Surveillance Clinique** : Monitorage complet des constantes (FR, SaO2, T°, PA, FC) toutes les ${news2.score >= 5 ? "1 à 2 heures" : "8 à 12 heures"}.
2. **Mobilité & Cutané** : ${braden.score <= 14 ? "Changement de position planifié sur fiche de suivi cutané. S'assurer de l'installation de coussins de positionnement aux talons et au sacrum." : "Encourager la déambulation active sous surveillance."}
3. **Sécurité** : Ne jamais laisser le patient sans assistance lors des transferts au lit ou aux WC en raison du score de Morse élevé.
4. **Nutrition / Hydratation** : ${braden.score <= 14 || barthel.parameters.eating < 10 ? "Bilan nutritionnel avec dosage de l'albumine sérique. Compléments nutritionnels oraux si nécessaire." : "Alimentation normale, veiller à un apport hydrique d'au moins 1,5L/jour."}

---

#### 4. Signaux d'Alerte Majeurs (Consigne de signalement immédiat)
- Augmentation graduelle ou brutale du score NEWS2 de plus de 2 points.
- Saturation en oxygène inférieure à 90% (ou inférieure à 85% chez le patient BPCO).
- Altération subite de l'état de conscience (somnolence, agitation, confusion ou GCS en baisse de >=2 points).
- Pression artérielle systolique brute inférieure à 90 mmHg.
`;
  return report;
}

// In production, serve built frontend asset packages
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
} else {
  // In development, let Vite's dev server handle assets/HMR
  import('vite').then((viteModule) => {
    viteModule.createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    }).then((viteServer) => {
      app.use(viteServer.middlewares);
      console.log("Vite dev middleware loaded in Express dev mode.");
    });
  });
}

// Start listener on Port 3000 as strictly required by platform instructions
const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server launched on http://0.0.0.0:${PORT}`);
});
