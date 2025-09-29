import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, query, orderBy, getDocs, doc, setDoc, getDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

import {setupAuthListeners} from './auth.js'
import { loadHeader, setActiveNavLink, loadAuthModal } from './utils.js';



// Global array to store the list of selected ingredients
let selectedIngredients = [];
// Global variable to store the recipes retrieved from the API
let fetchedRecipes = [];
// Global variable to store detailed recipe info
let recipeDetailsCache = {};
// Global Set to store saved recipe IDs
let savedRecipeIds = new Set();

// API Configuration
const SPOONACULAR_API_KEY = "11180bbb178a463d87fc0b86998a04ce";
const SPOONACULAR_API_URL = "https://api.spoonacular.com/recipes/findByIngredients";


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

    // Check for saved recipes in localStorage
    const savedRecipes = localStorage.getItem('fetchedRecipes');
    const savedDetailsCache = localStorage.getItem('recipeDetailsCache');

    if (savedRecipes) {
        // Parse the JSON string back into a JavaScript array
        fetchedRecipes = JSON.parse(savedRecipes);
        // Display the recipes immediately without an API call
        const recipeCardsHtml = fetchedRecipes.map(recipe => createRecipeCard(recipe)).join('');
        recipeCardGrid.innerHTML = recipeCardsHtml;
        console.log("Recipes loaded from localStorage.");
    }

    if (savedDetailsCache) {
        // Parse the JSON string back into a JavaScript object
        recipeDetailsCache = JSON.parse(savedDetailsCache);
        console.log("Recipe details cache loaded from localStorage.");
    }

    // Listen for auth state changes to update the pantry items
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // User is signed in, fetch their pantry items
            console.log("User is signed in, fetching pantry items.");
            await fetchUserPantryItems(user.uid);
            await fetchSavedRecipeIds(user.uid);
            await updateSavedRecipeIcons(user.uid);
        } else {
            // User is signed out, show default common items
            console.log("User is signed out, showing default items.");
            recipeCardGrid.innerHTML = '';
            fetchedRecipes = [];
            recipeDetailsCache = {};
            savedRecipeIds.clear();
            localStorage.removeItem('fetchedRecipes');
            localStorage.removeItem('recipeDetailsCache');
            selectedIngredients = [];
            showDefaultItems();
        }
        // Render the ingredients after setting them up
        renderIngredients();
    });

    quickAddPillsContainer.addEventListener('click', (event) => {
        const clickedPill = event.target.closest('.quick-add-item');
        if (clickedPill) {
            const ingredient = clickedPill.dataset.ingredient;
            addIngredient(ingredient);
        }
    });
}



// other UI elements
const ingredientInput = document.querySelector('.ingredient-input');
const addButton = document.querySelector('.add-button');
const selectedIngredientsContainer = document.getElementById('selected-ingredients-container');
const generateButton = document.querySelector('.generate-button');
const quickAddPillsContainer = document.querySelector('.quick-add-pills');
const quickAddHeader = document.querySelector('.quick-add-title');
const recipeCardGrid = document.getElementById('card-list');
const recipeModal = document.getElementById('recipe-modal');
const modalCloseBtn = document.querySelector('.modal-close-btn');
const modalContent = document.querySelector('.recipe-modal-content');



// Fetches pantry items for the signed-in user from Firebase, sorts them by expiry date, and updates the UI.
async function fetchUserPantryItems(userId) {
    try {
        const appId = "less-waste-more-taste"
        const pantryItemsQuery = query(
            collection(db, `artifacts/${appId}/users/${userId}/pantry`),
            orderBy("expiryDate", "asc") // Sort by expiry date ascending
        );

        const querySnapshot = await getDocs(pantryItemsQuery);
        const pantryItems = [];
        querySnapshot.forEach((doc) => {
            pantryItems.push({ id: doc.id, ...doc.data() });
        });

        updateSearchWithPantryItems(pantryItems);

    } catch (e) {
        console.error("Error fetching user's pantry: ", e);
        showDefaultItems(); // Fallback to default if there's an error
    }
}

// Updates the search UI with the user's pantry items.
// parameter items is the sorted array of pantry items.
function updateSearchWithPantryItems(items) {
    quickAddHeader.textContent = "Quickly add items from your kitchen";
    quickAddPillsContainer.innerHTML = ''; // Clear default items

    items.forEach(item => {
        const itemPill = createPantryItemPill(item.name, item.expiryDate);
        quickAddPillsContainer.appendChild(itemPill);
    });
}

