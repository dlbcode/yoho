import { appState, updateState } from "./stateManager.js";
import { adjustMapSize } from "./map.js";
import { inputManager } from "./inputManager.js";

// Add CSS for placeholder fix
const placeholderFixCss = document.createElement('link');
placeholderFixCss.rel = 'stylesheet';
placeholderFixCss.href = 'css/placeholder-fix.css';
document.head.appendChild(placeholderFixCss);

let estimatedBottomBarHeight = 0;

const estimateBottomBarHeight = () => {
    const input = document.createElement('input');
    input.style.position = 'absolute';
    input.style.bottom = '0';
    input.style.opacity = '0';
    document.body.appendChild(input);

    const initialViewportHeight = window.visualViewport.height;

    input.focus();

    setTimeout(() => {
        const focusedViewportHeight = window.visualViewport.height;
        estimatedBottomBarHeight = initialViewportHeight - focusedViewportHeight;

        document.body.removeChild(input);
    }, 500);
};

const setBottomBarHeight = () => {
    const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    const fullHeight = window.innerHeight;
    const bottomBarHeight = fullHeight - viewportHeight;
    document.documentElement.style.setProperty('--bottom-bar-height', `${bottomBarHeight}px`);
};

const uiHandling = {
    // Replace with delegation to inputManager
    setFocusToNextUnsetInput() {
        inputManager.setFocusToNextUnsetInput();
    },

    initInfoPaneDragButton: function () {
        const infoPane = document.getElementById('infoPane');
        const resizeHandle = document.getElementById('resizeHandle');

        let startY, startHeight;

        const startDrag = (e) => {
            if (e.cancelable) {
                e.preventDefault();
            }

            const clientY = e.touches ? e.touches[0].clientY : e.clientY;

            startY = clientY;
            startHeight = parseInt(document.defaultView.getComputedStyle(infoPane).height, 10);

            document.documentElement.addEventListener('mousemove', doDrag, false);
            document.documentElement.addEventListener('mouseup', stopDrag, false);
            document.documentElement.addEventListener('touchmove', doDrag, { passive: false });
            document.documentElement.addEventListener('touchend', stopDrag, false);
        };

        const doDrag = (e) => {
            if (e.cancelable) {
                e.preventDefault();
            }

            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            const newHeight = startHeight - (clientY - startY);

            const bottomBarHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bottom-bar-height'));
            const maxHeight = (window.visualViewport ? window.visualViewport.height : window.innerHeight) - bottomBarHeight;

            infoPane.style.height = `${Math.min(Math.max(40, newHeight), maxHeight)}px`;
            requestAnimationFrame(adjustMapSize); // Ensure this is called to adjust map size
        };

        const stopDrag = () => {
            document.documentElement.removeEventListener('mousemove', doDrag, false);
            document.documentElement.removeEventListener('mouseup', stopDrag, false);
            document.documentElement.removeEventListener('touchmove', doDrag, false);
            document.documentElement.removeEventListener('touchend', stopDrag, false);
        };

        resizeHandle.addEventListener('mousedown', startDrag, false);
        resizeHandle.addEventListener('touchstart', startDrag, { passive: false });
    },

    attachDateTooltip: function (element, routeNumber) {
        let tooltipTimeout;
        element.addEventListener('mouseover', function () {
            const selectedRoute = appState.selectedRoutes[routeNumber];
            if (selectedRoute && selectedRoute.displayData) {
                const { departure, arrival } = selectedRoute.displayData;
                const departureDate = new Date(departure);
                const arrivalDate = new Date(arrival);
                const options = { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true };
                const formattedDeparture = departureDate.toLocaleString('en-US', options);
                const formattedArrival = arrivalDate.toLocaleString('en-US', options);
                const tooltipText = `${formattedDeparture} to ${formattedArrival}`;
                uiHandling.showDateTooltip(this, tooltipText);
            } else {
                const routeDate = appState.routeDates[routeNumber];
                if (routeDate) {
                    uiHandling.showDateTooltip(this, routeDate);
                }
            }
            tooltipTimeout = setTimeout(uiHandling.hideDateTooltip, 2000);
        });
        element.addEventListener('mouseout', function () {
            clearTimeout(tooltipTimeout);
            uiHandling.hideDateTooltip();
        });
    },

    showDateTooltip: function (element, text) {
        clearTimeout(this.tooltipTimeout);
        this.tooltipTimeout = setTimeout(() => {
            const tooltip = document.createElement('div');
            tooltip.className = 'dateTooltip';
            tooltip.textContent = text;
            document.body.appendChild(tooltip);
            const rect = element.getBoundingClientRect();
            const containerRect = document.querySelector('.container').getBoundingClientRect();
            tooltip.style.position = 'absolute';
            tooltip.style.left = `${rect.left - containerRect.left}px`;
            tooltip.style.top = `${rect.bottom - containerRect.top}px`;
        }, 300);
    },

    hideDateTooltip: function () {
        clearTimeout(this.tooltipTimeout);
        document.querySelectorAll('.dateTooltip').forEach(tooltip => {
            tooltip.remove();
        });
    },

    positionDropdown: function (dropdownBtn, dropdownList) {
        const buttonRect = dropdownBtn.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const dropdownHeight = dropdownList.offsetHeight;
        const dropdownWidth = dropdownList.offsetWidth;

        // Set fixed positioning
        dropdownList.style.position = 'fixed';
        
        // Calculate horizontal position
        let left = buttonRect.left;
        // If dropdown would overflow to the right, align it to the right edge of the button
        if (left + dropdownWidth > viewportWidth) {
            left = buttonRect.right - dropdownWidth;
        }
        // If still overflows (rare case with very wide dropdown), align to viewport edge with padding
        if (left < 0) {
            left = 5; // 5px padding from viewport edge
        }

        // Calculate vertical position - check space below vs. above
        const spaceBelow = viewportHeight - buttonRect.bottom;
        const spaceAbove = buttonRect.top;
        
        let top;
        if (spaceBelow >= dropdownHeight || spaceBelow > spaceAbove) {
            // Position below - directly touching the bottom of the button
            top = buttonRect.bottom;
            dropdownList.classList.remove('dropdown-up');
        } else {
            // Position above - directly touching the top of the button
            top = buttonRect.top - dropdownHeight;
            dropdownList.classList.add('dropdown-up');
        }

        // Apply calculated position
        dropdownList.style.top = `${top}px`;
        dropdownList.style.left = `${left}px`;
        dropdownList.style.zIndex = '2000';
    }
}

window.addEventListener('resize', () => {
    setBottomBarHeight();
    adjustMapSize();
});

window.addEventListener('orientationchange', () => {
    setBottomBarHeight();
    adjustMapSize();
});

if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
        setBottomBarHeight();
        adjustMapSize();
    });
}

document.addEventListener('DOMContentLoaded', () => {
    estimateBottomBarHeight();
    setBottomBarHeight();
    uiHandling.initInfoPaneDragButton();
    adjustMapSize();
});

export { uiHandling };