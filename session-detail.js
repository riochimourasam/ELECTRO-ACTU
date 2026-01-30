// session-detail.js - Page de détails d'une séance
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
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
let currentUser = null;
let currentCourse = null;
let currentSequenceIndex = 0;
let currentSessionIndex = 0;

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
        // Utilisateur connecté
        loginBtn.classList.add('hidden');
        userMenu.classList.remove('hidden');

        // Afficher nom et avatar
        const displayName = user.displayName || user.email.split('@')[0];
        document.getElementById('userName').textContent = displayName;
        document.getElementById('userNameDropdown').textContent = displayName;
        document.getElementById('userEmailDropdown').textContent = user.email;

        const avatarUrl = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=1e40af&color=fff`;
        document.getElementById('userAvatar').src = avatarUrl;
        document.getElementById('userAvatarDropdown').src = avatarUrl;

        // Vérifier si admin
        try {
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists() && userDoc.data().role === 'admin') {
                adminLink.classList.remove('hidden');
                adminDivider.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Erreur vérification admin:', error);
        }
    } else {
        // Non connecté
        loginBtn.classList.remove('hidden');
        userMenu.classList.add('hidden');
        adminLink.classList.add('hidden');
        adminDivider.classList.add('hidden');
    }
});

// Toggle menu utilisateur
const userMenuToggle = document.getElementById('userMenuToggle');
if (userMenuToggle) {
    userMenuToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('userDropdown').classList.toggle('hidden');
    });
}

// Fermer dropdown en cliquant ailleurs
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('userDropdown');
    const toggle = document.getElementById('userMenuToggle');
    if (dropdown && !dropdown.contains(e.target) && e.target !== toggle) {
        dropdown.classList.add('hidden');
    }
});

// Déconnexion
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        try {
            await signOut(auth);
            window.location.href = 'index.html';
        } catch (error) {
            console.error('Erreur déconnexion:', error);
            alert('Erreur lors de la déconnexion');
        }
    });
}

// ============================================
// RÉCUPÉRER LES PARAMÈTRES DE L'URL
// ============================================
function getUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    return {
        courseId: urlParams.get('courseId'),
        seqIndex: parseInt(urlParams.get('seqIndex')) || 0,
        sessionIndex: parseInt(urlParams.get('sessionIndex')) || 0
    };
}

// ============================================
// CHARGER LA SÉANCE
// ============================================
async function loadSession() {
    const params = getUrlParams();
    
    if (!params.courseId) {
        alert('Cours introuvable');
        window.location.href = 'courses.html';
        return;
    }

    try {
        // Charger le cours
        const docRef = doc(db, 'courses', params.courseId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            alert('Cours introuvable');
            window.location.href = 'courses.html';
            return;
        }

        currentCourse = {
            id: docSnap.id,
            ...docSnap.data()
        };
        
        currentSequenceIndex = params.seqIndex;
        currentSessionIndex = params.sessionIndex;

        displaySession();
    } catch (error) {
        console.error('Erreur chargement séance:', error);
        alert('Erreur lors du chargement de la séance');
        window.location.href = 'courses.html';
    }
}

// ============================================
// AFFICHER LA SÉANCE
// ============================================
function displaySession() {
    // Masquer le loading
    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('sessionPage').classList.remove('hidden');

    const sequences = currentCourse.sequences || [];
    const sequence = sequences[currentSequenceIndex];
    
    if (!sequence) {
        alert('Séquence introuvable');
        window.location.href = `course-detail.html?id=${currentCourse.id}`;
        return;
    }

    const sessions = sequence.sessions || [];
    const session = sessions[currentSessionIndex];
    
    if (!session) {
        alert('Séance introuvable');
        window.location.href = `course-detail.html?id=${currentCourse.id}`;
        return;
    }

    // Titre de la page
    document.title = `${session.title || 'Séance'} | ElectroInfo`;

    // Badge
    document.getElementById('sessionBadge').textContent = `Séance ${currentSessionIndex + 1}`;

    // Titre
    document.getElementById('sessionTitle').textContent = session.title || 'Séance';

    // Contenu
    const sessionContent = document.getElementById('sessionContent');
    sessionContent.innerHTML = session.content || '<p>Aucun contenu disponible.</p>';

    // PDF
    const pdfSection = document.getElementById('pdfSection');
    const pdfDownloadBtn = document.getElementById('pdfDownloadBtn');
    if (session.pdfUrl) {
        pdfSection.classList.remove('hidden');
        pdfDownloadBtn.href = session.pdfUrl;
    } else {
        pdfSection.classList.add('hidden');
    }

    // Bouton retour
    const backButton = document.getElementById('backButton');
    backButton.href = `course-detail.html?id=${currentCourse.id}`;

    // Navigation
    setupNavigation(sequences, sessions);
}

// ============================================
// CONFIGURER LA NAVIGATION
// ============================================
function setupNavigation(sequences, sessions) {
    const prevBtn = document.getElementById('prevSessionBtn');
    const nextBtn = document.getElementById('nextSessionBtn');

    // Séance précédente
    if (currentSessionIndex > 0) {
        // Séance précédente dans la même séquence
        prevBtn.classList.remove('disabled');
        prevBtn.href = `session-detail.html?courseId=${currentCourse.id}&seqIndex=${currentSequenceIndex}&sessionIndex=${currentSessionIndex - 1}`;
    } else if (currentSequenceIndex > 0) {
        // Dernière séance de la séquence précédente
        const prevSequence = sequences[currentSequenceIndex - 1];
        const prevSequenceSessions = prevSequence.sessions || [];
        if (prevSequenceSessions.length > 0) {
            prevBtn.classList.remove('disabled');
            prevBtn.href = `session-detail.html?courseId=${currentCourse.id}&seqIndex=${currentSequenceIndex - 1}&sessionIndex=${prevSequenceSessions.length - 1}`;
        } else {
            prevBtn.classList.add('disabled');
        }
    } else {
        prevBtn.classList.add('disabled');
    }

    // Séance suivante
    if (currentSessionIndex < sessions.length - 1) {
        // Séance suivante dans la même séquence
        nextBtn.classList.remove('disabled');
        nextBtn.href = `session-detail.html?courseId=${currentCourse.id}&seqIndex=${currentSequenceIndex}&sessionIndex=${currentSessionIndex + 1}`;
    } else if (currentSequenceIndex < sequences.length - 1) {
        // Première séance de la séquence suivante
        const nextSequence = sequences[currentSequenceIndex + 1];
        const nextSequenceSessions = nextSequence.sessions || [];
        if (nextSequenceSessions.length > 0) {
            nextBtn.classList.remove('disabled');
            nextBtn.href = `session-detail.html?courseId=${currentCourse.id}&seqIndex=${currentSequenceIndex + 1}&sessionIndex=0`;
        } else {
            nextBtn.classList.add('disabled');
        }
    } else {
        nextBtn.classList.add('disabled');
    }
}

// ============================================
// MENU MOBILE (corrige : utilise mobileMenu)
// ============================================
const mobileToggle = document.getElementById('mobileToggle');
const navMenu = document.getElementById('mobileMenu'); // ✅ Corrigé

function closeMobileMenu() {
    navMenu?.classList.remove('active');
    const icon = mobileToggle?.querySelector('i');
    if (icon) { icon.className = 'fas fa-bars'; }
}

if (mobileToggle && navMenu) {
    mobileToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        navMenu.classList.toggle('active');
        const icon = mobileToggle.querySelector('i');
        icon.className = navMenu.classList.contains('active') ? 'fas fa-times' : 'fas fa-bars';
    });

    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => closeMobileMenu());
    });

    document.addEventListener('click', (e) => {
        if (!navMenu.contains(e.target) && !mobileToggle.contains(e.target)) {
            closeMobileMenu();
        }
    });
}

// ============================================
// INITIALISATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    loadSession();
});