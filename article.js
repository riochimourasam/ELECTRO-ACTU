// ============================================
// ARTICLE.JS - VERSION CORRIGÉE AVEC FIREBASE V9
// ============================================

// Imports Firebase v9 modular
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
    getFirestore, 
    collection, 
    doc, 
    getDoc, 
    getDocs, 
    addDoc, 
    updateDoc,
    setDoc,
    query, 
    where, 
    orderBy, 
    limit,
    increment,
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Configuration Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAlBDedWLbHG-3UnijsSfocm77sNpn15Wg",
    authDomain: "electroactu-b6050.firebaseapp.com",
    projectId: "electroactu-b6050",
    storageBucket: "electroactu-b6050.firebasestorage.app",
    messagingSenderId: "890343912768",
    appId: "1:890343912768:web:87de595f6df3c3f434f6a5"
};

// Initialisation Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Variables globales
let currentArticleId = null;
let userReactions = {};
let reactionDebounceTimer = null;

// Récupérer le SLUG depuis le path OU l'ID depuis les paramètres
const pathParts = window.location.pathname.split('/');
const lastPathElement = pathParts[pathParts.length - 1]; // Dernier élément du path
const urlParams = new URLSearchParams(window.location.search);
const articleId = urlParams.get('id');

// Déterminer si on a un slug ou un ID
// Un slug valide : ne contient pas .html, n'est pas vide, et n'est pas "article"
const hasSlug = lastPathElement && 
                !lastPathElement.includes('.html') && 
                lastPathElement !== '' && 
                lastPathElement !== 'article';

// Prioriser l'ID si présent dans les paramètres, sinon utiliser le slug
const identifier = articleId || (hasSlug ? lastPathElement : null);
const useSlug = !articleId && hasSlug;

// Éléments DOM
const loadingState = document.getElementById('loadingState');
const articleContainer = document.getElementById('articleContainer');
const errorState = document.getElementById('errorState');
const newsletterModal = document.getElementById('newsletterModal');
const themeToggle = document.getElementById('themeToggle');

// ============================================
// INITIALISATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    loadUserReactions();
    initUserToken();
    
    if (identifier) {
        if (useSlug) {
            loadArticleBySlug(identifier);
        } else {
            loadArticleById(identifier);
        }
    } else {
        showError();
    }
    
    setupEventListeners();
    initReadingProgress();
    initBackToTop();
});

// ============================================
// CONFIGURATION DES ÉVÉNEMENTS
// ============================================

function setupEventListeners() {
    // Theme toggle
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
    
    // Note: Les réactions sont configurées dans setupReactionListeners()
    // qui est appelée APRÈS le chargement de l'article
    
    // Commentaire
    const commentForm = document.getElementById('commentForm');
    if (commentForm) {
        commentForm.addEventListener('submit', submitComment);
    }
    
    // Newsletter
    const newsletterForm = document.getElementById('newsletterForm');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', submitNewsletter);
    }
    
    // Smooth scroll
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
}

// Nouvelle fonction pour configurer les event listeners des réactions
function setupReactionListeners() {
    console.log('Configuration des listeners de réactions...');
    
    const reactionButtons = document.querySelectorAll('.reaction-btn');
    console.log('Boutons de réaction trouvés:', reactionButtons.length);
    
    reactionButtons.forEach(btn => {
        // Retirer les anciens listeners pour éviter les doublons
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        // Ajouter le nouveau listener
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Réaction cliquée:', newBtn.dataset.reaction);
            
            clearTimeout(reactionDebounceTimer);
            reactionDebounceTimer = setTimeout(() => handleReaction(e), 300);
        });
    });
}

// ============================================
// GESTION TOKEN UTILISATEUR
// ============================================

function initUserToken() {
    let userToken = localStorage.getItem('userToken');
    if (!userToken) {
        userToken = generateUniqueToken();
        localStorage.setItem('userToken', userToken);
    }
    return userToken;
}

function generateUniqueToken() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// ============================================
// CHARGEMENT ARTICLE PAR SLUG
// ============================================

async function loadArticleBySlug(slug) {
    try {
        // Chercher l'article avec ce slug
        const articlesRef = collection(db, 'articles');
        const q = query(articlesRef, where('slug', '==', slug), limit(1));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            showError();
            return;
        }
        
        const docSnapshot = querySnapshot.docs[0];
        currentArticleId = docSnapshot.id;
        
        const article = docSnapshot.data();
        
        // Incrémenter les vues
        const articleRef = doc(db, 'articles', docSnapshot.id);
        await updateDoc(articleRef, {
            views: increment(1)
        }).catch(err => console.warn('Erreur incrémentation vues:', err));
        
        // Afficher l'article
        displayArticle(article);
        
        // Charger les données supplémentaires
        await Promise.all([
            loadReactions(docSnapshot.id),
            loadComments(docSnapshot.id),
            loadRelatedArticles(article.category)
        ]);
        
        // Cacher le loading, afficher le contenu
        loadingState.classList.add('hidden');
        articleContainer.classList.remove('hidden');
        
        // IMPORTANT: Configurer les event listeners des réactions
        // APRÈS que l'article soit visible
        setupReactionListeners();
        
        // Mettre à jour le titre et métadonnées
        updatePageMeta(article);
        
    } catch (error) {
        console.error('Erreur lors du chargement:', error);
        showError();
        showNotification('Erreur de chargement de l\'article', 'error');
    }
}

