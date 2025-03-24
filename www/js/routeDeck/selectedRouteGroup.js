import { appState } from '../stateManager.js';
import { infoPaneHeight } from '../utils/infoPaneHeightManager.js';
import { flightMap } from '../flightMap.js';
import { airlineLogoManager } from '../utils/airlineLogoManager.js';

// Function to load airline names from JSON file (similar to selectedRoute.js)
let airlineNamesCache = null;

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

async function getAirlineName(airlineCode) {
    const airlines = await loadAirlineNames();
    return airlines[airlineCode] || airlineCode;
}

// Generate full journey data for the entire route
function generateFullJourneyData(currentGroupId) {
    // Find all routes that belong to the same group
    const groupSegments = Object.entries(appState.selectedRoutes)
        .filter(([_, route]) => route.group === currentGroupId)
        .map(([idx, route]) => {
            const [origin, destination] = route.displayData.route.split(' > ');
            return {
                index: parseInt(idx),
                origin,
                destination,
                routeDetails: route.displayData,
                fullData: route.fullData
            };
        })
        // Sort by route index to ensure correct order
        .sort((a, b) => a.index - b.index);
    
    // Calculate total price, total duration, airlines involved
    const totalPrice = groupSegments.reduce((sum, segment) => sum + parseFloat(segment.routeDetails.price), 0);
    const airlines = [...new Set(groupSegments.map(segment => segment.routeDetails.airline))];
    const firstSegment = groupSegments[0];
    const lastSegment = groupSegments[groupSegments.length - 1];
    
    return {
        groupId: currentGroupId,
        segments: groupSegments,
        overallOrigin: firstSegment.origin,
        overallDestination: lastSegment.destination,
        totalPrice,
        airlines,
        departureDate: firstSegment.routeDetails.departure,
        arrivalDate: lastSegment.routeDetails.arrival,
        totalStops: groupSegments.length - 1,
        totalSegments: groupSegments.length
    };
}

// Generate route description for a route group - similar to the one in selectedRoute.js
function generateRouteDescription(groupId, currentSegmentIndex = null) {
    // Find all routes that belong to the same group
    const routeSegments = Object.entries(appState.selectedRoutes)
        .filter(([_, route]) => route.group === groupId)
        .map(([idx, route]) => {
            // Extract origin and destination from the route
            const [origin, destination] = route.displayData.route.split(' > ');
            return {
                index: parseInt(idx),
                segment: `${origin}-${destination}`,
                origin,
                destination
            };
        })
        // Sort by route index to ensure correct order
        .sort((a, b) => a.index - b.index);

    // Create HTML with segments - with plane icon between segments
    const planeIconSvg = `<svg class="route-segment-plane" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14">
                            <path fill="currentColor" d="M21,16V14L13,9V3.5A1.5,1.5,0,0,0,11.5,2A1.5,1.5,0,0,0,10,3.5V9L2,14V16L10,13.5V19L8,20.5V22L11.5,21L15,22V20.5L13,19V13.5L21,16Z" />
                          </svg>`;

    return routeSegments.map((segment, index) => {
        const isCurrentSegment = currentSegmentIndex !== null && segment.index === parseInt(currentSegmentIndex);
        const segmentHtml = `<span class="route-segment ${isCurrentSegment ? 'current-segment' : ''}" 
                     data-route-index="${segment.index}" 
                     role="button"
                     tabindex="0">
                     ${segment.segment}
                </span>`;
        
        // Add plane icon after all segments except the last one
        return index < routeSegments.length - 1 
            ? segmentHtml + planeIconSvg 
            : segmentHtml;
    }).join('');
}

