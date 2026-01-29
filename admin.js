// admin.js - Script d'administration avec URLs SLUG
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
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 100);
}

async function isSlugUnique(slug, excludeId = null) {
    const q = query(collection(db, 'articles'), where('slug', '==', slug));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return true;
    if (excludeId) {
        const existingDoc = snapshot.docs[0];
        return existingDoc.id === excludeId;
    }
    return false;
}

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
// 🔐 VÉRIFICATION ADMIN
// ============================================
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'auth.html?redirect=admin.html';
        return;
    }
    try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists() || userDoc.data().role !== 'admin') {
            showAccessDenied();
            return;
        }
        currentUser = user;
        showAdminDashboard(user, userDoc.data());
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
    if (typeof Quill !== 'undefined' && !quillEditor) {
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
// PUBLICATION / MODIFICATION ARTICLE
// ============================================
articleForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const content = quillEditor.root.innerHTML;
        const textContent = quillEditor.getText().trim();
        if (!textContent || textContent.length < 10) {
            showNotification('⚠️ Le contenu est trop court', 'error');
            return;
        }

        const title = document.getElementById('title').value.trim();
        const slug = await generateUniqueSlug(title, editMode ? currentEditId : null);

        const articleData = {
            title,
            slug,
            category: document.getElementById('category').value,
            imageUrl: document.getElementById('imageUrl').value.trim() || null,
            summary: document.getElementById('summary').value.trim(),
            content,
            featured: document.getElementById('featured').checked,
            tags: document.getElementById('tags').value.split(',').map(t => t.trim()).filter(t => t),
            author: {
                uid: currentUser.uid,
                name: currentUser.displayName || currentUser.email,
                email: currentUser.email
            }
        };

        if (editMode && currentEditId) {
            await updateDoc(doc(db, 'articles', currentEditId), { ...articleData, updatedAt: serverTimestamp() });
            showNotification('✅ Article modifié !', 'success');
            cancelEdit();
        } else {
            await addDoc(collection(db, 'articles'), { 
                ...articleData, 
                createdAt: serverTimestamp(), 
                views: 0, 
                commentsCount: 0, 
                reactions: { like: 0, love: 0, star: 0 } 
            });
            showNotification('✅ Article publié !', 'success');
            articleForm.reset();
            quillEditor.setText('');
        }
        loadArticles();
        loadStatistics();
    } catch (error) {
        console.error('Erreur:', error);
        showNotification('❌ Erreur lors de la publication', 'error');
    }
});

// ============================================
// CHARGER ARTICLES & AFFICHAGE
// ============================================
async function loadArticles() {
    try {
        articlesList.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>Chargement...</p></div>';
        const q = query(collection(db, 'articles'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            articlesList.innerHTML = '<div class="empty-state"><p>Aucun article</p></div>';
            return;
        }
        articlesList.innerHTML = '';
        snapshot.forEach(doc => {
            articlesList.appendChild(createArticleItem(doc.id, doc.data()));
        });
    } catch (error) {
        console.error('Erreur chargement:', error);
    }
}

function createArticleItem(id, article) {
    const div = document.createElement('div');
    div.className = 'admin-article-item';
    const date = article.createdAt ? new Date(article.createdAt.toDate()).toLocaleDateString('fr-FR') : 'Date inconnue';
    
    // 🆕 CORRECTION : Utiliser le slug si disponible
    const articleUrl = article.slug 
        ? `/article/${article.slug}` 
        : `article.html?id=${id}`;
    
    const displayUrl = article.slug 
        ? `electroinfo.online/article/${article.slug}`
        : `article.html?id=${id}`;

    div.innerHTML = `
        <div class="article-info">
            <h3>${escapeHtml(article.title)}</h3>
            <small style="color: #6b7280;"><i class="fas fa-link"></i> ${displayUrl}</small>
            <p class="article-meta">
                <span class="badge badge-${getCategoryClass(article.category)}">${article.category}</span>
                <span>${date}</span>
                <span><i class="fas fa-eye"></i> ${article.views || 0}</span>
            </p>
        </div>
        <div class="article-actions">
            <a href="${articleUrl}" target="_blank" class="btn btn-sm btn-outline" style="text-decoration:none; display:inline-flex; align-items:center; gap:5px; border:1px solid #ddd; padding:5px 10px; border-radius:4px; color:#333;">
                <i class="fas fa-external-link-alt"></i> Voir
            </a>
            <button class="btn btn-sm btn-success" onclick="copyArticleLink('${articleUrl}')">
                <i class="fas fa-copy"></i> Copier
            </button>
            <button class="btn btn-sm btn-primary" onclick="editArticle('${id}')">
                <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-sm btn-danger" onclick="showDeleteModal('${id}')">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    return div;
}

// ============================================
// COPIER LE LIEN
// ============================================
window.copyArticleLink = function(url) {
    const fullUrl = url.startsWith('http') ? url : `https://electroinfo.online${url}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
        showNotification('✅ Lien copié !', 'success');
    }).catch(err => {
        console.error('Erreur copie:', err);
        showNotification('❌ Erreur lors de la copie', 'error');
    });
};