// ============================================
// CHARGEMENT ARTICLE PAR ID (ANCIENNE MÉTHODE)
// ============================================

async function loadArticleById(id) {
    currentArticleId = id;
    
    try {
        const docRef = doc(db, 'articles', id);
        const docSnapshot = await getDoc(docRef);
        
        if (!docSnapshot.exists()) {
            showError();
            return;
        }
        
        const article = docSnapshot.data();
        
        // Incrémenter les vues
        await updateDoc(docRef, {
            views: increment(1)
        }).catch(err => console.warn('Erreur incrémentation vues:', err));
        
        // Afficher l'article
        displayArticle(article);
        
        // Charger les données supplémentaires
        await Promise.all([
            loadReactions(id),
            loadComments(id),
            loadRelatedArticles(article.category)
        ]);
        
        // Cacher le loading, afficher le contenu
        loadingState.classList.add('hidden');
        articleContainer.classList.remove('hidden');
        
        // IMPORTANT: Configurer les event listeners des réactions
        // APRÈS que l'article soit visible
        setupReactionListeners();
        
        // Mettre à jour le titre et métadonnées
        updatePageMeta(article);
        
    } catch (error) {
        console.error('Erreur lors du chargement:', error);
        showError();
        showNotification('Erreur de chargement de l\'article', 'error');
    }
}

// ============================================
// AFFICHAGE ARTICLE
// ============================================

function displayArticle(article) {
    // Titre
    document.getElementById('articleTitle').textContent = article.title || 'Sans titre';
    
    // Catégorie
    const categoryBadge = document.getElementById('categoryBadge');
    categoryBadge.textContent = article.category || 'GÉNÉRAL';
    categoryBadge.className = `category-badge ${getCategoryClass(article.category)}`;
    
    // Date
    let dateText = 'Date inconnue';
    if (article.createdAt) {
        const date = article.createdAt.toDate();
        dateText = new Intl.DateTimeFormat('fr-FR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }).format(date);
    }
    document.getElementById('articleDate').textContent = dateText;
    
    // Auteur
    const authorName = article.author?.name || article.author?.email || 'Auteur inconnu';
    document.getElementById('authorName').textContent = authorName;
    
    // Avatar
    const authorAvatar = document.getElementById('authorAvatar');
    if (article.author?.photoURL) {
        authorAvatar.src = article.author.photoURL;
    } else {
        authorAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=1e40af&color=fff`;
    }
    
    // Temps de lecture
    const readingTime = calculateReadingTime(article.content);
    document.getElementById('readingTime').textContent = `${readingTime} min de lecture`;
    
    // Vues
    document.getElementById('viewsCount').textContent = (article.views || 0).toLocaleString();
    
    // Image
    const articleImage = document.getElementById('articleImage');
    if (article.imageUrl) {
        articleImage.src = article.imageUrl;
        articleImage.alt = article.title;
    } else {
        articleImage.parentElement.style.display = 'none';
    }
    
    // Contenu avec traitement des vidéos YouTube
    const articleContentElement = document.getElementById('articleContent');
    articleContentElement.innerHTML = article.content || '<p>Contenu non disponible</p>';
    
    // Traiter les iframes YouTube pour les rendre responsive et fonctionnelles
    processYouTubeVideos(articleContentElement);
    
    // Tags
    const tagsContainer = document.getElementById('tagsContainer');
    if (article.tags && article.tags.length > 0) {
        tagsContainer.innerHTML = article.tags.map(tag => 
            `<span class="tag">#${escapeHtml(tag)}</span>`
        ).join('');
    } else {
        tagsContainer.innerHTML = '';
    }
    
    // Configuration des boutons de partage social
    setupSocialShareButtons(article);
}

// ============================================
// BOUTONS DE PARTAGE SOCIAL
// ============================================

