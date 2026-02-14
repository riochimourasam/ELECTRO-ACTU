// article-detail.js — Page détail article (Firebase v9 modulaire)

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {
    getFirestore, collection, doc, getDoc, getDocs, addDoc,
    updateDoc, setDoc, query, where, orderBy, limit,
    increment, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

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

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ============================================
// RÉSOLUTION DE L'IDENTIFIANT D'ARTICLE
// Priorité : ?id=xxx > slug dans le path
// ============================================
const urlParams      = new URLSearchParams(window.location.search);
const articleIdParam = urlParams.get('id');
const lastSegment    = window.location.pathname.split('/').filter(Boolean).pop() || '';

const isSlug = !articleIdParam &&
    lastSegment !== '' &&
    !lastSegment.includes('.html') &&
    lastSegment !== 'article' &&
    lastSegment !== 'article-detail';

const identifier = articleIdParam || (isSlug ? lastSegment : null);

// ============================================
// ÉTAT GLOBAL
// ============================================
let currentArticleId    = null;
let userReactions       = {};
let reactionDebounceTimer = null;

// ============================================
// ÉLÉMENTS DOM
// ============================================
const loadingState   = document.getElementById('loadingState');
const articleContainer = document.getElementById('articleContainer');
const errorState     = document.getElementById('errorState');
const themeToggle    = document.getElementById('themeToggle');

// ============================================
// INITIALISATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    loadUserReactions();
    initUserToken();
    initReadingProgress();
    initBackToTop();
    setupGlobalListeners();

    if (!identifier) { showError(); return; }

    isSlug
        ? loadArticleBySlug(identifier)
        : loadArticleById(identifier);
});

// ============================================
// LISTENERS GLOBAUX (formulaires, thème, nav)
// ============================================
function setupGlobalListeners() {
    themeToggle?.addEventListener('click', toggleTheme);

    document.getElementById('commentForm')?.addEventListener('submit', submitComment);
    document.getElementById('newsletterForm')?.addEventListener('submit', submitNewsletter);

    // Menu mobile
    const mobileToggle = document.getElementById('mobileMenuToggle');
    const navMenu      = document.getElementById('navMenu');

    mobileToggle?.addEventListener('click', () => {
        const open = navMenu.classList.toggle('active');
        mobileToggle.querySelector('i').className = open ? 'fas fa-times' : 'fas fa-bars';
    });

    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            navMenu?.classList.remove('active');
            mobileToggle?.querySelector('i')?.classList.replace('fa-times', 'fa-bars');
        });
    });

    document.addEventListener('click', (e) => {
        if (navMenu && mobileToggle &&
            !navMenu.contains(e.target) && !mobileToggle.contains(e.target)) {
            navMenu.classList.remove('active');
            const icon = mobileToggle.querySelector('i');
            if (icon) icon.className = 'fas fa-bars';
        }
    });
}

// Les listeners de réactions sont configurés APRÈS le chargement de l'article
// pour s'assurer que les boutons sont visibles dans le DOM.
function setupReactionListeners() {
    document.querySelectorAll('.reaction-btn').forEach(btn => {
        // Remplacer le nœud pour supprimer les anciens listeners
        const fresh = btn.cloneNode(true);
        btn.replaceWith(fresh);
        fresh.addEventListener('click', () => {
            clearTimeout(reactionDebounceTimer);
            reactionDebounceTimer = setTimeout(() => handleReaction(fresh), 300);
        });
    });
}

// ============================================
// TOKEN UTILISATEUR (anonymat local)
// ============================================
function initUserToken() {
    if (!localStorage.getItem('userToken')) {
        localStorage.setItem('userToken', `user_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`);
    }
}

// ============================================
// CHARGEMENT PAR SLUG
// ============================================
async function loadArticleBySlug(slug) {
    try {
        const q   = query(collection(db, 'articles'), where('slug', '==', slug), limit(1));
        const snap = await getDocs(q);

        if (snap.empty) { showError(); return; }

        const docSnap = snap.docs[0];
        currentArticleId = docSnap.id;
        await incrementViews(docSnap.id);
        await renderArticle(docSnap.id, docSnap.data());
    } catch (err) {
        console.error('Erreur loadArticleBySlug:', err);
        showError();
    }
}

