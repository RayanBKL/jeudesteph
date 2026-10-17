# RECAP — The Ashtray King (Stéphane, le Roi du Cendrier)

_Dernière mise à jour : 12 octobre 2026_

## 1. C'est quoi le jeu ?

Un jeu web satirique 18+ (HTML/CSS/JS pur, sans framework ni build) où on incarne **Stéphane**, qui veut devenir le roi du cendrier.
Le cœur du jeu est un **clicker / jeu de collection de cartes** façon Pokémon TCG Pocket : on clique pour gagner du cash, on ouvre des paquets, on collectionne des cartes qui rapportent des revenus passifs, et on dépense son argent au marché, à la bourse et au casino.

Aucun argent réel. Ton humoristique et décalé.

### Les écrans (`index.html`, pages `page-*`)

| Écran | Fichier | Ce qu'on y fait |
|---|---|---|
| Empire / Clicker | `js/clicker.js`, `js/empire.js` | Taper pour gagner du cash, revenus passifs des cartes équipées, combos, mode frénésie, synergies entre catégories |
| Paquets | `js/packs.js`, `js/empire_db.js` | Ouverture de paquets en 3D (déchirement, tilt holo, fanfare). 5 paquets : Cadeau (gratuit), Tabac, Reliques & Terroirs, Buvette, Pochon Noir |
| Inventaire | `js/ui.js`, `js/cards.js` | Collection de cartes, rendu « TCG holographique » |
| Marché / Bourse | `js/market.js`, `js/empire.js` | Marché du jour (reset 24h), bourse avec cours qui fluctuent par catégorie, achat/vente |
| Casino | `js/casino.js` | Blackjack européen et roulette européenne |
| Talents | `js/talents.js` | Arbre de compétences RPG à 4 branches |
| Course | `js/race.js` | Course style PMU sur 4 couloirs contre des rivaux |
| Multi | `js/multiplayer.js` | Duels de cartes 3v3 avec mises, course clandestine, classement |
| Amis / Profil / Classements | `js/friends.js`, `js/game.js` | Amis, défis, profil joueur |

### Le contenu : 6 037 cartes, 10 familles affichées, 6 raretés

| Catégorie | Cartes | Préfixe image |
|---|---|---|
| Cigarettes | 507 | `cig_` |
| Alcools | 419 | `alc_` |
| Drogues | 166 | `drg_` |
| Actrices VIP | 178 | `act_` |
| Reliques beauf / terroir | 152 | `ter_` |
| Briquets & accessoires | 123 | `acc_` |

Raretés : Commune → Peu commune → Rare → Épique → Légendaire → Mythique. Chaque carte a une rareté fixe.

Les données sont dans `js/cigarettes_db.js` (cigarettes), `js/empire_db.js` (raretés, paquets, cartes de base, assemblage de la base) et `js/empire_db_expansion.js` (le reste des catégories).
Chaque carte a une photo WebP locale dans `assets/cards/`, nommée `<préfixe>_<id>.webp`.

### Technique

- **Front** : HTML/CSS/JS vanilla, scripts chargés dans `index.html` (`?v=39` pour casser le cache).
- **Son** : synthétisé en Web Audio API (`js/audio.js`), aucun fichier audio.
- **Backend** : Supabase (auth email + 2FA TOTP, Postgres avec RLS). Schéma dans `supabase_schema.sql`, client dans `js/supabase.js`.
- **Hébergement prévu** : Hostinger (Apache), config dans `.htaccess`.
- **Lancer en local** : `python3 -m http.server 8000` puis http://localhost:8000

## 2. Ce qui a été fait

- Release initiale : course, marché, casino, paquets, amis (commit `2055410`).
- Auth Supabase, schéma Postgres avec RLS, 2FA (commits `fa4f06d`, `e7ea842`).
- Passage au mode « Empire » : clicker, revenus passifs, synergies, bourse.
- Base de cartes passée de ~140 à **1545 cartes** avec descriptions uniques et raretés rééquilibrées.
- **Toutes les cartes ont une vraie photo locale en WebP** (environ 21 Mo au total, 0 image manquante).
- Ouverture de paquets 3D, rendu holographique des cartes, son arcade.
- Casino refait (blackjack + roulette européenne), arbre de talents, multijoueur (duels 3v3).

