// article.js - Affichage d'article avec support SLUG + ID
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, collection, doc, getDoc, getDocs, addDoc, updateDoc, increment, query, where, orderBy, limit, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

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

let currentArticleId = null;
let currentArticle = null;
let userReactions = JSON.parse(localStorage.getItem('userReactions') || '{}');

// ============================================
// 🆕 FONCTION PRINCIPALE : DÉTECTION SLUG OU ID
// ============================================
async function loadArticle() {
    try {
        showLoading();

        // Récupérer le paramètre depuis l'URL
        const urlPath = window.location.pathname;
        const urlParams = new URLSearchParams(window.location.search);
        
        let articleId = null;
        let articleData = null;

        // CAS 1 : URL avec slug (/article/mon-super-titre)
        if (urlPath.startsWith('/article/')) {
            const slug = urlPath.replace('/article/', '');
            
            if (slug && slug !== 'article.html') {
                console.log('🔍 Recherche par slug:', slug);
                
                // Rechercher l'article par son slug
                const q = query(
                    collection(db, 'articles'), 
                    where('slug', '==', slug),
                    limit(1)
                );
                const snapshot = await getDocs(q);
                
                if (!snapshot.empty) {
                    const docSnap = snapshot.docs[0];
                    articleId = docSnap.id;
                    articleData = docSnap.data();
                    console.log('✅ Article trouvé via slug:', articleId);
                }
            }
        }
        
        // CAS 2 : URL avec ID classique (?id=abc123)
        if (!articleId && urlParams.has('id')) {
            articleId = urlParams.get('id');
            console.log('🔍 Recherche par ID:', articleId);
            
            const docRef = doc(db, 'articles', articleId);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                articleData = docSnap.data();
                console.log('✅ Article trouvé via ID');
            }
        }

        // Vérification finale
        if (!articleId || !articleData) {
            showError();
            return;
        }

        // Enregistrement et affichage
        currentArticleId = articleId;
        currentArticle = articleData;
        
        await incrementViews(articleId);
        displayArticle(articleData);
        loadComments(articleId);
        loadRelatedArticles(articleData.category, articleId);
        updateMetaTags(articleData);
        hideLoading();

    } catch (error) {
        console.error('❌ Erreur chargement article:', error);
        showError();
    }
}

// ============================================
// AFFICHAGE DE L'ARTICLE
// ============================================
function displayArticle(article) {
    document.getElementById('articleTitle').textContent = article.title;
    document.getElementById('articleCategory').textContent = article.category;
    document.getElementById('articleCategory').className = `article-category-badge badge-${getCategoryClass(article.category)}`;
    
    if (article.imageUrl) {
        document.getElementById('articleImage').src = article.imageUrl;
        document.getElementById('articleImage').alt = article.title;
    }
    
    const date = article.createdAt ? new Date(article.createdAt.toDate()).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }) : 'Date inconnue';
    
    document.getElementById('articleDate').textContent = date;
    document.getElementById('articleReadTime').textContent = calculateReadTime(article.content);
    document.getElementById('articleViews').textContent = (article.views || 0).toLocaleString();
    document.getElementById('articleSummary').textContent = article.summary;
    document.getElementById('articleBody').innerHTML = article.content;
    
    // Tags
    if (article.tags && article.tags.length > 0) {
        const tagsContainer = document.getElementById('articleTags');
        tagsContainer.innerHTML = '<h4 class="tags-title">Mots-clés</h4>';
        article.tags.forEach(tag => {
            const tagEl = document.createElement('span');
            tagEl.className = 'article-tag';
            tagEl.textContent = tag;
            tagsContainer.appendChild(tagEl);
        });
    }
    
    // Réactions
    if (article.reactions) {
        document.getElementById('likeCount').textContent = article.reactions.like || 0;
        document.getElementById('loveCount').textContent = article.reactions.love || 0;
        document.getElementById('starCount').textContent = article.reactions.star || 0;
    }
    
    updateReactionButtons();
}

// ============================================
// MISE À JOUR DES META TAGS (SEO)
// ============================================
function updateMetaTags(article) {
    document.title = `${article.title} | Électro-Actu`;
    
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.content = article.summary;
    
    // Open Graph
    updateMetaTag('og:title', article.title);
    updateMetaTag('og:description', article.summary);
    if (article.imageUrl) updateMetaTag('og:image', article.imageUrl);
    
    // 🆕 URL canonique avec slug
    const canonicalUrl = article.slug 
        ? `https://electroinfo.online/article/${article.slug}`
        : `https://electroinfo.online/article.html?id=${currentArticleId}`;
    
    updateMetaTag('og:url', canonicalUrl);
    
    // Twitter Card
    updateMetaTag('twitter:title', article.title);
    updateMetaTag('twitter:description', article.summary);
    if (article.imageUrl) updateMetaTag('twitter:image', article.imageUrl);
}