// Creates a the html for a pantry item pill >span> with a background color based on expiry date.
function createPantryItemPill(name, expiryDate) {
    const pill = document.createElement('span');
    const expiry = expiryDate && expiryDate.toDate ? expiryDate.toDate() : null;
    pill.className = `ingredient-pill quick-add-item ${getExpiryColorClass(expiry)}`;
    pill.textContent = name;
    pill.dataset.ingredient = name;
    return pill;
}

// determine the color class for a pill based on the expiry date
function getExpiryColorClass(expiryDate) {
    console.log("in color class");
    if (!expiryDate) return '';

    const today = new Date();
    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 2) {
        return 'bg-status-bad';
    } else if (diffDays <= 7) {
        return 'bg-status-warning';
    } else {
        return 'bg-status-good';
    }
}



// reset the UI to show common pantry items (will be used when the user isn't signed in)
function showDefaultItems() {
    quickAddHeader.textContent = "Quickly add common ingredients";
    quickAddPillsContainer.innerHTML = '';
    const defaultItems = ["Flour", "Sugar", "Eggs", "Milk", "Butter", "Salt", "Pepper", "Onions", "Garlic", "Potatoes", "Tomatoes", "Chicken", "Rice"]
    defaultItems.forEach(item => {
        const itemPill = createPantryItemPill(item, null); 
        quickAddPillsContainer.appendChild(itemPill);
    });
}


// Function to render the ingredient pills for the search bar
function renderIngredients() {
    // Clear the container first to avoid duplicates
    selectedIngredientsContainer.innerHTML = '';
    selectedIngredients.forEach(ingredient => {
        const pill = document.createElement('span');
        pill.className = 'ingredient-pill';
        pill.textContent = ingredient;
        pill.innerHTML += ' <i class="fa-solid fa-xmark"></i>';
        pill.dataset.ingredient = ingredient;
        selectedIngredientsContainer.appendChild(pill);
    });
}

// Function to add a new ingredient
function addIngredient(ingredientName) {
    const trimmedIngredient = ingredientName.trim();
    if (trimmedIngredient && !selectedIngredients.includes(trimmedIngredient)) {
        selectedIngredients.push(trimmedIngredient);
        renderIngredients();
        ingredientInput.value = ''; // Clear input field
    }
}

// Function to remove an ingredient
function removeIngredient(ingredientName) {
    selectedIngredients = selectedIngredients.filter(ingredient => ingredient !== ingredientName);
    renderIngredients();
}

// Event listener for adding an ingredient via the input field
addButton.addEventListener('click', (event) => {
    event.preventDefault(); // Prevents form submission and page reload
    addIngredient(ingredientInput.value);
});

// Event listener using event delegation for removing ingredients
selectedIngredientsContainer.addEventListener('click', (event) => {
    if (event.target.classList.contains('fa-xmark')) {
        // Find the parent span and get its data attribute
        const pill = event.target.closest('.ingredient-pill');
        const ingredient = pill.dataset.ingredient;
        if (ingredient) {
            removeIngredient(ingredient);
        }
    }
});



// Function to create a recipe card from an API response item
function createRecipeCard(recipe) {
    // Spoonacular's API provides a 'usedIngredients' and 'missedIngredients' count.
    const title = recipe.title;
    const image = recipe.image;
    const id = recipe.id;
    const likes = recipe.likes;

    // Check if the current recipe ID is in the savedRecipeIds set
    const isSaved = savedRecipeIds.has(String(id));
    // Determine the initial icon class based on the saved status
    const iconClass = isSaved ? 'fa-solid' : 'fa-regular';

    // Function to generate ingredient list HTML for the recipe cards with a show/hide button
    const renderIngredientList = (ingredients, type) => {
        const maxItems = 4;
        const isLongList = ingredients.length > maxItems;

        const initialListHtml = ingredients.slice(0, maxItems).map(item => `<li>${item.name.charAt(0).toUpperCase() + item.name.slice(1)}</li>`).join('');
        
        const fullListHtml = ingredients.map(item => `<li>${item.name.charAt(0).toUpperCase() + item.name.slice(1)}</li>`).join('');
        
        return `
            <div class="ingredient-list">
                <p class="ingredient-list-title">
                    <i class="fa-solid fa-${type === 'used' ? 'check-circle ingredient-icon-check' : 'circle-question ingredient-icon-ques'}"></i>
                    You ${type === 'used' ? 'have' : 'need'} ${ingredients.length} ingredients:
                </p>
                <div class="ingredient-list-content">
                    <ul class="visible-list">
                        ${initialListHtml}
                    </ul>
                    ${isLongList ? `<ul class="hidden-list hidden">${fullListHtml}</ul>` : ''}
                </div>
                ${isLongList ? `<button class="show-more-button" data-list-type="${type}">Show more</button>` : ''}
            </div>
        `;
    };
    
    // Create the HTML string for a single recipe card
    return `
        <div class="feature-card recipe-card">
            <img src="${image}" alt="${title}" class="recipe-card-image">
            <div class="recipe-card-content">
                <h3 class="recipe-title">${title}</h3>

                <div class="recipe-meta">
                    <span class="flex items-center gap-1"><i class="fa-regular fa-heart icon"></i> ${likes} likes</span>
                    <span class="flex items-center gap-1"><i class="fa-regular fa-eye icon"></i> ${
                        Math.floor(Math.random() * 20) + likes
                    } views</span>
                </div>

                <div class="ingredient-lists-container">
                    ${renderIngredientList(recipe.usedIngredients, 'used')}
                    ${renderIngredientList(recipe.missedIngredients, 'missed')}
                </div>
            </div>
            <div class="recipe-card-actions">
                <button class="view-recipe-button" data-recipe-id="${id}">View Recipe</button>
                <button class="save-recipe-button" data-recipe-id="${id}"><i class="${iconClass} fa-bookmark"></i></button>
            </div>
        </div>
    `;
}

