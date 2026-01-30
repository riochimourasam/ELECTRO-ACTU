// admin.js - Script d'administration SÉCURISÉ AVEC SLUGS
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, where } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Configuration Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAlBDedWLbHG-3UnijsSfocm77sNpn15Wg",
    authDomain: "electroactu-b6050.firebaseapp.com",
    projectId: "electroactu-b6050",
    storageBucket: "electroactu-b6050.firebasestorage.app",
    messagingSenderId: "890343912768",
    appId: "1:890343912768:web:87de595f6df3c3f434f6a5"
};

// Initialisation
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Variables globales
let currentUser = null;
let quillEditor = null;
let editMode = false;
let currentEditId = null;
let articleToDelete = null;

// Éléments DOM
const loadingSection = document.getElementById('loadingSection');
const accessDenied = document.getElementById('accessDenied');
const adminDashboard = document.getElementById('adminDashboard');
const articleForm = document.getElementById('articleForm');
const articlesList = document.getElementById('articlesList');
const newsletterList = document.getElementById('newsletterList');

// ============================================
// 🆕 FONCTION GÉNÉRATION SLUG
// ============================================
function generateSlug(title) {
    return title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Enlever les accents
        .replace(/[^a-z0-9\s-]/g, '') // Garder uniquement lettres, chiffres, espaces et tirets
        .trim()
        .replace(/\s+/g, '-') // Remplacer espaces par tirets
        .replace(/-+/g, '-') // Enlever tirets multiples
        .substring(0, 100); // Limiter à 100 caractères
}

// Vérifier si un slug existe déjà
async function isSlugUnique(slug, excludeId = null) {
    const q = query(collection(db, 'articles'), where('slug', '==', slug));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return true;
    
    // Si on modifie un article, vérifier que ce n'est pas le même
    if (excludeId) {
        const existingDoc = snapshot.docs[0];
        return existingDoc.id === excludeId;
    }
    
    return false;
}

// Générer un slug unique en ajoutant un numéro si nécessaire
async function generateUniqueSlug(title, excludeId = null) {
    let baseSlug = generateSlug(title);
    let slug = baseSlug;
    let counter = 1;
    
    while (!(await isSlugUnique(slug, excludeId))) {
        slug = `${baseSlug}-${counter}`;
        counter++;
    }
    
    return slug;
}

// ============================================
// 🔐 VÉRIFICATION ADMIN (CRITIQUE)
// ============================================
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'auth.html?redirect=admin.html';
        return;
    }

    try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));

        if (!userDoc.exists()) {
            showAccessDenied();
            return;
        }

        const userData = userDoc.data();

        if (userData.role !== 'admin') {
            showAccessDenied();
            return;
        }

        currentUser = user;
        showAdminDashboard(user, userData);
        initQuillEditor();
        loadArticles();
        loadStatistics();
        loadNewsletterSubscribers();

    } catch (error) {
        console.error('Erreur vérification admin:', error);
        showAccessDenied();
    }
});

function showAccessDenied() {
    loadingSection.classList.add('hidden');
    accessDenied.classList.remove('hidden');
    adminDashboard.classList.add('hidden');
}