// ============================================
// ÉDITION ARTICLE
// ============================================
window.editArticle = async function(articleId) {
    const docSnap = await getDoc(doc(db, 'articles', articleId));
    if (docSnap.exists()) {
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
// SUPPRESSION ARTICLE
// ============================================
window.showDeleteModal = function(articleId) {
    articleToDelete = articleId;
    document.getElementById('deleteModal').classList.remove('hidden');
};

document.getElementById('cancelDelete')?.addEventListener('click', () => {
    document.getElementById('deleteModal').classList.add('hidden');
});

document.getElementById('confirmDelete')?.addEventListener('click', async () => {
    if (articleToDelete) {
        await deleteDoc(doc(db, 'articles', articleToDelete));
        document.getElementById('deleteModal').classList.add('hidden');
        loadArticles();
        loadStatistics();
        showNotification('✅ Article supprimé', 'success');
    }
});

// ============================================
// STATISTIQUES
// ============================================
async function loadStatistics() {
    try {
        const snapshot = await getDocs(collection(db, 'articles'));
        const newsSnap = await getDocs(collection(db, 'newsletter'));
        
        let views = 0;
        let todayCount = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        snapshot.forEach(d => {
            const data = d.data();
            views += (data.views || 0);
            
            if (data.createdAt) {
                const articleDate = data.createdAt.toDate();
                articleDate.setHours(0, 0, 0, 0);
                if (articleDate.getTime() === today.getTime()) {
                    todayCount++;
                }
            }
        });
        
        document.getElementById('totalArticles').textContent = snapshot.size;
        document.getElementById('todayArticles').textContent = todayCount;
        document.getElementById('totalViews').textContent = views.toLocaleString();
        document.getElementById('newsletterSubs').textContent = newsSnap.size;
    } catch (error) {
        console.error('Erreur chargement stats:', error);
    }
}

// ============================================
// NEWSLETTER
// ============================================
async function loadNewsletterSubscribers() {
    try {
        const snapshot = await getDocs(collection(db, 'newsletter'));
        newsletterList.innerHTML = '';
        
        if (snapshot.empty) {
            newsletterList.innerHTML = '<div class="empty-state"><p>Aucun abonné</p></div>';
            return;
        }
        
        snapshot.forEach(doc => {
            const sub = doc.data();
            const div = document.createElement('div');
            div.className = 'newsletter-item';
            div.innerHTML = `<span class="newsletter-email">${sub.email}</span>`;
            newsletterList.appendChild(div);
        });
    } catch (error) {
        console.error('Erreur newsletter:', error);
    }
}

window.exportNewsletterCSV = async function() {
    try {
        const snapshot = await getDocs(collection(db, 'newsletter'));
        let csv = 'Email,Date\n';
        snapshot.forEach(doc => {
            const data = doc.data();
            const date = data.subscribedAt ? new Date(data.subscribedAt.toDate()).toLocaleDateString() : '';
            csv += `${data.email},${date}\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `newsletter_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showNotification('✅ Export réussi !', 'success');
    } catch (error) {
        console.error('Erreur export:', error);
        showNotification('❌ Erreur lors de l\'export', 'error');
    }
};

// ============================================
// UTILITAIRES
// ============================================
function getCategoryClass(cat) {
    const map = { 
        'INNOVATION': 'blue', 
        'SÉCURITÉ': 'red', 
        'NOUVEAUTÉ': 'green', 
        'TUTO': 'orange', 
        'DOMOTIQUE': 'purple' 
    };
    return map[cat] || 'blue';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showNotification(message, type = 'info') {
    const n = document.getElementById('notification');
    n.textContent = message;
    n.className = `notification ${type}`;
    n.classList.remove('hidden');
    setTimeout(() => n.classList.add('hidden'), 3000);
}