const selectedRouteGroup = {
    // Display full journey information for the entire route group
    displayFullJourneyInfo: async function(groupId, formatHelpers) {
        // Get complete journey data
        const journeyData = generateFullJourneyData(groupId);
        if (!journeyData || journeyData.segments.length === 0) {
            console.error('No journey data found for group:', groupId);
            return;
        }
        
        // Clear existing content
        const infoPaneContent = document.getElementById('infoPaneContent');
        infoPaneContent.innerHTML = '';
        
        // Add group-route-button class to all route buttons belonging to this group
        this.updateGroupRouteButtonStyles(groupId);
        
        // Create content wrapper
        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'content-wrapper';
        infoPaneContent.appendChild(contentWrapper);
        
        // Create container for the journey overview
        const journeyContainer = document.createElement('div');
        journeyContainer.className = 'selected-route-container';
        
        // Get airline logos for all airlines
        const airlineLogos = await Promise.all(
            journeyData.airlines.map(async (airline) => {
                const logo = await airlineLogoManager.getLogoUrl(airline);
                const name = await getAirlineName(airline);
                return { code: airline, logo, name };
            })
        );
        
        // Get airport data for origin and destination
        const originAirport = await this.getAirportInfo(journeyData.overallOrigin);
        const destAirport = await this.getAirportInfo(journeyData.overallDestination);
        
        // Generate the route segments description
        const routeDescription = generateRouteDescription(groupId);
        
        // Create the HTML structure for the full journey overview
        journeyContainer.innerHTML = `
            <div class="flight-header">
                <div class="back-button">
                    <button class="change-route-button">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                        Back to Segment
                    </button>
                </div>
                <div class="overall-route active-route">${journeyData.overallOrigin}-${journeyData.overallDestination}</div>
                <div class="route-description">${routeDescription}</div>
                <div class="flight-price">$${Math.ceil(journeyData.totalPrice)}</div>
            </div>
            
            <div class="flight-overview journey-overview">
                <div class="journey-summary">
                    <h2>Complete Journey</h2>
                    <div class="journey-stats">
                        <div class="journey-stat">
                            <span class="stat-label">Total segments:</span>
                            <span class="stat-value">${journeyData.totalSegments}</span>
                        </div>
                        <div class="journey-stat">
                            <span class="stat-label">Stops:</span>
                            <span class="stat-value">${journeyData.totalStops}</span>
                        </div>
                        <div class="journey-stat">
                            <span class="stat-label">Airlines:</span>
                            <span class="stat-value">${journeyData.airlines.length}</span>
                        </div>
                    </div>
                    
                    <div class="airline-logos">
                        ${airlineLogos.map(airline => 
                            `<div class="airline-logo-item" title="${airline.name}">
                                <img src="${airline.logo}" alt="${airline.name}" class="small-airline-logo">
                                <span class="airline-code">${airline.code}</span>
                            </div>`
                        ).join('')}
                    </div>
                </div>
                
                <div class="route-summary">
                    <div class="city-pair">
                        <div class="origin-city">${originAirport?.city || journeyData.overallOrigin}</div>
                        <div class="route-line">
                            <svg class="plane-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M21,16V14L13,9V3.5A1.5,1.5,0,0,0,11.5,2A1.5,1.5,0,0,0,10,3.5V9L2,14V16L10,13.5V19L8,20.5V22L11.5,21L15,22V20.5L13,19V13.5L21,16Z" />
                            </svg>
                        </div>
                        <div class="destination-city">${destAirport?.city || journeyData.overallDestination}</div>
                    </div>
                </div>
            </div>
            
            <div class="journey-segments-container">
                <h3>Journey Segments</h3>
                <div class="journey-segments">
                ${journeyData.segments.map((segment, index) => {
                    const segmentClass = index === journeyData.segments.length - 1 ? 'last-segment' : '';
                    return `
                        <div class="journey-segment ${segmentClass}" data-segment-index="${segment.index}">
                            <div class="segment-header">
                                <div class="segment-number">Segment ${index + 1}</div>
                                <div class="segment-route">${segment.origin}-${segment.destination}</div>
                                <div class="segment-price">$${Math.ceil(segment.routeDetails.price)}</div>
                            </div>
                            <div class="segment-details">
                                <div class="segment-airline">
                                    <img src="${airlineLogos.find(a => a.code === segment.routeDetails.airline)?.logo}" 
                                         alt="${airlineLogos.find(a => a.code === segment.routeDetails.airline)?.name}" 
                                         class="small-airline-logo">
                                    <span>${airlineLogos.find(a => a.code === segment.routeDetails.airline)?.name}</span>
                                </div>
                                <div class="segment-times">
                                    <div class="segment-departure">
                                        <div class="time">${formatHelpers.formatFlightTime(new Date(segment.routeDetails.departure))}</div>
                                        <div class="date">${formatHelpers.formatFlightDate(new Date(segment.routeDetails.departure))}</div>
                                        <div class="airport">${segment.origin}</div>
                                    </div>
                                    <div class="segment-arrow">→</div>
                                    <div class="segment-arrival">
                                        <div class="time">${formatHelpers.formatFlightTime(new Date(segment.routeDetails.arrival))}</div>
                                        <div class="date">${formatHelpers.formatFlightDate(new Date(segment.routeDetails.arrival))}</div>
                                        <div class="airport">${segment.destination}</div>
                                    </div>
                                </div>
                            </div>
                            <button class="view-segment-button" data-segment-index="${segment.index}">View Segment Details</button>
                        </div>
                    `;
                }).join('')}
                </div>
            </div>
            
            <div class="booking-section">
                <a href="${journeyData.segments[0].routeDetails.deep_link}" target="_blank" class="booking-button">
                    Book this journey
                </a>
            </div>
        `;
        
        contentWrapper.appendChild(journeyContainer);
        
        return { journeyContainer, journeyData };
    },
    
    // Helper function to get airport information
    getAirportInfo: async function(iataCode) {
        try {
            return await flightMap.getAirportDataByIata(iataCode);
        } catch (error) {
            console.error('Error getting airport data:', error);
            return null;
        }
    },
    
    // Setup event listeners for the journey view
    setupJourneyEventListeners: function(journeyContainer, journeyData, callbacks) {
        // Add back button functionality to return to the segment view
        const backButton = journeyContainer.querySelector('.change-route-button');
        backButton.addEventListener('click', () => {
            // Return to the first segment in the group
            const firstSegmentIndex = journeyData.segments[0].index;
            
            // Remove group-route-button class from all buttons
            this.removeGroupButtonStyles();
            
            // Remove active-route-button class from all buttons first
            document.queryAll('.route-info-button').forEach(button => {
                button.classList.remove('active-route-button');
            });
            
            callbacks.onReturnToSegment(firstSegmentIndex);
        });
        
        // Add click listeners to each segment's "View Segment Details" button
        const segmentButtons = journeyContainer.querySelectorAll('.view-segment-button');
        segmentButtons.forEach(button => {
            const segmentIndex = button.getAttribute('data-segment-index');
            button.addEventListener('click', () => {
                // Remove group-route-button class from all buttons
                this.removeGroupButtonStyles();
                
                // Remove active-route-button class from all buttons first
                document.querySelectorAll('.route-info-button').forEach(button => {
                    button.classList.remove('active-route-button');
                });
                
                callbacks.onViewSegment(parseInt(segmentIndex));
            });
        });
        
        // Make each segment row clickable
        const segmentRows = journeyContainer.querySelectorAll('.journey-segment');
        segmentRows.forEach(row => {
            const segmentIndex = row.getAttribute('data-segment-index');
            row.addEventListener('click', (event) => {
                // Avoid triggering if clicking on the button itself
                if (event.target.closest('.view-segment-button')) return;
                
                // Remove group-route-button class from all buttons
                this.removeGroupButtonStyles();
                
                // Remove active-route-button class from all buttons first
                document.querySelectorAll('.route-info-button').forEach(button => {
                    button.classList.remove('active-route-button');
                });
                
                callbacks.onViewSegment(parseInt(segmentIndex));
            });
        });
        
        // Add event listeners for route segment clicks after the content is added to DOM
        const routeSegments = journeyContainer.querySelectorAll('.route-segment');
        routeSegments.forEach(segment => {
            segment.addEventListener('click', (event) => {
                const clickedSegmentIndex = parseInt(event.currentTarget.getAttribute('data-route-index'));
                if (!isNaN(clickedSegmentIndex)) {
                    // Prevent default navigation behavior
                    event.preventDefault();
                    // Navigate to the clicked segment
                    callbacks.onViewSegment(clickedSegmentIndex);
                }
            });
            
            // Handle keyboard navigation (Enter/Space)
            segment.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    const clickedSegmentIndex = parseInt(event.currentTarget.getAttribute('data-route-index'));
                    if (!isNaN(clickedSegmentIndex)) {
                        callbacks.onViewSegment(clickedSegmentIndex);
                    }
                }
            });
        });
        
        // Set appropriate info pane height
        infoPaneHeight.setRouteDetailsHeight(journeyContainer);
    },
    
    // Updated function to update route button styles for the group view
    updateGroupRouteButtonStyles: function(groupId) {
        // First, remove any existing group-route-button styling
        this.removeGroupButtonStyles();
        
        // Get all segments that belong to this group and sort them by index
        const groupSegments = Object.entries(appState.selectedRoutes)
            .filter(([_, route]) => route.group === groupId)
            .map(([index, _]) => parseInt(index))
            .sort((a, b) => a - b); // Sort numerically
        
        // If there are no segments, return
        if (groupSegments.length === 0) return;
        
        // Add appropriate classes to each button
        groupSegments.forEach((segmentIndex, i) => {
            const buttonId = `route-button-${segmentIndex}`;
            const button = document.getElementById(buttonId);
            if (button) {
                // Add base group-route-button class to all buttons
                button.classList.add('group-route-button');
                
                // Create and add top border element
                const topBorder = document.createElement('div');
                topBorder.className = 'top-border';
                button.appendChild(topBorder);
                
                // Create and add bottom border element
                const bottomBorder = document.createElement('div');
                bottomBorder.className = 'bottom-border';
                button.appendChild(bottomBorder);
                
                // Add first-button class to the first button
                if (i === 0) {
                    button.classList.add('group-route-button-first');
                }
                
                // Add last-button class to the last button
                if (i === groupSegments.length - 1) {
                    button.classList.add('group-route-button-last');
                }
            }
        });
    },
    
    // Updated function to remove all group button styles
    removeGroupButtonStyles: function() {
        document.querySelectorAll('.group-route-button').forEach(button => {
            button.classList.remove('group-route-button');
            button.classList.remove('group-route-button-first');
            button.classList.remove('group-route-button-last');
            
            // Remove the border elements
            const topBorder = button.querySelector('.top-border');
            if (topBorder) button.removeChild(topBorder);
            
            const bottomBorder = button.querySelector('.bottom-border');
            if (bottomBorder) button.removeChild(bottomBorder);
        });
    }
};

export { selectedRouteGroup, generateFullJourneyData, generateRouteDescription };
