import { uiHandling } from '../uiHandling.js';

export function sortDeckByField(container, fieldName, asc = true) {
    const dirModifier = asc ? 1 : -1;
    const cards = Array.from(container.querySelectorAll(".route-card:not([style*='display: none'])"));

    const sortedCards = cards.sort((a, b) => {
        // Define a mapping between field names and data extraction logic
        const fieldMap = {
            'departure': (card) => {
                // Use the data attribute we set for sorting
                return parseFloat(card.getAttribute('data-departure-time'));
            },
            'arrival': (card) => {
                // Use the data attribute we set for sorting
                return parseFloat(card.getAttribute('data-arrival-time'));
            },
            'price': (card) => {
                const element = card.querySelector('.card-price');
                return element ? element.textContent.replace('$', '').trim() : '';
            },
            'stops': (card) => {
                return parseInt(card.getAttribute('data-stops'), 10);
            },
            'duration': (card) => {
                const element = card.querySelector('.card-duration .detail-value');
                return element ? element.textContent.trim() : '';
            }
        };

        // Extract data based on the field name
        const aText = fieldMap[fieldName] ? fieldMap[fieldName](a) : '';
        const bText = fieldMap[fieldName] ? fieldMap[fieldName](b) : '';

        // Use the convertData function to handle data conversion
        let aValue = convertData(aText, fieldName);
        let bValue = convertData(bText, fieldName);

        if (typeof aValue === "number" && typeof bValue === "number") {
            return (aValue - bValue) * dirModifier;
        } else if (typeof aValue === "boolean" && typeof bValue === "boolean") {
            return (aValue === bValue ? 0 : aValue ? -1 : 1) * dirModifier;
        } else if (aValue instanceof Date && bValue instanceof Date) {
            return (aValue - bValue) * dirModifier;
        } else {
            return aValue.localeCompare(bValue, undefined, { numeric: true }) * dirModifier;
        }
    });

    // Remove all cards
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
    // Append the sorted cards
    sortedCards.forEach(card => container.appendChild(card));
}

function convertData(data, fieldName) {
    switch (fieldName) {
        case 'departure':
        case 'arrival':
            // Data is already a float (hours + minutes/60)
            return data;
        case 'price':
            return parseFloat(data.replace(/[^0-9.]/g, ''));
        case 'stops':
            return parseInt(data, 10);
        case 'duration':
            const [hours, minutes] = data.split('h ');
            return parseInt(hours) * 60 + parseInt(minutes.replace('m', ''));
        default:
            return data;
    }
}

export function createSortButton() {
    const sortButton = document.createElement('button');
    sortButton.className = 'sort-button';
    // Add data attributes to track current sort state
    sortButton.dataset.currentSort = 'price';
    sortButton.dataset.sortDirection = 'asc';
    
    sortButton.innerHTML = `
        <span>
            <img src="/assets/sort_icon.svg" alt="Sort" class="sort-icon" id="sortDirectionToggle"> 
            <span id="currentSort">Price</span>
        </span>
        <div class="sort-dropdown">
            <div class="sort-option selected" data-sort="price">
                Price <img src="/assets/money_icon.svg" alt="Price" class="menu-icon">
            </div>
            <div class="sort-option" data-sort="departure">
                Depart <img src="/assets/time_icon.svg" alt="Departure" class="menu-icon">
            </div>
            <div class="sort-option" data-sort="arrival">
                Arrive <img src="/assets/time_icon.svg" alt="Arrival" class="menu-icon">
            </div>
            <div class="sort-option" data-sort="duration">
                Duration <img src="/assets/duration_icon.svg" alt="Duration" class="menu-icon">
            </div>
            <div class="sort-option" data-sort="stops">
                Stops <img src="/assets/stops_icon.svg" alt="Stops" class="menu-icon">
            </div>
        </div>
    `;

    // Add click handler for the sort direction icon
    const sortIcon = sortButton.querySelector('#sortDirectionToggle');
    sortIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        const currentDirection = sortButton.dataset.sortDirection;
        const newDirection = currentDirection === 'asc' ? 'desc' : 'asc';
        sortButton.dataset.sortDirection = newDirection;
        
        // Replace the rotate transform with scaleY
        sortIcon.style.transform = newDirection === 'desc' ? 'scaleY(-1)' : 'scaleY(1)';
        
        // Find the cards container and resort
        const container = sortButton.closest('.filter-controls')
            .nextElementSibling;
        
        if (container && container.classList.contains('route-cards-container')) {
            sortDeckByField(container, sortButton.dataset.currentSort, newDirection === 'asc');
        }
    });

    // Update existing sort options click handler
    sortButton.querySelectorAll('.sort-option').forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            const sortField = option.getAttribute('data-sort');
            const currentSort = document.getElementById('currentSort');
            currentSort.textContent = option.textContent.trim().split('\n')[0];

            // Update current sort field
            sortButton.dataset.currentSort = sortField;
            
            // Reset sort direction and icon rotation when changing sort field
            sortButton.dataset.sortDirection = 'asc';
            const sortIcon = sortButton.querySelector('#sortDirectionToggle');
            // Replace the rotate reset with scaleY reset
            sortIcon.style.transform = 'scaleY(1)';

            // Remove selected class from all options
            sortButton.querySelectorAll('.sort-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            option.classList.add('selected');

            const container = sortButton.closest('.filter-controls')
                .nextElementSibling;
            
            if (container && container.classList.contains('route-cards-container')) {
                sortDeckByField(container, sortField, true); // Force ascending sort
            }

            const dropdown = sortButton.querySelector('.sort-dropdown');
            dropdown.classList.remove('active');
        });
    });

    // Keep existing dropdown toggle and outside click handlers
    sortButton.addEventListener('click', (e) => {
        if (e.target.id !== 'sortDirectionToggle') {
            const dropdown = sortButton.querySelector('.sort-dropdown');
            dropdown.classList.toggle('active');
            if (dropdown.classList.contains('active')) {
                uiHandling.positionDropdown(sortButton, dropdown);
            }
            e.stopPropagation();
        }
    });

    document.addEventListener('click', () => {
        const dropdown = sortButton.querySelector('.sort-dropdown');
        dropdown.classList.remove('active');
    });

    return sortButton;
}