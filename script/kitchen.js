import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, onSnapshot, addDoc, doc, deleteDoc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

import {setupAuthListeners} from './auth.js'
import { loadHeader, setActiveNavLink, loadAuthModal } from './utils.js';

const swooshSound = new Audio('../swoosh.mp3');

let userId;
let currentPlace = 'All';
let allPantryItems = [];

(async () => {
    try {

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


        // KITCHEN CONTENT PAGE FUNCTIONALITY
        
        // Pantry specific UI elements
        const pantryForm = document.getElementById('pantry-form');
        const pantryList = document.getElementById('pantry-list');
        const itemNameInput = document.getElementById('item-name');
        const itemQuantityInput = document.getElementById('item-quantity');
        const itemPlaceSelect = document.getElementById('item-place');
        const itemExpiryInput = document.getElementById('item-expiry');
        const pantryTabs = document.getElementById('pantry-tabs');
        const pantryLoading = document.getElementById('pantry-loading');

        // Edit Modal UI elements
        const editModal = document.getElementById('edit-item-modal');
        const closeEditModalBtn = document.getElementById('close-edit-modal');
        const editForm = document.getElementById('edit-form');
        const editItemIdInput = document.getElementById('edit-item-id');
        const editItemNameInput = document.getElementById('edit-item-name');
        const editItemQuantityInput = document.getElementById('edit-item-quantity');
        const editItemExpiryInput = document.getElementById('edit-item-expiry');
        const editItemPlaceSelect = document.getElementById('edit-item-place');


        // --- Functions to handle UI and data ---

        // determine item status (red, yellow, green) based on expiration date
        function getItemStatus(expiryDate) {
            const now = new Date();
            const expiry = expiryDate.toDate();
            const diffTime = expiry.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays <= 2) {
                return 'status-bad'; // Red
            } else if (diffDays <= 7) {
                return 'status-warning'; // Yellow
            } else {
                return 'status-good'; // Green
            }
        }

        // render pantry list to UI
        function renderPantry(items) {
            pantryList.innerHTML = ''; // Clear the list first
            if (items.length === 0) {
                pantryList.innerHTML = '<p class="text-center text-gray-500">No items found.</p>';
                return;
            }
            items.forEach(item => {
                const statusClass = getItemStatus(item.expiryDate);
                const bgClass = `bg-${statusClass}`;

                const itemElement = document.createElement('div');
                itemElement.classList.add('pantry-item', statusClass, bgClass);
                itemElement.dataset.id = item.id;
                
                const dateString = item.expiryDate.toDate().toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });

                itemElement.innerHTML = `
                    <div class="eaten-action">
                        <button class="eat-btn"><i class="fas fa-utensils"></i></button>
                        <span>Finished!</span>
                    </div>
                    <div class="item-info">
                        <span class="item-name">${item.name} (${item.quantity})</span>
                        <span class="item-details">
                            Location: ${item.place}
                            <span class="item-details-seperator">|</span>
                            Expires: ${dateString}
                        </span>
                    </div>
                    <div class="item-actions">
                        <button class="edit-btn"><i class="fas fa-edit"></i></button>
                        <button class="remove-btn"><i class="fas fa-trash-alt"></i></button>
                    </div>
                `;
                pantryList.appendChild(itemElement);
            });
        }

        // function to update the UI based on the current place and all items.
        function updatePantryUI() {
            // Filter the global items array based on the current place.
            const filteredItems = allPantryItems.filter(item => {
                return currentPlace === 'All' || item.place === currentPlace;
            });
            renderPantry(filteredItems);
        }

        // set up firestore listener for pantry items
        function setupPantryListener(uid) {
            const appId = "less-waste-more-taste";
            const pantryCollection = collection(db, `artifacts/${appId}/users/${uid}/pantry`);
            
            // Listen for real-time updates to the pantry
            onSnapshot(pantryCollection, (snapshot) => {
                // Defensive check to ensure the snapshot is valid before processing
                if (!snapshot || !snapshot.docs) {
                    console.error("Invalid snapshot received from Firestore.");
                    return;
                }
                
                allPantryItems = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}))
                
                // Sort all items by expiration date, soonest first
                allPantryItems.sort((a, b) => {
                    const dateA = a.expiryDate.toDate();
                    const dateB = b.expiryDate.toDate();
                    return dateA - dateB;
                });

                pantryLoading.classList.add('hidden');
                
                updatePantryUI();
            }, (error) => {
                console.error("Error listening to pantry collection: ", error);
            });
        }

        function getItemRef (itemId) {
            const appId = "less-waste-more-taste";
            return doc(db, `artifacts/${appId}/users/${userId}/pantry`, itemId);
        }

        // listen for authentication state changes and set up pantry listeners accordingly
        onAuthStateChanged(auth, (user) => {
            if (user) {
                // user is signed-in
                userId = user.uid;
                console.log(`User is authenticated with ID: ${userId}`);

                pantryLoading.classList.remove('hidden');
                pantryList.innerHTML = '';

                setupPantryListener(userId);
            } else {
                userId = null;
                console.log("User is signed out.");
                pantryList.innerHTML = '<p class="text-center text-gray-500">Please sign in to view your pantry.</p>';
            }
        });

        // --- Event Listeners ---

        // When tab is clicked
        pantryTabs.addEventListener('click', (e) => {
            const tabButton = e.target.closest('.tab-button');
            if (!tabButton) return;

            // Remove active class from all buttons
            document.querySelectorAll('.tab-button').forEach(btn => {
                btn.classList.remove("active");
            });

            // Add active class to the clicked button
            tabButton.classList.add("active");

            // Update the global place variable
            currentPlace = tabButton.dataset.place;
            
            // Now, filter and re-render the list using the stored data.
            updatePantryUI();
        });

        // Handle form submission to add new items
        pantryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = itemNameInput.value.trim();
            const quantity = itemQuantityInput.value;
            const expiryDate = itemExpiryInput.value;
            // Get the selected place from the dropdown
            const place = itemPlaceSelect.value;

            if (!name || !quantity || !expiryDate || !place) {
                console.error("Please fill in all fields.");
                // TODO: Replace with a user-friendly modal
                return;
            }

            if (!userId) {
                console.error("Please sign in to add items.");
                // TODO: Replace with a user-friendly modal
                return;
            }

            try {
                const appId = "less-waste-more-taste";
                const pantryCollection = collection(db, `artifacts/${appId}/users/${userId}/pantry`);
                await addDoc(pantryCollection, {
                    name,
                    quantity: Number(quantity),
                    expiryDate: new Date(expiryDate),
                    place, // Save the selected place to Firestore
                    addedAt: new Date(),
                });

                pantryForm.reset(); // Clear the form
            } catch (e) {
                console.error("Error adding document: ", e);
                // TODO: Replace with a user-friendly modal
            }
        });

        // Event delegation for the pantry list buttons
        pantryList.addEventListener('click', async (e) => {
            const itemElement = e.target.closest('.pantry-item');
            if (!itemElement) return;

            const itemId = itemElement.dataset.id;
            if (!itemId || !userId) return;

            // Handle Remove button click
            if (e.target.closest('.remove-btn')) {
                try {
                    const itemRef = getItemRef(itemId);
                    await deleteDoc(itemRef);
                } catch (error) {
                    console.error("Error removing document: ", error);
                    // TODO: Replace with a user-friendly modal
                }
            }

            // Handle Eat button click
            if (e.target.closest('.eaten-action')) {
                swooshSound.play();
                itemElement.classList.add('shrink');
                try {
                    const itemRef = getItemRef(itemId);
                    const currentQuantityElement = itemElement.querySelector('.item-name');
                    const quantityMatch = currentQuantityElement.textContent.match(/\((\d+)\)/);
                    let currentQuantity = quantityMatch ? parseInt(quantityMatch.pop()) : 0;

                    if (currentQuantity > 1) {
                        await updateDoc(itemRef, {
                            quantity: currentQuantity - 1
                        });
                    } else {
                        setTimeout(async () => {
                            await deleteDoc(itemRef);
                        }, 500);
                    }
                } catch (error) {
                    console.error("Error eating item: ", error);
                    // TODO: Replace with a user-friendly modal
                }
            }

            // Handle Edit button click
            if (e.target.closest('.edit-btn')) {
                try {
                    const itemRef = getItemRef(itemId);
                    const itemDoc = await getDoc(itemRef);
                    const itemData = itemDoc.data();

                    editItemIdInput.value = itemId;
                    editItemNameInput.value = itemData.name;
                    editItemQuantityInput.value = itemData.quantity;
                    editItemExpiryInput.value = itemData.expiryDate.toDate().toISOString().split('T')[0];
                    editItemPlaceSelect.value = itemData.place;

                    editModal.classList.remove('hidden');
                } catch (error) {
                    console.error("Error opening edit modal: ", error);
                    // TODO: Replace with a user-friendly modal
                }
            }
        });

        // Handle form submission for editing
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const itemId = editItemIdInput.value;
            const newName = editItemNameInput.value.trim();
            const newQuantity = editItemQuantityInput.value;
            const newExpiryDate = editItemExpiryInput.value;
            const newPlace = editItemPlaceSelect.value;
            
            if (!newName || !newQuantity || !newExpiryDate || !newPlace) {
                console.error("Please fill in all fields.");
                // TODO: Replace with a user-friendly modal
                return;
            }

            if (!userId) {
                console.error("Please sign in to edit items.");
                // TODO: Replace with a user-friendly modal
                return;
            }

            try {
                const itemRef = getItemRef(itemId);
                await updateDoc(itemRef, {
                    name: newName,
                    quantity: Number(newQuantity),
                    expiryDate: new Date(newExpiryDate),
                    place: newPlace, // Save the updated place to Firestore
                });

                editModal.classList.add('hidden');
                editForm.reset();
            } catch (error) {
                console.error("Error saving edits: ", error);
                // TODO: Replace with a user-friendly modal
            }
        });

        // Close edit modal
        closeEditModalBtn.addEventListener('click', () => {
            editModal.classList.add('hidden');
            editForm.reset();
        });
        
        // Initial tab styling
        // Select the "All" tab by default
        const initialTab = document.querySelector('.tab-button[data-place="All"]');
        if (initialTab) {
            initialTab.classList.add('active');
        }


    } catch (error) {
        console.error("Application initialization failed:", error);
    }
})();