// courses.js - Navigation par diplome + liste des cours
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, collection, getDocs, query, orderBy, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Variables globales
let allCourses = [];
let currentFilter = 'all';
let coursesLoaded = false;

// DOM
const viewHome    = document.getElementById('view-home');
const viewCourses = document.getElementById('view-courses');
const coursesGrid    = document.getElementById('coursesGrid');
const coursesLoading = document.getElementById('coursesLoading');
const noCourses      = document.getElementById('noCourses');
const coursesViewTitle = document.getElementById('coursesViewTitle');

// ============================================
// NOMS ET ICONES DES DIPLOMES
// ============================================
const diplomaInfo = {
    'all':      { label: 'Tous les cours',   icon: 'fa-th',              color: '#6b7280' },
    'BAC PRO':  { label: 'BAC PRO',          icon: 'fa-certificate',     color: '#1e40af' },
    'BEP':      { label: 'BEP',              icon: 'fa-award',           color: '#7c3aed' },
    'CAP':      { label: 'CAP',              icon: 'fa-medal',           color: '#065f46' },
    'BTS':      { label: 'BTS',              icon: 'fa-user-graduate',   color: '#b45309' },
    'LICENCE':  { label: 'Licence',          icon: 'fa-graduation-cap',  color: '#9f1239' },
};