function setupSocialShareButtons(article) {
    const currentUrl = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(article.title || 'Article');
    const text = encodeURIComponent(article.summary || article.title || 'Découvrez cet article');
    
    // Twitter
    const twitterBtn = document.getElementById('twitterShare');
    if (twitterBtn) {
        twitterBtn.href = `https://twitter.com/intent/tweet?url=${currentUrl}&text=${title}`;
    }
    
    // LinkedIn
    const linkedinBtn = document.getElementById('linkedinShare');
    if (linkedinBtn) {
        linkedinBtn.href = `https://www.linkedin.com/sharing/share-offsite/?url=${currentUrl}`;
    }
    
    // WhatsApp
    const whatsappBtn = document.getElementById('whatsappShare');
    if (whatsappBtn) {
        whatsappBtn.href = `https://wa.me/?text=${title}%20${currentUrl}`;
    }
}

// ============================================
// TRAITEMENT DES MÉDIAS (YOUTUBE, IMAGES, PINTEREST)
// ============================================

function processYouTubeVideos(container) {
    // ÉTAPE 1 : Convertir les URLs YouTube en texte brut en vidéos
    convertTextUrlsToVideos(container);
    
    // ÉTAPE 2 : Traiter les images
    processImages(container);
    
    // ÉTAPE 3 : Traiter les embeds Pinterest
    processPinterestEmbeds(container);
    
    // ÉTAPE 4 : Récupérer toutes les iframes
    const iframes = container.querySelectorAll('iframe');
    
    iframes.forEach(iframe => {
        // Vérifier si c'est une vidéo YouTube
        const src = iframe.getAttribute('src') || '';
        if (src.includes('youtube.com') || src.includes('youtu.be')) {
            
            // S'assurer que l'URL est correcte et sécurisée
            let videoSrc = src;
            
            // Convertir les URL youtube.com/watch?v= en embed
            if (src.includes('youtube.com/watch?v=')) {
                const videoId = new URL(src).searchParams.get('v');
                videoSrc = `https://www.youtube.com/embed/${videoId}`;
            }
            
            // Convertir les URL youtu.be en embed
            if (src.includes('youtu.be/')) {
                const videoId = src.split('youtu.be/')[1].split('?')[0];
                videoSrc = `https://www.youtube.com/embed/${videoId}`;
            }
            
            // S'assurer que l'URL utilise HTTPS
            videoSrc = videoSrc.replace('http://', 'https://');
            
            // Ajouter les paramètres nécessaires pour l'embed YouTube
            const url = new URL(videoSrc);
            url.searchParams.set('enablejsapi', '1');
            url.searchParams.set('origin', window.location.origin);
            
            // Mettre à jour l'iframe avec les bons attributs
            iframe.setAttribute('src', url.toString());
            iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
            iframe.setAttribute('allowfullscreen', '');
            iframe.setAttribute('frameborder', '0');
            
            // Créer un wrapper responsive si nécessaire
            if (!iframe.parentElement.classList.contains('video-wrapper')) {
                const wrapper = document.createElement('div');
                wrapper.className = 'video-wrapper';
                wrapper.style.cssText = `
                    position: relative;
                    padding-bottom: 56.25%; /* Ratio 16:9 */
                    height: 0;
                    overflow: hidden;
                    margin: 2rem 0;
                    border-radius: 0.5rem;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                `;
                
                iframe.parentNode.insertBefore(wrapper, iframe);
                wrapper.appendChild(iframe);
                
                iframe.style.cssText = `
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    border-radius: 0.5rem;
                `;
            }
        }
    });
    
    // ÉTAPE 3 : Traiter également les liens YouTube pour les convertir en embed
    const links = container.querySelectorAll('a');
    links.forEach(link => {
        const href = link.getAttribute('href') || '';
        if ((href.includes('youtube.com/watch?v=') || href.includes('youtu.be/'))) {
            
            let videoId = extractYouTubeIDFromUrl(href);
            
            if (videoId) {
                const wrapper = document.createElement('div');
                wrapper.className = 'video-wrapper';
                wrapper.style.cssText = `
                    position: relative;
                    padding-bottom: 56.25%;
                    height: 0;
                    overflow: hidden;
                    margin: 2rem 0;
                    border-radius: 0.5rem;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                `;
                
                const iframe = document.createElement('iframe');
                const embedUrl = new URL(`https://www.youtube.com/embed/${videoId}`);
                embedUrl.searchParams.set('enablejsapi', '1');
                embedUrl.searchParams.set('origin', window.location.origin);
                
                iframe.setAttribute('src', embedUrl.toString());
                iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
                iframe.setAttribute('allowfullscreen', '');
                iframe.setAttribute('frameborder', '0');
                iframe.style.cssText = `
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    border-radius: 0.5rem;
                `;
                
                wrapper.appendChild(iframe);
                link.parentNode.replaceChild(wrapper, link);
            }
        }
    });
}

