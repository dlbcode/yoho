import { adjustMapSize } from '../map.js';

export const infoPaneHeight = {
    MENU_BAR_HEIGHT: 42,
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
            const optimalHeight = Math.ceil(totalContentHeight + this.MENU_BAR_HEIGHT + 1);
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
                // Use provided content height or calculate minimum
                height = contentHeight || minHeight;
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
    }
};

// Initialize the resize handler when the module is imported
infoPaneHeight.initialize();