// Event listener for "Show more" buttons
recipeCardGrid.addEventListener('click', (event) => {
    const showMoreButton = event.target.closest('.show-more-button');
    if (showMoreButton) {
        const listContainer = showMoreButton.previousElementSibling;
        const visibleList = listContainer.querySelector('.visible-list');
        const hiddenList = listContainer.querySelector('.hidden-list');

        visibleList.classList.toggle('hidden');
        hiddenList.classList.toggle('hidden');
        showMoreButton.classList.toggle('expanded');
        
        if (showMoreButton.textContent.includes('Show more')) {
            showMoreButton.textContent = 'Show less';
        } else {
            showMoreButton.textContent = 'Show more';
        }
    }
});

// Function to call the Spoonacular API and generate a recipe
async function generateRecipe() {
    if (selectedIngredients.length === 0) {
        recipeCardGrid.innerHTML = `<div class="feature-card recipe-card p-4"><p class="text-red-500">Please add some ingredients first!</p></div>`;
        return;
    }

    // Show a loading state
    generateButton.textContent = 'Generating...';
    generateButton.disabled = true;
    recipeCardGrid.innerHTML = `<p class="text-center text-gray-500">Loading recipes...</p>`;

    // Format the ingredients for the API call
    const ingredientsString = selectedIngredients.join(',');

    try {
        // number = 5 indicates that mx number of recipes given is 5
        const response = await fetch(`${SPOONACULAR_API_URL}?apiKey=${SPOONACULAR_API_KEY}&ingredients=${ingredientsString}&number=9`);
        
        if (!response.ok) {
            throw new Error(`API call failed with status: ${response.status}`);
        }
        
        const recipes = await response.json();
        fetchedRecipes = recipes;

        // save the recipes to local storage
        localStorage.setItem('fetchedRecipes', JSON.stringify(fetchedRecipes));
        
        if (recipes.length === 0) {
             recipeCardGrid.innerHTML = `<div class="feature-card recipe-card p-4"><p class="text-gray-500">No recipes found with those ingredients. Try adding more!</p></div>`;
        } else {
            // Build the HTML for all recipe cards
            const recipeCardsHtml = recipes.map(recipe => createRecipeCard(recipe)).join('');
            recipeCardGrid.innerHTML = recipeCardsHtml;
        }

    } catch (error) {
        console.error('Error generating recipe:', error);
        // Display a user-friendly error message
        recipeCardGrid.innerHTML = `<div class="feature-card recipe-card p-4">
            <p class="text-red-500">Failed to load recipes. Please check your API key and try again.</p>
        </div>`;
    } finally {
        // Reset the button state
        generateButton.textContent = 'Generate Recipes';
        generateButton.disabled = false;
    }
}