// ============================================
// CHARGEMENT PAR ID
// ============================================
async function loadArticleById(id) {
    try {
        currentArticleId = id;
        const docRef  = doc(db, 'articles', id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) { showError(); return; }

        await incrementViews(id);
        await renderArticle(id, docSnap.data());
    } catch (err) {
        console.error('Erreur loadArticleById:', err);
        showError();
    }
}

async function incrementViews(id) {
    try {
        await updateDoc(doc(db, 'articles', id), { views: increment(1) });
    } catch (e) {
        console.warn('Vues non incrémentées:', e);
    }
}

// ============================================
// RENDU COMPLET DE L'ARTICLE
// ============================================
async function renderArticle(id, article) {
    displayArticle(article);

    await Promise.all([
        loadReactions(id),
        loadComments(id),
        loadRelatedArticles(article.category)
    ]);

    loadingState.classList.add('hidden');
    articleContainer.classList.remove('hidden');

    setupReactionListeners();
    updatePageMeta(article);
}

// ============================================
// AFFICHAGE DES DONNÉES DANS LE DOM
// ============================================
function displayArticle(article) {
    // Titre
    document.getElementById('articleTitle').textContent = article.title || 'Sans titre';

    // Badge catégorie
    const badge = document.getElementById('categoryBadge');
    badge.textContent = article.category || 'GÉNÉRAL';
    badge.className   = `article-category-badge category-${getCategoryClass(article.category)}`;

    // Date
    document.getElementById('articleDate').textContent = article.createdAt
        ? article.createdAt.toDate().toLocaleDateString('fr-FR', {
            year: 'numeric', month: 'long', day: 'numeric'
          })
        : 'Date inconnue';

    // Auteur
    const authorName = article.author?.name || article.author?.email || 'Auteur inconnu';
    document.getElementById('authorName').textContent = authorName;

    const avatarEl = document.getElementById('authorAvatar');
    avatarEl.src = article.author?.photoURL ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=1e40af&color=fff`;

    // Stats
    document.getElementById('readingTime').textContent =
        `${calculateReadingTime(article.content)} min de lecture`;
    document.getElementById('viewsCount').textContent =
        (article.views || 0).toLocaleString();

    // Image héro
    const heroImg = document.getElementById('articleImage');
    if (article.imageUrl) {
        heroImg.src = article.imageUrl;
        heroImg.alt = article.title;
    } else {
        heroImg.parentElement.style.display = 'none';
    }

    // Contenu HTML
    const contentEl = document.getElementById('articleContent');
    contentEl.innerHTML = article.content || '<p>Contenu non disponible</p>';
    processMedia(contentEl);

    // Tags
    const tagsEl = document.getElementById('tagsContainer');
    tagsEl.innerHTML = (article.tags?.length)
        ? article.tags.map(tag => `<span class="tag">#${escapeHtml(tag)}</span>`).join('')
        : '';

    // Boutons de partage
    setupShareButtons(article);
}

// ============================================
// BOUTONS DE PARTAGE
// ============================================
function setupShareButtons(article) {
    const url   = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(article.title || 'Article');

    const twitterBtn  = document.getElementById('twitterShare');
    const linkedinBtn = document.getElementById('linkedinShare');
    const whatsappBtn = document.getElementById('whatsappShare');

    if (twitterBtn)  twitterBtn.href  = `https://twitter.com/intent/tweet?url=${url}&text=${title}`;
    if (linkedinBtn) linkedinBtn.href = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
    if (whatsappBtn) whatsappBtn.href = `https://wa.me/?text=${title}%20${url}`;
}

