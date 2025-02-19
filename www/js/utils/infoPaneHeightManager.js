import { adjustMapSize } from '../map.js';

export const infoPaneHeight = {
    MENU_BAR_HEIGHT: 42,
    DEFAULT_HEIGHT_RATIO: 0.5, // Default ratio, can be adjusted
    currentHeightRatio: 0.5,

    setHeight(type, params = {}) {
        const infoPane = document.getElementById('infoPane');
        if (!infoPane) return;

        let height;
        const viewportHeight = window.visualViewport
            ? window.visualViewport.height
            : window.innerHeight;

        switch (type) {
            case 'collapse':
                height = this.MENU_BAR_HEIGHT;
                infoPane.classList.add('collapsed');
                infoPane.classList.remove('expanded');
                break;

            case 'content':
                const { contentElement } = params;
                if (!contentElement) return;
                height = contentElement.offsetHeight + this.MENU_BAR_HEIGHT;
                infoPane.classList.remove('collapsed');
                infoPane.classList.add('expanded');
                break;

            case 'half':
                height = Math.floor(viewportHeight * this.currentHeightRatio);
                infoPane.classList.remove('collapsed');
                infoPane.classList.add('expanded');
                break;
            case 'ratio':
                height = Math.floor(viewportHeight * this.currentHeightRatio);
                infoPane.classList.remove('collapsed');
                infoPane.classList.add('expanded');
                break;
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