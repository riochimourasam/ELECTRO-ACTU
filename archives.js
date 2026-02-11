// archives.js - Script pour la page Archives
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, collection, getDocs, query, orderBy } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

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

// Variables globales
let allArticles = [];
let filteredArticles = [];
let currentView = 'timeline';
let currentPage = 1;
const articlesPerPage = 20;

// Détection environnement
const isLocalDev = window.location.hostname === 'localhost' || 
                   window.location.hostname === '127.0.0.1' ||
                   window.location.port === '5500';

// ============================================
// CHARGEMENT DES ARTICLES
// ============================================
async function loadArticles() {
    try {
        const q = query(collection(db, 'articles'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        
        allArticles = [];
        snapshot.forEach(doc => {
            allArticles.push({ id: doc.id, ...doc.data() });
        });
        
        filteredArticles = [...allArticles];
        
        // Calculer et afficher les stats
        updateStats();
        
        // Remplir le filtre d'années
        populateYearFilter();
        
        // Afficher les articles
        displayArticles();
        
    } catch (error) {
        console.error('Erreur chargement articles:', error);
        showError('Erreur lors du chargement des archives');
    }
}

// ============================================
// STATISTIQUES
// ============================================
function updateStats() {
    const total = allArticles.length;
    
    // Calculer les mois actifs
    const monthsSet = new Set();
    let totalViews = 0;
    let lastPublishedDate = null;
    
    allArticles.forEach(article => {
        if (article.createdAt) {
            const date = article.createdAt.toDate();
            const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
            monthsSet.add(monthKey);
            
            if (!lastPublishedDate || date > lastPublishedDate) {
                lastPublishedDate = date;
            }
        }
        totalViews += article.views || 0;
    });
    
    const monthsActive = monthsSet.size;
    const avgPerMonth = monthsActive > 0 ? Math.round(total / monthsActive) : 0;
    
    // Afficher les stats
    document.getElementById('totalArticlesArchive').textContent = total;
    document.getElementById('monthsActive').textContent = monthsActive;
    document.getElementById('avgPerMonth').textContent = avgPerMonth;
    
    if (lastPublishedDate) {
        const daysAgo = Math.floor((new Date() - lastPublishedDate) / (1000 * 60 * 60 * 24));
        if (daysAgo === 0) {
            document.getElementById('lastPublished').textContent = "Aujourd'hui";
        } else if (daysAgo === 1) {
            document.getElementById('lastPublished').textContent = "Hier";
        } else if (daysAgo < 7) {
            document.getElementById('lastPublished').textContent = `${daysAgo}j`;
        } else if (daysAgo < 30) {
            const weeks = Math.floor(daysAgo / 7);
            document.getElementById('lastPublished').textContent = `${weeks}sem`;
        } else {
            const months = Math.floor(daysAgo / 30);
            document.getElementById('lastPublished').textContent = `${months}mois`;
        }
    }
}

function populateYearFilter() {
    const years = new Set();
    allArticles.forEach(article => {
        if (article.createdAt) {
            years.add(article.createdAt.toDate().getFullYear());
        }
    });
    
    const yearFilter = document.getElementById('yearFilter');
    const sortedYears = Array.from(years).sort((a, b) => b - a);
    
    sortedYears.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearFilter.appendChild(option);
    });
}

// ============================================
// AFFICHAGE DES ARTICLES
// ============================================
function displayArticles() {
    updateResultsCount();
    
    switch (currentView) {
        case 'timeline':
            displayTimeline();
            break;
        case 'grid':
            displayGrid();
            break;
        case 'list':
            displayList();
            break;
    }
    
    displayPagination();
}

