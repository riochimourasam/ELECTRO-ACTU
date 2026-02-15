// home.js - Script pour la page d'accueil
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, collection, getDocs, query, orderBy, limit, where, addDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

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
const db = getFirestore(app);
const auth = getAuth(app);

let currentUser = null;

// Détection environnement
const isLocalDev = window.location.hostname === 'localhost' || 
                   window.location.hostname === '127.0.0.1' ||
                   window.location.port === '5500';

// ============================================
// GESTION AUTHENTIFICATION
// ============================================
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    const loginBtn = document.getElementById('loginBtn');
    const userMenu = document.getElementById('userMenu');
    const adminLink = document.getElementById('adminLink');
    const adminDivider = document.getElementById('adminDivider');

    if (user) {
        loginBtn.classList.add('hidden');
        userMenu.classList.remove('hidden');

        const displayName = user.displayName || user.email.split('@')[0];
        document.getElementById('userName').textContent = displayName;
        document.getElementById('userNameDropdown').textContent = displayName;
        document.getElementById('userEmailDropdown').textContent = user.email;

        const avatarUrl = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=1e40af&color=fff`;
        document.getElementById('userAvatar').src = avatarUrl;
        document.getElementById('userAvatarDropdown').src = avatarUrl;

        try {
            const userDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', user.uid)));
            if (!userDoc.empty) {
                const userData = userDoc.docs[0].data();
                if (userData.role === 'admin') {
                    adminLink.classList.remove('hidden');
                    adminDivider.classList.remove('hidden');
                }
            }
        } catch (error) {
            console.error('Erreur vérification admin:', error);
        }
    } else {
        loginBtn.classList.remove('hidden');
        userMenu.classList.add('hidden');
        if (adminLink) adminLink.classList.add('hidden');
        if (adminDivider) adminDivider.classList.add('hidden');
    }
});

// Toggle menu utilisateur
document.getElementById('userMenuToggle')?.addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('userDropdown').classList.toggle('hidden');
});

// Fermer dropdown
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('userDropdown');
    const userMenuToggle = document.getElementById('userMenuToggle');
    if (dropdown && !dropdown.contains(e.target) && e.target !== userMenuToggle) {
        dropdown.classList.add('hidden');
    }
});

// Déconnexion
document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    try {
        await signOut(auth);
        showNotification('Déconnexion réussie', 'success');
        window.location.reload();
    } catch (error) {
        showNotification('Erreur lors de la déconnexion', 'error');
    }
});

// ============================================
// CHARGEMENT DES DERNIERS ARTICLES
// ============================================
async function loadLatestArticles() {
    const container = document.getElementById('latestArticles');
    
    try {
        const q = query(
            collection(db, 'articles'), 
            orderBy('createdAt', 'desc'), 
            limit(6)
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>Aucun article disponible</p></div>';
            return;
        }

        const articles = [];
        snapshot.forEach(doc => {
            articles.push({ id: doc.id, ...doc.data() });
        });

        container.innerHTML = articles.map(article => createArticleCard(article)).join('');
        
        // Mettre à jour les stats
        updateStats(snapshot.size);
    } catch (error) {
        console.error('Erreur chargement articles:', error);
        container.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Erreur de chargement</p></div>';
    }
}

// ============================================
// MISE À JOUR DES STATISTIQUES
// ============================================
async function updateStats(latestCount) {
    try {
        // Compter tous les articles
        const allArticlesSnapshot = await getDocs(collection(db, 'articles'));
        const totalArticles = allArticlesSnapshot.size;
        
        // Mettre à jour l'affichage
        const statsArticlesEl = document.getElementById('statsArticles');
        if (statsArticlesEl) {
            statsArticlesEl.textContent = `${totalArticles}+`;
        }
        
        // On pourrait aussi compter les utilisateurs de la newsletter
        const newsletterSnapshot = await getDocs(collection(db, 'newsletter'));
        const totalUsers = newsletterSnapshot.size;
        
        const statsUsersEl = document.getElementById('statsUsers');
        if (statsUsersEl && totalUsers > 0) {
            statsUsersEl.textContent = `${totalUsers}+`;
        }
    } catch (error) {
        console.error('Erreur mise à jour stats:', error);
    }
}

function createArticleCard(article) {
    const date = article.createdAt ? new Date(article.createdAt.toDate()).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    }) : 'Non daté';

    const imgUrl = article.imageUrl || 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800';
    const categoryClass = getCategoryClass(article.category);

    // URL avec slug si disponible, sinon fallback avec ID
    const articleUrl = article.slug 
        ? `/article/${article.slug}`
        : `/article-detail.html?id=${article.id}`;

    return `
        <article class="article-card" onclick="window.location.href='${articleUrl}'">
            <img src="${imgUrl}" alt="${escapeHtml(article.title)}" class="article-image" loading="lazy"
                 onerror="this.src='https://images.unsplash.com/photo-1518770660439-4636190af475?w=800'">
            <div class="article-content">
                <div class="article-meta">
                    <span class="badge badge-${categoryClass}">${escapeHtml(article.category)}</span>
                    <span class="article-date">${date}</span>
                </div>
                <h3 class="article-title">${escapeHtml(article.title)}</h3>
                <p class="article-summary">${escapeHtml(article.summary || '').substring(0, 120)}...</p>
                <div class="article-footer">
                    <div class="article-stats">
                        <span><i class="fas fa-eye"></i> ${article.views || 0}</span>
                        <span><i class="fas fa-comment"></i> ${article.commentsCount || 0}</span>
                    </div>
                    <button class="btn-read-more">
                        Lire la suite <i class="fas fa-arrow-right"></i>
                    </button>
                </div>
            </div>
        </article>
    `;
}

// ============================================
// NEWSLETTER
// ============================================
window.openNewsletterModal = function() {
    document.getElementById('newsletterModal').classList.remove('hidden');
};

window.closeNewsletterModal = function() {
    document.getElementById('newsletterModal').classList.add('hidden');
    document.getElementById('newsletterForm').reset();
};

// Newsletter modal
document.getElementById('newsletterForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await subscribeNewsletter(document.getElementById('newsletterEmail').value);
});

// Newsletter inline (page d'accueil)
document.getElementById('newsletterFormHome')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await subscribeNewsletter(document.getElementById('newsletterEmailHome').value);
});

async function subscribeNewsletter(email) {
    email = email.trim();
    
    try {
        const emailDoc = await getDocs(query(collection(db, 'newsletter'), where('email', '==', email)));

        if (!emailDoc.empty) {
            showNotification('Vous êtes déjà inscrit !', 'info');
            closeNewsletterModal();
            return;
        }

        await addDoc(collection(db, 'newsletter'), {
            email: email,
            subscribedAt: new Date()
        });

        showNotification('Merci pour votre inscription ! 🎉', 'success');
        closeNewsletterModal();
        
        // Reset form
        document.getElementById('newsletterEmailHome').value = '';
    } catch (error) {
        console.error('Erreur inscription newsletter:', error);
        showNotification('Erreur lors de l\'inscription', 'error');
    }
}

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
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${escapeHtml(message)}</span>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ============================================
// MENU MOBILE
// ============================================
const mobileToggle = document.getElementById('mobileToggle');
const navMenu = document.getElementById('mobileMenu');

function closeMobileMenu() {
    if (!navMenu) return;
    navMenu.classList.remove('active');
    const icon = mobileToggle?.querySelector('i');
    if (icon) {
        icon.classList.remove('fa-times');
        icon.classList.add('fa-bars');
    }
}

mobileToggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    navMenu.classList.toggle('active');
    const icon = mobileToggle.querySelector('i');
    if (navMenu.classList.contains('active')) {
        icon.classList.remove('fa-bars');
        icon.classList.add('fa-times');
    } else {
        icon.classList.remove('fa-times');
        icon.classList.add('fa-bars');
    }
});

document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => closeMobileMenu());
});

document.addEventListener('click', (e) => {
    if (navMenu && mobileToggle && !navMenu.contains(e.target) && !mobileToggle.contains(e.target)) {
        closeMobileMenu();
    }
});

// ============================================
// INITIALISATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    loadLatestArticles();
});