// ============================================
// TRAITEMENT DES MÉDIAS (YouTube, images, Pinterest)
// ============================================
function processMedia(container) {
    convertYouTubeTextUrls(container);
    processImages(container);
    processPinterest(container);

    // Traiter les iframes YouTube existantes
    container.querySelectorAll('iframe').forEach(iframe => {
        const src = iframe.getAttribute('src') || '';
        if (!src.includes('youtube.com') && !src.includes('youtu.be')) return;

        const videoId = extractYouTubeId(src);
        if (!videoId) return;

        const embedUrl = buildYouTubeEmbedUrl(videoId);
        iframe.setAttribute('src', embedUrl);
        iframe.setAttribute('allow',
            'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
        iframe.setAttribute('allowfullscreen', '');
        iframe.setAttribute('frameborder', '0');

        if (!iframe.parentElement.classList.contains('video-wrapper')) {
            wrapInVideoContainer(iframe);
        }
    });

    // Convertir les liens YouTube en embeds
    container.querySelectorAll('a').forEach(link => {
        const href    = link.getAttribute('href') || '';
        const videoId = extractYouTubeId(href);
        if (!videoId) return;

        const wrapper = createVideoWrapper(videoId);
        link.replaceWith(wrapper);
    });
}

function convertYouTubeTextUrls(container) {
    const youtubeRegex =
        /https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[?&][^\s]*)?/g;

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) {
        const tag = node.parentElement.tagName;
        if (tag !== 'SCRIPT' && tag !== 'STYLE' && tag !== 'IFRAME') {
            textNodes.push(node);
        }
    }

    textNodes.forEach(textNode => {
        const text    = textNode.textContent;
        const matches = [...text.matchAll(youtubeRegex)];
        if (!matches.length) return;

        const fragment = document.createDocumentFragment();
        let lastIndex  = 0;

        matches.forEach(match => {
            if (match.index > lastIndex) {
                fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
            }
            const videoId = extractYouTubeId(match[0]);
            if (videoId) fragment.appendChild(createVideoWrapper(videoId));
            lastIndex = match.index + match[0].length;
        });

        if (lastIndex < text.length) {
            fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
        }
        textNode.replaceWith(fragment);
    });
}

function extractYouTubeId(url) {
    let m;
    if ((m = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/))) return m[1];
    if ((m = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/))) return m[1];
    if ((m = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/))) return m[1];
    return null;
}

function buildYouTubeEmbedUrl(videoId) {
    const url = new URL(`https://www.youtube.com/embed/${videoId}`);
    url.searchParams.set('enablejsapi', '1');
    url.searchParams.set('origin', window.location.origin);
    return url.toString();
}

function createVideoWrapper(videoId) {
    const wrapper = document.createElement('div');
    wrapper.className = 'video-wrapper';

    const iframe = document.createElement('iframe');
    iframe.src   = buildYouTubeEmbedUrl(videoId);
    iframe.setAttribute('allow',
        'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('frameborder', '0');

    wrapper.appendChild(iframe);
    return wrapper;
}

function wrapInVideoContainer(iframe) {
    const wrapper = document.createElement('div');
    wrapper.className = 'video-wrapper';
    iframe.parentNode.insertBefore(wrapper, iframe);
    wrapper.appendChild(iframe);
}

function processImages(container) {
    container.querySelectorAll('img').forEach(img => {
        if (img.parentElement.tagName === 'FIGURE') return;

        const figure = document.createElement('figure');
        img.parentNode.insertBefore(figure, img);
        figure.appendChild(img);
    });
}

function processPinterest(container) {
    container.querySelectorAll('iframe[src*="pinterest.com"]').forEach(iframe => {
        if (iframe.parentElement.classList.contains('pinterest-iframe-wrapper')) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'pinterest-iframe-wrapper';
        iframe.parentNode.insertBefore(wrapper, iframe);
        wrapper.appendChild(iframe);
    });

    if (window.PinUtils?.build) window.PinUtils.build();
}

// ============================================
// RÉACTIONS
// ============================================
async function loadReactions(articleId) {
    try {
        const snap = await getDoc(doc(db, 'reactions', articleId));
        if (!snap.exists()) return;

        const data = snap.data();
        document.getElementById('likeCount').textContent    = data.like    || 0;
        document.getElementById('loveCount').textContent    = data.love    || 0;
        document.getElementById('insightCount').textContent = data.insight || 0;
        document.getElementById('supportCount').textContent = data.support || 0;

        updateReactionButtons(articleId);
    } catch (e) {
        console.error('Erreur réactions:', e);
    }
}

function updateReactionButtons(articleId) {
    const userReaction = userReactions[articleId];
    document.querySelectorAll('.reaction-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.reaction === userReaction);
    });
}

