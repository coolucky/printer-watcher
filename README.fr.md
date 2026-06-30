# Système de Surveillance du Service d'Impression

[![English](https://img.shields.io/badge/lang-English-blue)](README.md) [![简体中文](https://img.shields.io/badge/lang-%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-red)](README.zh-CN.md) [![繁體中文](https://img.shields.io/badge/lang-%E7%B9%81%E9%AB%94%E4%B8%AD%E6%96%87-red)](README.zh-TW.md) [![日本語](https://img.shields.io/badge/lang-%E6%97%A5%E6%9C%AC%E8%AA%9E-orange)](README.ja.md) [![한국어](https://img.shields.io/badge/lang-%ED%95%9C%EA%B5%AD%EC%96%B4-yellow)](README.ko.md) [![Français](https://img.shields.io/badge/lang-Fran%C3%A7ais-purple)](README.fr.md) [![Deutsch](https://img.shields.io/badge/lang-Deutsch-green)](README.de.md) [![Español](https://img.shields.io/badge/lang-Espa%C3%B1ol-orange)](README.es.md)

Une application web auto-hébergée et complète pour la gestion de parc d'imprimantes d'entreprise, la surveillance des serveurs d'impression, la génération automatisée de rapports, le suivi de l'inventaire des actifs et l'intégration des tickets Jira.

Développée avec un frontend **React 18 + Material UI** et un backend **Node.js + Express**, prenant en charge une interface bilingue (English / 简体中文), le mode sombre et le déploiement hors ligne sur Windows Server.

🌐 **Portal**: [http://papercut001.example-corp.com.cn:9191/](http://papercut001.example-corp.com.cn:9191/)

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18-green.svg)
![React](https://img.shields.io/badge/react-18-blue.svg)

---

## Fonctionnalités

### 🖨️ Surveillance des imprimantes
- **Surveillance de l'état en temps réel** via le protocole SNMP (niveaux de toner, état du papier, détection d'erreurs)
- **Intervalle d'interrogation de 30 secondes** avec temporisation configurable
- **Support multi-imprimantes** avec configuration IP/SNMP individuelle
- **Suivi de l'historique des états** avec instantanés quotidiens
- **Mode maintenance** pour suspendre la surveillance d'imprimantes spécifiques

### 🖥️ Surveillance des serveurs d'impression
- **Utilisation CPU, mémoire, disque** pour la surveillance des serveurs d'impression Windows
- **Suivi du temps de fonctionnement** et historique des états
- **Tableau de bord visuel** avec indicateurs de santé codés par couleur
- **Gestion de la configuration des serveurs** avec ajout/modification/suppression

### 📊 Tableau de bord des états
- **Vue d'ensemble en direct** de toutes les imprimantes et serveurs en une seule vue
- **Gestion des licences** avec suivi des expirations
- **Analyses d'impression** avec graphiques d'utilisation quotidienne (contrôlé par indicateur de fonctionnalité)

### 📧 Génération automatisée de rapports
- **Rapports hebdomadaires programmés** avec envoi par e-mail
- **5 modèles de style de rapport** au choix
- **Rapports par e-mail HTML** avec tableaux d'état des imprimantes
- **Destinataires configurables** et planification horaire
- **Génération manuelle de rapports** avec aperçu instantané

### 🔔 Système d'alertes
- **Alertes de toner bas** avec seuil configurable (5% / 10%)
- **Alertes d'imprimante hors ligne** avec notifications par e-mail
- **Alertes d'erreur de serveur d'impression**
- **Intégration e-mail SMTP** avec mécanisme de réessai
- **Animation de respiration** sur les indicateurs d'alerte actifs

### 📦 Inventaire des actifs
- **Suivi des actifs matériels** et gestion
- **Gestion des sessions d'inventaire** pour les audits périodiques
- **Export Excel** pris en charge (ExcelJS intégré pour une utilisation hors ligne)

### 🎫 Intégration des tickets Jira
- **Création de tickets basée sur des modèles** avec plus de 20 modèles configurables
- **Création de tickets par lots** pour plusieurs déclarants
- **Variables auto-remplies** : `{ntid}`, `{fullname}`, `{DATE_COMPACT}`, etc.
- **Recherche de tickets** avec recherche progressive par préfixe (ISDS → TPX → CHG → ECSR)
- **Surveillance des approbations en attente** avec interrogation en temps réel
- **Approbation du Service Desk** prise en charge (Approuver/Refuser pour les tickets ISDS)
- **Actions rapides** : Commenter, Résoudre, Fermer avec remplissage automatique du composant interne
- **Modèles de commentaires** (partagés entre utilisateurs, persistés côté serveur)
- **Gestion des modèles** avec tri par fréquence d'utilisation et suivi des utilisations récentes

### 👥 Gestion des utilisateurs
- **Contrôle d'accès basé sur les rôles** : Administrateur, Éditeur, Lecteur
- **Authentification JWT** avec jetons de rafraîchissement
- **Gestion du profil utilisateur**

### 🌐 Internationalisation
- **Interface bilingue** : anglais et chinois simplifié
- **Changement de langue en temps réel** sans rechargement de page
- **Tout le texte de l'interface** géré via des clés i18n

### 🌙 Mode sombre
- **Support complet du thème sombre** sur tous les composants
- **Thématisation basée sur les variables CSS** pour un style cohérent
- **Basculement en un clic** avec persistance des préférences

---

## Stack technique

### Frontend
| Technologie | Utilisation |
|---|---|
| React 18 | Framework UI |
| Material UI 7 | Bibliothèque de composants |
| Vite 7 | Outil de build et serveur de développement |
| Chart.js | Visualisation de données |
| i18next | Internationalisation |
| Axios | Client HTTP |
| react-hook-form | Gestion des formulaires |

### Backend
| Technologie | Utilisation |
|---|---|
| Node.js 18+ | Environnement d'exécution |
| Express 5 | Framework web |
| net-snmp | Requêtes SNMP pour imprimantes |
| nodemailer | Envoi d'e-mails |
| jsonwebtoken | Authentification JWT |
| bcryptjs | Hachage de mots de passe |
| Puppeteer | Capture d'écran |
| Tesseract.js | Traitement OCR |
| cheerio | Analyse HTML |

---

## Structure du projet

```
├── src/                          # Source frontend
│   ├── components/               # Composants React
│   │   ├── StatusDashboard.jsx   # Tableau de bord de surveillance principal
│   │   ├── PrintServerDashboard.jsx
│   │   ├── ReportForm.jsx        # Génération de rapports
│   │   ├── AlertSettings.jsx     # Configuration des alertes
│   │   ├── JiraTickets.jsx       # Intégration Jira
│   │   ├── AssetInventory.jsx    # Suivi des actifs
│   │   ├── SettingsPanel.jsx     # Paramètres système
│   │   └── ...
│   ├── i18n/locales/             # Fichiers de traduction
│   │   ├── en.json               # Anglais
│   │   └── zh-CN.json            # Chinois simplifié
│   ├── context/                  # React Context (état global)
│   ├── hooks/                    # Hooks personnalisés
│   ├── services/                 # Services frontend
│   └── theme/                    # Configuration du thème
├── backend/                      # Source backend
│   ├── server.js                 # Point d'entrée du serveur Express
│   ├── config/                   # Fichiers de configuration (JSON)
│   │   ├── printers.json         # Définitions des imprimantes
│   │   ├── printServers.json     # Configurations des serveurs d'impression
│   │   ├── alertConfig.json      # Règles d'alerte
│   │   ├── jiraTemplates.json    # Modèles de tickets Jira
│   │   └── ...
│   ├── routes/                   # Gestionnaires de routes API
│   ├── services/                 # Logique métier (16 services)
│   │   ├── printerMonitoringService.js
│   │   ├── printServerMonitoringService.js
│   │   ├── scheduledReportService.js
│   │   ├── snmpService.js
│   │   ├── jiraService.js
│   │   ├── emailService.js
│   │   └── ...
│   ├── middleware/               # Authentification, validation, formatage
│   └── utils/                    # JWT, utilitaires
├── deploy/                       # Scripts de déploiement
│   ├── pack-offline.sh           # Constructeur de package hors ligne
│   ├── install-service.bat       # Installateur de service Windows
│   ├── frontend-server.js        # Serveur statique de production
│   └── offline-package/          # Package de déploiement pré-construit
└── public/                       # Ressources statiques
```

---

## Démarrage rapide

### Prérequis
- **Node.js 18+** ([télécharger](https://nodejs.org/))
- **npm** (inclus avec Node.js)

### Configuration de l'environnement de développement

```bash
# Cloner le dépôt
git clone https://github.com/your-org/printer-status-report.git
cd printer-status-report

# Installer les dépendances frontend
npm install

# Installer les dépendances backend
cd backend
cp .env.example .env    # Configurez votre environnement
npm install
cd ..

# Démarrer les deux services (dans des terminaux séparés)
npm run dev             # Frontend sur http://localhost:5175
cd backend && node server.js  # Backend sur http://localhost:3001
```

### Variables d'environnement

Créez `backend/.env` à partir de `.env.example` :

```env
PORT=3001
NODE_ENV=development

# Configuration SMTP
SMTP_HOST=your-smtp-server
SMTP_PORT=25
SMTP_FROM=printer-monitor@yourcompany.com
ALERT_RECIPIENTS=admin@yourcompany.com

# Secrets JWT (auto-générés si non définis)
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
```

### Connexion par défaut
- **Nom d'utilisateur** : `admin`
- **Mot de passe** : `admin123` (à modifier après la première connexion)

---

## Déploiement en production (Windows Server)

### Déploiement hors ligne

Le système est conçu pour les environnements **Windows Server isolés** :

```bash
# Sur la machine de développement (macOS/Linux) : construire le package hors ligne
bash deploy/pack-offline.sh
```

Cela génère un fichier `.zip` contenant tout le nécessaire :

1. Copiez le `.zip` sur le Windows Server
2. Extrayez dans un répertoire (par ex. `C:\PrinterStatus`)
3. Assurez-vous que Node.js 18+ est installé
4. Cliquez droit sur `install-service.bat` → **Exécuter en tant qu'administrateur**
5. Accédez à `http://server-ip:9191`

L'installateur utilise **NSSM** pour enregistrer des services Windows qui survivent aux déconnexions et redémarrages :
- `PrinterStatusBackend` (port 3001)
- `PrinterStatusFrontend` (port 9191)

---

## Aperçu de l'API

| Méthode | Point de terminaison | Description |
|---|---|---|
| `GET` | `/api/health` | Vérification de l'état de santé |
| `POST` | `/api/auth` | Authentification utilisateur |
| `GET/POST` | `/api/printers` | Gestion des imprimantes |
| `GET/POST` | `/api/settings` | Paramètres système |
| `POST/GET` | `/api/reports` | Génération de rapports |
| `GET/POST` | `/api/alerts` | Configuration des alertes |
| `GET` | `/api/jira/templates` | Modèles de tickets Jira |
| `POST` | `/api/jira/tickets` | Créer des tickets Jira |
| `GET` | `/api/jira/issues` | Rechercher des tickets Jira |
| `GET` | `/api/jira/pending-approvals` | Tickets en attente d'approbation |
| `POST` | `/api/jira/issues/:key/transition` | Exécuter une transition de ticket |
| `GET/POST/DELETE` | `/api/jira/comment-templates` | Modèles de commentaires |

---

## Captures d'écran

> Ajoutez des captures d'écran du tableau de bord principal, de la création de tickets Jira, du mode sombre, etc.

---

## Contribuer

1. Forkez le dépôt
2. Créez une branche de fonctionnalité (`git checkout -b feature/amazing-feature`)
3. Validez vos modifications (`git commit -m 'Add amazing feature'`)
4. Poussez vers la branche (`git push origin feature/amazing-feature`)
5. Ouvrez une Pull Request

### Directives de développement
- Tout texte destiné à l'utilisateur doit utiliser `t('key')` de react-i18next
- Ajoutez les clés correspondantes dans `src/i18n/locales/zh-CN.json` et `en.json`
- Suivez les modèles de code et la structure des composants existants

---

## Licence

Ce projet est sous licence MIT — voir le fichier [LICENSE](LICENSE) pour plus de détails.

---

## Remerciements

- [Material UI](https://mui.com/) — Bibliothèque de composants React
- [Vite](https://vitejs.dev/) — Outillage frontend nouvelle génération
- [NSSM](https://nssm.cc/) — Gestionnaire de services Windows
- [net-snmp](https://github.com/markabrahams/node-net-snmp) — Protocole SNMP pour Node.js
