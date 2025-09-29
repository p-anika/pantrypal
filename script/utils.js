// Function to load the header content
export async function loadHeader() {
    try {
        const response = await fetch('../header.html');
        const headerHtml = await response.text();
        document.body.insertAdjacentHTML('afterbegin', headerHtml);
    } catch (error) {
        console.error('Failed to load header:', error);
    }
}


// Function to set active navigation link
export function setActiveNavLink() {
    const currentPath = window.location.pathname.split('/').pop();
    const navLinks = document.querySelectorAll('.nav-link');

    navLinks.forEach(link => {
        // Remove the active class from all links first
        link.classList.remove('nav-link-active');
        
        // Add the active class to the link that matches the current page
        const linkPath = link.href.split('/').pop();
        if (linkPath === currentPath) {
            link.classList.add('nav-link-active');
        }
    });
}


// Function to load the sign-in/sign-up modal HTML
export async function loadAuthModal() {
    try {
        const response = await fetch('../auth-modal.html');
        const modalHtml = await response.text();
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    } catch (error) {
        console.error('Failed to load authentication modal:', error);
    }
}