async function handleReaction(btn) {
    if (!currentArticleId) return;

    const reaction      = btn.dataset.reaction;
    const previous      = userReactions[currentArticleId];
    const reactionsRef  = doc(db, 'reactions', currentArticleId);

    try {
        const snap = await getDoc(reactionsRef);
        const updates = {};

        if (previous === reaction) {
            updates[reaction] = increment(-1);
            delete userReactions[currentArticleId];
        } else {
            updates[reaction] = increment(1);
            if (previous) updates[previous] = increment(-1);
            userReactions[currentArticleId] = reaction;
        }

        if (snap.exists()) {
            await updateDoc(reactionsRef, updates);
        } else {
            const base = { like: 0, love: 0, insight: 0, support: 0 };
            if (!previous) base[reaction] = 1;
            await setDoc(reactionsRef, base);
        }

        saveUserReactions();
        await loadReactions(currentArticleId);

        // Micro-animation de feedback
        btn.style.transform = 'scale(1.2)';
        setTimeout(() => { btn.style.transform = ''; }, 200);

    } catch (e) {
        console.error('Erreur handleReaction:', e);
        showNotification("Erreur lors de l'enregistrement", 'error');
        // Restaurer l'état précédent
        if (previous) {
            userReactions[currentArticleId] = previous;
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
        const snap = await getDocs(
            query(collection(db, 'comments'),
                where('articleId', '==', articleId),
                orderBy('createdAt', 'desc'))
        );

        const listEl  = document.getElementById('commentsList');
        const countEl = document.getElementById('commentsCount');
        countEl.textContent = snap.size;

        if (snap.empty) {
            listEl.innerHTML =
                '<p class="empty-text">Aucun commentaire pour le moment. Soyez le premier !</p>';
            return;
        }

        listEl.innerHTML = '';
        snap.forEach(d => listEl.appendChild(createCommentEl(d.data())));
    } catch (e) {
        console.error('Erreur commentaires:', e);
        document.getElementById('commentsList').innerHTML =
            '<p class="empty-text">Erreur de chargement des commentaires</p>';
    }
}

function createCommentEl(comment) {
    const div  = document.createElement('div');
    div.className = 'comment-item';

    const date = comment.createdAt
        ? comment.createdAt.toDate().toLocaleDateString('fr-FR', {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
          })
        : 'Date inconnue';

    const name = escapeHtml(comment.authorName || 'Anonyme');
    div.innerHTML = `
        <div class="comment-header">
            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(comment.authorName || 'A')}&background=1e40af&color=fff"
                 alt="${name}" class="comment-avatar">
            <div class="comment-author-info">
                <span class="comment-author">${name}</span>
                <span class="comment-date">${date}</span>
            </div>
        </div>
        <p class="comment-text">${escapeHtml(comment.text)}</p>
    `;
    return div;
}

async function submitComment(e) {
    e.preventDefault();

    const name  = document.getElementById('commentName').value.trim();
    const email = document.getElementById('commentEmail').value.trim();
    const text  = document.getElementById('commentText').value.trim();

    if (!name || !email || !text) {
        showNotification('Veuillez remplir tous les champs', 'error');
        return;
    }

    try {
        await addDoc(collection(db, 'comments'), {
            articleId:   currentArticleId,
            authorName:  name,
            authorEmail: email,
            text,
            createdAt: serverTimestamp()
        });

        document.getElementById('commentForm').reset();
        showNotification('Commentaire ajouté avec succès !', 'success');
        await loadComments(currentArticleId);
    } catch {
        showNotification("Erreur lors de l'ajout du commentaire", 'error');
    }
}

// ============================================
// ARTICLES CONNEXES
// ============================================
async function loadRelatedArticles(category) {
    try {
        const snap = await getDocs(
            query(collection(db, 'articles'),
                where('category', '==', category),
                orderBy('createdAt', 'desc'),
                limit(4))
        );

        const container = document.getElementById('relatedArticles');

        // Filtrer l'article courant
        const others = snap.docs.filter(d => d.id !== currentArticleId);
        if (!others.length) {
            container.closest('.related-widget')?.remove();
            return;
        }

        container.innerHTML = '';
        others.forEach(d => container.appendChild(createRelatedCard(d.id, d.data())));
    } catch (e) {
        console.error('Erreur articles connexes:', e);
    }
}

function createRelatedCard(id, article) {
    const div  = document.createElement('div');
    div.className = 'related-article-item';

    const slug = article.slug || id;
    const date = article.createdAt
        ? article.createdAt.toDate().toLocaleDateString('fr-FR', {
            year: 'numeric', month: 'short', day: 'numeric'
          })
        : '';

    div.innerHTML = `
        <a href="/article/${slug}" class="related-article-link">
            ${article.imageUrl
                ? `<img src="${escapeHtml(article.imageUrl)}"
                        alt="${escapeHtml(article.title)}"
                        class="related-article-image">`
                : ''}
            <div class="related-article-content">
                <span class="related-article-category">${escapeHtml(article.category)}</span>
                <h4 class="related-article-title">${escapeHtml(article.title)}</h4>
                ${date ? `<span class="related-article-date"><i class="fas fa-calendar"></i> ${date}</span>` : ''}
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
    const email = document.getElementById('newsletterEmail').value.trim().toLowerCase();
    if (!email) return;

    try {
        const existing = await getDocs(
            query(collection(db, 'newsletter'), where('email', '==', email))
        );
        if (!existing.empty) {
            showNotification('Cet email est déjà inscrit !', 'info');
            closeNewsletterModal();
            return;
        }
        await addDoc(collection(db, 'newsletter'), {
            email, subscribedAt: serverTimestamp(), source: 'article_page'
        });
        document.getElementById('newsletterEmail').value = '';
        showNotification('Merci pour votre inscription !', 'success');
        closeNewsletterModal();
    } catch {
        showNotification("Erreur lors de l'inscription", 'error');
    }
}

function closeNewsletterModal() {
    document.getElementById('newsletterModal')?.classList.add('hidden');
}

// ============================================
// PARTAGE — COPIE DU LIEN
// ============================================
function copyLink() {
    const url = window.location.href;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(url)
            .then(() => showNotification('Lien copié !', 'success'))
            .catch(() => fallbackCopy(url));
    } else {
        fallbackCopy(url);
    }
}

function fallbackCopy(url) {
    const input = Object.assign(document.createElement('input'), { value: url });
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    input.remove();
    showNotification('Lien copié !', 'success');
}

// ============================================
// THÈME CLAIR / SOMBRE
// ============================================
function toggleTheme() {
    const html     = document.documentElement;
    const isDark   = html.getAttribute('data-theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
}

function loadTheme() {
    const saved = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcon(saved);
}

function updateThemeIcon(theme) {
    const icon = themeToggle?.querySelector('i');
    if (!icon) return;
    icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

// ============================================
// MÉTADONNÉES & SEO
// ============================================
function updatePageMeta(article) {
    document.title = `${article.title} | ElectroInfo`;

    setMeta('description', article.summary || article.title);
    setMeta('og:title',       article.title);
    setMeta('og:description', article.summary || article.title);
    setMeta('og:url',         window.location.href);
    setMeta('twitter:title',       article.title);
    setMeta('twitter:description', article.summary || article.title);

    if (article.imageUrl) {
        setMeta('og:image',      article.imageUrl);
        setMeta('twitter:image', article.imageUrl);
    }

    injectStructuredData(article);
}

function setMeta(key, value) {
    let el = document.querySelector(`meta[property="${key}"], meta[name="${key}"]`);
    if (!el) {
        el = document.createElement('meta');
        const attr = key.startsWith('og:') || key.startsWith('twitter:') ? 'property' : 'name';
        el.setAttribute(attr, key);
        document.head.appendChild(el);
    }
    el.setAttribute('content', value);
}

function injectStructuredData(article) {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify({
        "@context":  "https://schema.org",
        "@type":     "Article",
        headline:    article.title,
        description: article.summary || article.title,
        image:       article.imageUrl || "https://electroinfo.online/images/logo.png",
        datePublished: article.createdAt
            ? article.createdAt.toDate().toISOString()
            : new Date().toISOString(),
        author: {
            "@type": "Person",
            name: article.author?.name || article.author?.email || "ElectroInfo"
        },
        publisher: {
            "@type": "Organization",
            name:    "ElectroInfo",
            logo:    { "@type": "ImageObject", url: "https://electroinfo.online/images/logo.png" }
        },
        mainEntityOfPage: { "@type": "WebPage", "@id": window.location.href }
    });
    document.head.appendChild(script);
}

// ============================================
// ÉTAT D'ERREUR
// ============================================
function showError() {
    loadingState?.classList.add('hidden');
    articleContainer?.classList.add('hidden');
    errorState?.classList.remove('hidden');
}

// ============================================
// BARRE DE PROGRESSION DE LECTURE
// ============================================
function initReadingProgress() {
    const bar = document.createElement('div');
    bar.id = 'readingProgress';
    Object.assign(bar.style, {
        position:   'fixed',
        top:        '64px',
        left:       '0',
        width:      '0%',
        height:     '3px',
        background: 'linear-gradient(90deg, #eab308, #1e40af)',
        zIndex:     '1000',
        transition: 'width 0.1s ease-out'
    });
    document.body.appendChild(bar);

    window.addEventListener('scroll', () => {
        const { scrollTop, scrollHeight, clientHeight } =
            document.documentElement;
        const pct = (scrollTop / (scrollHeight - clientHeight)) * 100;
        bar.style.width = `${Math.min(pct, 100)}%`;
    }, { passive: true });
}

// ============================================
// BOUTON "RETOUR EN HAUT"
// ============================================
function initBackToTop() {
    const btn = document.createElement('button');
    btn.id = 'backToTop';
    btn.innerHTML = '<i class="fas fa-arrow-up" aria-hidden="true"></i>';
    btn.setAttribute('aria-label', 'Retour en haut');
    Object.assign(btn.style, {
        position:  'fixed',
        bottom:    '5rem',
        right:     '2rem',
        width:     '3rem',
        height:    '3rem',
        borderRadius: '50%',
        background:   '#1e40af',
        color:        'white',
        border:       'none',
        cursor:       'pointer',
        boxShadow:    '0 4px 12px rgba(0,0,0,0.15)',
        zIndex:       '998',
        fontSize:     '1.25rem',
        transition:   'all 0.3s',
        opacity:      '0',
        visibility:   'hidden',
        transform:    'scale(0.8)'
    });
    document.body.appendChild(btn);

    window.addEventListener('scroll', () => {
        const visible = window.scrollY > 300;
        btn.style.opacity    = visible ? '1' : '0';
        btn.style.visibility = visible ? 'visible' : 'hidden';
        btn.style.transform  = visible ? 'scale(1)' : 'scale(0.8)';
    }, { passive: true });

    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

    btn.addEventListener('mouseenter', () => {
        btn.style.transform       = 'scale(1.1)';
        btn.style.backgroundColor = '#1e3a8a';
    });
    btn.addEventListener('mouseleave', () => {
        btn.style.transform       = 'scale(1)';
        btn.style.backgroundColor = '#1e40af';
    });
}

// ============================================
// UTILITAIRES
// ============================================
function getCategoryClass(category) {
    return { INNOVATION: 'blue', 'SÉCURITÉ': 'red', 'NOUVEAUTÉ': 'green',
             TUTO: 'orange', DOMOTIQUE: 'purple' }[category] || 'blue';
}

function calculateReadingTime(content) {
    if (!content) return 1;
    return Math.max(1, Math.ceil(content.split(/\s+/).length / 200));
}

function escapeHtml(text) {
    if (!text) return '';
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
}

function saveUserReactions() {
    try { localStorage.setItem('userReactions', JSON.stringify(userReactions)); } catch {}
}

function loadUserReactions() {
    try { userReactions = JSON.parse(localStorage.getItem('userReactions') || '{}'); } catch {
        userReactions = {};
    }
}

function showNotification(message, type = 'info') {
    const icons = { success: 'check-circle', error: 'exclamation-circle', info: 'info-circle' };
    const el = document.createElement('div');
    el.className = `notification ${type}`;
    el.setAttribute('role', 'alert');
    el.innerHTML = `<i class="fas fa-${icons[type]}"></i><span>${escapeHtml(message)}</span>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
        el.classList.remove('show');
        setTimeout(() => el.remove(), 300);
    }, 3000);
}

// ============================================
// EXPORTS GLOBAUX (appelés depuis le HTML)
// ============================================
window.copyLink              = copyLink;
window.closeNewsletterModal  = closeNewsletterModal;
