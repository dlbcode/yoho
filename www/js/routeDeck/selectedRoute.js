import { appState, updateState } from '../stateManager.js';
import { infoPaneHeight } from '../utils/infoPaneHeightManager.js';
import { flightMap } from '../flightMap.js';
import { airlineLogoManager } from '../utils/airlineLogoManager.js';
import { formatFlightDateTime } from './routeCard.js';
import { selectedRouteGroup, generateRouteDescription as generateGroupRouteDescription } from './selectedRouteGroup.js';
import { calculateFlightDuration } from '../utils/durationCalc.js';

// Load the selectedRoute CSS
(function loadSelectedRouteCSS() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './css/selectedRoute.css';
    document.head.appendChild(link);
})();

// Cache for airline names
let airlineNamesCache = null;

// Function to load airline names from JSON file
async function loadAirlineNames() {
    if (airlineNamesCache) {
        return airlineNamesCache;
    }
    
    try {
        const response = await fetch('./assets/airlines.json');
        if (!response.ok) {
            throw new Error(`Failed to load airlines.json: ${response.status}`);
        }
        airlineNamesCache = await response.json();
        return airlineNamesCache;
    } catch (error) {
        console.error('Error loading airline names:', error);
        return {};
    }
}

// Function to get full airline name from code
async function getAirlineName(airlineCode) {
    const airlines = await loadAirlineNames();
    return airlines[airlineCode] || airlineCode;
}

// Generate route description for a route group
function generateRouteDescription(routeIndex) {
    // Use routeData instead of selectedRoutes
    const selectedRoute = appState.routeData[routeIndex]?.selectedRoute;
    if (!selectedRoute) return '';
    
    // Use the shared function from selectedRouteGroup, but ensure we're using our own icons
    // This ensures we're consistent across both views
    return generateGroupRouteDescription(selectedRoute.group, routeIndex);
}

// Replace legacy helper function
function generateOverallRoute(routeIndex) {
    // Use routeData exclusively
    const selectedRoute = appState.routeData[routeIndex]?.selectedRoute;
    if (!selectedRoute) return '';

    const currentGroupId = selectedRoute.group;
    // Find all routes that belong to the same group in routeData only
    const routeSegments = Object.entries(appState.routeData)
        .filter(([_, route]) => route && route.selectedRoute && route.selectedRoute.group === currentGroupId)
        .map(([_, route]) => {
            // Extract origin and destination from the route
            const [origin, destination] = route.selectedRoute.displayData.route.split(' > ');
            return { origin, destination };
        })
        .sort((a, b) => a.index - b.index);
    
    if (routeSegments.length === 0) return '';
    
    // Get first origin and last destination for overall route
    const firstOrigin = routeSegments[0].origin;
    const lastDestination = routeSegments[routeSegments.length - 1].destination;
    
    return `${firstOrigin}-${lastDestination}`;
}

