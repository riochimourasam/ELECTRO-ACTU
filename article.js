// ============================================
// ARTICLE.JS - VERSION CORRIGÉE ET OPTIMISÉE
// ============================================

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
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Variables globales
let currentArticleId = null;
let userReactions = {};
let reactionDebounceTimer = null;

// Récupérer le SLUG depuis le path OU l'ID depuis les paramètres
const pathParts = window.location.pathname.split('/');
const articleSlug = pathParts[pathParts.length - 1]; // Dernier élément du path
const urlParams = new URLSearchParams(window.location.search);
const articleId = urlParams.get('id');

// Déterminer si on a un slug ou un ID
const hasSlug = articleSlug && !articleSlug.includes('.html') && articleSlug !== '';
const identifier = hasSlug ? articleSlug : articleId;

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
        if (hasSlug) {
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
    
    // Réactions avec debounce
    document.querySelectorAll('.reaction-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            clearTimeout(reactionDebounceTimer);
            reactionDebounceTimer = setTimeout(() => handleReaction(e), 300);
        });
    });
    
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
        const querySnapshot = await db.collection('articles')
            .where('slug', '==', slug)
            .limit(1)
            .get();
        
        if (querySnapshot.empty) {
            showError();
            return;
        }
        
        const doc = querySnapshot.docs[0];
        currentArticleId = doc.id;
        
        const article = doc.data();
        
        // Incrémenter les vues
        await db.collection('articles').doc(doc.id).update({
            views: firebase.firestore.FieldValue.increment(1)
        }).catch(err => console.warn('Erreur incrémentation vues:', err));
        
        // Afficher l'article
        displayArticle(article);
        
        // Charger les données supplémentaires
        await Promise.all([
            loadReactions(doc.id),
            loadComments(doc.id),
            loadRelatedArticles(article.category)
        ]);
        
        // Cacher le loading, afficher le contenu
        loadingState.classList.add('hidden');
        articleContainer.classList.remove('hidden');
        
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
        const doc = await db.collection('articles').doc(id).get();
        
        if (!doc.exists) {
            showError();
            return;
        }
        
        const article = doc.data();
        
        // Incrémenter les vues
        await db.collection('articles').doc(id).update({
            views: firebase.firestore.FieldValue.increment(1)
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
        
        // Mettre à jour le titre et métadonnées
        updatePageMeta(article);
        
    } catch (error) {
        console.error('Erreur lors du chargement:', error);
        showError();
        showNotification('Erreur de chargement de l\'article', 'error');
    }
}

// ============================================
// CHARGEMENT ARTICLE
// ============================================

