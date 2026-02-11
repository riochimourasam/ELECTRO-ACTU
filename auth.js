// auth.js - Gestion de l'authentification AMÉLIORÉE
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, sendPasswordResetEmail, updateProfile, setPersistence, browserLocalPersistence, browserSessionPersistence } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

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
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

console.log('=== FIREBASE INITIALISÉ ===');
console.log('Auth:', auth);
console.log('Firestore:', db);
console.log('Project ID:', firebaseConfig.projectId);

// Redirection si déjà connecté
auth.onAuthStateChanged(user => {
    if (user) {
        console.log('>>> Utilisateur déjà connecté:', user.uid);
        const redirect = new URLSearchParams(window.location.search).get('redirect') || 'index.html';
        window.location.href = redirect;
    } else {
        console.log('>>> Aucun utilisateur connecté');
    }
});

// Gestion des onglets
document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        console.log('>>> Changement onglet:', tabName);

        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
        document.getElementById(`${tabName}Tab`).classList.add('active');
    });
});

// CONNEXION
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const rememberMe = document.getElementById('rememberMe').checked;

    console.log('>>> Tentative connexion:', email);

    try {
        const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
        await setPersistence(auth, persistence);
        console.log('>>> Persistence:', rememberMe ? 'Local' : 'Session');

        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log('>>> Connexion réussie! UID:', userCredential.user.uid);
        
        showNotification('Connexion réussie !', 'success');
    } catch (error) {
        console.error('!!! ERREUR Connexion:', error);
        console.error('Code:', error.code);
        console.error('Message:', error.message);
        
        let message = 'Erreur de connexion';

        if (error.code === 'auth/user-not-found') {
            message = 'Aucun compte trouvé avec cet email';
        } else if (error.code === 'auth/wrong-password') {
            message = 'Mot de passe incorrect';
        } else if (error.code === 'auth/invalid-email') {
            message = 'Email invalide';
        } else if (error.code === 'auth/invalid-credential') {
            message = 'Email ou mot de passe incorrect';
        }

        showNotification(message, 'error');
    }
});

// INSCRIPTION - VERSION AMÉLIORÉE
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    console.log('====================================');
    console.log('=== DÉBUT INSCRIPTION (AMÉLIORÉ) ===');
    console.log('====================================');
    console.log('Email:', email);
    console.log('Nom:', name);
    console.log('Timestamp:', new Date().toISOString());

    // Validation
    if (password !== confirmPassword) {
        console.log('!!! Mots de passe différents');
        showNotification('Les mots de passe ne correspondent pas', 'error');
        return;
    }

    if (password.length < 6) {
        console.log('!!! Mot de passe trop court');
        showNotification('Le mot de passe doit contenir au moins 6 caractères', 'error');
        return;
    }

    try {
        // ÉTAPE 1 : Créer compte Auth
        console.log('>>> ÉTAPE 1/5: Création compte Firebase Auth...');
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        console.log('✅ Compte Auth créé avec succès !');
        console.log('    UID:', user.uid);
        console.log('    Email:', user.email);
        console.log('    EmailVerified:', user.emailVerified);

        // ÉTAPE 2 : Update profil
        console.log('>>> ÉTAPE 2/5: Mise à jour profil...');
        await updateProfile(user, {
            displayName: name
        });
        console.log('✅ Profil mis à jour:', name);

        // ÉTAPE 3 : Préparer données Firestore
        console.log('>>> ÉTAPE 3/5: Préparation données Firestore...');
        
        const userData = {
            name: name,
            email: email,
            role: 'user',
            photoURL: null,
            createdAt: serverTimestamp()
        };
        
        console.log('>>> Données à enregistrer:', {
            ...userData,
            createdAt: '[serverTimestamp]'
        });
        
        // ÉTAPE 4 : Créer document Firestore
        console.log('>>> ÉTAPE 4/5: Création document Firestore...');
        const userDocRef = doc(db, 'users', user.uid);
        console.log('>>> Chemin du document:', `users/${user.uid}`);
        console.log('>>> Référence complète:', userDocRef.path);
        
        try {
            await setDoc(userDocRef, userData);
            console.log('✅ setDoc() exécuté sans erreur');
        } catch (firestoreError) {
            console.error('❌ ERREUR FIRESTORE setDoc():', firestoreError);
            console.error('    Code:', firestoreError.code);
            console.error('    Message:', firestoreError.message);
            
            // Afficher l'erreur spécifique
            if (firestoreError.code === 'permission-denied') {
                console.error('❌ PROBLÈME DE PERMISSIONS FIRESTORE !');
                console.error('    -> Vérifiez les règles Firestore dans la console Firebase');
                console.error('    -> Le document ne sera PAS créé tant que les règles ne sont pas corrigées');
                throw new Error('ERREUR PERMISSIONS: Vérifiez les règles Firestore dans la console Firebase');
            }
            throw firestoreError;
        }

        // ÉTAPE 5 : Vérification
        console.log('>>> ÉTAPE 5/5: Vérification...');
        
        // Attendre un peu pour que Firestore traite l'écriture
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        try {
            const verifyDoc = await getDoc(userDocRef);
            
            if (verifyDoc.exists()) {
                console.log('✅✅✅ SUCCÈS TOTAL ✅✅✅');
                console.log('Document créé et vérifié:', verifyDoc.data());
                console.log('====================================');
                
                showNotification('Compte créé avec succès ! 🎉', 'success');
                
                console.log('>>> Redirection dans 1.5 secondes...');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1500);
                
            } else {
                console.error('❌ ERREUR CRITIQUE: Document non trouvé après création !');
                console.error('    Le compte Auth existe mais pas le document Firestore');
                console.error('    -> Vérifiez les règles Firestore');
                console.error('    -> Le document a peut-être été bloqué par les règles de sécurité');
                
                showNotification('Compte créé mais données incomplètes. Contactez le support.', 'error');
            }
        } catch (verifyError) {
            console.error('❌ Erreur lors de la vérification:', verifyError);
            showNotification('Compte créé mais vérification échouée', 'error');
        }

    } catch (error) {
        console.error('====================================');
        console.error('❌❌❌ ERREUR INSCRIPTION ❌❌❌');
        console.error('====================================');
        console.error('Type:', error.constructor.name);
        console.error('Code:', error.code);
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
        
        let message = 'Erreur lors de la création du compte';

        if (error.code === 'auth/email-already-in-use') {
            message = 'Cet email est déjà utilisé';
            console.log('>>> Email déjà existant dans Auth');
        } else if (error.code === 'auth/invalid-email') {
            message = 'Email invalide';
        } else if (error.code === 'auth/weak-password') {
            message = 'Mot de passe trop faible';
        } else if (error.code === 'permission-denied') {
            message = '⚠️ ERREUR DE PERMISSIONS FIRESTORE - Vérifiez les règles de sécurité dans la console Firebase';
            console.error('!!! PROBLÈME RÈGLES FIRESTORE !!!');
            console.error('!!! Allez dans Firebase Console > Firestore Database > Rules !!!');
        } else if (error.message.includes('ERREUR PERMISSIONS')) {
            message = error.message;
        } else {
            message = 'Erreur: ' + error.message;
        }

        showNotification(message, 'error');
    }
});

