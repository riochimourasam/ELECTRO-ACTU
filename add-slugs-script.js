// ============================================
// SCRIPT : Ajouter des slugs à tous les articles
// À exécuter UNE FOIS dans la console de votre page admin
// ============================================

/**
 * Fonction pour générer un slug SEO-friendly
 */
function generateSlug(title) {
    return title
        .toLowerCase()                          // Minuscules
        .normalize('NFD')                       // Décomposer les accents
        .replace(/[\u0300-\u036f]/g, '')       // Supprimer les accents
        .replace(/[^a-z0-9\s-]/g, '')          // Garder lettres, chiffres, espaces, tirets
        .trim()                                 // Enlever espaces début/fin
        .replace(/\s+/g, '-')                  // Remplacer espaces par tirets
        .replace(/-+/g, '-')                   // Éviter tirets multiples
        .substring(0, 60);                     // Limiter à 60 caractères
}

/**
 * Script principal pour mettre à jour tous les articles
 * IMPORTANT : Assurez-vous d'avoir importé Firebase avant d'exécuter
 */
async function updateAllArticlesWithSlugs() {
    console.log('🚀 Début de la mise à jour des slugs...\n');
    
    try {
        // Récupérer tous les articles
        const articlesRef = collection(db, 'articles');
        const snapshot = await getDocs(articlesRef);
        
        console.log(`📊 ${snapshot.size} articles trouvés\n`);
        
        let updated = 0;
        let skipped = 0;
        let errors = 0;
        
        // Parcourir chaque article
        for (const docSnapshot of snapshot.docs) {
            const article = docSnapshot.data();
            const articleId = docSnapshot.id;
            
            try {
                // Si l'article a déjà un slug, on passe
                if (article.slug) {
                    console.log(`⏭️  [${articleId}] "${article.title}" a déjà un slug: ${article.slug}`);
                    skipped++;
                    continue;
                }
                
                // Générer un slug
                let slug = generateSlug(article.title);
                
                // Vérifier si le slug existe déjà
                const slugQuery = query(articlesRef, where('slug', '==', slug));
                const slugSnapshot = await getDocs(slugQuery);
                
                // Si le slug existe déjà pour un autre article
                if (!slugSnapshot.empty && slugSnapshot.docs[0].id !== articleId) {
                    // Ajouter un suffixe unique
                    const shortId = articleId.substring(0, 8);
                    slug = `${slug}-${shortId}`;
                    console.log(`⚠️  Slug existant, ajout d'un suffixe: ${slug}`);
                }
                
                // Mettre à jour l'article avec le slug
                await updateDoc(doc(db, 'articles', articleId), {
                    slug: slug
                });
                
                console.log(`✅ [${articleId}] "${article.title}"`);
                console.log(`   → Slug créé: ${slug}\n`);
                updated++;
                
            } catch (error) {
                console.error(`❌ Erreur pour l'article [${articleId}]:`, error);
                errors++;
            }
        }
        
        // Résumé final
        console.log('\n' + '='.repeat(60));
        console.log('🎉 MISE À JOUR TERMINÉE !');
        console.log('='.repeat(60));
        console.log(`✅ ${updated} articles mis à jour`);
        console.log(`⏭️  ${skipped} articles déjà à jour`);
        console.log(`❌ ${errors} erreurs`);
        console.log(`📊 Total: ${snapshot.size} articles`);
        console.log('='.repeat(60) + '\n');
        
        // Afficher quelques exemples de slugs créés
        if (updated > 0) {
            console.log('📋 Exemples de slugs créés :');
            const examplesQuery = query(articlesRef, limit(5));
            const examplesSnapshot = await getDocs(examplesQuery);
            examplesSnapshot.forEach(doc => {
                const article = doc.data();
                console.log(`   • ${article.title}`);
                console.log(`     → /article/${article.slug}\n`);
            });
        }
        
    } catch (error) {
        console.error('💥 Erreur fatale:', error);
    }
}