// Convertir les URLs YouTube en texte brut en vidéos
function convertTextUrlsToVideos(container) {
    // Regex pour détecter les URLs YouTube
    const youtubeRegex = /https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[?&][^\s]*)?/g;
    
    // Parcourir tous les nœuds de texte
    const walker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );
    
    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
        // Ignorer les nœuds dans les scripts, styles, et iframes
        if (node.parentElement.tagName !== 'SCRIPT' && 
            node.parentElement.tagName !== 'STYLE' &&
            node.parentElement.tagName !== 'IFRAME') {
            textNodes.push(node);
        }
    }
    
    // Traiter chaque nœud de texte
    textNodes.forEach(textNode => {
        const text = textNode.textContent;
        const matches = text.match(youtubeRegex);
        
        if (matches && matches.length > 0) {
            // Créer un fragment pour remplacer le texte
            const fragment = document.createDocumentFragment();
            let lastIndex = 0;
            
            matches.forEach(match => {
                const index = text.indexOf(match, lastIndex);
                
                // Ajouter le texte avant l'URL
                if (index > lastIndex) {
                    fragment.appendChild(document.createTextNode(text.substring(lastIndex, index)));
                }
                
                // Extraire l'ID vidéo
                const videoId = extractYouTubeIDFromUrl(match);
                
                if (videoId) {
                    // Créer le wrapper vidéo
                    const wrapper = document.createElement('div');
                    wrapper.className = 'video-wrapper';
                    wrapper.style.cssText = `
                        position: relative;
                        padding-bottom: 56.25%;
                        height: 0;
                        overflow: hidden;
                        margin: 2rem 0;
                        border-radius: 0.5rem;
                        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    `;
                    
                    // Créer l'iframe
                    const iframe = document.createElement('iframe');
                    const embedUrl = new URL(`https://www.youtube.com/embed/${videoId}`);
                    embedUrl.searchParams.set('enablejsapi', '1');
                    embedUrl.searchParams.set('origin', window.location.origin);
                    
                    iframe.setAttribute('src', embedUrl.toString());
                    iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
                    iframe.setAttribute('allowfullscreen', '');
                    iframe.setAttribute('frameborder', '0');
                    iframe.style.cssText = `
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        border-radius: 0.5rem;
                    `;
                    
                    wrapper.appendChild(iframe);
                    fragment.appendChild(wrapper);
                }
                
                lastIndex = index + match.length;
            });
            
            // Ajouter le texte restant
            if (lastIndex < text.length) {
                fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
            }
            
            // Remplacer le nœud de texte
            textNode.parentNode.replaceChild(fragment, textNode);
        }
    });
}

// Extraire l'ID YouTube depuis une URL
function extractYouTubeIDFromUrl(url) {
    // Format: https://www.youtube.com/watch?v=VIDEO_ID
    let match = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];
    
    // Format: https://youtu.be/VIDEO_ID
    match = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];
    
    // Format: https://www.youtube.com/embed/VIDEO_ID
    match = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];
    
    return null;
}

// ============================================
// TRAITEMENT DES IMAGES
// ============================================

function processImages(container) {
    const images = container.querySelectorAll('img');
    
    images.forEach(img => {
        // S'assurer que les images sont responsive
        if (!img.style.maxWidth) {
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
        }
        
        // Ajouter un wrapper figure si l'image n'est pas déjà dans un wrapper
        if (!img.parentElement.classList.contains('image-wrapper') && 
            img.parentElement.tagName !== 'FIGURE') {
            
            const figure = document.createElement('figure');
            figure.style.cssText = `
                margin: 2rem 0;
                text-align: center;
            `;
            
            img.parentNode.insertBefore(figure, img);
            figure.appendChild(img);
            
            // Ajouter du style à l'image
            if (!img.style.borderRadius) {
                img.style.borderRadius = '8px';
                img.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
            }
        }
    });
}

// ============================================
// TRAITEMENT DES EMBEDS PINTEREST
// ============================================

function processPinterestEmbeds(container) {
    // Chercher les divs avec la classe pinterest-embed ou pinterest-iframe-wrapper
    const pinterestDivs = container.querySelectorAll('.pinterest-embed, .pinterest-iframe-wrapper, [data-pin-do]');
    
    pinterestDivs.forEach(div => {
        // S'assurer que le script Pinterest est chargé pour les embeds data-pin-do
        if (div.querySelector('[data-pin-do]') && !document.querySelector('script[src*="pinit.js"]')) {
            const script = document.createElement('script');
            script.async = true;
            script.defer = true;
            script.src = '//assets.pinterest.com/js/pinit.js';
            document.body.appendChild(script);
        }
        
        // Ajouter un style au conteneur si nécessaire
        if (!div.style.margin) {
            div.style.margin = '2rem 0';
            div.style.textAlign = 'center';
        }
    });
    
    // Traiter les iframes Pinterest directement
    const pinterestIframes = container.querySelectorAll('iframe[src*="pinterest.com"]');
    pinterestIframes.forEach(iframe => {
        // S'assurer que l'iframe a des styles appropriés
        if (!iframe.style.maxWidth) {
            iframe.style.maxWidth = '100%';
        }
        
        // Encapsuler dans un wrapper si pas déjà fait
        if (!iframe.parentElement.classList.contains('pinterest-iframe-wrapper')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'pinterest-iframe-wrapper';
            wrapper.style.cssText = `
                margin: 2rem 0;
                text-align: center;
                max-width: 100%;
            `;
            
            iframe.parentNode.insertBefore(wrapper, iframe);
            wrapper.appendChild(iframe);
        }
    });
    
    // Recharger les widgets Pinterest si le script est déjà présent
    if (window.PinUtils && window.PinUtils.build) {
        window.PinUtils.build();
    }
}

