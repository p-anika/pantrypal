import {setupAuthListeners} from './auth.js'
import { loadHeader, setActiveNavLink, loadAuthModal } from './utils.js';

// Global variables to hold map-related objects
let map;
let service;
let infoWindow;
let userLocation;
let markers = [];

// UI elements
const loadingIndicator = document.getElementById('loading-indicator');
const mapContainer = document.getElementById('map');
const locationsList = document.getElementById('locations-list');

async function initializePage () {
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
}




// Main function that initializes the map. Called by the Google Maps script callback.
window.initMap = function () {
    // 1. Try to get the user's location
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                // Success: We have the location
                userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                };
                createMap(userLocation);
            },
            () => {
                // Error: User denied location or an error occurred
                handleLocationError();
            }
        );
    } else {
        // Error: Browser doesn't support Geolocation
        handleLocationError();
    }
};

// Creates the Google Map centered on the user's location. Takes the latitude and longitude of the user as a parameter.
function createMap(location) {
    loadingIndicator.style.display = 'none'; // Hide loading indicator

    map = new google.maps.Map(mapContainer, {
        center: location,
        zoom: 13, // A good zoom level to see a neighborhood
        disableDefaultUI: true,
        zoomControl: true,
    });

    // Add a marker for the user's own location
    new google.maps.Marker({
        position: location,
        map: map,
        title: 'Your Location',
        icon: { // Custom blue dot icon
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#4285F4",
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: "white",
        }
    });

    // Initialize the Places service and the InfoWindow
    service = new google.maps.places.PlacesService(map);
    infoWindow = new google.maps.InfoWindow();

    // 2. Search for nearby places
    searchNearbyPlaces(location);
}

// Handles cases where the user's location cannot be retrieved. It shows an error and centers the map on a default location.
function handleLocationError() {
    loadingIndicator.innerHTML = '<p>Could not find your location. Showing a default area.</p>';
    // Default to a central location in the US if location is denied
    const defaultLocation = { lat: 39.8283, lng: -98.5795 };
    createMap(defaultLocation);
}

// Performs two searches: one for food banks and one for shelters. Takes the user's location coordinates as a parameter
function searchNearbyPlaces(location) {
    // Clear any previous results
    locationsList.innerHTML = '';
    clearMarkers();

    const searchRequests = [
        {
            location: location,
            radius: '10000',
            type: 'establishment',
            keyword: 'food bank'
        },
        {
            location: location,
            radius: '10000',
            type: 'establishment',
            keyword: 'homeless shelter'
        }
    ];

    searchRequests.forEach(request => {
        service.nearbySearch(request, (results, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                // 3. Display the results
                displayPlaces(results);
            }
        });
    });
}

// Loops through places and adds them to the map and the list. Takes an array of place results from the API as a parameter.
function displayPlaces(places) {
    for (const place of places) {
        if (place.geometry && place.geometry.location) {
            // Create a marker on the map
            const marker = createMarker(place);
            markers.push(marker);

            // Create a list item in the sidebar
            createListItem(place, marker);
        }
    }
}

// Creates a marker on the map for a given place. Takes a single place result as parameter and returns the created marker
function createMarker(place) {
    const marker = new google.maps.Marker({
        map: map,
        position: place.geometry.location,
        title: place.name,
    });

    // Add a click listener to the marker to show details
    google.maps.event.addListener(marker, "click", () => {
        showPlaceDetails(place, marker);
    });

    return marker;
}

// Creates an item in the sidebar list for a given place. Takes a single place result and the corresponding map marker as parameters
function createListItem(place, marker) {
    const li = document.createElement('li');
    li.className = 'location-item';
    li.innerHTML = `
        <h4>${place.name}</h4>
        <p>${place.vicinity}</p>
    `;
    locationsList.appendChild(li);

    // Add a click listener to the list item
    li.addEventListener('click', () => {
        showPlaceDetails(place, marker);
        // Center the map on the marker when the list item is clicked
        map.panTo(place.geometry.location);
    });
}

// Fetches detailed information for a place and displays it in the InfoWindow. Parameters: The basic place object and the marker that was clicked.
function showPlaceDetails(place, marker) {
    const detailsRequest = {
        placeId: place.place_id,
        fields: ['name', 'formatted_address', 'formatted_phone_number', 'website']
    };

    service.getDetails(detailsRequest, (details, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && details) {
            let content = `<div class="info-window-content"><h5>${details.name}</h5>`;
            if (details.formatted_address) {
                content += `<p><i class="fas fa-map-marker-alt"></i> ${details.formatted_address}</p>`;
            }
            if (details.formatted_phone_number) {
                content += `<p><i class="fas fa-phone"></i> <a href="tel:${details.formatted_phone_number}">${details.formatted_phone_number}</a></p>`;
            }
            if (details.website) {
                content += `<p><i class="fas fa-globe"></i> <a href="${details.website}" target="_blank">Visit Website</a></p>`;
            }
            content += `</div>`;
            
            infoWindow.setContent(content);
            infoWindow.open(map, marker);
        }
    });
}

// Removes all markers from the map.
function clearMarkers() {
    for (let i = 0; i < markers.length; i++) {
        markers[i].setMap(null);
    }
    markers.length = 0;
}




initializePage();