function showAdminDashboard(user, userData) {
    loadingSection.classList.add('hidden');
    accessDenied.classList.add('hidden');
    adminDashboard.classList.remove('hidden');

    const displayName = userData.name || user.displayName || user.email.split('@')[0];
    const avatarUrl = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=1e40af&color=fff`;

    document.getElementById('adminName').textContent = displayName;
    document.getElementById('adminAvatar').src = avatarUrl;
}

// ============================================
// DÉCONNEXION
// ============================================
document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    try {
        await signOut(auth);
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Erreur déconnexion:', error);
    }
});

// ============================================
// QUILL EDITOR
// ============================================
function initQuillEditor() {
    if (typeof Quill !== 'undefined') {
        quillEditor = new Quill('#editor', {
            theme: 'snow',
            modules: {
                toolbar: {
                    container: [
                        [{ 'header': [1, 2, 3, false] }],
                        ['bold', 'italic', 'underline', 'strike'],
                        ['blockquote', 'code-block'],
                        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                        [{ 'color': [] }, { 'background': [] }],
                        ['link', 'image', 'video'],
                        ['clean']
                    ],
                    handlers: {
                        'video': insertYouTubeVideo,
                        'image': insertImage
                    }
                }
            },
            placeholder: 'Rédigez votre article ici...'
        });
    }
}

// ============================================
// 🎥 FONCTION INSERTION VIDÉO YOUTUBE
// ============================================
function insertYouTubeVideo() {
    const url = prompt('Entrez l\'URL de la vidéo YouTube:');
    if (!url) return;
    
    let videoId = extractYouTubeID(url);
    
    if (!videoId) {
        showNotification('URL YouTube invalide. Utilisez un lien youtube.com ou youtu.be', 'error');
        return;
    }
    
    // Créer l'HTML de l'iframe YouTube
    const embedHTML = `
        <div class="video-wrapper" style="position: relative; padding-bottom: 56.25%; height: 0; margin: 2rem 0;">
            <iframe 
                src="https://www.youtube.com/embed/${videoId}?enablejsapi=1" 
                frameborder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                allowfullscreen
                style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;">
            </iframe>
        </div>
    `;
    
    // Insérer dans Quill
    const range = quillEditor.getSelection(true);
    quillEditor.clipboard.dangerouslyPasteHTML(range.index, embedHTML);
    quillEditor.setSelection(range.index + 1);
    
    showNotification('Vidéo YouTube ajoutée avec succès !', 'success');
}

// Extraire l'ID de la vidéo YouTube depuis différents formats d'URL
function extractYouTubeID(url) {
    // Format: https://www.youtube.com/watch?v=VIDEO_ID
    let match = url.match(/[?&]v=([^&]+)/);
    if (match) return match[1];
    
    // Format: https://youtu.be/VIDEO_ID
    match = url.match(/youtu\.be\/([^?]+)/);
    if (match) return match[1];
    
    // Format: https://www.youtube.com/embed/VIDEO_ID
    match = url.match(/youtube\.com\/embed\/([^?]+)/);
    if (match) return match[1];
    
    // Si c'est juste l'ID
    if (url.length === 11 && /^[a-zA-Z0-9_-]+$/.test(url)) {
        return url;
    }
    
    return null;
}

// ============================================
// 🖼️ FONCTION INSERTION IMAGE
// ============================================
function insertImage() {
    const choice = prompt('Choisissez:\n1 - Insérer une image par URL\n2 - Insérer un code Pinterest\n\nEntrez 1 ou 2:');
    
    if (choice === '1') {
        insertImageURL();
    } else if (choice === '2') {
        insertPinterestEmbed();
    }
}

function insertImageURL() {
    const url = prompt('Entrez l\'URL de l\'image:');
    if (!url) return;
    
    // Vérifier si c'est une URL valide d'image
    if (!isValidImageURL(url)) {
        showNotification('URL d\'image invalide. Utilisez un lien vers une image (jpg, jpeg, png, gif, webp)', 'error');
        return;
    }
    
    // Créer l'HTML de l'image responsive
    const imageHTML = `
        <figure style="margin: 2rem 0; text-align: center;">
            <img src="${url}" alt="Image" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
        </figure>
    `;
    
    // Insérer dans Quill
    const range = quillEditor.getSelection(true);
    quillEditor.clipboard.dangerouslyPasteHTML(range.index, imageHTML);
    quillEditor.setSelection(range.index + 1);
    
    showNotification('Image ajoutée avec succès !', 'success');
}

function insertPinterestEmbed() {
    const code = prompt('Collez le code d\'intégration Pinterest\n(iframe ou code avec data-pin-do)');
    if (!code) return;
    
    // Vérifier si c'est un code Pinterest valide
    if (!code.includes('pinterest.com') && !code.includes('data-pin-do')) {
        showNotification('Code Pinterest invalide. Utilisez le code fourni par Pinterest.', 'error');
        return;
    }
    
    // Déterminer si c'est un iframe ou un code data-pin-do
    let pinterestHTML = '';
    
    if (code.includes('<iframe')) {
        // C'est un iframe - l'encapsuler dans un wrapper responsive
        pinterestHTML = `
            <div class="pinterest-iframe-wrapper" style="margin: 2rem 0; text-align: center; max-width: 100%;">
                ${code}
            </div>
        `;
    } else {
        // C'est un code data-pin-do - ajouter le script
        pinterestHTML = `
            <div class="pinterest-embed" style="margin: 2rem 0; text-align: center;">
                ${code}
                <script async defer src="//assets.pinterest.com/js/pinit.js"></script>
            </div>
        `;
    }
    
    // Insérer dans Quill
    const range = quillEditor.getSelection(true);
    quillEditor.clipboard.dangerouslyPasteHTML(range.index, pinterestHTML);
    quillEditor.setSelection(range.index + 1);
    
    showNotification('Épingle Pinterest ajoutée avec succès !', 'success');
}

// Vérifier si c'est une URL d'image valide
function isValidImageURL(url) {
    try {
        const urlObj = new URL(url);
        const path = urlObj.pathname.toLowerCase();
        return path.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i) !== null;
    } catch (e) {
        return false;
    }
}

// ============================================
// PUBLICATION / MODIFICATION ARTICLE (MODIFIÉ)
// ============================================
articleForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    try {
        // Synchroniser Quill avec le textarea pour la validation
        const content = quillEditor.root.innerHTML;
        document.getElementById('content').value = content;

        // Vérifier que le contenu n'est pas vide (seulement <p><br></p>)
        const textContent = quillEditor.getText().trim();
        if (!textContent || textContent.length < 10) {
            showNotification('⚠️ Le contenu de l\'article est trop court', 'error');
            return;
        }

        const title = document.getElementById('title').value.trim();
        const category = document.getElementById('category').value;
        const imageUrl = document.getElementById('imageUrl').value.trim();
        const summary = document.getElementById('summary').value.trim();
        const featured = document.getElementById('featured').checked;
        const tags = document.getElementById('tags').value.split(',').map(t => t.trim()).filter(t => t);

        // 🆕 GÉNÉRER LE SLUG
        const slug = await generateUniqueSlug(title, editMode ? currentEditId : null);

        const articleData = {
            title,
            slug, // 🆕 AJOUT DU SLUG
            category,
            imageUrl: imageUrl || null,
            summary,
            content,
            featured,
            tags,
            author: {
                uid: currentUser.uid,
                name: currentUser.displayName || currentUser.email,
                email: currentUser.email
            }
        };

        if (editMode && currentEditId) {
            await updateDoc(doc(db, 'articles', currentEditId), {
                ...articleData,
                updatedAt: serverTimestamp()
            });

            showNotification('✅ Article modifié avec succès !', 'success');
            cancelEdit();
        } else {
            await addDoc(collection(db, 'articles'), {
                ...articleData,
                createdAt: serverTimestamp(),
                views: 0,
                commentsCount: 0,
                reactions: { like: 0, love: 0, star: 0 }
            });

            showNotification('✅ Article publié avec succès !', 'success');
            articleForm.reset();
            quillEditor.setText('');
        }

        loadArticles();
        loadStatistics();

    } catch (error) {
        console.error('Erreur publication:', error);
        showNotification('❌ Erreur lors de la publication', 'error');
    }
});

// ============================================
// CHARGER ARTICLES
// ============================================
async function loadArticles() {
    try {
        articlesList.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>Chargement...</p></div>';

        const q = query(collection(db, 'articles'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            articlesList.innerHTML = '<div class="empty-state"><i class="fas fa-newspaper"></i><p>Aucun article</p></div>';
            return;
        }

        articlesList.innerHTML = '';

        snapshot.forEach(doc => {
            const article = doc.data();
            const articleElement = createArticleItem(doc.id, article);
            articlesList.appendChild(articleElement);
        });

    } catch (error) {
        console.error('Erreur chargement articles:', error);
        articlesList.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Erreur de chargement</p></div>';
    }
}

function createArticleItem(id, article) {
    const div = document.createElement('div');
    div.className = 'admin-article-item';

    const date = article.createdAt ? new Date(article.createdAt.toDate()).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    }) : 'Non daté';

    const featuredBadge = article.featured ? '<span class="badge badge-yellow"><i class="fas fa-star"></i> Vedette</span>' : '';
    
    // 🆕 AFFICHER LE SLUG
    const slugInfo = article.slug ? `<br><small style="color: #6b7280;"><i class="fas fa-link"></i> /article/${article.slug}</small>` : '';

    div.innerHTML = `
        <div class="article-info">
            <h3>${escapeHtml(article.title)} ${featuredBadge}</h3>
            ${slugInfo}
            <p class="article-meta">
                <span class="badge badge-${getCategoryClass(article.category)}">${escapeHtml(article.category)}</span>
                <span>${date}</span>
                <span><i class="fas fa-eye"></i> ${article.views || 0}</span>
                <span><i class="fas fa-comment"></i> ${article.commentsCount || 0}</span>
            </p>
        </div>
        <div class="article-actions">
            <button class="btn btn-sm btn-success" onclick="generateSharePage('${id}')">
                <i class="fas fa-share-alt"></i> Page Partage
            </button>
            <button class="btn btn-sm btn-primary" onclick="editArticle('${id}')">
                <i class="fas fa-edit"></i> Modifier
            </button>
            <button class="btn btn-sm btn-danger" onclick="showDeleteModal('${id}')">
                <i class="fas fa-trash"></i> Supprimer
            </button>
        </div>
    `;

    return div;
}

// ============================================
// MODIFIER ARTICLE
// ============================================
window.editArticle = async function(articleId) {
    try {
        const docSnap = await getDoc(doc(db, 'articles', articleId));
        
        if (!docSnap.exists()) {
            showNotification('Article introuvable', 'error');
            return;
        }

        const article = docSnap.data();

        document.getElementById('title').value = article.title;
        document.getElementById('category').value = article.category;
        document.getElementById('imageUrl').value = article.imageUrl || '';
        document.getElementById('summary').value = article.summary;
        document.getElementById('featured').checked = article.featured || false;
        document.getElementById('tags').value = (article.tags || []).join(', ');
        
        quillEditor.root.innerHTML = article.content;

        editMode = true;
        currentEditId = articleId;
        document.getElementById('formTitle').textContent = 'Modifier l\'article';
        document.getElementById('submitBtnText').textContent = 'Mettre à jour';

        window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (error) {
        console.error('Erreur chargement article:', error);
        showNotification('Erreur lors du chargement', 'error');
    }
};

window.cancelEdit = function() {
    editMode = false;
    currentEditId = null;
    document.getElementById('formTitle').textContent = 'Nouvel Article';
    document.getElementById('submitBtnText').textContent = 'Publier';
    articleForm.reset();
    quillEditor.setText('');
};

// ============================================
// SUPPRIMER ARTICLE
// ============================================
window.showDeleteModal = function(articleId) {
    articleToDelete = articleId;
    document.getElementById('deleteModal').classList.remove('hidden');
};

document.getElementById('cancelDelete')?.addEventListener('click', () => {
    document.getElementById('deleteModal').classList.add('hidden');
    articleToDelete = null;
});

document.getElementById('confirmDelete')?.addEventListener('click', async () => {
    if (!articleToDelete) return;

    try {
        await deleteDoc(doc(db, 'articles', articleToDelete));
        showNotification('Article supprimé', 'success');
        document.getElementById('deleteModal').classList.add('hidden');
        articleToDelete = null;
        loadArticles();
        loadStatistics();
    } catch (error) {
        console.error('Erreur suppression:', error);
        showNotification('Erreur lors de la suppression', 'error');
    }
});

// ============================================
// STATISTIQUES
// ============================================
async function loadStatistics() {
    try {
        const articlesSnapshot = await getDocs(collection(db, 'articles'));
        const newsletterSnapshot = await getDocs(collection(db, 'newsletter'));

        let totalArticles = articlesSnapshot.size;
        let totalViews = 0;
        let todayArticles = 0;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        articlesSnapshot.forEach(doc => {
            const article = doc.data();
            totalViews += article.views || 0;

            if (article.createdAt) {
                const articleDate = article.createdAt.toDate();
                articleDate.setHours(0, 0, 0, 0);
                if (articleDate.getTime() === today.getTime()) {
                    todayArticles++;
                }
            }
        });

        document.getElementById('totalArticles').textContent = totalArticles;
        document.getElementById('todayArticles').textContent = todayArticles;
        document.getElementById('totalViews').textContent = totalViews.toLocaleString();
        document.getElementById('newsletterSubs').textContent = newsletterSnapshot.size;

    } catch (error) {
        console.error('Erreur stats:', error);
    }
}

// ============================================
// NEWSLETTER
// ============================================
async function loadNewsletterSubscribers() {
    try {
        newsletterList.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>Chargement...</p></div>';

        const snapshot = await getDocs(collection(db, 'newsletter'));

        if (snapshot.empty) {
            newsletterList.innerHTML = '<p class="empty-text">Aucun abonné</p>';
            return;
        }

        newsletterList.innerHTML = '';
        
        snapshot.forEach(doc => {
            const sub = doc.data();
            const date = sub.subscribedAt ? new Date(sub.subscribedAt.toDate()).toLocaleDateString('fr-FR') : 'N/A';
            
            const div = document.createElement('div');
            div.className = 'newsletter-item';
            div.innerHTML = `
                <span class="newsletter-email">${escapeHtml(sub.email)}</span>
                <span class="newsletter-date">${date}</span>
            `;
            newsletterList.appendChild(div);
        });

    } catch (error) {
        console.error('Erreur newsletter:', error);
        newsletterList.innerHTML = '<p class="empty-text text-danger">Erreur de chargement</p>';
    }
}

window.exportNewsletterCSV = async function() {
    try {
        const snapshot = await getDocs(collection(db, 'newsletter'));
        
        if (snapshot.empty) {
            showNotification('Aucun abonné à exporter', 'info');
            return;
        }

        let csv = 'Email,Date d\'inscription\n';
        
        snapshot.forEach(doc => {
            const sub = doc.data();
            const date = sub.subscribedAt ? new Date(sub.subscribedAt.toDate()).toLocaleDateString('fr-FR') : 'N/A';
            csv += `${sub.email},${date}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `newsletter-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);

        showNotification('Export réussi !', 'success');

    } catch (error) {
        console.error('Erreur export:', error);
        showNotification('Erreur lors de l\'export', 'error');
    }
};

// ============================================
// GÉNÉRATION PAGE DE PARTAGE
// ============================================
window.generateSharePage = async function(articleId) {
    try {
        showNotification('🔄 Génération de la page de partage...', 'info');
        
        const articleDoc = await getDoc(doc(db, 'articles', articleId));
        
        if (!articleDoc.exists()) {
            showNotification('❌ Article introuvable', 'error');
            return;
        }
        
        const article = articleDoc.data();
        const slug = article.slug || articleId;
        const title = escapeHtml(article.title || 'Article');
        const description = escapeHtml(article.summary || 'Découvrez cet article sur Électro-Actu');
        const imageUrl = escapeHtml(article.imageUrl || 'https://electroinfo.online/images/logo.png');
        const shareUrl = `https://electroinfo.online/share/${slug}.html`;
        
        // Générer le HTML de la page de partage
        const html = `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    
    <title>${title} | Électro-Actu</title>
    <meta name="description" content="${description}">
    
    <link rel="icon" type="image/x-icon" href="/images/favicon.ico">
    
    <!-- Open Graph / Facebook / LinkedIn / WhatsApp -->
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="Électro-Actu">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${imageUrl}">
    <meta property="og:image:secure_url" content="${imageUrl}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:url" content="${shareUrl}">
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${imageUrl}">
    
    <!-- Redirection -->
    <meta http-equiv="refresh" content="0;url=/article/${slug}">
    <script>window.location.href="/article/${slug}";</script>
    
    <style>
        body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:linear-gradient(135deg,#667eea,#764ba2);color:white;text-align:center;padding:2rem}
        .spinner{border:4px solid rgba(255,255,255,.3);border-radius:50%;border-top:4px solid white;width:60px;height:60px;animation:spin 1s linear infinite;margin:0 auto 2rem}
        @keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}
        h1{font-size:1.75rem;margin-bottom:1rem}
    </style>
</head>
<body>
    <div><div class="spinner"></div><h1>${title}</h1><p>Chargement...</p></div>
</body>
</html>`;
        
        // Télécharger le fichier
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${slug}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Instructions
        const instructions = `✅ PAGE DE PARTAGE GÉNÉRÉE !

📁 Fichier téléchargé : ${slug}.html

📤 ÉTAPES SUIVANTES :
1. Créez un dossier "share" dans votre projet Firebase
2. Copiez le fichier ${slug}.html dans ce dossier
3. Déployez : firebase deploy --only hosting

🔗 URL À PARTAGER :
${shareUrl}

💡 Cette URL affichera l'image de couverture sur WhatsApp/Facebook !`;
        
        // Copier l'URL
        if (navigator.clipboard) {
            navigator.clipboard.writeText(shareUrl).catch(() => {});
        }
        
        showNotification('✅ Fichier téléchargé !', 'success');
        alert(instructions);
        
    } catch (error) {
        console.error('Erreur:', error);
        showNotification('❌ Erreur lors de la génération', 'error');
    }
};

