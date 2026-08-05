# Portfolio immersif — N.C.R Solutions

## Fichiers principaux

- `portfolio.html` : page complète.
- `portfolio-premium.css` : design system, responsive, objet cristallin et mises en page.
- `portfolio-premium.js` : navigation, filtres, animations et scrollytelling.
- `assets/portfolio/` : captures réelles de NCR Suite, Sentinelle Pro, application SST et sites Azzera.

## Mise en ligne

Déposer l’ensemble des fichiers à la racine du site en remplaçant les versions précédentes. Aucune compilation n’est nécessaire.

La page charge GSAP et ScrollTrigger depuis jsDelivr. En cas d’indisponibilité du CDN ou d’ouverture hors connexion, un comportement de secours natif maintient le défilement et les apparitions principales.

## Contrôles réalisés

- HTML et chemins des assets vérifiés.
- JavaScript validé avec `node --check`.
- Aucun débordement horizontal à 390 px et 1440 px.
- Captures réelles contrôlées sur les versions ordinateur et mobile.
- Respect de `prefers-reduced-motion`.