function displayTimeline() {
    const container = document.getElementById('timelineContent');
    
    if (filteredArticles.length === 0) {
        container.innerHTML = getEmptyState();
        return;
    }
    
    // Grouper par mois
    const groupedByMonth = {};
    filteredArticles.forEach(article => {
        if (article.createdAt) {
            const date = article.createdAt.toDate();
            const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
            if (!groupedByMonth[monthKey]) {
                groupedByMonth[monthKey] = {
                    date: date,
                    articles: []
                };
            }
            groupedByMonth[monthKey].articles.push(article);
        }
    });
    
    // Trier par date décroissante
    const sortedMonths = Object.keys(groupedByMonth).sort((a, b) => {
        return groupedByMonth[b].date - groupedByMonth[a].date;
    });
    
    // Générer le HTML
    let html = '';
    sortedMonths.forEach(monthKey => {
        const group = groupedByMonth[monthKey];
        const monthName = group.date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        
        html += `
            <div class="timeline-group">
                <div class="timeline-header">
                    <h2>${capitalize(monthName)}</h2>
                    <span class="timeline-count">${group.articles.length} article${group.articles.length > 1 ? 's' : ''}</span>
                </div>
                <div class="timeline-items">
                    ${group.articles.map(article => createTimelineArticle(article)).join('')}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function displayGrid() {
    const container = document.getElementById('gridContent');
    
    if (filteredArticles.length === 0) {
        container.innerHTML = getEmptyState();
        return;
    }
    
    const start = (currentPage - 1) * articlesPerPage;
    const end = start + articlesPerPage;
    const articlesToShow = filteredArticles.slice(start, end);
    
    container.innerHTML = articlesToShow.map(article => createGridArticle(article)).join('');
}

function displayList() {
    const container = document.getElementById('listContent');
    
    if (filteredArticles.length === 0) {
        container.innerHTML = getEmptyState();
        return;
    }
    
    const start = (currentPage - 1) * articlesPerPage;
    const end = start + articlesPerPage;
    const articlesToShow = filteredArticles.slice(start, end);
    
    container.innerHTML = articlesToShow.map(article => createListArticle(article)).join('');
}

// ============================================
// TEMPLATES D'ARTICLES
// ============================================
function createTimelineArticle(article) {
    const date = article.createdAt ? article.createdAt.toDate() : new Date();
    const day = date.getDate();
    const month = date.toLocaleDateString('fr-FR', { month: 'short' });
    const fullDate = date.toLocaleDateString('fr-FR', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
    });
    
    const articleUrl = getArticleUrl(article);
    const categoryClass = getCategoryClass(article.category);
    
    return `
        <div class="timeline-article" onclick="window.location.href='${articleUrl}'">
            <div class="timeline-date-badge">
                <div class="timeline-day">${day}</div>
                <div class="timeline-month">${month}</div>
            </div>
            <div class="timeline-article-content">
                <div class="timeline-article-meta">
                    <span class="badge badge-${categoryClass}">${escapeHtml(article.category)}</span>
                    <span style="color: #94a3b8; font-size: 0.875rem;">
                        <i class="fas fa-calendar"></i> ${fullDate}
                    </span>
                </div>
                <h3 class="timeline-article-title">${escapeHtml(article.title)}</h3>
                <p class="timeline-article-summary">${escapeHtml(article.summary || '')}</p>
                <div class="timeline-article-footer">
                    <div class="timeline-stats">
                        <span><i class="fas fa-eye"></i> ${article.views || 0}</span>
                        <span><i class="fas fa-comment"></i> ${article.commentsCount || 0}</span>
                    </div>
                    <button class="btn btn-sm btn-primary">
                        Lire <i class="fas fa-arrow-right"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}

function createGridArticle(article) {
    const date = article.createdAt ? article.createdAt.toDate().toLocaleDateString('fr-FR', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
    }) : 'Non daté';
    
    const imgUrl = article.imageUrl || 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800';
    const articleUrl = getArticleUrl(article);
    const categoryClass = getCategoryClass(article.category);
    
    return `
        <div class="grid-article" onclick="window.location.href='${articleUrl}'">
            <img src="${imgUrl}" alt="${escapeHtml(article.title)}" class="grid-article-image" loading="lazy">
            <div class="grid-article-content">
                <div class="grid-article-meta">
                    <span class="badge badge-${categoryClass}">${escapeHtml(article.category)}</span>
                    <span class="grid-article-date">
                        <i class="fas fa-calendar"></i> ${date}
                    </span>
                </div>
                <h3 class="grid-article-title">${escapeHtml(article.title)}</h3>
                <p class="grid-article-summary">${escapeHtml(article.summary || '')}</p>
                <div class="grid-article-footer">
                    <div class="grid-stats">
                        <span><i class="fas fa-eye"></i> ${article.views || 0}</span>
                        <span><i class="fas fa-comment"></i> ${article.commentsCount || 0}</span>
                    </div>
                    <button class="btn btn-sm btn-primary">Lire</button>
                </div>
            </div>
        </div>
    `;
}

function createListArticle(article) {
    const date = article.createdAt ? article.createdAt.toDate().toLocaleDateString('fr-FR', { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric' 
    }) : 'Non daté';
    
    const articleUrl = getArticleUrl(article);
    const categoryClass = getCategoryClass(article.category);
    
    return `
        <div class="list-article" onclick="window.location.href='${articleUrl}'">
            <div class="list-date">${date}</div>
            <div class="list-content">
                <h3 class="list-title">${escapeHtml(article.title)}</h3>
                <div class="list-meta">
                    <span class="badge badge-${categoryClass}">${escapeHtml(article.category)}</span>
                </div>
            </div>
            <div class="list-stats">
                <span><i class="fas fa-eye"></i> ${article.views || 0}</span>
                <span><i class="fas fa-comment"></i> ${article.commentsCount || 0}</span>
            </div>
        </div>
    `;
}

// ============================================
// FILTRES
// ============================================
document.getElementById('searchArchives')?.addEventListener('input', (e) => {
    applyFilters();
});

document.getElementById('categoryFilter')?.addEventListener('change', () => {
    applyFilters();
});

document.getElementById('yearFilter')?.addEventListener('change', () => {
    applyFilters();
});

document.getElementById('sortArchives')?.addEventListener('change', () => {
    applyFilters();
});

function applyFilters() {
    const searchQuery = document.getElementById('searchArchives').value.toLowerCase().trim();
    const category = document.getElementById('categoryFilter').value;
    const year = document.getElementById('yearFilter').value;
    
    filteredArticles = allArticles.filter(article => {
        // Recherche
        const matchesSearch = !searchQuery || 
            article.title.toLowerCase().includes(searchQuery) ||
            article.summary?.toLowerCase().includes(searchQuery) ||
            article.category.toLowerCase().includes(searchQuery);
        
        // Catégorie
        const matchesCategory = category === 'all' || article.category === category;
        
        // Année
        const matchesYear = year === 'all' || 
            (article.createdAt && article.createdAt.toDate().getFullYear().toString() === year);
        
        return matchesSearch && matchesCategory && matchesYear;
    });
    
    // Appliquer le tri
    sortArticles();
    
    currentPage = 1;
    displayArticles();
}

function sortArticles() {
    const sortType = document.getElementById('sortArchives').value;
    
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
        case 'views-desc':
            filteredArticles.sort((a, b) => (b.views || 0) - (a.views || 0));
            break;
        case 'title-asc':
            filteredArticles.sort((a, b) => a.title.localeCompare(b.title));
            break;
    }
}

