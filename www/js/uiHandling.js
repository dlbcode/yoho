import { appState, updateState } from "./stateManager.js";
import { adjustMapSize } from "./map.js";
import { inputManager } from "./inputManager.js";

let estimatedBottomBarHeight = 0;

// Simplified bottom bar height calculation
const estimateBottomBarHeight = () => {
    const input = document.createElement('input');
    input.style.cssText = 'position:absolute;bottom:0;opacity:0';
    document.body.appendChild(input);

    const initialViewportHeight = window.visualViewport.height;
    input.focus();

    setTimeout(() => {
        estimatedBottomBarHeight = initialViewportHeight - window.visualViewport.height;
        document.body.removeChild(input);
    }, 500);
};

const setBottomBarHeight = () => {
    const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    const bottomBarHeight = window.innerHeight - viewportHeight;
    document.documentElement.style.setProperty('--bottom-bar-height', `${bottomBarHeight}px`);
};

const uiHandling = {
    // Delegate to inputManager
    setFocusToNextUnsetInput: () => inputManager.setFocusToNextUnsetInput(),

    initInfoPaneDragButton() {
        const infoPane = document.getElementById('infoPane');
        const resizeHandle = document.getElementById('resizeHandle');
        if (!infoPane || !resizeHandle) return;

        let startY, startHeight;

        const startDrag = (e) => {
            if (e.cancelable) e.preventDefault();

            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            startY = clientY;
            startHeight = parseInt(document.defaultView.getComputedStyle(infoPane).height, 10);

            const events = {
                'mousemove': doDrag,
                'mouseup': stopDrag,
                'touchmove': doDrag,
                'touchend': stopDrag
            };

            Object.entries(events).forEach(([event, handler]) => {
                document.documentElement.addEventListener(event, handler, 
                    event.includes('touch') ? { passive: false } : false);
            });
        };

        const doDrag = (e) => {
            if (e.cancelable) e.preventDefault();

            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            const newHeight = startHeight - (clientY - startY);

            const bottomBarHeight = parseFloat(getComputedStyle(document.documentElement)
                .getPropertyValue('--bottom-bar-height') || '0');
            const maxHeight = (window.visualViewport ? window.visualViewport.height : window.innerHeight) - bottomBarHeight;

            infoPane.style.height = `${Math.min(Math.max(40, newHeight), maxHeight)}px`;
            requestAnimationFrame(adjustMapSize);
        };

        const stopDrag = () => {
            // Use the same structure as when adding the event listeners
            const events = {
                'mousemove': doDrag,
                'mouseup': stopDrag,
                'touchmove': doDrag,
                'touchend': stopDrag
            };

            Object.entries(events).forEach(([event, handler]) => {
                document.documentElement.removeEventListener(event, handler, 
                    event.includes('touch') ? { passive: false } : false);
            });
        };

        resizeHandle.addEventListener('mousedown', startDrag, false);
        resizeHandle.addEventListener('touchstart', startDrag, { passive: false });
    },

    // Simplified tooltip handlers using shared code
    attachDateTooltip(element, routeNumber, customDateRange) {
        let tooltipTimeout;
        
        const getTooltipText = () => {
            // First try from selectedRoute if available
            const selectedRoute = appState.selectedRoutes[routeNumber];
            if (selectedRoute?.displayData) {
                const { departure, arrival } = selectedRoute.displayData;
                const options = { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric', 
                                 hour: 'numeric', minute: '2-digit', hour12: true };
                return `${new Date(departure).toLocaleString('en-US', options)} to ${new Date(arrival).toLocaleString('en-US', options)}`;
            }
            
            // Then try from routeData if available
            const routeData = appState.routeData[routeNumber];
            if (routeData && (routeData.departDate || routeData.returnDate)) {
                return this.formatDateRangeTooltip(routeData.departDate, routeData.returnDate);
            }
            
            // Next try from custom date range parameter
            if (customDateRange) {
                return this.formatDateRangeTooltip(customDateRange.depart, customDateRange.return);
            }
            
            // Finally fall back to legacy routeDates
            const dateRange = appState.routeDates[routeNumber];
            if (dateRange) {
                return this.formatDateRangeTooltip(dateRange.depart, dateRange.return);
            }
            
            return '';
        };
        
        element.addEventListener('mouseover', function() {
            const tooltipText = getTooltipText();
            if (tooltipText) {
                uiHandling.showDateTooltip(this, tooltipText);
                tooltipTimeout = setTimeout(uiHandling.hideDateTooltip, 2000);
            }
        });
        
        element.addEventListener('mouseout', function() {
            clearTimeout(tooltipTimeout);
            uiHandling.hideDateTooltip();
        });
    },
    
    // Helper method to format date range tooltip
    formatDateRangeTooltip(departDate, returnDate) {
        if (!departDate) return '';
        
        const formatDate = (dateStr) => {
            if (!dateStr || dateStr === 'null') return '';
            try {
                const date = new Date(dateStr);
                return date.toLocaleDateString('en-US', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            } catch (e) {
                console.error('Error formatting date:', e);
                return dateStr;
            }
        };
        
        const formattedDepart = formatDate(departDate);
        const formattedReturn = formatDate(returnDate);
        
        return formattedReturn && formattedReturn !== 'null' ? 
            `${formattedDepart} to ${formattedReturn}` : 
            formattedDepart;
    },

    showDateTooltip(element, text) {
        clearTimeout(this.tooltipTimeout);
        this.tooltipTimeout = setTimeout(() => {
            const tooltip = document.createElement('div');
            tooltip.className = 'dateTooltip';
            tooltip.textContent = text;
            document.body.appendChild(tooltip);
            
            const rect = element.getBoundingClientRect();
            const containerRect = document.querySelector('.container').getBoundingClientRect();
            tooltip.style.cssText = `position:absolute;left:${rect.left - containerRect.left}px;top:${rect.bottom - containerRect.top}px`;
        }, 300);
    },

    hideDateTooltip() {
        clearTimeout(this.tooltipTimeout);
        document.querySelectorAll('.dateTooltip').forEach(tooltip => tooltip.remove());
    },

    positionDropdown(dropdownBtn, dropdownList) {
        if (!dropdownBtn || !dropdownList) return;
        
        const buttonRect = dropdownBtn.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const dropdownHeight = dropdownList.offsetHeight;
        const dropdownWidth = dropdownList.offsetWidth;

        // Calculate horizontal position
        let left = Math.max(5, Math.min(buttonRect.left, viewportWidth - dropdownWidth));

        // Calculate vertical position - check space below vs. above
        const spaceBelow = viewportHeight - buttonRect.bottom;
        const spaceAbove = buttonRect.top;
        
        // Position based on available space
        const isBelow = spaceBelow >= dropdownHeight || spaceBelow > spaceAbove;
        dropdownList.style.cssText = `
            position:fixed;
            top:${isBelow ? buttonRect.bottom : 'auto'}px;
            bottom:${!isBelow ? viewportHeight - buttonRect.top : 'auto'}px;
            left:${left}px;
            z-index:2000;
        `;
        
        dropdownList.classList.toggle('dropdown-up', !isBelow);
    }
};

// Combine window event listeners for better performance
const handleViewportChange = () => {
    setBottomBarHeight();
    adjustMapSize();
};

['resize', 'orientationchange'].forEach(event => {
    window.addEventListener(event, handleViewportChange);
});

if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', handleViewportChange);
}

document.addEventListener('DOMContentLoaded', () => {
    estimateBottomBarHeight();
    setBottomBarHeight();
    uiHandling.initInfoPaneDragButton();
    adjustMapSize();
});

export { uiHandling };