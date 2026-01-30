const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();
const fs = require('fs');
const path = require('path');

exports.articleMetadata = functions.https.onRequest(async (req, res) => {
    try {
        // Récupérer le slug depuis l'URL
        const slug = req.path.replace('/article/', '').replace('/', '');
        
        if (!slug) {
            res.redirect(301, '/index.html');
            return;
        }
        
        // Chercher l'article dans Firestore
        const querySnapshot = await db.collection('articles')
            .where('slug', '==', slug)
            .limit(1)
            .get();
        
        if (querySnapshot.empty) {
            res.redirect(301, '/index.html');
            return;
        }
        
        const articleDoc = querySnapshot.docs[0];
        const article = articleDoc.data();
        const articleId = articleDoc.id;
        
        // Générer le HTML avec les métadonnées
        const html = generateHTML(article, articleId);
        
        // Envoyer la réponse
        res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
        res.status(200).send(html);
        
    } catch (error) {
        console.error('Erreur:', error);
        res.redirect(301, '/index.html');
    }
});

function generateHTML(article, articleId) {
    const title = escapeHtml(article.title || 'Article');
    const description = escapeHtml(article.summary || '');
    const imageUrl = escapeHtml(article.imageUrl || 'https://electroinfo.online/images/logo.png');
    const slug = article.slug || articleId;
    
    return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} | Électro-Actu</title>
    
    <!-- Open Graph -->
    <meta property="og:type" content="article">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${imageUrl}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:url" content="https://electroinfo.online/article/${slug}">
    
    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${imageUrl}">
    
    <!-- Redirection -->
    <script>window.location.href="/article.html?id=${articleId}";</script>
</head>
<body>
    <p>Chargement...</p>
</body>
</html>`;
}

function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
