// about.js - Script pour la page À Propos
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

// ============================================
// CHARGEMENT DE L'ÉQUIPE
// ============================================
async function loadTeam() {
    const teamGrid = document.getElementById('teamGrid');
    
    try {
        // Charger les utilisateurs avec rôle admin depuis Firestore
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const teamMembers = [];
        
        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            if (userData.role === 'admin') {
                teamMembers.push({
                    id: doc.id,
                    ...userData
                });
            }
        });
        
        if (teamMembers.length === 0) {
            // Afficher des membres d'équipe par défaut
            teamGrid.innerHTML = getDefaultTeam();
        } else {
            // Afficher les vrais membres de l'équipe
            teamGrid.innerHTML = teamMembers.map(member => createTeamMemberCard(member)).join('');
        }
        
        // Charger les statistiques de chaque membre
        await loadTeamStats(teamMembers);
        
    } catch (error) {
        console.error('Erreur chargement équipe:', error);
        teamGrid.innerHTML = getDefaultTeam();
    }
}

function createTeamMemberCard(member) {
    const avatarUrl = member.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.displayName || member.email)}&background=3b82f6&color=fff&size=200`;
    const name = member.displayName || member.email.split('@')[0];
    const bio = member.bio || "Passionné d'électricité industrielle et de partage de connaissances.";
    
    return `
        <div class="team-member" data-member-id="${member.id}">
            <img src="${avatarUrl}" alt="${escapeHtml(name)}" class="team-avatar">
            <h3 class="team-name">${escapeHtml(name)}</h3>
            <p class="team-role">Rédacteur Expert</p>
            <p class="team-bio">${escapeHtml(bio)}</p>
            <div class="team-stats">
                <div class="team-stat">
                    <div class="team-stat-number" data-stat="articles">0</div>
                    <div class="team-stat-label">Articles</div>
                </div>
                <div class="team-stat">
                    <div class="team-stat-number" data-stat="views">0</div>
                    <div class="team-stat-label">Vues</div>
                </div>
            </div>
        </div>
    `;
}

function getDefaultTeam() {
    return `
        <div class="team-member">
            <img src="https://ui-avatars.com/api/?name=Equipe+Redaction&background=3b82f6&color=fff&size=200" alt="Équipe de Rédaction" class="team-avatar">
            <h3 class="team-name">Équipe de Rédaction</h3>
            <p class="team-role">Experts en Électricité Industrielle</p>
            <p class="team-bio">Notre équipe est composée d'ingénieurs électriciens, de techniciens experts et de rédacteurs techniques passionnés par la transmission du savoir.</p>
            <div class="team-stats">
                <div class="team-stat">
                    <div class="team-stat-number">-</div>
                    <div class="team-stat-label">Articles</div>
                </div>
                <div class="team-stat">
                    <div class="team-stat-number">-</div>
                    <div class="team-stat-label">Vues</div>
                </div>
            </div>
        </div>
        <div class="team-member">
            <img src="https://ui-avatars.com/api/?name=Comite+Editorial&background=10b981&color=fff&size=200" alt="Comité Éditorial" class="team-avatar">
            <h3 class="team-name">Comité Éditorial</h3>
            <p class="team-role">Validation & Qualité</p>
            <p class="team-bio">Chaque article est relu et validé par notre comité éditorial pour garantir la rigueur technique et la clarté de nos contenus.</p>
            <div class="team-stats">
                <div class="team-stat">
                    <div class="team-stat-number">-</div>
                    <div class="team-stat-label">Articles</div>
                </div>
                <div class="team-stat">
                    <div class="team-stat-number">-</div>
                    <div class="team-stat-label">Vues</div>
                </div>
            </div>
        </div>
    `;
}

async function loadTeamStats(teamMembers) {
    try {
        // Charger tous les articles
        const articlesSnapshot = await getDocs(collection(db, 'articles'));
        
        teamMembers.forEach(member => {
            let articleCount = 0;
            let totalViews = 0;
            
            articlesSnapshot.forEach(doc => {
                const article = doc.data();
                if (article.authorId === member.id) {
                    articleCount++;
                    totalViews += article.views || 0;
                }
            });
            
            // Mettre à jour l'affichage
            const memberCard = document.querySelector(`[data-member-id="${member.id}"]`);
            if (memberCard) {
                memberCard.querySelector('[data-stat="articles"]').textContent = articleCount;
                memberCard.querySelector('[data-stat="views"]').textContent = formatNumber(totalViews);
            }
        });
    } catch (error) {
        console.error('Erreur chargement stats équipe:', error);
    }
}

// ============================================
// CHARGEMENT DES STATISTIQUES GLOBALES
// ============================================
async function loadGlobalStats() {
    try {
        // Charger les articles
        const articlesSnapshot = await getDocs(collection(db, 'articles'));
        let totalArticles = 0;
        let totalViews = 0;
        const articlesByMonth = {};
        
        articlesSnapshot.forEach(doc => {
            const article = doc.data();
            totalArticles++;
            totalViews += article.views || 0;
            
            // Compter articles par mois
            if (article.createdAt) {
                const date = article.createdAt.toDate();
                const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
                articlesByMonth[monthKey] = (articlesByMonth[monthKey] || 0) + 1;
            }
        });
        
        // Calculer la moyenne d'articles par mois
        const monthCount = Object.keys(articlesByMonth).length || 1;
        const avgArticlesPerMonth = Math.round(totalArticles / monthCount);
        
        // Charger les abonnés newsletter
        const newsletterSnapshot = await getDocs(collection(db, 'newsletter'));
        const totalSubscribers = newsletterSnapshot.size;
        
        // Afficher les stats
        document.getElementById('totalArticlesStat').textContent = formatNumber(totalArticles);
        document.getElementById('totalViewsStat').textContent = formatNumber(totalViews);
        document.getElementById('totalSubscribersStat').textContent = formatNumber(totalSubscribers);
        document.getElementById('publicationFrequency').textContent = avgArticlesPerMonth;
        
        // Animer les compteurs
        animateCounters();
        
    } catch (error) {
        console.error('Erreur chargement stats:', error);
    }
}

// ============================================
// ANIMATIONS
// ============================================
function animateCounters() {
    const statNumbers = document.querySelectorAll('.stat-number');
    
    statNumbers.forEach(stat => {
        const target = parseInt(stat.textContent.replace(/\s/g, ''));
        if (isNaN(target)) return;
        
        const duration = 2000; // 2 secondes
        const increment = target / (duration / 16); // 60 FPS
        let current = 0;
        
        const updateCounter = () => {
            current += increment;
            if (current < target) {
                stat.textContent = formatNumber(Math.floor(current));
                requestAnimationFrame(updateCounter);
            } else {
                stat.textContent = formatNumber(target);
            }
        };
        
        // Observer pour démarrer l'animation quand visible
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    updateCounter();
                    observer.unobserve(entry.target);
                }
            });
        });
        
        observer.observe(stat);
    });
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

// Fermer le menu mobile quand on clique sur un lien
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
        navMenu.classList.remove('active');
        const icon = mobileToggle.querySelector('i');
        icon.classList.remove('fa-times');
        icon.classList.add('fa-bars');
    });
});

// ============================================
// UTILITAIRES
// ============================================
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// INITIALISATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    loadTeam();
    loadGlobalStats();
});