// CONNEXION GOOGLE
window.signInWithGoogle = async function() {
    console.log('>>> Tentative connexion Google...');
    
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        console.log('>>> Google OK! UID:', user.uid);
        console.log('    Nom:', user.displayName);
        console.log('    Email:', user.email);

        // Vérifier document
        console.log('>>> Vérification document Firestore...');
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
            console.log('>>> Nouveau user Google, création document...');
            
            const userData = {
                name: user.displayName,
                email: user.email,
                role: 'user',
                photoURL: user.photoURL,
                createdAt: serverTimestamp()
            };
            
            console.log('>>> Données:', userData);
            await setDoc(userDocRef, userData);
            console.log('>>> Document créé pour Google user');
        } else {
            console.log('>>> User Google existant trouvé');
        }

        showNotification('Connexion réussie !', 'success');
    } catch (error) {
        console.error('!!! Erreur Google:', error);
        console.error('Code:', error.code);
        console.error('Message:', error.message);
        showNotification('Erreur lors de la connexion avec Google', 'error');
    }
};

// MOT DE PASSE OUBLIÉ
window.showForgotPassword = function() {
    console.log('>>> Ouverture modal mot de passe oublié');
    document.getElementById('forgotPasswordModal').classList.remove('hidden');
};

window.closeForgotPassword = function() {
    document.getElementById('forgotPasswordModal').classList.add('hidden');
    document.getElementById('forgotPasswordForm').reset();
};

document.getElementById('forgotPasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('resetEmail').value.trim();
    console.log('>>> Demande réinitialisation pour:', email);

    try {
        await sendPasswordResetEmail(auth, email);
        console.log('>>> Email envoyé');
        showNotification('Email de réinitialisation envoyé !', 'success');
        closeForgotPassword();
    } catch (error) {
        console.error('!!! Erreur:', error);
        let message = 'Erreur lors de l\'envoi de l\'email';

        if (error.code === 'auth/user-not-found') {
            message = 'Aucun compte trouvé avec cet email';
        } else if (error.code === 'auth/invalid-email') {
            message = 'Email invalide';
        }

        showNotification(message, 'error');
    }
});

// AFFICHER/MASQUER MOT DE PASSE
window.togglePassword = function(inputId, button) {
    const input = document.getElementById(inputId);
    const icon = button.querySelector('i');

    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
};

// FORCE DU MOT DE PASSE
document.getElementById('registerPassword')?.addEventListener('input', (e) => {
    const password = e.target.value;
    const strengthDiv = document.getElementById('passwordStrength');

    if (password.length === 0) {
        strengthDiv.innerHTML = '';
        return;
    }

    let strength = 0;

    if (password.length >= 8) strength++;
    if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++;
    if (password.match(/[0-9]/)) strength++;
    if (password.match(/[^a-zA-Z0-9]/)) strength++;

    let feedback = '';
    let className = '';

    switch (strength) {
        case 0:
        case 1:
            feedback = 'Faible';
            className = 'weak';
            break;
        case 2:
            feedback = 'Moyen';
            className = 'medium';
            break;
        case 3:
            feedback = 'Bon';
            className = 'good';
            break;
        case 4:
            feedback = 'Fort';
            className = 'strong';
            break;
    }

    strengthDiv.innerHTML = `Force : <span class="${className}">${feedback}</span>`;
});

// NOTIFICATIONS
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type} show`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${escapeHtml(message)}</span>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 5000); // Augmenté à 5 secondes pour les messages d'erreur
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

console.log('=== Script auth.js chargé et prêt ===');
console.log('=== Pour diagnostiquer : Ouvrez la Console (F12) lors de l\'inscription ===');