// ============================================
// NAVIGATION ENTRE VUES
// ============================================
function showView(viewName) {
    viewHome.classList.remove('active-view');
    viewCourses.classList.remove('active-view');

    if (viewName === 'home') {
        viewHome.classList.add('active-view');
        // Remettre le hash propre
        history.replaceState(null, '', window.location.pathname);
    } else {
        viewCourses.classList.add('active-view');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function openDiplomaView(diploma) {
    currentFilter = diploma;
    const info = diplomaInfo[diploma] || diplomaInfo['all'];

    // Mettre à jour le titre de la vue
    coursesViewTitle.innerHTML = `
        <i class="fas ${info.icon}" style="color:${info.color}"></i>
        <span>${info.label}</span>
    `;

    // Mettre à jour le hash URL (pour le bouton retour natif du navigateur)
    history.pushState({ diploma }, '', `#${diploma.replace(' ', '-')}`);

    showView('courses');

    // Charger si pas encore fait, sinon filtrer directement
    if (!coursesLoaded) {
        loadCourses();
    } else {
        displayCourses();
    }
}

// Boutons diplome de la vue accueil
document.querySelectorAll('.diploma-card').forEach(card => {
    card.addEventListener('click', () => {
        const diploma = card.dataset.diploma;
        openDiplomaView(diploma);
    });
});

// Bouton retour (vue cours → vue accueil)
document.getElementById('backToHome').addEventListener('click', () => {
    showView('home');
});

// Bouton retour si aucun cours
document.querySelector('.back-btn-empty')?.addEventListener('click', () => {
    showView('home');
});

// Gestion du bouton retour natif du navigateur (popstate)
window.addEventListener('popstate', (e) => {
    if (e.state && e.state.diploma) {
        currentFilter = e.state.diploma;
        const info = diplomaInfo[currentFilter] || diplomaInfo['all'];
        coursesViewTitle.innerHTML = `
            <i class="fas ${info.icon}" style="color:${info.color}"></i>
            <span>${info.label}</span>
        `;
        showView('courses');
        displayCourses();
    } else {
        showView('home');
    }
});

// Si on arrive avec un hash dans l'URL (lien direct)
function checkInitialHash() {
    const hash = window.location.hash.replace('#', '').replace('-', ' ');
    if (hash) {
        const matched = Object.keys(diplomaInfo).find(
            k => k.toLowerCase() === hash.toLowerCase()
        );
        if (matched) {
            openDiplomaView(matched);
            return;
        }
    }
    showView('home');
}

// ============================================
// CHARGEMENT DES COURS
// ============================================
async function loadCourses() {
    try {
        coursesLoading.classList.remove('hidden');
        coursesGrid.classList.add('hidden');
        noCourses.classList.add('hidden');

        const q = query(collection(db, 'courses'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);

        allCourses = [];
        snapshot.forEach(doc => {
            allCourses.push({ id: doc.id, ...doc.data() });
        });

        coursesLoaded = true;
        coursesLoading.classList.add('hidden');
        displayCourses();

    } catch (error) {
        console.error('Erreur chargement cours:', error);
        coursesLoading.classList.add('hidden');
        noCourses.classList.remove('hidden');
    }
}

// ============================================
// AFFICHAGE DES COURS
// ============================================
function displayCourses() {
    let filtered = allCourses;

    if (currentFilter !== 'all') {
        filtered = allCourses.filter(c => c.diploma === currentFilter);
    }

    if (filtered.length === 0) {
        coursesGrid.classList.add('hidden');
        noCourses.classList.remove('hidden');
        return;
    }

    noCourses.classList.add('hidden');
    coursesGrid.classList.remove('hidden');
    coursesGrid.innerHTML = filtered.map(c => createCourseCard(c)).join('');
}

// ============================================
// CARTE COURS
// ============================================
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function createCourseCard(course) {
    const sequencesCount = course.sequences?.length || 0;
    let sessionsCount = 0;
    course.sequences?.forEach(seq => {
        sessionsCount += seq.sessions?.length || 0;
    });

    const date = course.createdAt?.toDate?.() || new Date();
    const formattedDate = date.toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'long', year: 'numeric'
    });

    return `
        <div class="course-card" onclick="window.location.href='course-detail.html?id=${course.id}'">
            <div class="course-card-header">
                <div class="course-diploma">${escapeHtml(course.diploma || 'BAC PRO')}</div>
                <h3 class="course-card-title">${escapeHtml(course.title)}</h3>
            </div>
            <div class="course-card-body">
                <p class="course-description">${escapeHtml(course.description || '')}</p>
                <div class="course-meta">
                    <span class="course-badge">
                        <i class="fas fa-signal"></i>
                        ${escapeHtml(course.level || 'Debutant')}
                    </span>
                    <span class="course-badge">
                        <i class="fas fa-clock"></i>
                        ${sessionsCount} seances
                    </span>
                </div>
                <div class="course-stats">
                    <div class="course-stat">
                        <span class="course-stat-value">${sequencesCount}</span>
                        <span class="course-stat-label">Sequences</span>
                    </div>
                    <div class="course-stat">
                        <span class="course-stat-value">${sessionsCount}</span>
                        <span class="course-stat-label">Seances</span>
                    </div>
                    <div class="course-stat">
                        <span class="course-stat-value"><i class="fas fa-star" style="color:#fbbf24"></i></span>
                        <span class="course-stat-label">Nouveau</span>
                    </div>
                </div>
            </div>
            <div class="course-card-footer">
                <span class="course-date">
                    <i class="fas fa-calendar"></i> ${formattedDate}
                </span>
                <button class="course-action">
                    Voir le cours <i class="fas fa-arrow-right"></i>
                </button>
            </div>
        </div>
    `;
}

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
        document.getElementById('userName').textContent = displayName;
        document.getElementById('userNameDropdown').textContent = displayName;
        document.getElementById('userEmailDropdown').textContent = user.email;

        const avatarUrl = user.photoURL ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=1e40af&color=fff`;
        document.getElementById('userAvatar').src = avatarUrl;
        document.getElementById('userAvatarDropdown').src = avatarUrl;

        try {
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists() && userDoc.data().role === 'admin') {
                adminLink.classList.remove('hidden');
                adminDivider.classList.remove('hidden');
            }
        } catch (e) {
            console.error('Erreur verification admin:', e);
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
        window.location.href = 'index.html';
    } catch (e) {
        console.error('Erreur deconnexion:', e);
    }
});

// ============================================
// MENU MOBILE (corrige : utilise mobileMenu)
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
    navMenu.classList.toggle('active');
    const icon = mobileToggle.querySelector('i');
    icon.className = navMenu.classList.contains('active') ? 'fas fa-times' : 'fas fa-bars';
});

document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => closeMobileMenu());
});

document.addEventListener('click', (e) => {
    if (navMenu && mobileToggle &&
        !navMenu.contains(e.target) &&
        !mobileToggle.contains(e.target)) {
        closeMobileMenu();
    }
});

// ============================================
// INITIALISATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    checkInitialHash();
});