// Function to display a recipe in detail on a modal
async function showRecipeModal(recipeId) {
    const recipe = fetchedRecipes.find(r => r.id == recipeId);
    if (!recipe) {
        console.error("Recipe not found in fetched data.");
        return;
    }

    // Determine the saved status now, so it can be passed to the render function
    const isSaved = savedRecipeIds.has(String(recipeId));

    // Check whether the recipe is in the cache
    if (recipeDetailsCache[recipeId]) {
        console.log("Loading from cache...");
        renderModalContent(recipeDetailsCache[recipeId], isSaved);
        recipeModal.classList.remove('hidden');
        return;
    }

    // If not in cache, show a loading state inside the modal and proceed with API call
    modalContent.innerHTML = `<p class="text-center text-gray-500">Loading recipe details...</p>`;
    recipeModal.classList.remove('hidden');

    try {
        // Fetch the detailed information (instructions, etc.)
        const response = await fetch(`https://api.spoonacular.com/recipes/${recipeId}/information?apiKey=${SPOONACULAR_API_KEY}&includeNutrition=false`);
        if (!response.ok) {
            throw new Error(`Failed to fetch recipe details with status: ${response.status}`);
        }
        const detailedRecipe = await response.json();

        // store the detailed recipe in the cache and in local storage
        recipeDetailsCache[recipeId] = detailedRecipe;
        localStorage.setItem('recipeDetailsCache', JSON.stringify(recipeDetailsCache));

        renderModalContent(detailedRecipe, isSaved);
    } catch (error) {
        console.error('Error fetching recipe details:', error);
        modalContent.innerHTML = `<div class="p-4"><p class="text-red-500">Failed to load recipe details. Please try again.</p></div>`;
    }
}

// helper function to renderModalContent for detailed recipe view
function renderModalContent(recipe, isSaved) {
    const safeInstructions = new DOMParser().parseFromString(recipe.instructions, 'text/html').body.textContent || 'No instructions provided.';
    const ingredientsList = recipe.extendedIngredients.map(ingredient => `<li>${ingredient.original}</li>`).join('');

    // Determine the initial icon class based on the 'isSaved' flag
    const iconClass = isSaved ? 'fa-solid' : 'fa-regular';

    const recipeHtml = `
        <h1 class="recipe-title">${recipe.title}</h1>
        <div class="recipe-modal-image-container">
            <img src="${recipe.image}" alt="${recipe.title}" class="recipe-image">
            <button class="save-recipe-button recipe-modal-save-btn" data-recipe-id="${recipe.id}"><i class="${iconClass} fa-bookmark"></i></button>
        </div>
        <div class="recipe-meta">
            <span class="flex items-center"><i class="fa-regular fa-clock mr-2"></i> ${recipe.readyInMinutes} mins</span>
            <span class="flex items-center"><i class="fa-regular fa-user mr-2"></i> ${recipe.servings} servings</span>
            <span class="flex items-center"><i class="fa-solid fa-star mr-2"></i> Spoonacular Score: ${recipe.spoonacularScore.toFixed(0)}/100</span>
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

// fetch saved recipe IDs and store them
async function fetchSavedRecipeIds(userId) {
    savedRecipeIds.clear();
    try {
        const savedRecipesRef = collection(db, `artifacts/less-waste-more-taste/users/${userId}/savedRecipes`);
        const querySnapshot = await getDocs(savedRecipesRef);
        querySnapshot.forEach(doc => savedRecipeIds.add(doc.id));
    } catch (e) {
        console.error("Error fetching saved recipe IDs: ", e);
    }
}

// save a recipe
async function saveRecipe(recipeId, iconElement) {
    const user = auth.currentUser;
    if (!user) {
        alert("Please log in to save recipes!");
        return;
    }

    let recipeToSave = null;

    // First, check if the detailed recipe is in the cache
    if (recipeDetailsCache[recipeId]) {
        console.log("Saving detailed recipe from cache.");
        recipeToSave = recipeDetailsCache[recipeId];
    } else {
        // If not in cache, find the basic recipe from fetched data
        const basicRecipe = fetchedRecipes.find(r => r.id == recipeId);
        if (basicRecipe) {
            console.log("Fetching detailed recipe for saving.");
            try {
                // Fetch the detailed information from the API
                const response = await fetch(`https://api.spoonacular.com/recipes/${recipeId}/information?apiKey=${SPOONACULAR_API_KEY}&includeNutrition=false`);
                if (!response.ok) {
                    throw new Error(`Failed to fetch recipe details with status: ${response.status}`);
                }
                const detailedRecipe = await response.json();
                
                // Store in cache for future use
                recipeDetailsCache[recipeId] = detailedRecipe;
                localStorage.setItem('recipeDetailsCache', JSON.stringify(recipeDetailsCache));
                
                recipeToSave = detailedRecipe;
            } catch (error) {
                console.error('Error fetching recipe details for saving:', error);
                alert("Failed to get full recipe details. Please try again.");
                return;
            }
        } else {
            console.error("Recipe not found in any data source.");
            alert("Failed to save recipe. Recipe data is missing.");
            return;
        }
    }

    if (!recipeToSave) {
        console.error("No recipe data to save.");
        alert("Failed to save recipe. Please try again.");
        return;
    }

    try {
        const appId = "less-waste-more-taste";
        const userSavedRecipesRef = collection(db, `artifacts/${appId}/users/${user.uid}/savedRecipes`);
        const recipeDocRef = doc(userSavedRecipesRef, String(recipeId));

        const docSnap = await getDoc(recipeDocRef);

        if (docSnap.exists()) {
            // Recipe is already saved, so remove it from the database
            await deleteDoc(recipeDocRef);
            alert("Recipe unsaved successfully!");
            console.log("Recipe removed from saved list.");
            updateAllRecipeIcons(recipeId, false);
        } else {
            const recipeData = {
                id: recipeToSave.id,
                title: recipeToSave.title,
                image: recipeToSave.image,
                // Include other useful data points from the detailed recipe
                likes: recipeToSave.aggregateLikes || 0,
                readyInMinutes: recipeToSave.readyInMinutes || 0,
                servings: recipeToSave.servings || 0,
                instructions: recipeToSave.instructions || '',
                extendedIngredients: recipeToSave.extendedIngredients || [],
                savedAt: new Date(),
            };
            await setDoc(recipeDocRef, recipeData);
            console.log("Recipe saved with ID: ", recipeId);
            updateAllRecipeIcons(recipeId, true);
        }

    } catch (e) {
        console.error("Error saving recipe: ", e);
        alert("Failed to save the recipe. Please try again.");
    }
}