// ============================================
// RÉACTIONS
// ============================================

async function loadReactions(articleId) {
    try {
        const reactionsRef = doc(db, 'reactions', articleId);
        const reactionsDoc = await getDoc(reactionsRef);
        
        if (reactionsDoc.exists()) {
            const data = reactionsDoc.data();
            
            document.getElementById('likeCount').textContent = data.like || 0;
            document.getElementById('loveCount').textContent = data.love || 0;
            document.getElementById('insightCount').textContent = data.insight || 0;
            document.getElementById('supportCount').textContent = data.support || 0;
            
            // Mettre à jour l'état des boutons
            updateReactionButtons(articleId);
        }
    } catch (error) {
        console.error('Erreur chargement réactions:', error);
    }
}

function updateReactionButtons(articleId) {
    const userToken = initUserToken();
    const userReaction = userReactions[articleId];
    
    document.querySelectorAll('.reaction-btn').forEach(btn => {
        btn.classList.remove('active');
        if (userReaction && btn.dataset.reaction === userReaction) {
            btn.classList.add('active');
        }
    });
}

async function handleReaction(e) {
    const btn = e.currentTarget;
    const reaction = btn.dataset.reaction;
    
    console.log('handleReaction appelée, réaction:', reaction, 'articleId:', currentArticleId);
    
    if (!currentArticleId) {
        console.error('Pas d\'ID d\'article');
        showNotification('Article non chargé', 'error');
        return;
    }
    
    const userToken = initUserToken();
    const previousReaction = userReactions[currentArticleId];
    
    console.log('Réaction précédente:', previousReaction);
    
    try {
        const reactionsRef = doc(db, 'reactions', currentArticleId);
        const reactionsDoc = await getDoc(reactionsRef);
        
        let updateData = {};
        
        // Si c'est la même réaction, on la retire
        if (previousReaction === reaction) {
            console.log('Retrait de la réaction');
            updateData[reaction] = increment(-1);
            delete userReactions[currentArticleId];
        } else {
            // Nouvelle réaction
            console.log('Ajout de la réaction');
            updateData[reaction] = increment(1);
            
            // Retirer l'ancienne réaction si elle existe
            if (previousReaction) {
                console.log('Retrait ancienne réaction:', previousReaction);
                updateData[previousReaction] = increment(-1);
            }
            
            userReactions[currentArticleId] = reaction;
        }
        
        // Mettre à jour Firestore
        if (reactionsDoc.exists()) {
            console.log('Document existe, mise à jour...');
            await updateDoc(reactionsRef, updateData);
        } else {
            // Créer le document s'il n'existe pas
            console.log('Document n\'existe pas, création...');
            const initialData = { 
                like: 0, 
                love: 0, 
                insight: 0, 
                support: 0 
            };
            
            // Ajouter la réaction seulement si ce n'est pas un retrait
            if (!previousReaction) {
                initialData[reaction] = 1;
            }
            
            await setDoc(reactionsRef, initialData);
        }
        
        console.log('Réaction enregistrée avec succès');
        
        // Sauvegarder localement
        saveUserReactions();
        
        // Recharger les réactions
        await loadReactions(currentArticleId);
        
        // Feedback visuel
        btn.style.transform = 'scale(1.2)';
        setTimeout(() => {
            btn.style.transform = '';
        }, 200);
        
    } catch (error) {
        console.error('Erreur réaction:', error);
        showNotification('Erreur lors de l\'enregistrement de la réaction', 'error');
        
        // Restaurer l'état précédent
        if (previousReaction) {
            userReactions[currentArticleId] = previousReaction;
        } else {
            delete userReactions[currentArticleId];
        }
        saveUserReactions();
        updateReactionButtons(currentArticleId);
    }
}

// ============================================
// COMMENTAIRES
// ============================================

