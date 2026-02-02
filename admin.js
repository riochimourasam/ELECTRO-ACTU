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
                toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    ['blockquote', 'code-block'],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    [{ 'color': [] }, { 'background': [] }],
                    ['link', 'image'],
                    ['clean']
                ]
            },
            placeholder: 'Rédigez votre article ici...'
        });
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
    <meta http-equiv="refresh" content="0;url=/article.html?id=${articleId}">
    <script>window.location.href="/article.html?id=${articleId}";</script>
    
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