// ============================================
// MIGRATION DES ANCIENS ARTICLES
// ============================================

// Migrer les anciens articles qui n'ont pas de slug
window.migrateOldArticles = async function() {
    try {
        const confirmed = confirm('⚠️ Cette opération va ajouter des slugs à tous les articles qui n\'en ont pas encore.\n\nContinuer ?');
        if (!confirmed) return;
        
        showNotification('🔄 Migration en cours...', 'info');
        
        const snapshot = await getDocs(collection(db, 'articles'));
        let migrated = 0;
        let errors = 0;
        
        for (const docSnapshot of snapshot.docs) {
            const article = docSnapshot.data();
            
            // Si l'article n'a pas de slug
            if (!article.slug) {
                try {
                    const slug = await generateUniqueSlug(article.title, docSnapshot.id);
                    await updateDoc(doc(db, 'articles', docSnapshot.id), { slug });
                    migrated++;
                    console.log(`✅ Migré: ${article.title} → ${slug}`);
                } catch (error) {
                    console.error(`❌ Erreur migration ${article.title}:`, error);
                    errors++;
                }
            }
        }
        
        showNotification(`✅ Migration terminée ! ${migrated} articles mis à jour${errors > 0 ? `, ${errors} erreurs` : ''}`, 'success');
        loadArticles(); // Recharger la liste
        
    } catch (error) {
        console.error('Erreur migration:', error);
        showNotification('❌ Erreur lors de la migration', 'error');
    }
};

// ============================================
// UTILITAIRES
// ============================================
function getCategoryClass(category) {
    const map = {
        'INNOVATION': 'blue',
        'SÉCURITÉ': 'red',
        'NOUVEAUTÉ': 'green',
        'TUTO': 'orange',
        'DOMOTIQUE': 'purple'
    };
    return map[category] || 'blue';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.remove('hidden');

    setTimeout(() => {
        notification.classList.add('hidden');
    }, 3000);
}