async function loadComments(articleId) {
    try {
        const commentsRef = collection(db, 'comments');
        const q = query(
            commentsRef,
            where('articleId', '==', articleId),
            orderBy('createdAt', 'desc')
        );
        const querySnapshot = await getDocs(q);
        
        const commentsList = document.getElementById('commentsList');
        const commentsCount = document.getElementById('commentsCount');
        
        commentsCount.textContent = querySnapshot.size;
        
        if (querySnapshot.empty) {
            commentsList.innerHTML = '<p class="empty-text">Aucun commentaire pour le moment. Soyez le premier à commenter !</p>';
            return;
        }
        
        commentsList.innerHTML = '';
        
        querySnapshot.forEach(doc => {
            const comment = doc.data();
            const commentDiv = createCommentElement(comment);
            commentsList.appendChild(commentDiv);
        });
        
    } catch (error) {
        console.error('Erreur chargement commentaires:', error);
        document.getElementById('commentsList').innerHTML = '<p class="empty-text">Erreur de chargement des commentaires</p>';
    }
}

function createCommentElement(comment) {
    const div = document.createElement('div');
    div.className = 'comment';
    
    let dateText = 'Date inconnue';
    if (comment.createdAt) {
        const date = comment.createdAt.toDate();
        dateText = new Intl.DateTimeFormat('fr-FR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    }
    
    div.innerHTML = `
        <div class="comment-header">
            <div class="comment-author">
                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(comment.authorName || 'Anonyme')}&background=1e40af&color=fff" 
                     alt="${escapeHtml(comment.authorName || 'Anonyme')}" 
                     class="comment-avatar">
                <div>
                    <strong>${escapeHtml(comment.authorName || 'Anonyme')}</strong>
                    <span class="comment-date">${dateText}</span>
                </div>
            </div>
        </div>
        <p class="comment-text">${escapeHtml(comment.text)}</p>
    `;
    
    return div;
}

async function submitComment(e) {
    e.preventDefault();
    
    const nameInput = document.getElementById('commentName');
    const emailInput = document.getElementById('commentEmail');
    const textInput = document.getElementById('commentText');
    
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const text = textInput.value.trim();
    
    if (!name || !email || !text) {
        showNotification('Veuillez remplir tous les champs', 'error');
        return;
    }
    
    try {
        const commentsRef = collection(db, 'comments');
        await addDoc(commentsRef, {
            articleId: currentArticleId,
            authorName: name,
            authorEmail: email,
            text: text,
            createdAt: serverTimestamp()
        });
        
        // Réinitialiser le formulaire
        nameInput.value = '';
        emailInput.value = '';
        textInput.value = '';
        
        showNotification('Commentaire ajouté avec succès !', 'success');
        
        // Recharger les commentaires
        await loadComments(currentArticleId);
        
    } catch (error) {
        console.error('Erreur ajout commentaire:', error);
        showNotification('Erreur lors de l\'ajout du commentaire', 'error');
    }
}

// ============================================
// ARTICLES CONNEXES
// ============================================

async function loadRelatedArticles(category) {
    try {
        const articlesRef = collection(db, 'articles');
        const q = query(
            articlesRef,
            where('category', '==', category),
            orderBy('createdAt', 'desc'),
            limit(4)
        );
        const querySnapshot = await getDocs(q);
        
        const relatedContainer = document.getElementById('relatedArticles');
        
        if (querySnapshot.size <= 1) {
            relatedContainer.parentElement.style.display = 'none';
            return;
        }
        
        relatedContainer.innerHTML = '';
        
        querySnapshot.forEach(doc => {
            if (doc.id === currentArticleId) return; // Skip l'article actuel
            
            const article = doc.data();
            const articleCard = createRelatedArticleCard(doc.id, article);
            relatedContainer.appendChild(articleCard);
        });
        
    } catch (error) {
        console.error('Erreur articles connexes:', error);
    }
}

function createRelatedArticleCard(id, article) {
    const div = document.createElement('div');
    div.className = 'related-article-card';
    
    const slug = article.slug || id;
    const link = `/article/${slug}`;
    
    let dateText = '';
    if (article.createdAt) {
        const date = article.createdAt.toDate();
        dateText = new Intl.DateTimeFormat('fr-FR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }).format(date);
    }
    
    div.innerHTML = `
        <a href="${link}" class="related-article-link">
            ${article.imageUrl ? `
                <img src="${escapeHtml(article.imageUrl)}" 
                     alt="${escapeHtml(article.title)}" 
                     class="related-article-image">
            ` : ''}
            <div class="related-article-content">
                <span class="category-badge ${getCategoryClass(article.category)}">${escapeHtml(article.category)}</span>
                <h4>${escapeHtml(article.title)}</h4>
                ${dateText ? `<span class="related-article-date">${dateText}</span>` : ''}
            </div>
        </a>
    `;
    
    return div;
}

// ============================================
// NEWSLETTER
// ============================================

async function submitNewsletter(e) {
    e.preventDefault();
    
    const emailInput = document.getElementById('newsletterEmail');
    const email = emailInput.value.trim().toLowerCase();
    
    if (!email) {
        showNotification('Veuillez entrer un email valide', 'error');
        return;
    }
    
    try {
        // Vérifier si l'email existe déjà
        const newsletterRef = collection(db, 'newsletter');
        const q = query(newsletterRef, where('email', '==', email));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            showNotification('Cet email est déjà inscrit !', 'info');
            closeNewsletterModal();
            return;
        }
        
        // Ajouter l'email
        await addDoc(newsletterRef, {
            email: email,
            subscribedAt: serverTimestamp(),
            source: 'article_page'
        });
        
        emailInput.value = '';
        showNotification('Merci pour votre inscription !', 'success');
        closeNewsletterModal();
        
    } catch (error) {
        console.error('Erreur inscription newsletter:', error);
        showNotification('Erreur lors de l\'inscription', 'error');
    }
}

function closeNewsletterModal() {
    if (newsletterModal) {
        newsletterModal.classList.add('hidden');
    }
}

// ============================================
// PARTAGE
// ============================================

function copyLink() {
    const url = window.location.href;
    
    if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => {
            showNotification('Lien copié !', 'success');
        }).catch(err => {
            console.error('Erreur copie:', err);
            showNotification('Erreur lors de la copie', 'error');
        });
    } else {
        // Fallback pour les anciens navigateurs
        const input = document.createElement('input');
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        showNotification('Lien copié !', 'success');
    }
}