const selectedRoute = {
    displaySelectedRouteInfo: async function(routeIndex) {
        // Remove group-route-button class from all buttons first
        if (selectedRouteGroup && typeof selectedRouteGroup.removeGroupButtonStyles === 'function') {
            selectedRouteGroup.removeGroupButtonStyles();
        }
        
        // Use routeData instead of selectedRoutes
        const selectedRouteDetails = appState.routeData[routeIndex]?.selectedRoute;

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

        // Get detailed route information - add more safety checks
        const routeDetails = selectedRouteDetails.displayData;
        const fullData = selectedRouteDetails.fullData;
        
        // Add robust error checking for route details
        if (!routeDetails) {
            console.error('Missing displayData in selectedRouteDetails');
            
            // Create fallback route details container
            const fallbackContainer = document.createElement('div');
            fallbackContainer.className = 'error-container';
            fallbackContainer.innerHTML = `
                <h3>Error Loading Flight Details</h3>
                <p>Unable to load flight details. The selected flight information may be incomplete.</p>
                <button id="backToSearchButton" class="booking-button">Back to Search</button>
            `;
            
            contentWrapper.appendChild(fallbackContainer);
            
            // Add listener to the back button
            const backButton = fallbackContainer.querySelector('#backToSearchButton');
            backButton.addEventListener('click', () => {
                // Go back to route deck
                appState.currentView = 'routeDeck';
                appState.currentRouteIndex = routeIndex;
                
                import('../routeDeck/routeDeck.js').then(({ buildRouteDeck }) => {
                    buildRouteDeck(routeIndex);
                });
            });
            
            return;
        }
        
        // Get airport information - check if route exists
        if (!routeDetails.route) {
            console.error('Missing route in routeDetails:', routeDetails);
            
            // Create fallback message
            const fallbackContainer = document.createElement('div');
            fallbackContainer.className = 'error-container';
            fallbackContainer.innerHTML = `
                <h3>Invalid Route Information</h3>
                <p>The route information for this flight is incomplete.</p>
                <button id="backToSearchButton" class="booking-button">Back to Search</button>
            `;
            
            contentWrapper.appendChild(fallbackContainer);
            
            // Add listener to the back button
            const backButton = fallbackContainer.querySelector('#backToSearchButton');
            backButton.addEventListener('click', () => {
                // Go back to route deck
                appState.currentView = 'routeDeck';
                appState.currentRouteIndex = routeIndex;
                
                import('../routeDeck/routeDeck.js').then(({ buildRouteDeck }) => {
                    buildRouteDeck(routeIndex);
                });
            });
            
            return;
        }
        
        const routeParts = routeDetails.route.split(' > ');
        if (routeParts.length < 2) {
            console.error('Invalid route format:', routeDetails.route);
            return;
        }
        
        const [originCode, destCode] = routeParts;
        const originAirport = await this.getAirportInfo(originCode);
        const destAirport = await this.getAirportInfo(destCode);
        
        // Get airline logo
        const airlineLogo = await airlineLogoManager.getLogoUrl(routeDetails.airline);
        
        // Get full airline name
        const airlineName = await getAirlineName(routeDetails.airline);
        
        // Calculate flight duration and time of day
        // Make sure we're properly constructing Date objects from the string dates
        const departureDate = new Date(routeDetails.departure);
        const arrivalDate = new Date(routeDetails.arrival);

        // If fullData contains more precise time information, use that instead
        const departureDateWithTime = fullData && fullData.local_departure ? 
            new Date(fullData.local_departure) : 
            fullData && fullData.dTime ? 
                new Date(fullData.dTime * 1000) : 
                departureDate;
                
        const arrivalDateWithTime = fullData && fullData.local_arrival ? 
            new Date(fullData.local_arrival) : 
            fullData && fullData.aTime ? 
                new Date(fullData.aTime * 1000) : 
                arrivalDate;

        const flightDuration = this.calculateDuration(fullData);
        const departureTimeOfDay = this.getTimeOfDay(departureDateWithTime);
        const arrivalTimeOfDay = this.getTimeOfDay(arrivalDateWithTime);
        
        // Format flight times correctly using the more precise dates
        const formattedDepartureTime = this.formatFlightTime(departureDateWithTime);
        const formattedArrivalTime = this.formatFlightTime(arrivalDateWithTime);
        const formattedDepartureDate = this.formatFlightDate(departureDateWithTime);
        const formattedArrivalDate = this.formatFlightDate(arrivalDateWithTime);
        
        // Generate the route description
        const routeDescription = generateRouteDescription(routeIndex);
        
        // Generate the overall route
        const overallRoute = generateOverallRoute(routeIndex);
        
        // Create the HTML structure for the flight details page
        const detailsContainer = document.createElement('div');
        detailsContainer.className = 'selected-route-container';
        
        detailsContainer.innerHTML = `
            <div class="flight-header">
                <div class="back-button">
                    <button class="change-route-button">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                        Change flight
                    </button>
                </div>
                <div class="overall-route" tabindex="0" role="button">${overallRoute}</div>
                <div class="route-description">${routeDescription}</div>
                <div class="flight-price">$${Math.ceil(routeDetails.price)}</div>
            </div>
            
            <div class="flight-overview">
                <div class="airline-details">
                    <img src="${airlineLogo}" alt="${airlineName}" class="airline-logo">
                    <div class="airline-name">${airlineName}</div>
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
                        <div class="timeline-time">${formattedDepartureTime}</div>
                        <div class="timeline-date">${formattedDepartureDate}</div>
                        <div class="timeline-label">${departureTimeOfDay} Departure</div>
                    </div>
                    
                    <div class="timeline-path">
                        <div class="day-night-indicator" data-time-of-day="${departureTimeOfDay}"></div>
                    </div>
                    
                    <div class="timeline-node arrival">
                        <div class="timeline-time">${formattedArrivalTime}</div>
                        <div class="timeline-date">${formattedArrivalDate}</div>
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
                            <svg class="info-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M12,11.5A2.5,2.5,0,0,1,9.5,9A2.5,2.5,0,0,1,12,6.5A2.5,2.5,0,0,1,14.5,9A2.5,2.5,0,0,1,12,11.5M12,2A7,7,0,0,0,5,9C5,11.38,6.67,13.42,9,13.9V16H7V18H9V20H7V22H17V20H15V18H17V16H15V13.9C17.33,13.42,19,11.38,19,9A7,7,0,0,0,12,2M12,4A5,5,0,0,1,17,9C17,11.21,14.76,13,12,13C9.24,13,7,11.21,7,9A5,5,0,0,1,12,4M14,15V20H10V15H14Z" /></svg>
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
                    <img src="assets/baggage-icon.svg" alt="Baggage" class="baggage-icon">
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
            // Get the current route details to use for search
            const selectedRouteDetails = appState.routeData[routeIndex]?.selectedRoute;
            
            if (selectedRouteDetails && selectedRouteDetails.displayData) {
                // Extract origin and destination safely with a fallback
                const routeParts = selectedRouteDetails.displayData.route?.split(' > ') || [];
                const origin = routeParts[0] || '';
                const destination = routeParts[1] || '';
                const departureDate = selectedRouteDetails.displayData.departure;
                
                // No need to update waypoints as they don't exist anymore - directly update routeData
                if (origin && destination) {
                    // Ensure we have valid origin and destination in routeData
                    updateState('updateRouteData', {
                        routeNumber: routeIndex,
                        data: {
                            origin: {
                                iata_code: origin,
                                city: origin
                            },
                            destination: {
                                iata_code: destination,
                                city: destination
                            }
                        }
                    }, 'selectedRoute.backButton');
                }
                
                // Update the route date if needed - use updateRouteData instead of updateRouteDate
                if (departureDate) {
                    const formattedDate = new Date(departureDate).toISOString().split('T')[0];
                    updateState('updateRouteData', {
                        routeNumber: routeIndex,
                        data: {
                            departDate: formattedDate,
                            returnDate: null
                        }
                    }, 'selectedRoute.backButton');
                }
                
                // Set the current view to the route deck
                appState.currentView = 'routeDeck';
                appState.currentRouteIndex = routeIndex;
                
                // Rest of the code remains unchanged
                const infoPane = document.getElementById('infoPane');
                infoPane.classList.add('search-results');
                appState.searchResultsLoading = true;

                // Build route deck with the current route index to search for flights
                import('../routeDeck/routeDeck.js').then(({ buildRouteDeck }) => {
                    buildRouteDeck(routeIndex).then(() => {
                        // Once the deck is built, expand the pane
                        const infoPaneElement = document.getElementById('infoPane');
                        infoPaneElement.classList.remove('collapsed');
                        infoPaneElement.classList.add('expanded');
                        
                        // Notify about the view change
                        document.dispatchEvent(new CustomEvent('stateChange', { 
                            detail: { key: 'changeView', value: 'routeDeck' } 
                        }));
                        
                        // Reset loading state
                        setTimeout(() => appState.searchResultsLoading = false, 500);
                    });
                });
            } else {
                // Fallback if no route details are available
                appState.currentView = 'routeDeck';
                appState.currentRouteIndex = routeIndex;
                document.dispatchEvent(new CustomEvent('stateChange', { 
                    detail: { key: 'changeView', value: 'routeDeck' } 
                }));
            }
        });
        
        // Add click functionality to the overall route element
        const overallRouteElement = detailsContainer.querySelector('.overall-route');
        if (overallRouteElement) {
            // Store the group ID to use when clicked
            const groupId = selectedRouteDetails.group;
            
            // Add click event listener
            overallRouteElement.addEventListener('click', () => {
                this.displayFullJourneyInfo(groupId);
            });
            
            // Add keyboard accessibility
            overallRouteElement.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    this.displayFullJourneyInfo(groupId);
                }
            });
        }
        
        // Add event listeners for route segment clicks after the content is added to DOM
        setTimeout(() => {
            const routeSegments = document.querySelectorAll('.route-segment');
            routeSegments.forEach(segment => {
                segment.addEventListener('click', (event) => {
                    const clickedSegmentIndex = parseInt(event.currentTarget.getAttribute('data-route-index'));
                    if (!isNaN(clickedSegmentIndex) && clickedSegmentIndex !== routeIndex) {
                        // Prevent default navigation behavior
                        event.preventDefault();
                        // Display the selected route info for the clicked segment
                        this.displaySelectedRouteInfo(clickedSegmentIndex);
                    }
                });
                
                // Handle keyboard navigation (Enter/Space)
                segment.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        const clickedSegmentIndex = parseInt(event.currentTarget.getAttribute('data-route-index'));
                        if (!isNaN(clickedSegmentIndex) && clickedSegmentIndex !== routeIndex) {
                            this.displaySelectedRouteInfo(clickedSegmentIndex);
                        }
                    }
                });
            });
        }, 0);
        
        // Make sure infoPane is expanded
        const infoPane = document.getElementById('infoPane');
        infoPane.classList.remove('collapsed');
        infoPane.classList.add('expanded');
        
        // Set the appropriate info pane height with consistent sizing
        infoPaneHeight.setRouteDetailsHeight(detailsContainer);
        
        // Update current view and route index
        appState.currentView = 'selectedRoute';
        appState.currentRouteIndex = routeIndex;

        // Update the route button visual state to show it's selected
        this.updateRouteButtonState(routeIndex);
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
        // Use the shared utility function
        return calculateFlightDuration(flightData, true);
    },
    
    getTimeOfDay: function(date) {
        const hours = date.getHours();
        if (hours >= 5 && hours < 12) return 'Morning';
        if (hours >= 12 && hours < 18) return 'Afternoon';
        if (hours >= 18 && hours < 22) return 'Evening';
        return 'Night';
    },
    
    // New helper functions for consistent time and date formatting
    formatFlightTime: function(date) {
        // Ensure we have a valid date
        if (!(date instanceof Date) || isNaN(date)) {
            console.error("Invalid date provided to formatFlightTime:", date);
            return "Invalid Time";
        }
        
        try {
            return date.toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit',
                hour12: true
            });
        } catch (e) {
            console.error("Error formatting flight time:", e);
            return "Time Error";
        }
    },
    
    formatFlightDate: function(date) {
        // Ensure we have a valid date
        if (!(date instanceof Date) || isNaN(date)) {
            console.error("Invalid date provided to formatFlightDate:", date);
            return "Invalid Date";
        }
        
        try {
            return date.toLocaleDateString('en-US', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric' 
            });
        } catch (e) {
            console.error("Error formatting flight date:", e);
            return "Date Error";
        }
    },

    // New method to update the visual state of the route button
    updateRouteButtonState: function(routeIndex) {
        // Get current selected route data from routeData instead of selectedRoutes
        const selectedRouteData = appState.routeData[routeIndex]?.selectedRoute;
        
        if (!selectedRouteData) {
            console.error(`Cannot update button state - selected route data not found for index: ${routeIndex}`);
            return;
        }

        // Get the group ID from the selected route
        const currentGroupId = selectedRouteData.group;

        // Remove active-route-button class from all buttons
        document.querySelectorAll('.route-info-button').forEach(button => {
            button.classList.remove('active-route-button');
        });

        // Find all route indices that belong to this same group in routeData
        const groupRouteIndices = Object.entries(appState.routeData)
            .filter(([_, route]) => route && route.selectedRoute && route.selectedRoute.group === currentGroupId)
            .map(([idx, _]) => parseInt(idx));

        // Mark the current route button as active
        const currentButton = document.getElementById(`route-button-${routeIndex}`);
        if (currentButton) {
            currentButton.classList.add('active-route-button');
            currentButton.classList.add('selected-route-button');
        }

        // Mark all buttons in the group as selected
        groupRouteIndices.forEach(idx => {
            const button = document.getElementById(`route-button-${idx}`);
            if (button) {
                button.classList.add('selected-route-button');
                // Preserve even-button class if needed
                if (idx % 2 === 1) {
                    button.classList.add('even-button');
                }
            }
        });
    },

    // New method to display full journey information for the entire route
    displayFullJourneyInfo: async function(groupId) {
        try {
            // Create format helpers object to pass to the selectedRouteGroup module
            const formatHelpers = {
                formatFlightTime: this.formatFlightTime,
                formatFlightDate: this.formatFlightDate
            };
            
            // Use the selectedRouteGroup module to display the full journey info
            const { journeyContainer, journeyData } = await selectedRouteGroup.displayFullJourneyInfo(
                groupId, 
                formatHelpers
            );
            
            if (!journeyContainer || !journeyData) {
                console.error('Failed to display journey info');
                return;
            }
            
            // Setup event listeners for the journey view
            selectedRouteGroup.setupJourneyEventListeners(
                journeyContainer, 
                journeyData, 
                {
                    onReturnToSegment: (segmentIndex) => this.displaySelectedRouteInfo(segmentIndex),
                    onViewSegment: (segmentIndex) => this.displaySelectedRouteInfo(segmentIndex)
                }
            );
            
            // Update current view
            appState.currentView = 'fullJourney';
        } catch (error) {
            console.error('Error displaying full journey info:', error);
        }
    }
};

export { selectedRoute };