### Refonte du design (12/10/2026)

Direction artistique « bar-tabac PMU », alignée sur le logo et le décor existants : tons chauds (bois, cuir), rouge de la carotte tabac, jaune doré, papier crème, tapis vert ; contours noirs épais et relief rouge-brun comme sur le logo. Aucun élément du jeu n'a été retiré : seul l'habillage a changé.

- **Police maison « Cendrier »** (`assets/fonts/cendrier.woff2`) : lettres géométriques épaisses à coins coupés, petites capitales pour les minuscules, accents français inclus. Elle est générée par `scripts/build_font.py` (modifiable : épaisseur, largeurs, formes des lettres). Texte courant en Rubik (Google Fonts).
- **`css/theme.css`** : nouvelle couche de design chargée après `style.css` et `empire.css`. Barre du haut et du bas, boutons en relief, onglets, champs, modales, notifications, écran principal (jeton rouge cliquable), boutique, casino, course, Empire, profil.
- **Nouvelles cartes** : cadre métallique selon la rareté (acier, vert, bleu, violet, or, holo animé pour Mythique), face en papier crème, fenêtre d'illustration, stats en pastilles, ruban « NOUVEAU ».
- **Palette froide convertie** : les bleus nuit et gris ardoise codés en dur dans `css/style.css`, `css/empire.css` et les fichiers JS ont été convertis en tons chauds (86 couleurs).
- Collection sur 2 colonnes sur mobile, filtres de la Bourse remis en ligne.
- `.htaccess` : la police locale est autorisée (`font-src 'self'`). Les fichiers sont passés en `?v=40` pour forcer le rechargement.

Reste à faire côté design : remplacer les emojis (navigation, titres, paquets) par de vraies icônes illustrées, dessiner un visuel de paquet par booster, et retoucher les écrans secondaires moins vus (amis, classements, marché du jour).