// Function to update all bookmark icons for a given recipe ID
function updateAllRecipeIcons(recipeId, isSaved) {
    // Select all bookmark buttons for this specific recipe ID
    const buttons = document.querySelectorAll(`[data-recipe-id="${recipeId}"].save-recipe-button, [data-recipe-id="${recipeId}"].recipe-modal-save-btn`);

    buttons.forEach(button => {
        const iconElement = button.querySelector('i');
        if (iconElement) {
            if (isSaved) {
                iconElement.classList.remove('fa-regular');
                iconElement.classList.add('fa-solid');
            } else {
                iconElement.classList.remove('fa-solid');
                iconElement.classList.add('fa-regular');
            }
        }
    });
}

// update icons based on saved recipes
async function updateSavedRecipeIcons(userId) {
    try {
        const savedRecipesRef = collection(db, `artifacts/less-waste-more-taste/users/${userId}/savedRecipes`);
        const querySnapshot = await getDocs(savedRecipesRef);
        
        const savedRecipeIds = new Set();
        querySnapshot.forEach(doc => savedRecipeIds.add(doc.id));

        // Wait for recipes to be rendered before trying to find the buttons
        // You might need a more robust way to handle this timing if needed.
        setTimeout(() => {
            const saveButtons = document.querySelectorAll('.save-recipe-button');
            saveButtons.forEach(button => {
                const recipeId = button.dataset.recipeId;
                const iconElement = button.querySelector('i');
                if (savedRecipeIds.has(recipeId)) {
                    iconElement.classList.remove('fa-regular');
                    iconElement.classList.add('fa-solid');
                } else {
                    iconElement.classList.remove('fa-solid');
                    iconElement.classList.add('fa-regular');
                }
            });
        }, 500); // Wait half a second for recipes to load
    } catch (e) {
        console.error("Error updating saved recipe icons: ", e);
    }
}

// Event listener for saving recipes from the main grid
recipeCardGrid.addEventListener('click', (event) => {
    const button = event.target.closest('.save-recipe-button');
    if (button) {
        const recipeId = button.dataset.recipeId;
        const iconElement = button.querySelector('i');
        saveRecipe(recipeId, iconElement);
    }
});

// Event listener for saving recipes from the modal
modalContent.addEventListener('click', (event) => {
    const button = event.target.closest('.recipe-modal-save-btn');
    if (button) {
        const recipeId = button.dataset.recipeId;
        const iconElement = button.querySelector('i');
        saveRecipe(recipeId, iconElement);
    }
});

// Event listener for the generate button
generateButton.addEventListener('click', generateRecipe);

// Event listener for view recipe buttons using event delegation
recipeCardGrid.addEventListener('click', (event) => {
    if (event.target.classList.contains('view-recipe-button')) {
        const recipeId = event.target.dataset.recipeId;
        showRecipeModal(recipeId);
    }
});

// Event listener for the modal's close button
modalCloseBtn.addEventListener('click', () => {
    recipeModal.classList.add('hidden');
});

// Initialize the page on load
initializePage();
