import { adjustMapSize } from '../map.js';

export const infoPaneHeight = {
  MENU_BAR_HEIGHT: 42,

  setHeight(type, params = {}) {
    const infoPane = document.getElementById('infoPane');
    if (!infoPane) return;

    let height;
    
    switch(type) {
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
        const viewportHeight = window.visualViewport 
          ? window.visualViewport.height 
          : window.innerHeight;
        height = Math.floor(viewportHeight * 0.5);
        infoPane.classList.remove('collapsed');
        infoPane.classList.add('expanded');
        break;
    }

    infoPane.style.height = `${height}px`;
    adjustMapSize();
  }
};