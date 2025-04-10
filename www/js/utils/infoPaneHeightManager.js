import { adjustMapSize } from '../map.js';

export const infoPaneHeight = {
    MENU_BAR_HEIGHT: 50,
    DEFAULT_HEIGHT_RATIO: 0.5,
    currentHeightRatio: 0.5,

    initialize() {
        // Add resize event listener
        window.visualViewport
            ? window.visualViewport.addEventListener('resize', this.handleResize.bind(this))
            : window.addEventListener('resize', this.handleResize.bind(this));
    },

    handleResize() {
        const infoPane = document.getElementById('infoPane');
        if (!infoPane || infoPane.classList.contains('collapsed')) return;

        const infoPaneContent = document.getElementById('infoPaneContent');
        if (!infoPaneContent) return;

        // Get current content height
        const routeBox = document.querySelector('.route-box');
        const routeDeck = infoPaneContent.querySelector('deck');
        
        // Calculate total content height (including padding/margins)
        const totalContentHeight = routeBox ? 
            routeBox.offsetHeight + (routeDeck ? routeDeck.offsetHeight : 0) : 
            0;

        // Get current type (search results use ratio, others use content-based sizing)
        const currentType = infoPane.classList.contains('search-results') ? 'ratio' : 'content';
        
        if (currentType === 'content') {
            // Add menu bar height and small buffer
            const optimalHeight = Math.ceil(totalContentHeight + this.MENU_BAR_HEIGHT + 3);
            this.setHeight('content', { contentHeight: optimalHeight });
        } else if (currentType === 'ratio') {
            this.setHeight('ratio');
        }
    },

    setHeight(type, params = {}) {
        const infoPane = document.getElementById('infoPane');
        if (!infoPane) return;

        let height;
        const viewportHeight = window.visualViewport
            ? window.visualViewport.height
            : window.innerHeight;

        // Get routeBox height if it exists
        const routeBox = document.querySelector('.route-box');
        const routeBoxHeight = routeBox ? routeBox.offsetHeight : 0;
        
        // Minimum height should be routeBox height + menu bar height
        const minHeight = routeBoxHeight + this.MENU_BAR_HEIGHT;

        switch (type) {
            case 'collapse':
                height = this.MENU_BAR_HEIGHT;
                infoPane.classList.add('collapsed');
                infoPane.classList.remove('expanded');
                break;

            case 'content':
                const { contentHeight } = params;
                // Use provided content height or calculate using routeBox
                const routeBox = document.querySelector('.route-box');
                const routeBoxHeight = routeBox ? routeBox.offsetHeight : 0;
                height = contentHeight || routeBoxHeight + this.MENU_BAR_HEIGHT + 3;
                height = Math.max(height, minHeight);
                infoPane.classList.remove('collapsed');
                infoPane.classList.add('expanded');
                break;

            case 'half':
            case 'ratio':
                height = Math.floor(viewportHeight * this.currentHeightRatio);
                height = Math.max(height, minHeight);
                infoPane.classList.remove('collapsed');
                infoPane.classList.add('expanded');
                break;
        }

        // Ensure height doesn't exceed viewport
        const maxHeight = viewportHeight - parseFloat(getComputedStyle(document.documentElement)
            .getPropertyValue('--bottom-bar-height'));
        height = Math.min(height, maxHeight);

        // Final check to ensure we never go below minHeight when expanded
        if (infoPane.classList.contains('expanded')) {
            height = Math.max(height, minHeight);
        }

        infoPane.style.height = `${height}px`;
        adjustMapSize();

        // Reposition suggestion boxes after height changes
        setTimeout(() => {
            import('../inputManager.js').then(({ inputManager }) => {
                inputManager.repositionAllSuggestionBoxes();
            }).catch(console.error);
        }, 50); // Short timeout to ensure DOM updates
    },

    setHeightRatio(ratio) {
        this.currentHeightRatio = ratio;
        this.setHeight('ratio');
    },

    toggleInfoPaneHeight(infoPane, forceCollapse = false) {
        if (forceCollapse || (infoPane.offsetHeight > infoPaneHeight.MENU_BAR_HEIGHT)) {
            this.setHeight('collapse');
        } else {
            const routeBox = document.getElementById('routeBox');
            if (routeBox) {
                this.setHeight('content', { contentElement: routeBox });
            }
        }

        // Reposition suggestion boxes after height changes
        setTimeout(() => {
            import('../inputManager.js').then(({ inputManager }) => {
                inputManager.repositionAllSuggestionBoxes();
            }).catch(console.error);
        }, 300); // After transition completes
    },

    // Add a new standardized method for route details views
    setRouteDetailsHeight: function(contentElement) {
        // Use consistent 75% of window height as maximum for all route detail views
        const maxHeight = window.innerHeight * 0.50;
        const contentHeight = Math.min(maxHeight, contentElement.scrollHeight + 50);
        
        this.setHeight('content', {
            contentElement,
            contentHeight: contentHeight
        });
    }
};

// Initialize the resize handler when the module is imported
infoPaneHeight.initialize();