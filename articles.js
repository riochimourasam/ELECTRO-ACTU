// articles.js — Page liste des articles (Firebase v9 modulaire)

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {
    getFirestore, collection, getDocs, query,
    orderBy, limit, where, addDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import {
    getAuth, onAuthStateChanged, signOut
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// ============================================
// CONFIGURATION FIREBASE
// ============================================
const firebaseConfig = {
    apiKey: "AIzaSyAlBDedWLbHG-3UnijsSfocm77sNpn15Wg",
    authDomain: "electroactu-b6050.firebaseapp.com",
    projectId: "electroactu-b6050",
    storageBucket: "electroactu-b6050.firebasestorage.app",
    messagingSenderId: "890343912768",
    appId: "1:890343912768:web:87de595f6df3c3f434f6a5"
};

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

// ============================================
// VARIABLES GLOBALES
// ============================================
let allArticles      = [];
let filteredArticles = [];
let currentPage      = 1;
const ARTICLES_PER_PAGE = 9;

// ============================================
// ÉLÉMENTS DOM
// ============================================
const articlesGrid   = document.getElementById('articlesGrid');
const searchInput    = document.getElementById('searchInput');
const sortSelect     = document.getElementById('sortSelect');
const filterBtns     = document.querySelectorAll('.filter-btn');
const pagination     = document.getElementById('pagination');
const popularArticles = document.getElementById('popularArticles');

// ============================================
// AUTHENTIFICATION
// ============================================
onAuthStateChanged(auth, async (user) => {
    const loginBtn    = document.getElementById('loginBtn');
    const userMenu    = document.getElementById('userMenu');
    const adminLink   = document.getElementById('adminLink');
    const adminDivider = document.getElementById('adminDivider');

    if (user) {
        loginBtn.classList.add('hidden');
        userMenu.classList.remove('hidden');

        const displayName = user.displayName || user.email.split('@')[0];
        document.getElementById('userName').textContent         = displayName;
        document.getElementById('userNameDropdown').textContent = displayName;
        document.getElementById('userEmailDropdown').textContent = user.email;

        const avatarUrl = user.photoURL ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=1e40af&color=fff`;
        document.getElementById('userAvatar').src         = avatarUrl;
        document.getElementById('userAvatarDropdown').src = avatarUrl;

        // Vérification du rôle admin
        try {
            const userDoc = await getDocs(
                query(collection(db, 'users'), where('__name__', '==', user.uid))
            );
            if (!userDoc.empty && userDoc.docs[0].data().role === 'admin') {
                adminLink?.classList.remove('hidden');
                adminDivider?.classList.remove('hidden');
            }
        } catch (e) {
            console.error('Erreur vérification admin:', e);
        }
    } else {
        loginBtn.classList.remove('hidden');
        userMenu.classList.add('hidden');
        adminLink?.classList.add('hidden');
        adminDivider?.classList.add('hidden');
    }
});

// Toggle menu utilisateur
document.getElementById('userMenuToggle')?.addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('userDropdown').classList.toggle('hidden');
});

document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('userDropdown');
    const toggle   = document.getElementById('userMenuToggle');
    if (dropdown && !dropdown.contains(e.target) && e.target !== toggle) {
        dropdown.classList.add('hidden');
    }
});

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    try {
        await signOut(auth);
        showNotification('Déconnexion réussie', 'success');
        window.location.reload();
    } catch {
        showNotification('Erreur lors de la déconnexion', 'error');
    }
});

// ============================================
// CHARGEMENT DES ARTICLES
// ============================================
async function loadArticles() {
    try {
        articlesGrid.innerHTML =
            '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>Chargement...</p></div>';

        const snapshot = await getDocs(
            query(collection(db, 'articles'), orderBy('createdAt', 'desc'))
        );

        allArticles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        filteredArticles = [...allArticles];

        // Filtre par catégorie depuis l'URL
        const categoryParam = new URLSearchParams(window.location.search).get('category');
        if (categoryParam) {
            filteredArticles = allArticles.filter(a => a.category === categoryParam);
            filterBtns.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.category === categoryParam);
            });
        }

        displayArticles();
        loadPopularArticles();
    } catch (error) {
        console.error('Erreur chargement articles:', error);
        articlesGrid.innerHTML =
            '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Erreur de chargement</p></div>';
    }
}

function displayArticles() {
    const start = (currentPage - 1) * ARTICLES_PER_PAGE;
    const articlesToShow = filteredArticles.slice(start, start + ARTICLES_PER_PAGE);

    if (articlesToShow.length === 0) {
        articlesGrid.innerHTML =
            '<div class="empty-state"><i class="fas fa-search"></i><p>Aucun article trouvé</p></div>';
        pagination.classList.add('hidden');
        return;
    }

    // Premier article = card vedette pleine largeur, les autres = grille 2 colonnes
    const [featured, ...rest] = articlesToShow;
    articlesGrid.innerHTML =
        createFeaturedCard(featured) +
        (rest.length ? `<div class="articles-subgrid">${rest.map(createArticleCard).join('')}</div>` : '');

    displayPagination();
}

function getArticleUrl(article) {
    return article.slug
        ? `/article/${article.slug}`
        : `/article-detail.html?id=${article.id}`;
}

function getArticleDate(article) {
    return article.createdAt
        ? article.createdAt.toDate().toLocaleDateString('fr-FR', {
            day: 'numeric', month: 'long', year: 'numeric'
          })
        : 'Non daté';
}

// Card vedette — grande, pleine largeur
function createFeaturedCard(article) {
    const date         = getArticleDate(article);
    const imgUrl       = article.imageUrl || 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200';
    const categoryClass = getCategoryClass(article.category);
    const articleUrl   = getArticleUrl(article);

    return `
        <article class="article-card article-card--featured" onclick="window.location.href='${articleUrl}'">
            <div class="article-card__image-wrap">
                <img src="${imgUrl}"
                     alt="${escapeHtml(article.title)}"
                     class="article-image"
                     loading="lazy"
                     onerror="this.src='https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200'">
                <span class="article-card__featured-label">
                    <i class="fas fa-star"></i> À la une
                </span>
            </div>
            <div class="article-content">
                <div class="article-meta">
                    <span class="badge badge-${categoryClass}">${escapeHtml(article.category)}</span>
                    <span class="article-date"><i class="fas fa-calendar-alt"></i> ${date}</span>
                </div>
                <h2 class="article-title">${escapeHtml(article.title)}</h2>
                <p class="article-summary">${escapeHtml(article.summary || '')}</p>
                <div class="article-footer">
                    <div class="article-stats">
                        <span><i class="fas fa-eye"></i> ${article.views || 0} vues</span>
                        <span><i class="fas fa-comment"></i> ${article.commentsCount || 0}</span>
                    </div>
                    <button class="btn-read-more">
                        Lire l'article <i class="fas fa-arrow-right"></i>
                    </button>
                </div>
            </div>
        </article>
    `;
}

// Cards secondaires — grille 2 colonnes
function createArticleCard(article) {
    const date         = getArticleDate(article);
    const imgUrl       = article.imageUrl || 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800';
    const categoryClass = getCategoryClass(article.category);
    const articleUrl   = getArticleUrl(article);

    return `
        <article class="article-card" onclick="window.location.href='${articleUrl}'">
            <div class="article-card__image-wrap">
                <img src="${imgUrl}"
                     alt="${escapeHtml(article.title)}"
                     class="article-image"
                     loading="lazy"
                     onerror="this.src='https://images.unsplash.com/photo-1518770660439-4636190af475?w=800'">
            </div>
            <div class="article-content">
                <div class="article-meta">
                    <span class="badge badge-${categoryClass}">${escapeHtml(article.category)}</span>
                    <span class="article-date"><i class="fas fa-calendar-alt"></i> ${date}</span>
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
    const totalPages = Math.ceil(filteredArticles.length / ARTICLES_PER_PAGE);

    if (totalPages <= 1) {
        pagination.classList.add('hidden');
        return;
    }

    pagination.classList.remove('hidden');
    pagination.innerHTML = '';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'pagination-btn';
    prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
    prevBtn.disabled  = currentPage === 1;
    prevBtn.onclick   = () => changePage(currentPage - 1);
    pagination.appendChild(prevBtn);

    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            const btn = document.createElement('button');
            btn.className = `pagination-btn ${i === currentPage ? 'active' : ''}`;
            btn.textContent = i;
            btn.onclick = () => changePage(i);
            pagination.appendChild(btn);
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            const dots = document.createElement('span');
            dots.className   = 'pagination-dots';
            dots.textContent = '…';
            pagination.appendChild(dots);
        }
    }

    const nextBtn = document.createElement('button');
    nextBtn.className = 'pagination-btn';
    nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
    nextBtn.disabled  = currentPage === totalPages;
    nextBtn.onclick   = () => changePage(currentPage + 1);
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
async function loadPopularArticles() {
    try {
        const snapshot = await getDocs(
            query(collection(db, 'articles'), orderBy('views', 'desc'), limit(5))
        );

        popularArticles.innerHTML = snapshot.docs.map(doc => {
            const article    = { id: doc.id, ...doc.data() };
            const imgUrl     = article.imageUrl ||
                'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400';
            const articleUrl = article.slug
                ? `/article/${article.slug}`
                : `/article-detail.html?id=${article.id}`;

            return `
                <div class="popular-article" onclick="window.location.href='${articleUrl}'">
                    <img src="${imgUrl}"
                         alt="${escapeHtml(article.title)}"
                         onerror="this.src='https://images.unsplash.com/photo-1518770660439-4636190af475?w=400'">
                    <div class="popular-content">
                        <h4 class="popular-title">${escapeHtml(article.title)}</h4>
                        <p class="popular-views">
                            <i class="fas fa-eye"></i> ${article.views || 0} vues
                        </p>
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
    const q = e.target.value.toLowerCase().trim();
    filteredArticles = q
        ? allArticles.filter(a =>
            a.title.toLowerCase().includes(q) ||
            a.summary?.toLowerCase().includes(q) ||
            a.category.toLowerCase().includes(q)
          )
        : [...allArticles];
    currentPage = 1;
    displayArticles();
}));

filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const category = btn.dataset.category;
        filteredArticles = category === 'all'
            ? [...allArticles]
            : allArticles.filter(a => a.category === category);

        currentPage = 1;
        displayArticles();

        // Mettre à jour l'URL sans rechargement
        const url = new URL(window.location);
        category === 'all'
            ? url.searchParams.delete('category')
            : url.searchParams.set('category', category);
        window.history.pushState({}, '', url);
    });
});

sortSelect?.addEventListener('change', (e) => {
    switch (e.target.value) {
        case 'date-desc':
            filteredArticles.sort((a, b) => toDate(b) - toDate(a));
            break;
        case 'date-asc':
            filteredArticles.sort((a, b) => toDate(a) - toDate(b));
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

function toDate(article) {
    return article.createdAt ? article.createdAt.toDate() : new Date(0);
}

// ============================================
// NEWSLETTER
// ============================================
window.openNewsletterModal  = () =>
    document.getElementById('newsletterModal').classList.remove('hidden');
window.closeNewsletterModal = () => {
    document.getElementById('newsletterModal').classList.add('hidden');
    document.getElementById('newsletterForm').reset();
};

document.getElementById('newsletterForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('newsletterEmail').value.trim().toLowerCase();

    try {
        const existing = await getDocs(
            query(collection(db, 'newsletter'), where('email', '==', email))
        );
        if (!existing.empty) {
            showNotification('Vous êtes déjà inscrit !', 'info');
            window.closeNewsletterModal();
            return;
        }
        await addDoc(collection(db, 'newsletter'), { email, subscribedAt: new Date() });
        showNotification('Merci pour votre inscription ! 🎉', 'success');
        window.closeNewsletterModal();
    } catch {
        showNotification("Erreur lors de l'inscription", 'error');
    }
});

// ============================================
// MENU MOBILE
// ============================================
const mobileToggle = document.getElementById('mobileToggle');
const navMenu      = document.getElementById('mobileMenu');

function closeMobileMenu() {
    navMenu?.classList.remove('active');
    const icon = mobileToggle?.querySelector('i');
    if (icon) { icon.className = 'fas fa-bars'; }
}

mobileToggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = navMenu.classList.toggle('active');
    mobileToggle.querySelector('i').className = isOpen ? 'fas fa-times' : 'fas fa-bars';
});

document.querySelectorAll('.nav-link').forEach(link =>
    link.addEventListener('click', closeMobileMenu)
);

document.addEventListener('click', (e) => {
    if (navMenu && mobileToggle &&
        !navMenu.contains(e.target) && !mobileToggle.contains(e.target)) {
        closeMobileMenu();
    }
});

// ============================================
// UTILITAIRES
// ============================================
function getCategoryClass(category) {
    return { INNOVATION: 'blue', 'SÉCURITÉ': 'red', 'NOUVEAUTÉ': 'green',
             TUTO: 'orange', DOMOTIQUE: 'purple' }[category] || 'blue';
}

function escapeHtml(text) {
    if (!text) return '';
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
}

function showNotification(message, type = 'info') {
    const icons = { success: 'check-circle', error: 'exclamation-circle', info: 'info-circle' };
    const el = document.createElement('div');
    el.className = `notification ${type}`;
    el.innerHTML = `<i class="fas fa-${icons[type] || 'info-circle'}"></i><span>${escapeHtml(message)}</span>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
        el.classList.remove('show');
        setTimeout(() => el.remove(), 300);
    }, 3000);
}

// ============================================
// INITIALISATION
// ============================================
document.addEventListener('DOMContentLoaded', loadArticles);