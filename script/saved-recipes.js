import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, getDocs, query, orderBy, doc, getDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

import {setupAuthListeners} from './auth.js'
import { loadHeader, setActiveNavLink, loadAuthModal } from './utils.js';


// UI Elements
const savedRecipesContainer = document.querySelector('.feature-content-area');

// Modal UI Elements
const modalOverlay = document.getElementById('recipe-modal-overlay');
const modalContent = document.querySelector('.recipe-modal-content');
const closeModalButton = document.querySelector('.modal-close-btn');



async function initializePage() {
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

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // User is signed in, fetch their pantry items
            console.log("User is signed in, fetching saved recipes");
            await fetchSavedRecipes(user.uid);
        } else {
            // User is signed out, show default common items
            console.log("User is signed out");
            savedRecipesContainer.innerHTML = `<p class="text-gray-500 text-center">Please sign in to view your saved recipes.</p>`;
        }
    });
}






async function fetchSavedRecipes(userId) {
    savedRecipesContainer.innerHTML = `<p class="text-gray-500 text-center">Loading your saved recipes...</p>`;
    try {
        const appId = "less-waste-more-taste";
        const savedRecipesRef = collection(db, `artifacts/${appId}/users/${userId}/savedRecipes`);
        
        // Create a query to order the recipes by the 'savedAt' field in descending order
        const q = query(savedRecipesRef, orderBy("savedAt", "desc"));
        const querySnapshot = await getDocs(q);

        const savedRecipes = [];
        querySnapshot.forEach((doc) => {
            savedRecipes.push(doc.data());
        });

        if (savedRecipes.length === 0) {
            savedRecipesContainer.innerHTML = `
                <p class="text-gray-500 text-center">You haven't saved any recipes yet!</p>
            `;
        } else {
            displaySavedRecipes(savedRecipes);
        }

    } catch (e) {
        console.error("Error fetching saved recipes:", e);
        savedRecipesContainer.innerHTML = `<p class="text-red-500 text-center">Failed to load saved recipes. Please try again.</p>`;
    }
}


function displaySavedRecipes(recipes) {
    savedRecipesContainer.innerHTML = ''; // Clear loading message
    
    // Create a grid container
    const recipeGrid = document.createElement('div');
    recipeGrid.className = 'recipe-card-grid';
    savedRecipesContainer.appendChild(recipeGrid);

    recipes.forEach(recipe => {
        const cardHtml = createRecipeCard(recipe);
        recipeGrid.insertAdjacentHTML('beforeend', cardHtml);
    });
}

// Function to create a recipe card from the saved recipe data
function createRecipeCard(recipe) {
    return `
        <div class="feature-card recipe-card" data-recipe-id="${recipe.id}">
            <img src="${recipe.image}" alt="${recipe.title}" class="recipe-card-image">
            <div class="recipe-card-content">
                <h3 class="recipe-title">${recipe.title}</h3>
                <div class="recipe-meta">
                    <span class="flex items-center gap-1"><i class="fa-regular fa-clock icon"></i> ${recipe.readyInMinutes || '?'} mins</span>
                    <span class="flex items-center gap-1"><i class="fa-regular fa-user icon"></i> ${recipe.servings || '?'} servings</span>
                </div>
            </div>
            <div class="recipe-card-actions mt-auto">
                <button class="view-recipe-button">View Details</button>
                <button class="save-recipe-button" data-recipe-id="${recipe.id}"><i class="fa-solid fa-bookmark"></i></button>
            </div>
        </div>
    `;
}

// Event listener for opening the modal
savedRecipesContainer.addEventListener('click', async (event) => {
    const saveButton = event.target.closest('.save-recipe-button');
    if (saveButton) {
        const recipeId = saveButton.dataset.recipeId;
        await unsaveRecipe(recipeId, saveButton);
    } else {
        const card = event.target.closest('.recipe-card');
        if (card) {
            const recipeId = card.dataset.recipeId;
            await showRecipeModal(recipeId);
        }
    }
});