// ============================================
// VUE SWITCHER
// ============================================
document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const view = e.currentTarget.dataset.view;
        switchView(view);
    });
});

function switchView(view) {
    currentView = view;
    
    // Mettre à jour les boutons
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    
    // Afficher/masquer les vues
    document.getElementById('timelineView').classList.toggle('hidden', view !== 'timeline');
    document.getElementById('gridView').classList.toggle('hidden', view !== 'grid');
    document.getElementById('listView').classList.toggle('hidden', view !== 'list');
    
    currentPage = 1;
    displayArticles();
}

// ============================================
// PAGINATION
// ============================================
function displayPagination() {
    const pagination = document.getElementById('archivesPagination');
    const totalPages = Math.ceil(filteredArticles.length / articlesPerPage);
    
    if (totalPages <= 1 || currentView === 'timeline') {
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
            pageBtn.className = 'pagination-btn' + (i === currentPage ? ' active' : '');
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
// UTILITAIRES
// ============================================
function updateResultsCount() {
    const count = filteredArticles.length;
    const text = count === 0 ? 'Aucun article trouvé' :
                 count === 1 ? '1 article trouvé' :
                 `${count} articles trouvés`;
    document.getElementById('resultsCount').textContent = text;
}

function getArticleUrl(article) {
    return isLocalDev 
        ? `article.html?id=${article.id}`
        : (article.slug ? `article/${article.slug}` : `article.html?id=${article.id}`);
}

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

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getEmptyState() {
    return `
        <div class="empty-state">
            <i class="fas fa-search"></i>
            <h3>Aucun article trouvé</h3>
            <p>Essayez de modifier vos critères de recherche</p>
        </div>
    `;
}

function showError(message) {
    const container = document.getElementById('timelineContent');
    container.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Erreur</h3>
            <p>${escapeHtml(message)}</p>
        </div>
    `;
}

// ============================================
// MOBILE MENU
// ============================================
const mobileToggle = document.getElementById('mobileToggle');
const navMenu = document.getElementById('navMenu');

mobileToggle?.addEventListener('click', () => {
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

// ============================================
// INITIALISATION
// ============================================
document.addEventListener('DOMContentLoaded', loadArticles);