function updateMetaTag(property, content) {
    let meta = document.querySelector(`meta[property="${property}"]`) || 
               document.querySelector(`meta[name="${property}"]`);
    if (meta) meta.content = content;
}

// ============================================
// INCRÉMENTER LES VUES
// ============================================
async function incrementViews(articleId) {
    try {
        const articleRef = doc(db, 'articles', articleId);
        await updateDoc(articleRef, {
            views: increment(1)
        });
    } catch (error) {
        console.error('Erreur incrémentation vues:', error);
    }
}

// ============================================
// RÉACTIONS
// ============================================
document.getElementById('likeBtn')?.addEventListener('click', () => handleReaction('like'));
document.getElementById('loveBtn')?.addEventListener('click', () => handleReaction('love'));
document.getElementById('starBtn')?.addEventListener('click', () => handleReaction('star'));

async function handleReaction(type) {
    if (!currentArticleId) return;
    
    const reactionKey = `${currentArticleId}_${type}`;
    const hasReacted = userReactions[reactionKey];
    
    try {
        const articleRef = doc(db, 'articles', currentArticleId);
        const increment_value = hasReacted ? -1 : 1;
        
        await updateDoc(articleRef, {
            [`reactions.${type}`]: increment(increment_value)
        });
        
        userReactions[reactionKey] = !hasReacted;
        localStorage.setItem('userReactions', JSON.stringify(userReactions));
        
        const countEl = document.getElementById(`${type}Count`);
        countEl.textContent = parseInt(countEl.textContent) + increment_value;
        
        updateReactionButtons();
        
    } catch (error) {
        console.error('Erreur réaction:', error);
    }
}

