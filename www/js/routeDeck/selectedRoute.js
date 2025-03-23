import { appState, updateState } from '../stateManager.js';
import { infoPaneHeight } from '../utils/infoPaneHeightManager.js';
import { flightMap } from '../flightMap.js';
import { airlineLogoManager } from '../utils/airlineLogoManager.js';
import { formatFlightDateTime } from './routeCard.js';

// Load the selectedRoute CSS
(function loadSelectedRouteCSS() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './css/selectedRoute.css';
    document.head.appendChild(link);
})();

const selectedRoute = {
    displaySelectedRouteInfo: async function(routeIndex) {
        const selectedRouteDetails = appState.selectedRoutes[String(routeIndex)];

        if (!selectedRouteDetails) {
            console.error(`Selected route details not found for routeIndex: ${routeIndex}`);
            return;
        }

        // Clear existing content first
        const infoPaneContent = document.getElementById('infoPaneContent');
        infoPaneContent.innerHTML = '';

        // Create content wrapper
        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'content-wrapper';
        infoPaneContent.appendChild(contentWrapper);

        // Get detailed route information
        const routeDetails = selectedRouteDetails.displayData;
        const fullData = selectedRouteDetails.fullData;
        
        // Get airport information
        const [originCode, destCode] = routeDetails.route.split(' > ');
        const originAirport = await this.getAirportInfo(originCode);
        const destAirport = await this.getAirportInfo(destCode);
        
        // Get airline logo
        const airlineLogo = await airlineLogoManager.getLogoUrl(routeDetails.airline);
        
        // Calculate flight duration and time of day
        const departureDate = new Date(routeDetails.departure);
        const arrivalDate = new Date(routeDetails.arrival);
        const flightDuration = this.calculateDuration(fullData);
        const departureTimeOfDay = this.getTimeOfDay(departureDate);
        const arrivalTimeOfDay = this.getTimeOfDay(arrivalDate);
        
        // Create the HTML structure for the flight details page
        const detailsContainer = document.createElement('div');
        detailsContainer.className = 'selected-route-container';
        
        detailsContainer.innerHTML = `
            <div class="flight-header">
                <div class="back-button">
                    <button class="change-route-button">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                        Back to Search
                    </button>
                </div>
                <div class="flight-price">$${Math.ceil(routeDetails.price)}</div>
            </div>
            
            <div class="flight-overview">
                <div class="airline-details">
                    <img src="${airlineLogo}" alt="${routeDetails.airline}" class="airline-logo">
                    <div class="airline-name">${routeDetails.airline}</div>
                </div>
                
                <div class="route-summary">
                    <div class="city-pair">
                        <div class="origin-city">${originAirport?.city || originCode}</div>
                        <div class="route-line">
                            <svg class="plane-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M21,16V14L13,9V3.5A1.5,1.5,0,0,0,11.5,2A1.5,1.5,0,0,0,10,3.5V9L2,14V16L10,13.5V19L8,20.5V22L11.5,21L15,22V20.5L13,19V13.5L21,16Z" />
                            </svg>
                        </div>
                        <div class="destination-city">${destAirport?.city || destCode}</div>
                    </div>
                    <div class="flight-duration">
                        <div class="duration-label">Flight duration</div>
                        <div class="duration-value">${flightDuration}</div>
                    </div>
                </div>
            </div>
            
            <div class="flight-main-details">
                <div class="flight-timeline">
                    <div class="timeline-node departure">
                        <div class="timeline-time">${formatFlightDateTime(departureDate, 'time')}</div>
                        <div class="timeline-date">${formatFlightDateTime(departureDate, 'date')}</div>
                        <div class="timeline-label">${departureTimeOfDay} Departure</div>
                    </div>
                    
                    <div class="timeline-path">
                        <div class="day-night-indicator" data-time-of-day="${departureTimeOfDay}"></div>
                    </div>
                    
                    <div class="timeline-node arrival">
                        <div class="timeline-time">${formatFlightDateTime(arrivalDate, 'time')}</div>
                        <div class="timeline-date">${formatFlightDateTime(arrivalDate, 'date')}</div>
                        <div class="timeline-label">${arrivalTimeOfDay} Arrival</div>
                    </div>
                </div>
            </div>
            
            <div class="airport-details">
                <div class="airport-card origin">
                    <div class="airport-header">
                        <div class="airport-code">${originCode}</div>
                        <div class="airport-name">${originAirport?.name || 'Airport information unavailable'}</div>
                    </div>
                    <div class="airport-info">
                        <div class="info-item">
                            <svg class="info-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M12,11.5A2.5,2.5,0,0,1,9.5,9A2.5,2.5,0,0,1,12,6.5A2.5,2.5,0,0,1,14.5,9A2.5,2.5,0,0,1,12,11.5M12,2A7,7,0,0,0,5,9C5,14.25,12,22,12,22C12,22,19,14.25,19,9A7,7,0,0,0,12,2Z" /></svg>
                            <span>${originAirport?.city || 'Unknown City'}, ${originAirport?.country || 'Country'}</span>
                        </div>
                        <div class="info-item">
                            <svg class="info-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M12,20A8,8,0,0,0,20,12A8,8,0,0,0,12,4A8,8,0,0,0,4,12A8,8,0,0,0,12,20M12,2A10,10,0,0,1,22,12A10,10,0,0,1,12,22A10,10,0,0,1,2,12A10,10,0,0,1,12,2M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z" /></svg>
                            <span>Terminal info unavailable</span>
                        </div>
                    </div>
                </div>
                
                <div class="airport-card destination">
                    <div class="airport-header">
                        <div class="airport-code">${destCode}</div>
                        <div class="airport-name">${destAirport?.name || 'Airport information unavailable'}</div>
                    </div>
                    <div class="airport-info">
                        <div class="info-item">
                            <svg class="info-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M12,11.5A2.5,2.5,0,0,1,9.5,9A2.5,2.5,0,0,1,12,6.5A2.5,2.5,0,0,1,14.5,9A2.5,2.5,0,0,1,12,11.5M12,2A7,7,0,0,0,5,9C5,14.25,12,22,12,22C12,22,19,14.25,19,9A7,7,0,0,0,12,2Z" /></svg>
                            <span>${destAirport?.city || 'Unknown City'}, ${destAirport?.country || 'Country'}</span>
                        </div>
                        <div class="info-item">
                            <svg class="info-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M12,20A8,8,0,0,0,20,12A8,8,0,0,0,12,4A8,8,0,0,0,4,12A8,8,0,0,0,12,20M12,2A10,10,0,0,1,22,12A10,10,0,0,1,12,22A10,10,0,0,1,2,12A10,10,0,0,1,12,2M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z" /></svg>
                            <span>Terminal info unavailable</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="flight-extras">
                <div class="baggage-info">
                    <svg class="baggage-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M17.03,14H12V16H17.03M5,12.5A1.5,1.5,0,0,0,3.5,14A1.5,1.5,0,0,0,5,15.5A1.5,1.5,0,0,0,6.5,14A1.5,1.5,0,0,0,5,12.5M12,5A3,3,0,0,0,9,8V9H19V18H9V19A3,3,0,0,0,12,22A3,3,0,0,0,15,19V8A3,3,0,0,0,12,5M5,9.5A1.5,1.5,0,0,0,3.5,11A1.5,1.5,0,0,0,5,12.5A1.5,1.5,0,0,0,6.5,11A1.5,1.5,0,0,0,5,9.5M5,6.5A1.5,1.5,0,0,0,3.5,8A1.5,1.5,0,0,0,5,9.5A1.5,1.5,0,0,0,6.5,8A1.5,1.5,0,0,0,5,6.5M5,3.5A1.5,1.5,0,0,0,3.5,5A1.5,1.5,0,0,0,5,6.5A1.5,1.5,0,0,0,6.5,5A1.5,1.5,0,0,0,5,3.5Z" /></svg>
                    <div class="baggage-details">
                        <div class="baggage-title">Checked Baggage</div>
                        <div class="baggage-price">$${Math.ceil(fullData?.bags_price?.[1] * appState.eurToUsd || 30)}</div>
                    </div>
                </div>
                
                <div class="amenities">
                    <div class="amenity-item">
                        <svg class="amenity-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M12,2A7,7,0,0,0,5,9C5,11.38,6.67,13.42,9,13.9V16H7V18H9V20H7V22H17V20H15V18H17V16H15V13.9C17.33,13.42,19,11.38,19,9A7,7,0,0,0,12,2M12,4A5,5,0,0,1,17,9C17,11.21,14.76,13,12,13C9.24,13,7,11.21,7,9A5,5,0,0,1,12,4M14,15V20H10V15H14Z" /></svg>
                        <span>In-flight meals available</span>
                    </div>
                    <div class="amenity-item">
                        <svg class="amenity-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M12,21L15.6,16.2C14.6,15.45 13.35,15 12,15C10.65,15 9.4,15.45 8.4,16.2L12,21M12,3C7.95,3 4.21,4.34 1.2,6.6L3,9C5.5,7.12 8.62,6 12,6C15.38,6 18.5,7.12 21,9L22.8,6.6C19.79,4.34 16.05,3 12,3M12,9C9.3,9 6.81,9.89 4.8,11.4L6.6,13.8C8.1,12.67 9.97,12 12,12C14.03,12 15.9,12.67 17.4,13.8L19.2,11.4C17.19,9.89 14.7,9 12,9Z" /></svg>
                        <span>Wi-Fi available on board</span>
                    </div>
                    <div class="amenity-item">
                        <svg class="amenity-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z" /></svg>
                        <span>Flight tracking</span>
                    </div>
                </div>
            </div>
            
            <div class="booking-section">
                <a href="${routeDetails.deep_link}" target="_blank" class="booking-button">
                    Book this flight
                </a>
            </div>
        `;
        
        contentWrapper.appendChild(detailsContainer);
        
        // Add back button functionality
        const backButton = detailsContainer.querySelector('.change-route-button');
        backButton.addEventListener('click', () => {
            appState.currentView = 'routeDeck';
            appState.currentRouteIndex = routeIndex;
            document.dispatchEvent(new CustomEvent('stateChange', { 
                detail: { key: 'changeView', value: 'routeDeck' } 
            }));
        });
        
        // Make sure infoPane is expanded
        const infoPane = document.getElementById('infoPane');
        infoPane.classList.remove('collapsed');
        infoPane.classList.add('expanded');
        
        // Set the appropriate info pane height with more space for the detailed content
        infoPaneHeight.setHeight('content', {
            contentElement: detailsContainer,
            contentHeight: Math.min(window.innerHeight * 0.7, detailsContainer.scrollHeight + 50)
        });
        
        // Update current view and route index
        appState.currentView = 'selectedRoute';
        appState.currentRouteIndex = routeIndex;
    },
    
    // Helper functions
    getAirportInfo: async function(iataCode) {
        try {
            return await flightMap.getAirportDataByIata(iataCode);
        } catch (error) {
            console.error('Error getting airport data:', error);
            return null;
        }
    },
    
    calculateDuration: function(flightData) {
        // Extract duration in hours and minutes
        let durationHours = 0;
        let durationMinutes = 0;
        
        if (flightData.duration) {
            if (typeof flightData.duration.flight === 'number') {
                durationHours = Math.floor(flightData.duration.flight / 3600);
                durationMinutes = Math.floor((flightData.duration.flight % 3600) / 60);
            } else if (typeof flightData.duration === 'number') {
                durationHours = Math.floor(flightData.duration / 3600);
                durationMinutes = Math.floor((flightData.duration % 3600) / 60);
            }
        } else if (flightData.fly_duration) {
            const durMatch = flightData.fly_duration.match(/(\d+)h\s*(?:(\d+)m)?/);
            if (durMatch) {
                durationHours = parseInt(durMatch[1]) || 0;
                durationMinutes = parseInt(durMatch[2]) || 0;
            }
        }
        
        return `${durationHours}h ${durationMinutes}m`;
    },
    
    getTimeOfDay: function(date) {
        const hours = date.getHours();
        if (hours >= 5 && hours < 12) return 'Morning';
        if (hours >= 12 && hours < 18) return 'Afternoon';
        if (hours >= 18 && hours < 22) return 'Evening';
        return 'Night';
    }
};

export { selectedRoute };