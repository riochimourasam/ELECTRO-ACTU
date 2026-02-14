// articles.js - Script pour la page de liste des articles (réutilise app.js)
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

// Variables globales
let allArticles = [];
let filteredArticles = [];
let currentPage = 1;
const articlesPerPage = 9; // 9 articles par page au lieu de 6
let currentUser = null;

// Détection environnement
const isLocalDev = window.location.hostname === 'localhost' || 
                   window.location.hostname === '127.0.0.1' ||
                   window.location.port === '5500';

// Éléments DOM
const articlesGrid = document.getElementById('articlesGrid');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');
const filterBtns = document.querySelectorAll('.filter-btn');
const pagination = document.getElementById('pagination');
const popularArticles = document.getElementById('popularArticles');

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
// CHARGEMENT DES ARTICLES
// ============================================
async function loadArticles() {
    try {
        articlesGrid.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>Chargement...</p></div>';

        const q = query(collection(db, 'articles'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);

        allArticles = [];
        snapshot.forEach(doc => {
            allArticles.push({ id: doc.id, ...doc.data() });
        });

        filteredArticles = [...allArticles];
        
        // Vérifier si une catégorie est passée en paramètre URL
        const urlParams = new URLSearchParams(window.location.search);
        const categoryParam = urlParams.get('category');
        
        if (categoryParam) {
            filteredArticles = allArticles.filter(a => a.category === categoryParam);
            // Activer le bon bouton de filtre
            filterBtns.forEach(btn => {
                btn.classList.remove('active');
                if (btn.dataset.category === categoryParam) {
                    btn.classList.add('active');
                }
            });
        }
        
        displayArticles();
        displayPopularArticles();
    } catch (error) {
        console.error('Erreur chargement articles:', error);
        articlesGrid.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Erreur de chargement</p></div>';
    }
}

function displayArticles() {
    const start = (currentPage - 1) * articlesPerPage;
    const end = start + articlesPerPage;
    const articlesToShow = filteredArticles.slice(start, end);

    if (articlesToShow.length === 0) {
        articlesGrid.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i><p>Aucun article trouvé</p></div>';
        return;
    }

    articlesGrid.innerHTML = articlesToShow.map(article => createArticleCard(article)).join('');
    displayPagination();
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
                <p class="article-summary">${escapeHtml(article.summary || '')}</p>
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
// PAGINATION
// ============================================
function displayPagination() {
    const totalPages = Math.ceil(filteredArticles.length / articlesPerPage);

    if (totalPages <= 1) {
        pagination.classList.add('hidden');
        return;
    }

    pagination.classList.remove('hidden');
    pagination.innerHTML = '';

    // Bouton Précédent
    const prevBtn = document.createElement('button');
    prevBtn.className = 'pagination-btn';
    prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => changePage(currentPage - 1);
    pagination.appendChild(prevBtn);

    // Numéros de page
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            const pageBtn = document.createElement('button');
            pageBtn.className = `pagination-btn ${i === currentPage ? 'active' : ''}`;
            pageBtn.textContent = i;
            pageBtn.onclick = () => changePage(i);
            pagination.appendChild(pageBtn);
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            const dots = document.createElement('span');
            dots.className = 'pagination-dots';
            dots.textContent = '...';
            pagination.appendChild(dots);
        }
    }

    // Bouton Suivant
    const nextBtn = document.createElement('button');
    nextBtn.className = 'pagination-btn';
    nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => changePage(currentPage + 1);
    pagination.appendChild(nextBtn);
}

function changePage(page) {
    currentPage = page;
    displayArticles();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================
// ARTICLES POPULAIRES
// ============================================
async function displayPopularArticles() {
    try {
        const q = query(collection(db, 'articles'), orderBy('views', 'desc'), limit(5));
        const snapshot = await getDocs(q);

        popularArticles.innerHTML = snapshot.docs.map(doc => {
            const article = { id: doc.id, ...doc.data() };
            const imgUrl = article.imageUrl || 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400';
            
            // URL avec slug si disponible
            const articleUrl = article.slug 
                ? `/article/${article.slug}`
                : `/article-detail.html?id=${article.id}`;
            
            return `
                <div class="popular-article" onclick="window.location.href='${articleUrl}'">
                    <img src="${imgUrl}" alt="${escapeHtml(article.title)}" 
                         onerror="this.src='https://images.unsplash.com/photo-1518770660439-4636190af475?w=400'">
                    <div class="popular-content">
                        <h4 class="popular-title">${escapeHtml(article.title)}</h4>
                        <p class="popular-views"><i class="fas fa-eye"></i> ${article.views || 0} vues</p>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Erreur articles populaires:', error);
    }
}

// ============================================
// RECHERCHE & FILTRES
// ============================================
function debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

searchInput?.addEventListener('input', debounce((e) => {
    const query = e.target.value.toLowerCase().trim();

    if (!query) {
        filteredArticles = [...allArticles];
    } else {
        filteredArticles = allArticles.filter(article =>
            article.title.toLowerCase().includes(query) ||
            article.summary?.toLowerCase().includes(query) ||
            article.category.toLowerCase().includes(query)
        );
    }

    currentPage = 1;
    displayArticles();
}));

filterBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        filterBtns.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');

        const category = e.target.dataset.category;

        if (category === 'all') {
            filteredArticles = [...allArticles];
        } else {
            filteredArticles = allArticles.filter(a => a.category === category);
        }

        currentPage = 1;
        displayArticles();
        
        // Mettre à jour l'URL
        const url = new URL(window.location);
        if (category === 'all') {
            url.searchParams.delete('category');
        } else {
            url.searchParams.set('category', category);
        }
        window.history.pushState({}, '', url);
    });
});

sortSelect?.addEventListener('change', (e) => {
    const sortType = e.target.value;

    switch (sortType) {
        case 'date-desc':
            filteredArticles.sort((a, b) => {
                const dateA = a.createdAt ? a.createdAt.toDate() : new Date(0);
                const dateB = b.createdAt ? b.createdAt.toDate() : new Date(0);
                return dateB - dateA;
            });
            break;
        case 'date-asc':
            filteredArticles.sort((a, b) => {
                const dateA = a.createdAt ? a.createdAt.toDate() : new Date(0);
                const dateB = b.createdAt ? b.createdAt.toDate() : new Date(0);
                return dateA - dateB;
            });
            break;
        case 'popular':
            filteredArticles.sort((a, b) => (b.views || 0) - (a.views || 0));
            break;
        case 'title':
            filteredArticles.sort((a, b) => a.title.localeCompare(b.title));
            break;
    }

    displayArticles();
});

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

document.getElementById('newsletterForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('newsletterEmail').value.trim();

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
    } catch (error) {
        console.error('Erreur inscription newsletter:', error);
        showNotification('Erreur lors de l\'inscription', 'error');
    }
});

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
document.addEventListener('DOMContentLoaded', loadArticles);
