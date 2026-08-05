N.C.R SOLUTIONS — PORTFOLIO 3D IMMERSIF
========================================

OUVERTURE RAPIDE
----------------
1. Décompresse entièrement le ZIP.
2. Double-clique sur « Lancer le portfolio.command ».
3. Si macOS le bloque : clic droit → Ouvrir → Ouvrir.
4. Laisse la fenêtre Terminal ouverte pendant le test.

Tu peux aussi ouvrir directement portfolio.html :
la scène 3D et le pilotage du scroll sont intégrés localement et ne dépendent d'aucun CDN.

FICHIERS PRINCIPAUX
-------------------
- portfolio.html : page complète.
- portfolio-3d.css : design responsive et mise en scène.
- portfolio-3d.js : moteur WebGL, géométrie 3D, caméra et interactions.
- assets/portfolio/ : captures réelles des projets.

SCÈNE 3D
--------
La scène utilise de vraies géométries WebGL :
- arches cristallines en profondeur ;
- matières verre, argent et lumière bleue ;
- caméra qui traverse le portail pendant le scroll ;
- particules, rails lumineux et nœuds de données ;
- transition continue vers les projets réels.

Aucune bibliothèque 3D ou animation n'est chargée depuis Internet.

DÉPLOIEMENT
-----------
Téléverse le contenu du dossier à la racine de ton hébergement ou de ton dépôt GitHub Pages.
Le fichier portfolio.html doit rester à la racine, avec portfolio-3d.css, portfolio-3d.js et le dossier assets.