// ============================================
// THÈME
// ============================================

function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Mettre à jour l'icône
    const icon = themeToggle.querySelector('i');
    if (newTheme === 'dark') {
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
    } else {
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
    }
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    if (themeToggle) {
        const icon = themeToggle.querySelector('i');
        if (savedTheme === 'dark') {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        }
    }
}

// ============================================
// MÉTADONNÉES
// ============================================

function updatePageMeta(article) {
    // Titre
    document.title = `${article.title} | Électro-Actu`;
    
    // Description
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
        metaDesc.setAttribute('content', article.summary || article.title);
    }
    
    // Open Graph
    updateMetaTag('og:title', article.title);
    updateMetaTag('og:description', article.summary || article.title);
    if (article.imageUrl) {
        updateMetaTag('og:image', article.imageUrl);
    }
    updateMetaTag('og:url', window.location.href);
    
    // Twitter
    updateMetaTag('twitter:title', article.title);
    updateMetaTag('twitter:description', article.summary || article.title);
    if (article.imageUrl) {
        updateMetaTag('twitter:image', article.imageUrl);
    }
    
    // Structured Data
    addStructuredData(article);
}

function updateMetaTag(property, content) {
    let meta = document.querySelector(`meta[property="${property}"]`);
    if (!meta) {
        meta = document.querySelector(`meta[name="${property}"]`);
    }
    if (meta) {
        meta.setAttribute('content', content);
    } else {
        meta = document.createElement('meta');
        if (property.startsWith('og:') || property.startsWith('twitter:')) {
            meta.setAttribute('property', property);
        } else {
            meta.setAttribute('name', property);
        }
        meta.setAttribute('content', content);
        document.head.appendChild(meta);
    }
}

function addStructuredData(article) {
    const structuredData = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": article.title,
        "description": article.summary || article.title,
        "image": article.imageUrl || "https://electroinfo.online/images/logo.png",
        "datePublished": article.createdAt ? article.createdAt.toDate().toISOString() : new Date().toISOString(),
        "author": {
            "@type": "Person",
            "name": article.author?.name || article.author?.email || "Électro-Actu"
        },
        "publisher": {
            "@type": "Organization",
            "name": "Électro-Actu",
            "logo": {
                "@type": "ImageObject",
                "url": "https://electroinfo.online/images/logo.png"
            }
        },
        "mainEntityOfPage": {
            "@type": "WebPage",
            "@id": window.location.href
        }
    };
    
    // Ajouter le script au head
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(structuredData);
    document.head.appendChild(script);
}

// ============================================
// ÉTAT D'ERREUR
// ============================================