async function loadArticle(id) {
    currentArticleId = id;
    
    try {
        const doc = await db.collection('articles').doc(id).get();
        
        if (!doc.exists) {
            showError();
            return;
        }
        
        const article = doc.data();
        
        // Incrémenter les vues
        await db.collection('articles').doc(id).update({
            views: firebase.firestore.FieldValue.increment(1)
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
    try {
        // Image avec fallback
        const imgUrl = article.imageUrl || 'https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?w=1200&q=80';
        const articleImage = document.getElementById('articleImage');
        if (articleImage) {
            articleImage.src = imgUrl;
            articleImage.alt = article.title || 'Image de l\'article';
        }
        
        // Titre
        const articleTitle = document.getElementById('articleTitle');
        if (articleTitle) {
            articleTitle.textContent = article.title || 'Sans titre';
        }
        
        // Catégorie
        const categoryBadge = document.getElementById('articleCategory');
        if (categoryBadge) {
            categoryBadge.textContent = article.category || 'Général';
            categoryBadge.className = `article-category-badge category-${getCategoryClass(article.category)}`;
        }
        
        // Date
        const articleDate = document.getElementById('articleDate');
        if (articleDate) {
            const date = article.createdAt 
                ? new Date(article.createdAt.toDate()).toLocaleDateString('fr-FR', { 
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric' 
                })
                : 'Date inconnue';
            articleDate.textContent = date;
        }
        
        // Temps de lecture
        const readTime = calculateReadingTime(article.content || '');
        const articleReadTime = document.getElementById('articleReadTime');
        if (articleReadTime) {
            articleReadTime.textContent = `${readTime} min de lecture`;
        }
        
        // Vues
        const articleViews = document.getElementById('articleViews');
        if (articleViews) {
            articleViews.textContent = (article.views || 0) + 1;
        }
        
        // Résumé
        const articleSummary = document.getElementById('articleSummary');
        if (articleSummary) {
            articleSummary.textContent = article.summary || '';
        }
        
        // Contenu
        const articleBody = document.getElementById('articleBody');
        if (articleBody) {
            articleBody.innerHTML = formatArticleContent(article.content || '');
        }
        
        // Tags
        displayTags(article.tags || []);
        
    } catch (error) {
        console.error('Erreur affichage article:', error);
        showNotification('Erreur d\'affichage de l\'article', 'error');
    }
}

// ============================================
// FORMATAGE DU CONTENU - VERSION CORRIGÉE
// ============================================

function formatArticleContent(content) {
    if (!content) return '<p>Contenu indisponible.</p>';
    
    // ✅ CORRECTION : Vérifier si le contenu contient des balises HTML (venant de Quill)
    if (content.includes('<p>') || content.includes('<h1>') || content.includes('<h2>') || 
        content.includes('<h3>') || content.includes('<strong>') || content.includes('<em>') ||
        content.includes('<ul>') || content.includes('<ol>') || content.includes('<blockquote>')) {
        
        // C'est du contenu Quill formaté
        // Mais on doit quand même traiter les URLs d'images qui sont dans des paragraphes
        let processedContent = content;
        
        // Détecter et remplacer les URLs d'images dans les paragraphes
        processedContent = processedContent.replace(/<p>(https?:\/\/[^<]+?\.(jpg|jpeg|png|gif|webp|bmp|svg)[^<]*?)<\/p>/gi, (match, url) => {
            return `<img src="${url}" alt="Image de l'article" class="content-image" loading="lazy" decoding="async">`;
        });
        
        // Détecter les URLs spéciales (unsplash, pexels, blog-cdn, etc.) dans les paragraphes
        processedContent = processedContent.replace(/<p>(https?:\/\/[^<]*?(unsplash|pexels|pixabay|imgur|cloudinary|bing\.com\/th|blog-cdn\.athom\.com)[^<]*?)<\/p>/gi, (match, url) => {
            return `<img src="${url}" alt="Image de l'article" class="content-image" loading="lazy" decoding="async">`;
        });
        
        // Détecter et remplacer les vidéos YouTube dans les paragraphes
        processedContent = processedContent.replace(/<p>(https?:\/\/(www\.)?(youtube\.com|youtu\.be)[^<]+?)<\/p>/gi, (match, url) => {
            return formatYouTubeVideo(url);
        });
        
        return processedContent;
    }
    
    // Sinon, c'est du texte brut (ancien format), on le traite ligne par ligne
    const lines = content.split('\n').filter(line => line.trim());
    
    return lines.map(line => {
        line = line.trim();
        
        // Détection YouTube
        if (line.match(/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)/i)) {
            return formatYouTubeVideo(line);
        }
        
        // Détection image
        if (isImageUrl(line)) {
            return `<img src="${escapeHtml(line)}" alt="Image de l'article" class="content-image" loading="lazy" decoding="async">`;
        }
        
        // Lien standard
        if (line.match(/^https?:\/\//i)) {
            return `<p><a href="${escapeHtml(line)}" target="_blank" rel="noopener noreferrer" class="content-link">${escapeHtml(line)}</a></p>`;
        }
        
        // Texte avec liens intégrés
        if (line.includes('http')) {
            return `<p>${autoLinkUrls(line)}</p>`;
        }
        
        // Texte normal
        return `<p>${escapeHtml(line)}</p>`;
    }).join('');
}

function isImageUrl(url) {
    return /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i.test(url) ||
           /(unsplash|pexels|pixabay|imgur|cloudinary|bing\.com\/th|blog-cdn\.athom\.com)/.test(url);
}

function formatYouTubeVideo(url) {
    const match = url.match(/(?:v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    if (!match) return '';
    
    return `<div class="video-container">
        <iframe 
            src="https://www.youtube.com/embed/${match[1]}" 
            frameborder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowfullscreen
            loading="lazy"
            title="Vidéo YouTube">
        </iframe>
    </div>`;
}

function autoLinkUrls(text) {
    return escapeHtml(text).replace(
        /(https?:\/\/[^\s]+)/g, 
        '<a href="$1" target="_blank" rel="noopener noreferrer" class="content-link">$1</a>'
    );
}

// ============================================
// AFFICHAGE DES TAGS
// ============================================

function displayTags(tags) {
    const container = document.getElementById('articleTags');
    if (!container) return;
    
    if (!tags || tags.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = `
        <h3 class="tags-section-title">
            <i class="fas fa-tags mr-2" aria-hidden="true"></i>Tags
        </h3>
        <div class="tags-list">
            ${tags.map(tag => `<span class="tag-badge">${escapeHtml(tag)}</span>`).join('')}
        </div>
    `;
}

// ============================================
// GESTION DES RÉACTIONS
// ============================================

async function loadReactions(articleId) {
    try {
        const doc = await db.collection('articles').doc(articleId).get();
        if (!doc.exists) return;
        
        const reactions = doc.data().reactions || { like: 0, love: 0, star: 0 };
        
        const likeCount = document.getElementById('likeCount');
        const loveCount = document.getElementById('loveCount');
        const starCount = document.getElementById('starCount');
        
        if (likeCount) likeCount.textContent = reactions.like || 0;
        if (loveCount) loveCount.textContent = reactions.love || 0;
        if (starCount) starCount.textContent = reactions.star || 0;
        
        // Vérifier si l'utilisateur a déjà réagi
        const userReaction = userReactions[articleId];
        if (userReaction) {
            const btn = document.getElementById(`${userReaction}Btn`);
            if (btn) btn.classList.add('active');
        }
        
    } catch (error) {
        console.error('Erreur chargement réactions:', error);
        showNotification('Erreur de chargement des réactions', 'error');
    }
}

async function handleReaction(e) {
    if (!currentArticleId) return;
    
    const button = e.currentTarget;
    const reaction = button.dataset.reaction;
    const previousReaction = userReactions[currentArticleId];
    
    try {
        const articleRef = db.collection('articles').doc(currentArticleId);
        
        // Retirer ancienne réaction
        if (previousReaction) {
            await articleRef.update({
                [`reactions.${previousReaction}`]: firebase.firestore.FieldValue.increment(-1)
            });
            const prevBtn = document.getElementById(`${previousReaction}Btn`);
            if (prevBtn) prevBtn.classList.remove('active');
        }
        
        // Ajouter nouvelle réaction (sauf si même réaction)
        if (previousReaction !== reaction) {
            await articleRef.update({
                [`reactions.${reaction}`]: firebase.firestore.FieldValue.increment(1)
            });
            userReactions[currentArticleId] = reaction;
            button.classList.add('active');
        } else {
            delete userReactions[currentArticleId];
        }
        
        saveUserReactions();
        await loadReactions(currentArticleId);
        
    } catch (error) {
        console.error('Erreur réaction:', error);
        showNotification('Erreur lors de la réaction', 'error');
    }
}

// ============================================
// GESTION DES COMMENTAIRES
// ============================================

async function loadComments(articleId) {
    try {
        const snapshot = await db.collection('articles').doc(articleId)
            .collection('comments')
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();
        
        const commentsList = document.getElementById('commentsList');
        const commentsCount = document.getElementById('commentsCount');
        
        if (commentsCount) {
            commentsCount.textContent = snapshot.size;
        }
        
        if (!commentsList) return;
        
        if (snapshot.empty) {
            commentsList.innerHTML = '<p class="no-comments">Aucun commentaire pour le moment. Soyez le premier à partager votre avis !</p>';
            return;
        }
        
        commentsList.innerHTML = '';
        snapshot.forEach(doc => {
            const comment = doc.data();
            const commentEl = createCommentElement(comment, doc.id);
            commentsList.appendChild(commentEl);
        });
        
    } catch (error) {
        console.error('Erreur chargement commentaires:', error);
        showNotification('Erreur de chargement des commentaires', 'error');
    }
}

function createCommentElement(comment, commentId) {
    const div = document.createElement('div');
    div.className = 'comment-item fade-in';
    div.setAttribute('data-comment-id', commentId);
    
    const date = comment.createdAt 
        ? new Date(comment.createdAt.toDate()).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
        : 'Date inconnue';
    
    const userToken = localStorage.getItem('userToken');
    const isUserComment = comment.userToken === userToken;
    
    const actionsHtml = isUserComment ? `
        <div class="comment-actions">
            <button class="comment-action-btn edit-btn" onclick="editComment('${commentId}', this)" title="Modifier" aria-label="Modifier le commentaire">
                <i class="fas fa-edit" aria-hidden="true"></i>
            </button>
            <button class="comment-action-btn delete-btn" onclick="deleteComment('${commentId}')" title="Supprimer" aria-label="Supprimer le commentaire">
                <i class="fas fa-trash" aria-hidden="true"></i>
            </button>
        </div>
    ` : '';
    
    div.innerHTML = `
        <div class="comment-avatar" aria-hidden="true">${escapeHtml(comment.name.charAt(0).toUpperCase())}</div>
        <div class="comment-content">
            <div class="comment-header">
                <span class="comment-author">${escapeHtml(comment.name)}</span>
                <span class="comment-date">${date}</span>
            </div>
            <p class="comment-text">${escapeHtml(comment.text)}</p>
            ${actionsHtml}
        </div>
    `;
    
    return div;
}

async function submitComment(e) {
    e.preventDefault();
    
    if (!currentArticleId) return;
    
    const nameInput = document.getElementById('commentName');
    const textInput = document.getElementById('commentText');
    
    if (!nameInput || !textInput) return;
    
    const name = nameInput.value.trim();
    const text = textInput.value.trim();
    
    if (!name || !text) {
        showNotification('Veuillez remplir tous les champs', 'error');
        return;
    }
    
    if (name.length > 100) {
        showNotification('Le nom est trop long (max 100 caractères)', 'error');
        return;
    }
    
    if (text.length > 1000) {
        showNotification('Le commentaire est trop long (max 1000 caractères)', 'error');
        return;
    }
    
    const userToken = localStorage.getItem('userToken');
    
    try {
        await db.collection('articles').doc(currentArticleId)
            .collection('comments')
            .add({
                name,
                text,
                userToken,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        
        await db.collection('articles').doc(currentArticleId).update({
            commentsCount: firebase.firestore.FieldValue.increment(1)
        }).catch(err => console.warn('Erreur incrémentation commentaires:', err));
        
        e.target.reset();
        await loadComments(currentArticleId);
        showNotification('Commentaire publié avec succès ! 🎉', 'success');
        
        const commentsSection = document.getElementById('comments');
        if (commentsSection) {
            commentsSection.scrollIntoView({ behavior: 'smooth' });
        }
        
    } catch (error) {
        console.error('Erreur:', error);
        showNotification('Erreur lors de la publication du commentaire', 'error');
    }
}

async function editComment(commentId, button) {
    const commentItem = button.closest('.comment-item');
    if (!commentItem) return;
    
    const commentTextEl = commentItem.querySelector('.comment-text');
    if (!commentTextEl) return;
    
    const currentText = commentTextEl.textContent;
    
    const editForm = document.createElement('div');
    editForm.className = 'comment-edit-form';
    editForm.innerHTML = `
        <textarea class="comment-textarea" rows="3" maxlength="1000" aria-label="Modifier votre commentaire">${escapeHtml(currentText)}</textarea>
        <div class="comment-edit-actions">
            <button class="btn-save-comment" onclick="saveCommentEdit('${commentId}', this)">
                <i class="fas fa-check mr-1" aria-hidden="true"></i>Enregistrer
            </button>
            <button class="btn-cancel-comment" onclick="cancelCommentEdit(this)">
                <i class="fas fa-times mr-1" aria-hidden="true"></i>Annuler
            </button>
        </div>
    `;
    
    commentTextEl.replaceWith(editForm);
    
    const actionsDiv = commentItem.querySelector('.comment-actions');
    if (actionsDiv) {
        actionsDiv.style.display = 'none';
    }
}

async function saveCommentEdit(commentId, button) {
    const editForm = button.closest('.comment-edit-form');
    if (!editForm) return;
    
    const textarea = editForm.querySelector('textarea');
    if (!textarea) return;
    
    const newText = textarea.value.trim();
    
    if (!newText) {
        showNotification('Le commentaire ne peut pas être vide', 'error');
        return;
    }
    
    if (newText.length > 1000) {
        showNotification('Le commentaire est trop long (max 1000 caractères)', 'error');
        return;
    }
    
    try {
        await db.collection('articles').doc(currentArticleId)
            .collection('comments')
            .doc(commentId)
            .update({
                text: newText,
                editedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        
        await loadComments(currentArticleId);
        showNotification('Commentaire modifié avec succès !', 'success');
        
    } catch (error) {
        console.error('Erreur:', error);
        showNotification('Erreur lors de la modification', 'error');
    }
}

function cancelCommentEdit(button) {
    loadComments(currentArticleId);
}

async function deleteComment(commentId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce commentaire ?')) {
        return;
    }
    
    try {
        await db.collection('articles').doc(currentArticleId)
            .collection('comments')
            .doc(commentId)
            .delete();
        
        await db.collection('articles').doc(currentArticleId).update({
            commentsCount: firebase.firestore.FieldValue.increment(-1)
        }).catch(err => console.warn('Erreur décrémentation commentaires:', err));
        
        await loadComments(currentArticleId);
        showNotification('Commentaire supprimé avec succès !', 'success');
        
    } catch (error) {
        console.error('Erreur:', error);
        showNotification('Erreur lors de la suppression', 'error');
    }
}

// ============================================
// ARTICLES SIMILAIRES
// ============================================

async function loadRelatedArticles(category) {
    const container = document.getElementById('relatedArticles');
    if (!container) return;
    
    try {
        const snapshot = await db.collection('articles')
            .where('category', '==', category)
            .orderBy('createdAt', 'desc')
            .limit(4)
            .get();
        
        if (snapshot.empty) {
            container.innerHTML = '<p class="no-related">Aucun article similaire pour le moment.</p>';
            return;
        }
        
        const relatedArticles = [];
        snapshot.forEach(doc => {
            if (doc.id !== currentArticleId) {
                relatedArticles.push({ id: doc.id, data: doc.data() });
            }
        });
        
        if (relatedArticles.length === 0) {
            container.innerHTML = '<p class="no-related">Aucun article similaire pour le moment.</p>';
            return;
        }
        
        const limitedArticles = relatedArticles.slice(0, 3);
        
        container.innerHTML = limitedArticles
            .map(item => createRelatedArticleHTML(item.id, item.data))
            .join('');
        
    } catch (error) {
        console.error('Erreur chargement articles similaires:', error);
        container.innerHTML = '<p class="no-related">Erreur de chargement</p>';
    }
}

function createRelatedArticleHTML(id, article) {
    const imgUrl = article.imageUrl || 'https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?w=400&q=80';
    const title = article.title || 'Sans titre';
    
    return `
        <div class="related-article-item">
            <img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(title)}" class="related-article-img" loading="lazy" decoding="async">
            <div class="related-article-content">
                <h4 class="related-article-title">${escapeHtml(title)}</h4>
                <a href="article.html?id=${id}" class="related-article-link">
                    Lire l'article <i class="fas fa-arrow-right" aria-hidden="true"></i>
                </a>
            </div>
        </div>
    `;
}

// ============================================
// PARTAGE SOCIAL
// ============================================

function shareArticle(platform) {
    const title = document.getElementById('articleTitle')?.textContent || 'Article';
    const url = window.location.href;
    
    const shareUrls = {
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
        twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
        linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
        whatsapp: `https://wa.me/?text=${encodeURIComponent(title + ' ' + url)}`
    };
    
    const shareUrl = shareUrls[platform];
    if (shareUrl) {
        window.open(shareUrl, '_blank', 'width=600,height=400,noopener,noreferrer');
    }
}

function copyArticleLink() {
    const url = window.location.href;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url)
            .then(() => showNotification('Lien copié ! 📋', 'success'))
            .catch(() => fallbackCopyToClipboard(url));
    } else {
        fallbackCopyToClipboard(url);
    }
}

function fallbackCopyToClipboard(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    
    try {
        document.execCommand('copy');
        showNotification('Lien copié ! 📋', 'success');
    } catch (err) {
        showNotification('Impossible de copier le lien', 'error');
    }
    
    document.body.removeChild(textarea);
}

// ============================================
// NEWSLETTER
// ============================================

function openNewsletterModal() {
    if (newsletterModal) {
        newsletterModal.classList.remove('hidden');
        const emailInput = document.getElementById('newsletterEmail');
        if (emailInput) {
            setTimeout(() => emailInput.focus(), 100);
        }
    }
}

function closeNewsletterModal() {
    if (newsletterModal) {
        newsletterModal.classList.add('hidden');
        const form = document.getElementById('newsletterForm');
        if (form) {
            form.reset();
        }
    }
}

async function submitNewsletter(e) {
    e.preventDefault();
    
    const emailInput = document.getElementById('newsletterEmail');
    if (!emailInput) return;
    
    const email = emailInput.value.trim();
    
    if (!email) {
        showNotification('Veuillez entrer votre email', 'error');
        return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showNotification('Veuillez entrer un email valide', 'error');
        return;
    }
    
    try {
        const existingEmails = await db.collection('newsletter')
            .where('email', '==', email)
            .limit(1)
            .get();
        
        if (!existingEmails.empty) {
            showNotification('Vous êtes déjà inscrit à notre newsletter !', 'info');
            closeNewsletterModal();
            return;
        }
        
        await db.collection('newsletter').add({
            email: email,
            subscribedAt: firebase.firestore.FieldValue.serverTimestamp(),
            source: 'article'
        });
        
        showNotification('Merci pour votre inscription ! 🎉', 'success');
        closeNewsletterModal();
        
    } catch (error) {
        console.error('Erreur lors de l\'inscription:', error);
        showNotification('Erreur lors de l\'inscription. Veuillez réessayer.', 'error');
    }
}

// ============================================
// THÈME SOMBRE
// ============================================

function toggleTheme() {
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    
    const icon = themeToggle?.querySelector('i');
    if (icon) {
        icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    }
}

function loadTheme() {
    const theme = localStorage.getItem('theme');
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
        const icon = themeToggle?.querySelector('i');
        if (icon) {
            icon.className = 'fas fa-sun';
        }
    }
}

// ============================================
// MÉTADONNÉES PAGE
// ============================================

function updatePageMeta(article) {
    // Mettre à jour le titre de la page
    document.title = `${article.title || 'Article'} | Électro-Actu`;
    
    // Mettre à jour la description meta
    updateMetaTag('description', article.summary, 'name');
    
    // Open Graph
    updateMetaTag('og:title', article.title, 'property');
    updateMetaTag('og:description', article.summary, 'property');
    updateMetaTag('og:image', article.imageUrl || 'https://electroinfo.online/images/logo.png', 'property');
    updateMetaTag('og:url', window.location.href, 'property');
    updateMetaTag('og:type', 'article', 'property');
    updateMetaTag('og:site_name', 'Électro-Actu', 'property');
    
    // Twitter Card
    updateMetaTag('twitter:card', 'summary_large_image', 'name');
    updateMetaTag('twitter:title', article.title, 'name');
    updateMetaTag('twitter:description', article.summary, 'name');
    updateMetaTag('twitter:image', article.imageUrl || 'https://electroinfo.online/images/logo.png', 'name');
    
    // Ajouter les données structurées JSON-LD pour un meilleur SEO
    updateStructuredData(article);
}

function updateMetaTag(property, content, attributeType = 'property') {
    if (!content) return;
    
    // Chercher la balise existante
    let meta = document.querySelector(`meta[${attributeType}="${property}"]`);
    
    if (meta) {
        // Mettre à jour le contenu existant
        meta.setAttribute('content', content);
    } else {
        // Créer une nouvelle balise
        meta = document.createElement('meta');
        meta.setAttribute(attributeType, property);
        meta.setAttribute('content', content);
        document.head.appendChild(meta);
    }
}

function updateStructuredData(article) {
    // Supprimer l'ancien script JSON-LD s'il existe
    const oldScript = document.querySelector('script[type="application/ld+json"]');
    if (oldScript) {
        oldScript.remove();
    }
    
    // Créer les données structurées
    const structuredData = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": article.title,
        "description": article.summary,
        "image": article.imageUrl || "https://electroinfo.online/images/logo.png",
        "datePublished": article.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        "author": {
            "@type": "Person",
            "name": "Enoch",
            "jobTitle": "Expert en Électricité Industrielle"
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
// MENU HAMBURGER MOBILE
// ============================================

// Fonctions pour le menu mobile
function openMobileMenu() {
    const mobileMenu = document.getElementById('mobileMenu');
    if (mobileMenu) {
        mobileMenu.classList.add('active');
        document.body.classList.add('menu-open');
    }
}

function closeMobileMenu() {
    const mobileMenu = document.getElementById('mobileMenu');
    if (mobileMenu) {
        mobileMenu.classList.remove('active');
        document.body.classList.remove('menu-open');
    }
}

function toggleMobileMenu() {
    const mobileMenu = document.getElementById('mobileMenu');
    if (mobileMenu) {
        if (mobileMenu.classList.contains('active')) {
            closeMobileMenu();
        } else {
            openMobileMenu();
        }
    }
}

// Initialisation du menu mobile
function initMobileMenu() {
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const mobileMenuClose = document.getElementById('mobileMenuClose');
    const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
    const mobileMenuLinks = document.querySelectorAll('.mobile-menu-link');
    
    // Ouvrir le menu
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', openMobileMenu);
    }
    
    // Fermer le menu
    if (mobileMenuClose) {
        mobileMenuClose.addEventListener('click', closeMobileMenu);
    }
    
    // Fermer avec l'overlay
    if (mobileMenuOverlay) {
        mobileMenuOverlay.addEventListener('click', closeMobileMenu);
    }
    
    // Fermer quand on clique sur un lien
    mobileMenuLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            // Ne ferme pas si c'est le lien Newsletter (géré par onclick)
            if (!link.onclick) {
                closeMobileMenu();
            }
        });
    });
    
    // Fermer avec la touche Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeMobileMenu();
        }
    });
    
    // Gérer le redimensionnement de la fenêtre
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (window.innerWidth > 768) {
                closeMobileMenu();
            }
        }, 250);
    });
}

// Ajouter l'initialisation du menu mobile au chargement
document.addEventListener('DOMContentLoaded', () => {
    initMobileMenu();
});