async function showRecipeModal(recipeId) {
    modalOverlay.classList.remove('hidden');
    modalContent.innerHTML = `<p class="text-center text-gray-500">Loading recipe details...</p>`;

    try {
        const appId = "less-waste-more-taste";
        const user = auth.currentUser;
        if (!user) {
            modalContent.innerHTML = `<p class="text-red-500">Please sign in to view recipe details.</p>`;
            return;
        }

        const recipeDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/savedRecipes`, String(recipeId));
        const docSnap = await getDoc(recipeDocRef);

        if (docSnap.exists()) {
            const detailedRecipe = docSnap.data();
            renderModalContent(detailedRecipe);
        } else {
            modalContent.innerHTML = `<p class="text-gray-500">Recipe details not found.</p>`;
        }
    } catch (error) {
        console.error('Error fetching recipe details:', error);
        modalContent.innerHTML = `<p class="text-red-500">Failed to load recipe details. Please try again.</p>`;
    }
}

function renderModalContent(recipe) {
    const safeInstructions = recipe.instructions || 'No instructions provided.';
    const ingredientsList = (recipe.extendedIngredients || []).map(ingredient => `<li>${ingredient.original}</li>`).join('');

    const recipeHtml = `
        <h1 class="recipe-title">${recipe.title}</h1>
        <div class="recipe-modal-image-container">
            <img src="${recipe.image}" alt="${recipe.title}" class="recipe-image">
            <button class="save-recipe-button recipe-modal-save-btn" data-recipe-id="${recipe.id}"><i class="fa-solid fa-bookmark"></i></button>
        </div>
        <div class="recipe-meta">
            <span class="flex items-center"><i class="fa-regular fa-clock mr-2"></i> ${recipe.readyInMinutes || '?'} mins</span>
            <span class="flex items-center"><i class="fa-regular fa-user mr-2"></i> ${recipe.servings || '?'} Servings</span>
        </div>
        <div class="recipe-content-layout">
            <div>
                <h2 class="recipe-section-title">Ingredients</h2>
                <ul class="recipe-list">
                    ${ingredientsList}
                </ul>
            </div>
            <div>
                <h2 class="recipe-section-title">Instructions</h2>
                <p class="text-gray-700 whitespace-pre-wrap">${safeInstructions}</p>
            </div>
        </div>
    `;
    modalContent.innerHTML = recipeHtml;
}

// Event listener for modal close button
closeModalButton.addEventListener('click', () => {
    modalOverlay.classList.add('hidden');
});

// Event listener to close modal when clicking outside of it
modalOverlay.addEventListener('click', (event) => {
    if (event.target === modalOverlay) {
        modalOverlay.classList.add('hidden');
    }
});


// Function to handle unsaving a recipe
async function unsaveRecipe(recipeId, elementToUpdate) {
    const user = auth.currentUser;
    if (!user) {
        alert("Please sign in to manage your saved recipes!");
        return;
    }

    try {
        const appId = "less-waste-more-taste";
        const recipeDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/savedRecipes`, String(recipeId));
        await deleteDoc(recipeDocRef);

        // Update the UI after a successful un-save
        alert("Recipe unsaved successfully!");
        console.log("Recipe removed from saved list.");
        
        // Remove the card from the UI
        const cardToRemove = elementToUpdate.closest('.recipe-card');
        if (cardToRemove) {
            cardToRemove.remove();
        }

        // Check if there are any remaining recipes and update the message
        if (savedRecipesContainer.children.length === 0) {
            savedRecipesContainer.innerHTML = `<p class="text-gray-500 text-center">You haven't saved any recipes yet!</p>`;
        }
    } catch (e) {
        console.error("Error removing recipe: ", e);
        alert("Failed to unsave the recipe. Please try again.");
    }
}

// Event listener for the modal's bookmark button
modalContent.addEventListener('click', async (event) => {
    const saveButton = event.target.closest('.save-recipe-button');
    if (saveButton) {
        const recipeId = saveButton.dataset.recipeId;
        await unsaveRecipe(recipeId, saveButton);
        modalOverlay.classList.add('hidden'); // Close the modal after unsaving
    }
});

initializePage();