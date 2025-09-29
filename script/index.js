// This script handles the authentication UI and logic for the index.html page.
// It imports the necessary Firebase services from firebase-config.js.

import {setupAuthListeners, showSignUpForm} from './auth.js'
import { loadHeader, setActiveNavLink, loadAuthModal } from './utils.js';

await loadHeader();
setActiveNavLink();
await loadAuthModal();

// UI Elements
// Sign-in / sign-up elements
const authStatusDiv = document.getElementById('auth-status');
const authModal = document.getElementById('auth-modal');
const closeModalButton = document.querySelector('.close-modal');
const authForm = document.getElementById('auth-form');
const authModalTitle = document.getElementById('auth-modal-title');
const nameGroup = document.getElementById('name-group');
const fullNameInput = document.getElementById('fullName');
const authSubmitButton = document.getElementById('auth-submit-button');
const switchFormText = document.getElementById('switch-form-text');
const pantryLink = document.getElementById('pantry-link');
const chatLink = document.getElementById('chat-link');
const userMenuContainer = document.getElementById('user-menu-container');
const profileDisplay = document.getElementById('profile-display');
const userNameSpan = document.getElementById('user-name');
const userMenu = document.getElementById('user-menu');
const signoutButton = document.getElementById('signout-button');


// Call shared function to set up the auth listeners
setupAuthListeners({
    authStatusDiv,
    authModal,
    closeModalButton,
    authForm,
    authModalTitle,
    nameGroup,
    fullNameInput,
    authSubmitButton,
    switchFormText,
    pantryLink,
    chatLink,
    userMenuContainer,
    profileDisplay,
    userNameSpan,
    userMenu,
    signoutButton
});


// Other UI elements
const getStartedButton = document.querySelector('.get-started-button');

// Add functionality for "Get Started Now" button so it directs you to the sign-up form
getStartedButton.addEventListener('click', showSignUpForm);