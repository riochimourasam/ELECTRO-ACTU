// course-detail.js - Détails du cours avec séquences et séances
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
let currentCourse = null;
let currentUser = null;

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
// RÉCUPÉRER L'ID DU COURS DEPUIS L'URL
// ============================================
function getCourseIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

// ============================================
// CHARGER LE COURS
// ============================================
async function loadCourse() {
    const courseId = getCourseIdFromUrl();
    
    if (!courseId) {
        showError();
        return;
    }

    try {
        const docRef = doc(db, 'courses', courseId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            showError();
            return;
        }

        currentCourse = {
            id: docSnap.id,
            ...docSnap.data()
        };

        displayCourse();
    } catch (error) {
        console.error('Erreur chargement cours:', error);
        showError();
    }
}

// ============================================
// AFFICHER LE COURS
// ============================================
function displayCourse() {
    // Masquer le loading
    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('courseContainer').classList.remove('hidden');

    // Mettre à jour le titre de la page
    document.title = `${currentCourse.title} | ElectroInfo`;

    // Header du cours
    document.getElementById('courseDiploma').textContent = currentCourse.diploma || 'BAC PRO';
    document.getElementById('courseLevel').textContent = currentCourse.level || 'Débutant';
    document.getElementById('courseTitle').textContent = currentCourse.title;
    document.getElementById('courseDescription').textContent = currentCourse.description || '';

    // Stats
    const sequences = currentCourse.sequences || [];
    let totalSessions = 0;
    sequences.forEach(seq => {
        totalSessions += seq.sessions?.length || 0;
    });

    document.getElementById('sequencesCount').textContent = sequences.length;
    document.getElementById('sessionsCount').textContent = totalSessions;

    const date = currentCourse.createdAt?.toDate?.() || new Date();
    document.getElementById('courseDate').textContent = date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    // Afficher les séquences
    displaySequences();
    displaySequencesNav();
}

// ============================================
// AFFICHER LA NAVIGATION DES SÉQUENCES
// ============================================
function displaySequencesNav() {
    const sequencesNav = document.getElementById('sequencesNav');
    const sequences = currentCourse.sequences || [];

    if (sequences.length === 0) {
        sequencesNav.innerHTML = '<p style="color: #6b7280; font-size: 0.9rem;">Aucune séquence</p>';
        return;
    }

    sequencesNav.innerHTML = sequences.map((seq, index) => `
        <div class="sequence-nav-item" onclick="scrollToSequence(${index})">
            <i class="fas fa-chevron-right" style="font-size: 0.7rem; margin-right: 0.5rem;"></i>
            Séquence ${index + 1}
        </div>
    `).join('');
}

// ============================================
// AFFICHER LES SÉQUENCES
// ============================================
function displaySequences() {
    const sequencesContainer = document.getElementById('sequencesContainer');
    const emptySequences = document.getElementById('emptySequences');
    const sequences = currentCourse.sequences || [];

    if (sequences.length === 0) {
        sequencesContainer.classList.add('hidden');
        emptySequences.classList.remove('hidden');
        return;
    }

    sequencesContainer.classList.remove('hidden');
    emptySequences.classList.add('hidden');

    sequencesContainer.innerHTML = sequences.map((sequence, seqIndex) => `
        <div class="sequence-block" id="sequence-${seqIndex}">
            <div class="sequence-header">
                <div class="sequence-title-wrapper">
                    <div class="sequence-number">Séquence ${seqIndex + 1}</div>
                    <h2 class="sequence-title">${escapeHtml(sequence.title || `Séquence ${seqIndex + 1}`)}</h2>
                </div>
                <button class="sequence-toggle" onclick="toggleSequence(${seqIndex})">
                    <i class="fas fa-chevron-up"></i>
                </button>
            </div>
            
            <div class="sessions-list" id="sessions-${seqIndex}">
                ${displaySessions(sequence.sessions || [], seqIndex)}
            </div>
        </div>
    `).join('');
}

// ============================================
// AFFICHER LES SÉANCES
// ============================================
function displaySessions(sessions, seqIndex) {
    if (sessions.length === 0) {
        return `
            <div class="empty-state" style="padding: 2rem;">
                <i class="fas fa-inbox" style="font-size: 2rem; color: #9ca3af; margin-bottom: 1rem;"></i>
                <p style="color: #6b7280;">Aucune séance dans cette séquence</p>
            </div>
        `;
    }

    return sessions.map((session, sessionIndex) => `
        <div class="session-item" onclick="openSession(${seqIndex}, ${sessionIndex})">
            <div class="session-icon">
                <i class="fas fa-play"></i>
            </div>
            <div class="session-info">
                <div class="session-number">Séance ${sessionIndex + 1}</div>
                <h4 class="session-title">${escapeHtml(session.title || `Séance ${sessionIndex + 1}`)}</h4>
                ${session.pdfUrl ? `
                    <div class="session-has-pdf">
                        <i class="fas fa-file-pdf"></i>
                        PDF disponible
                    </div>
                ` : ''}
            </div>
            <i class="fas fa-chevron-right session-arrow"></i>
        </div>
    `).join('');
}

// ============================================
// FONCTION UTILITAIRE POUR ÉCHAPPER HTML
// ============================================
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// TOGGLE SÉQUENCE (Plier/Déplier)
// ============================================
window.toggleSequence = function(index) {
    const sequenceBlock = document.getElementById(`sequence-${index}`);
    const sessionsList = document.getElementById(`sessions-${index}`);
    
    sequenceBlock.classList.toggle('collapsed');
    sessionsList.style.display = sessionsList.style.display === 'none' ? 'grid' : 'none';
};

// ============================================
// SCROLL VERS UNE SÉQUENCE
// ============================================
window.scrollToSequence = function(index) {
    const sequence = document.getElementById(`sequence-${index}`);
    if (sequence) {
        sequence.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        // Mettre à jour la navigation
        document.querySelectorAll('.sequence-nav-item').forEach((item, i) => {
            if (i === index) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }
};

// ============================================
// OUVRIR UNE SÉANCE (REDIRECTION VERS PAGE COMPLÈTE)
// ============================================
window.openSession = function(seqIndex, sessionIndex) {
    if (!currentCourse) return;
    
    // Rediriger vers la page de détails de la séance
    window.location.href = `session-detail.html?courseId=${currentCourse.id}&seqIndex=${seqIndex}&sessionIndex=${sessionIndex}`;
};

// ============================================
// AFFICHER L'ERREUR
// ============================================
function showError() {
    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('errorState').classList.remove('hidden');
}

// ============================================
// MOBILE MENU
// ============================================
const mobileToggle = document.getElementById('mobileToggle');
const navMenu = document.getElementById('navMenu');

if (mobileToggle && navMenu) {
    mobileToggle.addEventListener('click', () => {
        navMenu.classList.toggle('active');
    });
}

// ============================================
// INITIALISATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    loadCourse();
});