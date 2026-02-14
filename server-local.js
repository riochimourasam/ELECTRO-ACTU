// ============================================
// SERVEUR LOCAL POUR TESTER LES SLUGS
// ============================================

const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// Middleware pour logger les requêtes
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// Servir les fichiers statiques (CSS, JS, images)
app.use(express.static(__dirname));

// ============================================
// ROUTES AVEC SLUGS
// ============================================

// Route principale : /article/slug
app.get('/article/:slug', (req, res) => {
    console.log(`✅ Slug détecté : ${req.params.slug}`);
    res.sendFile(path.join(__dirname, 'article-detail.html'));
});

// Route articles
app.get('/articles', (req, res) => {
    res.sendFile(path.join(__dirname, 'articles.html'));
});

// Route courses
app.get('/courses', (req, res) => {
    res.sendFile(path.join(__dirname, 'courses.html'));
});

// Route about
app.get('/about', (req, res) => {
    res.sendFile(path.join(__dirname, 'about.html'));
});

// Route contact
app.get('/contact', (req, res) => {
    res.sendFile(path.join(__dirname, 'contact.html'));
});

// ============================================
// REDIRECTIONS (comme .htaccess)
// ============================================

// Rediriger article-detail.html vers /article/slug
app.get('/article-detail.html', (req, res) => {
    const id = req.query.id;
    if (id) {
        // En production, on redirigerait vers le slug
        // En dev, on garde l'ID
        console.log(`⚠️  URL legacy détectée avec ID : ${id}`);
        res.sendFile(path.join(__dirname, 'article-detail.html'));
    } else {
        res.redirect('/articles');
    }
});

// ============================================
// PAGE D'ACCUEIL
// ============================================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ============================================
// 404 - Page non trouvée
// ============================================

app.use((req, res) => {
    res.status(404).send(`
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>404 - Page non trouvée</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    text-align: center;
                }
                .container {
                    background: rgba(255,255,255,0.1);
                    padding: 3rem;
                    border-radius: 1rem;
                    backdrop-filter: blur(10px);
                }
                h1 { font-size: 5rem; margin: 0; }
                p { font-size: 1.5rem; margin: 1rem 0; }
                a {
                    color: white;
                    background: rgba(255,255,255,0.2);
                    padding: 0.75rem 2rem;
                    text-decoration: none;
                    border-radius: 0.5rem;
                    display: inline-block;
                    margin-top: 1rem;
                    transition: all 0.3s;
                }
                a:hover {
                    background: rgba(255,255,255,0.3);
                    transform: translateY(-2px);
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>404</h1>
                <p>Page non trouvée</p>
                <p style="font-size: 1rem; opacity: 0.8;">URL demandée : ${req.url}</p>
                <a href="/">← Retour à l'accueil</a>
            </div>
        </body>
        </html>
    `);
});

// ============================================
// DÉMARRAGE DU SERVEUR
// ============================================

app.listen(PORT, () => {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 SERVEUR LOCAL AVEC SUPPORT DES SLUGS');
    console.log('='.repeat(60));
    console.log(`✅ Serveur démarré sur : http://localhost:${PORT}`);
    console.log('\n📋 URLs de test :');
    console.log(`   • Accueil    : http://localhost:${PORT}/`);
    console.log(`   • Articles   : http://localhost:${PORT}/articles`);
    console.log(`   • Article    : http://localhost:${PORT}/article/mon-slug`);
    console.log(`   • Courses    : http://localhost:${PORT}/courses`);
    console.log('\n💡 Astuce : Ctrl+C pour arrêter le serveur');
    console.log('='.repeat(60) + '\n');
});

// Gestion propre de l'arrêt
process.on('SIGINT', () => {
    console.log('\n\n👋 Arrêt du serveur...');
    process.exit(0);
});