/**
 * Fonction pour vérifier les slugs existants
 */
async function verifyAllSlugs() {
    console.log('🔍 Vérification des slugs...\n');
    
    const articlesRef = collection(db, 'articles');
    const snapshot = await getDocs(articlesRef);
    
    let withSlug = 0;
    let withoutSlug = 0;
    const duplicates = {};
    
    // Parcourir tous les articles
    for (const docSnapshot of snapshot.docs) {
        const article = docSnapshot.data();
        
        if (article.slug) {
            withSlug++;
            
            // Vérifier les doublons
            if (duplicates[article.slug]) {
                duplicates[article.slug].push({
                    id: docSnapshot.id,
                    title: article.title
                });
            } else {
                duplicates[article.slug] = [{
                    id: docSnapshot.id,
                    title: article.title
                }];
            }
        } else {
            withoutSlug++;
            console.log(`⚠️  Pas de slug: [${docSnapshot.id}] "${article.title}"`);
        }
    }
    
    // Afficher les résultats
    console.log('\n' + '='.repeat(60));
    console.log('📊 RAPPORT DE VÉRIFICATION');
    console.log('='.repeat(60));
    console.log(`✅ Articles avec slug: ${withSlug}`);
    console.log(`❌ Articles sans slug: ${withoutSlug}`);
    console.log(`📊 Total: ${snapshot.size}`);
    
    // Vérifier les doublons
    const duplicatesList = Object.entries(duplicates).filter(([slug, articles]) => articles.length > 1);
    
    if (duplicatesList.length > 0) {
        console.log(`\n⚠️  ${duplicatesList.length} slugs en doublon détectés:\n`);
        duplicatesList.forEach(([slug, articles]) => {
            console.log(`   Slug: "${slug}"`);
            articles.forEach(article => {
                console.log(`      • [${article.id}] ${article.title}`);
            });
            console.log('');
        });
    } else {
        console.log('\n✅ Aucun doublon détecté');
    }
    
    console.log('='.repeat(60) + '\n');
}

// ============================================
// INSTRUCTIONS D'UTILISATION
// ============================================

console.log(`
╔════════════════════════════════════════════════════════════╗
║  SCRIPT DE GÉNÉRATION DE SLUGS                            ║
╚════════════════════════════════════════════════════════════╝

📋 ÉTAPES :

1️⃣  Ouvrez la console de votre page admin (F12)

2️⃣  Copiez-collez ce script COMPLET dans la console

3️⃣  Exécutez une des commandes suivantes :

    Pour vérifier l'état actuel :
    → verifyAllSlugs()

    Pour mettre à jour tous les articles :
    → updateAllArticlesWithSlugs()

⚠️  IMPORTANT :
   • Faites une sauvegarde de Firebase avant !
   • Ce script modifie tous les articles sans slug
   • Les articles avec slug existant sont ignorés

💡 ASTUCE :
   Après la mise à jour, vérifiez avec :
   → verifyAllSlugs()

════════════════════════════════════════════════════════════
`);

// ============================================
// FONCTION BONUS : Tester un slug
// ============================================

/**
 * Tester la génération d'un slug
 */
function testSlug(title) {
    const slug = generateSlug(title);
    console.log('\n🧪 Test de génération de slug');
    console.log('─'.repeat(60));
    console.log(`Titre : "${title}"`);
    console.log(`Slug  : "${slug}"`);
    console.log(`URL   : /article/${slug}`);
    console.log('─'.repeat(60) + '\n');
    return slug;
}

// Exemples de tests
console.log('📝 Exemples de slugs générés :\n');
testSlug("C'est quoi Matter?");
testSlug("Les véhicules électriques en 2025");
testSlug("Sécurité électrique : Guide complet NFC 15-100");
testSlug("Comment installer une borne de recharge à domicile ?");