function updateReactionButtons() {
    ['like', 'love', 'star'].forEach(type => {
        const btn = document.getElementById(`${type}Btn`);
        const reactionKey = `${currentArticleId}_${type}`;
        if (userReactions[reactionKey]) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// ============================================
// COMMENTAIRES
// ============================================
document.getElementById('commentForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('commentName').value.trim();
    const text = document.getElementById('commentText').value.trim();
    
    if (!name || !text) return;
    
    try {
        await addDoc(collection(db, 'articles', currentArticleId, 'comments'), {
            name,
            text,
            createdAt: serverTimestamp(),
            approved: false
        });
        
        document.getElementById('commentForm').reset();
        alert('✅ Commentaire envoyé ! Il sera visible après modération.');
        loadComments(currentArticleId);
        
    } catch (error) {
        console.error('Erreur commentaire:', error);
        alert('❌ Erreur lors de l\'envoi du commentaire');
    }
});

async function loadComments(articleId) {
    try {
        const q = query(
            collection(db, 'articles', articleId, 'comments'),
            where('approved', '==', true),
            orderBy('createdAt', 'desc')
        );
        
        const snapshot = await getDocs(q);
        const commentsList = document.getElementById('commentsList');
        document.getElementById('commentsCount').textContent = snapshot.size;
        
        if (snapshot.empty) {
            commentsList.innerHTML = '<p class="no-comments">Aucun commentaire pour le moment. Soyez le premier à réagir !</p>';
            return;
        }
        
        commentsList.innerHTML = '';
        snapshot.forEach(doc => {
            const comment = doc.data();
            const commentEl = createCommentElement(comment);
            commentsList.appendChild(commentEl);
        });
        
    } catch (error) {
        console.error('Erreur chargement commentaires:', error);
    }
}

function createCommentElement(comment) {
    const div = document.createElement('div');
    div.className = 'comment-item';
    
    const date = comment.createdAt ? new Date(comment.createdAt.toDate()).toLocaleDateString('fr-FR') : '';
    
    div.innerHTML = `
        <div class="comment-header">
            <div class="comment-avatar">${comment.name.charAt(0).toUpperCase()}</div>
            <div class="comment-meta">
                <strong class="comment-author">${escapeHtml(comment.name)}</strong>
                <span class="comment-date">${date}</span>
            </div>
        </div>
        <p class="comment-text">${escapeHtml(comment.text)}</p>
    `;
    
    return div;
}

// ============================================
// ARTICLES SIMILAIRES
// ============================================
async function loadRelatedArticles(category, excludeId) {
    try {
        const q = query(
            collection(db, 'articles'),
            where('category', '==', category),
            orderBy('createdAt', 'desc'),
            limit(4)
        );
        
        const snapshot = await getDocs(q);
        const relatedContainer = document.getElementById('relatedArticles');
        relatedContainer.innerHTML = '';
        
        const articles = snapshot.docs.filter(doc => doc.id !== excludeId);
        
        if (articles.length === 0) {
            relatedContainer.innerHTML = '<p class="no-related">Aucun article similaire</p>';
            return;
        }
        
        articles.slice(0, 3).forEach(doc => {
            const article = doc.data();
            // 🆕 Utiliser le slug si disponible
            const url = article.slug 
                ? `/article/${article.slug}` 
                : `article.html?id=${doc.id}`;
            
            const div = document.createElement('a');
            div.href = url;
            div.className = 'related-article-item';
            div.innerHTML = `
                <div class="related-article-image" style="background-image: url('${article.imageUrl || 'images/default.jpg'}')"></div>
                <div class="related-article-content">
                    <h4 class="related-article-title">${escapeHtml(article.title)}</h4>
                    <p class="related-article-meta">${article.category}</p>
                </div>
            `;
            relatedContainer.appendChild(div);
        });
        
    } catch (error) {
        console.error('Erreur articles similaires:', error);
    }
}

// ============================================
// PARTAGE SOCIAL
// ============================================
window.shareArticle = function(platform) {
    if (!currentArticle) return;
    
    // 🆕 URL avec slug pour le partage
    const url = currentArticle.slug
        ? `https://electroinfo.online/article/${currentArticle.slug}`
        : `https://electroinfo.online/article.html?id=${currentArticleId}`;
    
    const title = encodeURIComponent(currentArticle.title);
    const text = encodeURIComponent(currentArticle.summary);
    
    const shareUrls = {
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
        twitter: `https://twitter.com/intent/tweet?url=${url}&text=${title}`,
        linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
        whatsapp: `https://wa.me/?text=${title}%20${url}`
    };
    
    if (shareUrls[platform]) {
        window.open(shareUrls[platform], '_blank', 'width=600,height=400');
    }
};

window.copyArticleLink = function() {
    const url = currentArticle.slug
        ? `https://electroinfo.online/article/${currentArticle.slug}`
        : `https://electroinfo.online/article.html?id=${currentArticleId}`;
    
    navigator.clipboard.writeText(url).then(() => {
        alert('✅ Lien copié dans le presse-papiers !');
    }).catch(err => {
        console.error('Erreur copie:', err);
    });
};

// ============================================
// NEWSLETTER
// ============================================
window.openNewsletterModal = function() {
    document.getElementById('newsletterModal').classList.remove('hidden');
};

window.closeNewsletterModal = function() {
    document.getElementById('newsletterModal').classList.add('hidden');
};

document.getElementById('newsletterForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('newsletterEmail').value.trim();
    
    try {
        await addDoc(collection(db, 'newsletter'), {
            email,
            subscribedAt: serverTimestamp()
        });
        alert('✅ Inscription réussie !');
        closeNewsletterModal();
        document.getElementById('newsletterForm').reset();
    } catch (error) {
        console.error('Erreur newsletter:', error);
        alert('❌ Erreur lors de l\'inscription');
    }
});

// ============================================
// UTILITAIRES
// ============================================
function showLoading() {
    document.getElementById('loadingState').classList.remove('hidden');
    document.getElementById('articleContainer').classList.add('hidden');
    document.getElementById('errorState').classList.add('hidden');
}

function hideLoading() {
    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('articleContainer').classList.remove('hidden');
}

function showError() {
    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('articleContainer').classList.add('hidden');
    document.getElementById('errorState').classList.remove('hidden');
}

function calculateReadTime(content) {
    const wordsPerMinute = 200;
    const text = content.replace(/<[^>]*>/g, '');
    const wordCount = text.split(/\s+/).length;
    const minutes = Math.ceil(wordCount / wordsPerMinute);
    return `${minutes} min de lecture`;
}

function getCategoryClass(category) {
    const classes = {
        'INNOVATION': 'blue',
        'SÉCURITÉ': 'red',
        'NOUVEAUTÉ': 'green',
        'TUTO': 'orange',
        'DOMOTIQUE': 'purple'
    };
    return classes[category] || 'blue';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// THÈME SOMBRE
// ============================================
const themeToggle = document.getElementById('themeToggle');
const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);

themeToggle?.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    themeToggle.innerHTML = newTheme === 'dark' 
        ? '<i class="fas fa-sun"></i>' 
        : '<i class="fas fa-moon"></i>';
});

// ============================================
// MENU MOBILE
// ============================================
document.getElementById('mobileMenuToggle')?.addEventListener('click', function() {
    document.getElementById('navMenu').classList.toggle('active');
    this.querySelector('i').classList.toggle('fa-bars');
    this.querySelector('i').classList.toggle('fa-times');
});

// ============================================
// INITIALISATION AU CHARGEMENT
// ============================================
document.addEventListener('DOMContentLoaded', loadArticle);