function showError() {
    if (loadingState) loadingState.classList.add('hidden');
    if (articleContainer) articleContainer.classList.add('hidden');
    if (errorState) errorState.classList.remove('hidden');
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

function calculateReadingTime(content) {
    if (!content) return 1;
    const wordsPerMinute = 200;
    const words = content.split(/\s+/).length;
    const minutes = Math.ceil(words / wordsPerMinute);
    return Math.max(1, minutes);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function saveUserReactions() {
    try {
        localStorage.setItem('userReactions', JSON.stringify(userReactions));
    } catch (error) {
        console.warn('Erreur sauvegarde réactions:', error);
    }
}

function loadUserReactions() {
    try {
        const saved = localStorage.getItem('userReactions');
        if (saved) {
            userReactions = JSON.parse(saved);
        }
    } catch (error) {
        console.warn('Erreur chargement réactions:', error);
        userReactions = {};
    }
}

// ============================================
// NOTIFICATIONS
// ============================================

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.setAttribute('role', 'alert');
    notification.setAttribute('aria-live', 'polite');
    
    const icons = {
        success: 'check-circle',
        error: 'exclamation-circle',
        info: 'info-circle'
    };
    
    notification.innerHTML = `
        <i class="fas fa-${icons[type] || 'info-circle'}" aria-hidden="true"></i>
        <span>${escapeHtml(message)}</span>
    `;
    
    document.body.appendChild(notification);
    
    requestAnimationFrame(() => {
        notification.classList.add('show');
    });
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// ============================================
// AMÉLIORATION : Indicateur de lecture
// ============================================

function initReadingProgress() {
    const progressBar = document.createElement('div');
    progressBar.id = 'readingProgress';
    progressBar.style.cssText = `
        position: fixed;
        top: 64px;
        left: 0;
        width: 0%;
        height: 3px;
        background: linear-gradient(90deg, #eab308, #1e40af);
        z-index: 1000;
        transition: width 0.1s ease-out;
    `;
    document.body.appendChild(progressBar);
    
    window.addEventListener('scroll', () => {
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        const scrollPercent = (scrollTop / (documentHeight - windowHeight)) * 100;
        progressBar.style.width = Math.min(scrollPercent, 100) + '%';
    });
}

// ============================================
// AMÉLIORATION : Bouton "Retour en haut"
// ============================================

function initBackToTop() {
    const backToTopBtn = document.createElement('button');
    backToTopBtn.id = 'backToTop';
    backToTopBtn.className = 'back-to-top-btn';
    backToTopBtn.innerHTML = '<i class="fas fa-arrow-up" aria-hidden="true"></i>';
    backToTopBtn.setAttribute('aria-label', 'Retour en haut');
    backToTopBtn.style.cssText = `
        position: fixed;
        bottom: 5rem;
        right: 2rem;
        width: 3rem;
        height: 3rem;
        border-radius: 50%;
        background-color: #1e40af;
        color: white;
        border: none;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 998;
        font-size: 1.25rem;
        transition: all 0.3s;
        opacity: 0;
        visibility: hidden;
        transform: scale(0.8);
    `;
    
    document.body.appendChild(backToTopBtn);
    
    window.addEventListener('scroll', () => {
        if (window.pageYOffset > 300) {
            backToTopBtn.style.opacity = '1';
            backToTopBtn.style.visibility = 'visible';
            backToTopBtn.style.transform = 'scale(1)';
        } else {
            backToTopBtn.style.opacity = '0';
            backToTopBtn.style.visibility = 'hidden';
            backToTopBtn.style.transform = 'scale(0.8)';
        }
    });
    
    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
    
    backToTopBtn.addEventListener('mouseenter', () => {
        backToTopBtn.style.transform = 'scale(1.1)';
        backToTopBtn.style.backgroundColor = '#1e3a8a';
    });
    
    backToTopBtn.addEventListener('mouseleave', () => {
        backToTopBtn.style.transform = 'scale(1)';
        backToTopBtn.style.backgroundColor = '#1e40af';
    });
}

// ============================================
// GESTION DES ERREURS GLOBALES
// ============================================

window.addEventListener('error', (e) => {
    console.error('Erreur globale:', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Promise rejetée:', e.reason);
});

// ============================================
// MENU MOBILE
// ============================================

const mobileMenuToggle = document.getElementById('mobileMenuToggle');
const navMenu = document.getElementById('navMenu');

// Toggle du menu mobile
if (mobileMenuToggle && navMenu) {
    mobileMenuToggle.addEventListener('click', () => {
        navMenu.classList.toggle('active');
        
        // Changer l'icône
        const icon = mobileMenuToggle.querySelector('i');
        if (navMenu.classList.contains('active')) {
            icon.classList.remove('fa-bars');
            icon.classList.add('fa-times');
        } else {
            icon.classList.remove('fa-times');
            icon.classList.add('fa-bars');
        }
    });
    
    // Fermer le menu quand on clique sur un lien
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('active');
            const icon = mobileMenuToggle.querySelector('i');
            icon.classList.remove('fa-times');
            icon.classList.add('fa-bars');
        });
    });
    
    // Fermer le menu quand on clique en dehors
    document.addEventListener('click', (e) => {
        if (!navMenu.contains(e.target) && !mobileMenuToggle.contains(e.target)) {
            navMenu.classList.remove('active');
            const icon = mobileMenuToggle.querySelector('i');
            if (icon) {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        }
    });
}

// Rendre certaines fonctions accessibles globalement
window.copyLink = copyLink;
window.closeNewsletterModal = closeNewsletterModal;