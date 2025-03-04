import { createSortButton } from './sortDeck.js';

/**
 * Creates filter controls for the route deck
 * @returns {HTMLElement} The filter controls container element
 */
function createFilterControls() {
    const filterControls = document.createElement('div');
    filterControls.className = 'filter-controls';
    
    // Create a separate container for filter buttons
    const filterButtonsContainer = document.createElement('div');
    filterButtonsContainer.className = 'filter-buttons-container';

    // Create scroll indicator
    const scrollIndicator = document.createElement('div');
    scrollIndicator.className = 'scroll-indicator';
    filterButtonsContainer.appendChild(scrollIndicator);

    // Set up scroll indicator with mutation observer
    setupScrollIndicator(filterButtonsContainer);

    const filters = ['departure', 'arrival', 'price'];
    filters.forEach(filterType => {
        const filterButton = document.createElement('button');
        filterButton.className = 'filter-button';
        filterButton.setAttribute('data-filter', filterType);
        
        filterButton.innerHTML = `
            <span class="filter-text" data-filter="${filterType}">${filterType.charAt(0).toUpperCase() + filterType.slice(1)}</span>
            <img class="filterIcon" id="${filterType}Filter" data-filter="${filterType}" src="/assets/filter-icon.svg" alt="Filter">
            <span class="resetIcon hidden" id="reset${filterType.charAt(0).toUpperCase() + filterType.slice(1)}Filter" 
                  data-filter="${filterType}">✕</span>
        `;
        
        filterButtonsContainer.appendChild(filterButton);
    });

    // Create a separate container for the sort button
    const sortControls = document.createElement('div');
    sortControls.className = 'sort-controls';
    sortControls.appendChild(createSortButton());

    filterControls.appendChild(filterButtonsContainer);
    filterControls.appendChild(sortControls);

    // Setup scroll indicator
    setupScrollIndicator(filterButtonsContainer);

    return filterControls;
}

// Use a throttled version to reduce calculations
function updateScrollIndicator(container) {
    // Clear any pending animation frame
    if (updateScrollIndicator.frameId) {
        cancelAnimationFrame(updateScrollIndicator.frameId);
    }
    
    // Schedule the update in the next animation frame
    updateScrollIndicator.frameId = requestAnimationFrame(() => {
        const buttonsContainer = container instanceof Event ? container.target : container;
        const scrollIndicator = buttonsContainer.querySelector('.scroll-indicator');
        
        if (!scrollIndicator) return;
        
        const containerWidth = buttonsContainer.clientWidth;
        const scrollWidth = buttonsContainer.scrollWidth;
        
        if (scrollWidth <= containerWidth) {
            scrollIndicator.style.width = '0';
            scrollIndicator.style.transform = 'translateX(0)';
            return;
        }

        // Calculate the visible ratio and line width
        const visibleRatio = containerWidth / scrollWidth;
        const lineWidth = Math.max(containerWidth * visibleRatio, 30);
        
        // Calculate scroll values
        const overflowAmount = scrollWidth - containerWidth;
        const scrollProgress = buttonsContainer.scrollLeft / overflowAmount;
        
        // Calculate maximum travel distance
        const maxTravel = containerWidth - lineWidth;
        const leftPosition = scrollProgress * maxTravel * 2.25;

        scrollIndicator.style.width = `${lineWidth}px`;
        scrollIndicator.style.transform = `translateX(${leftPosition}px)`;
    });
}

// Add a mutation observer to watch for content changes
function setupScrollIndicator(filterButtonsContainer) {
    // Store observer in container to prevent multiple observers on the same element
    if (!filterButtonsContainer._scrollObserver) {
        const observer = new MutationObserver(() => updateScrollIndicator(filterButtonsContainer));
        
        observer.observe(filterButtonsContainer, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true
        });
        
        // Save observer reference to prevent duplicates
        filterButtonsContainer._scrollObserver = observer;
        
        // Use passive event listener for scroll performance
        filterButtonsContainer.addEventListener('scroll', updateScrollIndicator, { passive: true });
        
        // Use debounced resize handler
        if (!window._resizeHandlerSet) {
            const resizeHandler = () => {
                document.querySelectorAll('.filter-buttons-container').forEach(container => {
                    updateScrollIndicator(container);
                });
            };
            
            window.addEventListener('resize', resizeHandler);
            window._resizeHandlerSet = true;
        }
        
        // Initial update
        updateScrollIndicator(filterButtonsContainer);
    }
}

export { createFilterControls, updateScrollIndicator, setupScrollIndicator };
