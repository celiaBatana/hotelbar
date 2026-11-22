# 🏨 HôtelBar Pro — Guide de déploiement

## Ce que tu vas avoir
Un vrai site web à ton URL perso, connecté Firebase,
accessible par toute ton équipe 24h/24.

---

## ✅ Étape 1 — Installer les outils (5 min)

### Installe Node.js
→ Va sur https://nodejs.org → télécharge la version **LTS** → installe-la.

### Installe Git
→ Va sur https://git-scm.com → télécharge → installe (options par défaut).

---

## ✅ Étape 2 — Créer un compte GitHub (2 min)

→ Va sur https://github.com → **Sign up** avec ton email.
→ Vérifie ton email pour confirmer le compte.

---

## ✅ Étape 3 — Mettre le projet sur GitHub (5 min)

1. Va sur https://github.com → clique **+** en haut à droite → **New repository**
2. Nom du repo : `hotelbar`
3. Laisse tout par défaut → clique **Create repository**

Ensuite, ouvre un terminal (Invite de commandes sur Windows, Terminal sur Mac) :

```bash
# Va dans le dossier du projet (remplace le chemin si besoin)
cd ~/Desktop/hotelbar

# Initialise et envoie le code
git init
git add .
git commit -m "HôtelBar Pro"
git branch -M main
git remote add origin https://github.com/TON_PSEUDO/hotelbar.git
git push -u origin main
```

⚠️ Remplace `TON_PSEUDO` par ton nom d'utilisateur GitHub.

---

## ✅ Étape 4 — Déployer sur Vercel (3 min)

1. Va sur https://vercel.com → **Sign up with GitHub**
2. Clique **Add New Project**
3. Sélectionne ton repo `hotelbar` → clique **Import**
4. Vercel détecte automatiquement que c'est un projet React
5. Clique **Deploy** — attends ~2 minutes

🎉 **Ton site est en ligne !** Vercel te donne une URL du type :
`https://hotelbar-xxx.vercel.app`

---

## ✅ Étape 5 — Comptes & sécurité Firebase (important !)

L'app a maintenant une connexion avec deux rôles : **Admin** (tout) et **Vendeur** (ventes uniquement).

1. Console Firebase → **Authentication** → **Get started** → onglet **Sign-in method** → active **Email/Password**.
2. Console Firebase → **Firestore Database** → onglet **Rules** → **ne remplace pas tout** : la base est partagée avec d'autres projets. Remplace uniquement la ligne `match /hotelbar/{id} { allow read, write: if true; }` par le bloc « HôtelBar » du fichier `firestore.rules` (ou colle tout ce fichier, il contient déjà les autres projets).
3. Clique **Publish**.
4. Ouvre le site → **« Première utilisation ? Créer le compte administrateur »** → crée ton compte (fais-le tout de suite, ce lien disparaît une fois le compte admin créé).
5. Dans le site → **👥 Équipe** → **Ajouter une personne** (rôle Vendeur) et communique-lui email + mot de passe.

## ✅ Étape 6 — Partager l'URL

Envoie simplement l'URL Vercel à ton équipe :
`https://hotelbar-xxx.vercel.app`

Tout le monde voit les mêmes données en temps réel.
Pas besoin de compte, pas besoin d'installer quoi que ce soit.

---

## 🔄 Pour mettre à jour l'app plus tard

Si tu veux modifier l'app, envoie les nouveaux fichiers et :

```bash
git add .
git commit -m "mise à jour"
git push
```

Vercel redéploie automatiquement en 1-2 minutes.

---

## 📞 En cas de problème

Reviens me voir avec le message d'erreur, je t'aide à déboguer !
