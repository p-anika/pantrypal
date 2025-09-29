import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";


// UI elements passed in from other pages
let authStatusDiv, authModal, closeModalButton, authForm, authModalTitle, nameGroup, fullNameInput, authSubmitButton, switchFormText, pantryLink, chatLink, userMenuContainer, profileDisplay, userNameSpan, userMenu, signoutButton;

// State for form
let isSignInForm = true;


// Function that can initialize authorization logic on any page
export function setupAuthListeners(elements) {
    // assign the elements passed in from the calling page
    ({ authStatusDiv, authModal, closeModalButton, authForm, authModalTitle, nameGroup, fullNameInput, authSubmitButton, switchFormText, pantryLink, chatLink, userMenuContainer, profileDisplay, userNameSpan, userMenu, signoutButton } = elements);

    // When sign-in / sign-up button is click
    authStatusDiv.addEventListener('click', (e) => {
        // This checks if the clicked element is the sign-in button
        if (e.target && e.target.id === 'signin-button') {
            authModal.classList.remove('hidden');
        }
    });
    
    // When 'exit / X' button is clicked, close the modal
    closeModalButton.addEventListener('click', () => {
        authModal.classList.add('hidden');
    });
    
    // when any area outside the modal is clicked, close the modal
    window.addEventListener('click', (e) => {
        if (e.target === authModal) {
            authModal.classList.add('hidden');
        }
    });
    
    // when you try to sign-up instead of sign-in (or vice versa), change the form
    switchFormText.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'switch-form-link') {
            e.preventDefault();
            isSignInForm = !isSignInForm; // the form is changing, so change the variable value
            if (isSignInForm) {
                authModalTitle.textContent = 'Sign In';
                authSubmitButton.textContent = 'Sign In';
                switchFormText.innerHTML = `Don't have an account? <a href="#" id="switch-form-link">Sign Up</a>`;
                nameGroup.style.display = 'none';
                fullNameInput.required = false;
            } else {
                authModalTitle.textContent = 'Sign Up';
                authSubmitButton.textContent = 'Sign Up';
                switchFormText.innerHTML = `Already have an account? <a href="#" id="switch-form-link">Sign In</a>`;
                nameGroup.style.display = 'block';
                fullNameInput.required = true;
            }
        }
    });
    
    // when the submit button is clicked
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = authForm.email.value;
        const password = authForm.password.value;
        const fullName = authForm.fullName.value;
    
        try {
            if (isSignInForm) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
    
                // save the user's full name to firestore
                await setDoc(doc(db, "users", user.uid), {
                    fullName: fullName,
                    email: email
                });
            }
            authModal.classList.add('hidden');
        } catch (error) {
            console.error("Authentication error:", error.message);
            alert(`Error: ${error.message}`);
        }
    });
    
    // when the user toggles the user menu dropdown
    if (profileDisplay) {
        profileDisplay.addEventListener('click', (event) => {
            userMenu.classList.toggle('hidden');
            event.stopPropagation(); // Prevent the window click listener from closing it immediately
        });
    }
    
    // close the user menu dropdown if the user clicks anywhere else
    window.addEventListener('click', (e) => {
        if (!userMenu.contains(e.target) && !profileDisplay.contains(e.target)) {
            userMenu.classList.add('hidden');
        }
    });
    
    // when the authentication state is changed
    onAuthStateChanged(auth, async (user) => {
        authStatusDiv.innerHTML = '';
        if (user) {
            // User is signed in
            const userDocRef = doc(db, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);
            let displayName = user.email; // defualt to user email
    
            if (userDocSnap.exists()) {
                displayName = userDocSnap.data().fullName;
            }
    
            // show the profile icon and username. hide the sign-in button
            userMenuContainer.classList.remove('hidden');
            userNameSpan.textContent = displayName;
            const signInButton = document.getElementById('signin-button');
            if (signInButton) {
                signInButton.classList.add('hidden');
            }
    
            // add sign-out functionality
            signoutButton.addEventListener('click', async () => {
                try {
                    await signOut(auth);
                } catch (error) {
                    console.error("Sign out error:", error);
                }
            });
    
            // Enable navigation links
            pantryLink.classList.remove('disabled-link');
            chatLink.classList.remove('disabled-link');
        } else {
            // User is signed out
            userMenuContainer.classList.add('hidden');

            const signInUpButton = document.createElement('button');
            if (isSignInForm) {
                signInUpButton.textContent = 'Sign In';
            } else {
                signInUpButton.textContent = 'Sign Up';
            }
            
            signInUpButton.classList.add('profile-button');
            signInUpButton.id = 'signin-button';
    
            authStatusDiv.appendChild(signInUpButton);
    
            // Disable navigation links
            pantryLink.classList.add('disabled-link');
            chatLink.classList.add('disabled-link');
        }
    });
}


export function showSignUpForm() {
    authModal.classList.remove('hidden');
    isSignInForm = false;
    authModalTitle.textContent = 'Sign Up';
    authSubmitButton.textContent = 'Sign Up';
    switchFormText.innerHTML = `Already have an account? <a href="#" id="switch-form-link">Sign In</a>`;
    nameGroup.style.display = 'block';
    fullNameInput.required = true;
}