### 9e passe (14/10/2026) : comptes, en ligne, amis, clans, sécurité
- **Comptes Supabase (e-mail + mot de passe)** : `js/account.js`. Sauvegarde en ligne de toute la progression (instantané localStorage dans `cloud_saves`, envoi 20 s après un changement, détection de conflit entre appareils). Plus de mode test.
- **Rangs et classements côté serveur** : `league_ratings`, saisons mensuelles, le navigateur ne peut pas modifier un rang. Contre l'ordi : plafond Buraliste I.
- **Parties entre vrais joueurs** (Pierre-Briquet-Clope, 421, Quiz) : `supabase/migrations/003b_multijoueur.sql` (le serveur lance les dés, garde les coups secrets, gère le chrono, le forfait, les points) + `js/games/online.js` (recherche d'adversaire, écran de partie, résultat). Victoire PvP = ×1,5 PL. Au-delà de 10 parties contre le même joueur en 24 h : plus de points.
- **Amis, invitations, clans** : `003c_amis_clans.sql` + `js/social.js`. Onglets Profil / Amis / Clan dans la page Profil. Ajouter par pseudo ou code ami, défier un ami (invitation 2 min), clans de 30 max avec classement.
- **Réglages** : vraie page séparée du profil (son, compte, 2FA, déconnexion, réinitialisation). Photo de profil : recadrage (glisser + zoom).
- **Limite de clics** relevée : 40 clics/s (avant 22).
- **Audit de sécurité** (`004_securite.sql`) : pseudos et photos au format strict (plus d'injection de code), profils sans argent/XP visibles, anciennes tables fermées, fonctions internes privées, mot de passe 8 car. avec min/maj/chiffre, `supabase-js` épinglé + SRI, CSP corrigée, `.htaccess` qui cache `.git`, `scripts`, `supabase`, `.env`, `*.md`.
- GIF Giphy pour 32 mèmes (`scripts/fetch_meme_gifs.py`).

### 10e passe (15/10/2026) : tout en ligne, mèmes, économie
- **Les 6 jeux se jouent contre de vrais joueurs** (Bataille, Course, Ultimate Comptoir ajoutés, `007_jeux_en_ligne.sql`). Course arbitrée par rejeu serveur des sprints.
- **Les 173 mèmes ont un GIF ou une vraie image** (plus aucun dessin généré) ; vrais visuels du brainrot trouvés sur Wikimedia Commons ; images des mèmes rechargées chez les joueurs (`MEME_IMG_REV` dans `js/data.js`).
- **Économie** : clic de base 1 €, paquets ×12, cotes ×12, cartes rares et + réduites (`js/balance.js`, version 3, simulation `scripts/simulate_economy.js`). Les emplacements de l'Empire étaient écrasés (CSS) : corrigé, c'est eux qui donnent le revenu passif.
- **Sauvegarde automatique chaque nuit** dans la base (`006_sauvegarde_auto.sql`, 7 jours) + `python3 scripts/backup_db.py` (copie locale).
- **Tableau de bord admin** (`admin.html`) : joueurs, évolution, signalements, crédits, suppression de compte. Entrée « Empire » dans la barre du bas. Revenu passif des pièces réparé (copie d'état).
- **Chat** de clan et entre amis (avec signalement et modération admin), **textes légaux** (CGU, confidentialité, mentions légales, case à cocher), **nettoyage** du code ancien (`friends.js`, ancien système de comptes en localStorage avec mots de passe en clair, méthodes `CloudSync` inutilisées, `supabase_schema.sql`). Gardés volontairement : `multiplayer.js` (« Duels de cartes ») et l'ancien `Market`.
- **Plus aucun bot** : Bourse = vrai marché entre joueurs (ventes à prix fixe, commission 5 %), faux acheteurs supprimés, « Duels de cartes » (faux rivaux) supprimé, les 6 jeux uniquement contre de vrais joueurs (si personne n'est en ligne : on attend ou on invite un ami). Enchères retirées (pas possible proprement sans temps réel).
- Conflits de sauvegarde entre deux appareils : la partie la plus avancée est gardée sans poser de question.

### 8e passe (13/10/2026)

- **Prestiges** : ne donnent plus de points de talent ni de paquets, objectifs ×3 (plus rares, à collectionner comme les trophées PlayStation).
- **Talents** : 1 point par niveau + 1 bonus tous les 5 niveaux (arbre complet vers le niveau 55) ; courbe d'XP adoucie après le niveau 12 pour que ce soit long mais atteignable ; XP gagnée en jouant aux mini-jeux.
- **Refs → 3 familles** (aucune carte supprimée, identifiants conservés) :
  - **Mèmes** (173) : mèmes uniquement, dont 131 nouveaux, surtout français (« T'es sûrement pas français », « Il pleure sur le poulet », « Non mais allô quoi », « Comment est votre blanquette ? »…) + brainrot italien et classiques internationaux.
  - **Musique** (573) : chanteurs et rappeurs, ~400 français (de Piaf à Gazo) et ~190 stars internationales. Jul a maintenant la bonne photo. Musique plafonnée à « Légendaire » sauf Johnny.
  - **Culte** (121) : films, télé, humoristes, YouTubeurs, jeux vidéo, monuments.
  - 2 nouveaux paquets : « Disque de Platine » et « La Vidéothèque Culte ».
- **Images : 6 037 / 6 037**. Les cartes sans photo libre ont une illustration dessinée par `scripts/generate_card_art.py` (paquet de clopes à la marque, briquet, sachet, affiche, ou la phrase du mème en gros).
- Bouton « Duels de cartes (ancien mode) » renommé « Duels de cartes ».

### 7e passe (13/10/2026)

- **Photos** : Wikimedia bloquait nos téléchargements ; passage par `thumb.wikimedia.org` (autre serveur, pas bloqué), ~60 photos/minute.
- **Bug corrigé** : après l'ouverture d'un paquet, on reste dans la Boutique (avant : renvoi vers la Collection).
- **Bourse** : la cote de chaque carte suit maintenant les ventes réelles (moyenne mobile, entre ×0,5 et ×2), les indices du haut sont calculés (avant : chiffres écrits en dur), et les chances de vente dépendent du prix demandé par rapport à la cote.
- **Prix des paquets recalés** : avant, le paquet à 150 000 € contenait ~2 500 € de cartes et la Valise à 600 000 € ~7 000 €. Maintenant chaque paquet vaut ~1/3 de son prix en cartes (1 300 € → 20 000 €), triés par prix.
- **Talents** : 7 nouveaux (revenu passif +15 %/+25 %, clic +30 %, critiques 40 % ×6, paquets gratuits plus fréquents, « Empereur du Cendrier ») ; points gagnés aussi avec les prestiges Or (+1) et Platine (+2).
- **6e jeu : Quiz du Comptoir** (photo de carte, 4 noms, 8 s, contre l'ordi).
- **Bouton « ? »** sur chaque jeu (et règles affichées automatiquement à la première partie), règles détaillées du 421.
- **Cartes de foot** : note et poste en médaillon, nationalité et club sous le nom, détail complet dans la fiche.

**Multijoueur** : aujourd'hui tous les jeux se jouent contre l'ordinateur et la progression (ligues, prestiges) est stockée dans le navigateur. Pour du vrai multi en ligne il faut : tables Supabase (profils de ligue, parties, classement), Supabase Realtime pour les parties en direct (PBC, 421, Quiz), matchmaking, et calcul des résultats côté serveur (sinon triche possible). Pour l'Ultimate Comptoir, le plus simple est le « match asynchrone » : on affronte l'équipe enregistrée d'un vrai joueur, jouée par l'ordi.

### 6e passe (13/10/2026) : Ultimate Comptoir et Refs

- **Ultimate Comptoir** (nouveau jeu classé, en tête de la salle de jeux) : 11 de tes footballeurs en 4-3-3 sur un terrain, liens entre voisins **vert** (club en commun), **orange** (même pays), **rouge** (rien), cohésion de 0 à 3 par joueur (−2 hors poste), cohésion d'équipe sur 100, bouton « Auto » qui compose la meilleure équipe, choix joueur par joueur avec l'effet sur la puissance. Match simulé en direct avec commentaires contre une équipe de l'ordi (note et cohésion qui montent avec ton rang). Il manque des joueurs ? Les trous sont bouchés par des « joueurs du quartier » (note 50, aucun lien).
- Footballeurs : poste, nationalité, **tous les clubs de carrière** (jusqu'à 4) et note générale (58 à 94 selon la rareté).
- **Nouvelle famille « Refs »** (188 cartes) : mèmes internationaux (6-7, Skibidi, Rickroll…) et surtout culture française (Kaamelott, Les Visiteurs, Johnny, Jul, PNL, Squeezie, la Daronne, le PMU du coin…). Paquet « Les Refs du Comptoir », synergie « Six-Seven » (+67 % au clic).
- 4 nouveaux défis hebdo liés à l'Ultimate Comptoir.
- Photos : Wikimedia limite fortement les téléchargements depuis notre adresse. Le script tourne lentement en arrière-plan (refs et footballeurs en priorité) ; à relancer si l'ordinateur s'éteint : `python3 scripts/download_extra_images.py`.

### 5e passe (12/10/2026) : salle de jeux, prestiges, 5 170 cartes

- **Salle de jeux** (onglet « Jeux ») avec 4 mini-jeux classés contre l'ordinateur : **Bataille de Comptoir** (tes cartes, stat tirée au sort), **421**, **Pierre-Briquet-Clope** (l'ordi apprend tes habitudes), **Course Clandestine** (le moteur de course PMU en mode classé).
- **Ligue** : 26 rangs par jeu (Mégot, Roulée, Blonde, Brune, Cigarillo, Havane, Buraliste, Baron en III/II/I, puis Parrain et Roi du Comptoir). 100 PL par rang, on ne retombe pas sous le début de son palier, l'ordi devient plus fort quand on monte.
- **Prestiges façon PS5** : chaque semaine (lundi 0 h → dimanche 23 h 59), 10 défis tirés au sort (6 Bronze, 3 Argent, 1 Or) + Platine si tout est réussi ; prestiges permanents pour chaque palier atteint dans chaque jeu ; notification de trophée et vitrine. Récompenses : XP et paquets gratuits.
- **Cartes : 1 545 → 5 170** — Football 1 100 (nouvelle catégorie, nouveau paquet « Album du Ballon d'Or »), Actrices 1 000, Boissons 1 000, Terroirs 928, Tabac & accessoires 880 (regroupés dans un seul onglet), Substances 262 (shit, coke, LSD, GHB, ecsta, champis… ton « rue », pas scientifique, avec cartes de prévention).
- Collection : compteur par famille sur chaque onglet, vue « Mes cartes / Catalogue complet », affichage progressif (60 cartes à la fois).
- **Bug corrigé** : la course était impossible à finir (constantes manquantes → énergie = NaN) et le bouton Abandon plantait (`RaceEngine.stop` n'existait pas).

**À faire** :
- Finir le téléchargement des photos : `python3 scripts/download_extra_images.py` (relançable, reprend où il s'est arrêté). Wikimedia limite le nombre de téléchargements ; en attendant, les cartes sans photo affichent un emblème.
- Tabac & accessoires (880) et Terroirs (928) n'atteignent pas 1 000 : il n'existe pas assez de marques avec photo libre ; à compléter par des listes écrites à la main (`scripts/data/tabac_comptoir.json`).
- Photos : licences libres Wikimedia Commons, crédits dans `data/image_credits.json` — prévoir une page « crédits » avant la mise en ligne. Les actrices/footballeurs sont de vraies personnes : vérifier le droit à l'image avant publication.
- Multijoueur en ligne des mini-jeux (Supabase Realtime) et classement entre joueurs.

### 4e passe (12/10/2026)

- Blackjack : après un split (jusqu'à 4 mains), les sous-mains s'affichent côte à côte avec leur score ; pendant une donne, les mains inactives sont masquées. Plus de chevauchement.
- « Avance de la banque » : donnait 1 000 € à chaque clic, sans limite (argent infini). Maintenant : 500 €, seulement si le solde est sous 50 €, une fois toutes les 10 minutes.
- Écran principal : nouveau compteur « Tes clics / seconde » (gain réel des 5 dernières secondes) + bouton « ? » qui explique chaque chiffre ; « Clique pour fumer » au lieu de « Stéphane » ; jeton recentré visuellement.
- Règles du projet dans `CLAUDE.md` (relu automatiquement à chaque session).
- Mini-jeux + ligues : propositions envoyées, en attente du choix.

### Corrections et progression (12/10/2026, 3e passe)

- **Roulette** : sur PC, la roue est à gauche et le tapis complet à droite (les douzaines et Rouge/Noir/Pair/Impair/Manque/Passe étaient coupées). Au lancer, la roue **s'agrandit en plein écran** avec une bille, puis affiche le numéro ; on peut aussi l'agrandir en touchant la petite roue. **Bug corrigé** : la roue affichée ne s'arrêtait pas sur le numéro réellement tiré.
- **Blackjack** : bandeau de texte coupé supprimé ; sur PC, jetons et bouton « Distribuer » sur la même ligne, mains plus compactes.
- **Paquet vide à l'ouverture** : le paquet et la carte avaient une taille calculée que Safari résout à 0 ; tailles maintenant explicites. ⚠️ Non vérifié dans Safari (le téléchargement du moteur Safari de test a échoué), vérifié dans Chrome.
- **Bug corrigé (introduit à la 2e passe)** : les mises du casino et les achats de paquets n'étaient plus débités ni crédités.
- **Profil** : photo de profil (recadrée et compressée, gardée dans le navigateur) et pseudo modifiables. Le profil est enfin accessible (bouton en haut à gauche) et affiche le niveau d'Empire et les vraies stats. Le titre « The Ashtray King » de la barre du haut est remplacé par la photo et le pseudo du joueur ; le logo apparaît sur un **écran de chargement** au démarrage.
- **Écran principal** : Stéphane est centré dans le jeton ; les compteurs s'appellent « Chaque clic » et « Tes cartes / seconde ».
- **Progression ralentie** :
  - XP : 1 XP par clic manuel (avant : selon l'argent gagné, et les revenus passifs en donnaient aussi), + XP à l'ouverture de paquets (1 XP par 100 € dépensés, 15 pour un paquet gratuit).
  - Niveaux : 300 XP pour le niveau 2, puis ×1,35 à chaque niveau (niveau 10 ≈ 13 000 XP cumulés, niveau 20 ≈ 255 000).
  - Talents : **1 point par niveau** (avant : 7 dès le départ + 2 par niveau). L'arbre complet coûte 46 points. Les arbres déjà débloqués avec l'ancienne règle sont remis à zéro.
  - Le mode test (`js/main.js`) ne donne plus 50 000 €, 30 points et le niveau 10 à chaque chargement.

À faire : photo de profil stockée dans le cloud (Supabase Storage) pour la retrouver sur un autre appareil ; vérifier l'ouverture de paquets sur Safari/iPhone ; retirer le mode test qui saute la connexion avant la mise en ligne.

### Paquets, jouabilité et mobile (12/10/2026, suite)

- **Boutique en carrousel horizontal** : on fait défiler les paquets (glisser, flèches, points, molette), le **paquet gratuit est en premier** avec son minuteur et son stock. Chaque paquet a son visuel de « booster » (film métallisé, bords crantés, illustration SVG dessinée : cadeau, cigarette, saucisson, bouteille, pochon, ticket VIP, valise) dans `js/pack_art.js`. Les probabilités s'affichent avec des décimales (plus de « Épique 0% »).
- **Nouvelle ouverture de paquet** (`css/packs.css`) : le paquet tombe au centre, on le **déchire en glissant le doigt** (ou d'un tap), la bande du haut s'envole avec un éclair de lumière, puis les cartes arrivent **face cachée** et se **retournent en 3D** au toucher. Les cartes rares et plus brillent avant d'être retournées ; les effets montent avec la rareté (particules, flash, tremblement pour Légendaire/Mythique). Récapitulatif animé avec le nombre de nouvelles cartes et la cote totale.
- **Montant au clic** : l'argent s'affiche maintenant à l'euro près jusqu'au million (avant, « 50.0 k » ne bougeait pas quand on cliquait). La barre du haut affiche le même argent, le **niveau d'Empire** (et non plus l'ancien niveau de course) et le stock de paquets gratuits.
- **Frenzy supprimée** (barre, jauge, bonus). Les 2 talents qui la concernaient (et qui ne faisaient en réalité rien) donnent maintenant +20 % et +25 % aux gains de clic.
- **Tout tient sur l'écran** : chaque écran a la hauteur exacte entre les deux barres, la page ne défile plus. Seules les listes longues défilent dans leur zone (grille de la collection, offres de la bourse). Casino recomposé (3 mains de blackjack côte à côte, jetons sur une ligne, actions regroupées, **tapis de roulette vertical sur mobile**), talents (arbre + fiche, côte à côte sur ordinateur), Empire (salles compactes), bourse (en-tête compact).
- Corrections : barre d'XP de l'écran Empire toujours vide (identifiant en double), titre des talents en anglais, texte « toutes les 10 min » (c'est 8), avatars cassés du multijoueur.

Vérifié sur 1440×900, 390×844 et 375×667 (iPhone SE). Sur l'iPhone SE, le tapis de roulette et la zone de blackjack défilent à l'intérieur de la table, faute de place.

### Nettoyage du 12/10/2026

Tout a été **déplacé** (pas supprimé) dans le dossier `../Jeu stephan - archive nettoyage 2026-10-12/` :
- 261 images de cartes orphelines (doublons `act_act-*` des actrices, anciens alias d'alcools, etc.) : ~4 Mo.
- Images inutilisées : `packs.jpg`, `stephane.jpg`, `stephane_sprite.jpg`, `stephane_cool.jpg`, `stephane_smoke.jpg`, `actrice_brandi_love.jpg`.
- `server.py` (serveur de redirection d'images, plus utilisé depuis que les images sont en local).
- `data/missing_images.json`, `data/unresolved_images.json` (rapports obsolètes).
- 20 scripts ponctuels de génération/enrichissement de la base dans `scripts/`.

Conservés dans `scripts/` :
- `audit_cards.js` (réécrit) : `node scripts/audit_cards.js` vérifie que chaque carte a son image et liste les orphelines.
- `download_and_convert_webp.py` : télécharge et convertit les images de nouvelles cartes (utilise le cache `data/image_urls.json`).

Si rien ne manque après quelques jours de test, le dossier d'archive peut être supprimé.

## 3. Ce qui reste à faire

### Avant la mise en ligne (Hostinger)
- [x] Clés régénérées (14/10) ; domaine `theastrayking.bklvision.fr` ; e-mails via Resend (`noreply@bklvision.fr`, domaine vérifié), confirmation d'e-mail obligatoire, mails en français ; Turnstile actif à l'inscription, la connexion et « mot de passe oublié » (clés dans `.env`, la secrète seulement dans Supabase).
- [ ] **Tester en vrai** une inscription avec une vraie adresse e-mail (mail de confirmation, lien, mot de passe oublié) une fois le site en ligne.
- [ ] **Ne publier que le nécessaire** : si Hostinger déploie tout le dépôt, `.htaccess` cache `.git`, `scripts`, `supabase`, `data`, `.env`, `*.md`. Vérifier en ligne que `/.env`, `/.git/config`, `/scripts/` donnent bien 404.
- [ ] Faire un commit : tout le travail est indexé mais **pas encore commité**. Ne jamais pousser `.env` (il est dans `.gitignore`).

### Limites connues (à savoir)
- La progression (argent, collection) vit dans le navigateur et est copiée en ligne : un joueur qui bidouille son navigateur peut tricher sur SON compte. Les rangs et parties en ligne, eux, sont arbitrés par le serveur. Classement « collectionneurs » = déclaratif.
- Deux comptes complices peuvent se faire gagner des points (limité à 10 parties/jour par duo et par jeu).
- Pas encore en ligne : Ultimate Comptoir contre l'équipe d'un vrai joueur, Bataille et Course en PvP, chat de clan.
- Code ancien inutilisé : `js/friends.js` et `js/multiplayer.js` (faux amis/rivaux locaux, plus de lien avec le serveur) ; les méthodes `CloudSync.loadInventory/recordRace/...` ne sont plus appelées.

### Bugs repérés
- [ ] Les 36 cartes actrices de `js/empire_db.js` ont un champ `img: "assets/actrice_*.jpg"` vers des fichiers qui n'existent pas. Sans effet aujourd'hui, à nettoyer.

### Nettoyage de code (optionnel)
- [ ] Deux résolveurs d'image quasi identiques : `resolveCigaretteImage` (`js/data.js`) et `resolveCardPhoto` (`js/cards.js`).
- [ ] Code legacy de l'ancienne version « course » (`GameState`, `stephane_users` dans `js/game.js`).
- [ ] Le README est à mettre à jour (6 037 cartes, comptes en ligne).

### Avant le lancement public
- [ ] Tests mobile (tactile, performances avec beaucoup d'images).
- [ ] Économie du jeu : équilibrer prix des paquets, revenus passifs, casino.
