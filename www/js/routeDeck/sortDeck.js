import { uiHandling } from '../uiHandling.js';

export function sortDeckByField(container, fieldName, asc = true) {
    const dirModifier = asc ? 1 : -1;
    const cards = Array.from(container.querySelectorAll(".route-card:not([style*='display: none'])"));

    const sortedCards = cards.sort((a, b) => {
        // Define a mapping between field names and data extraction logic
        const fieldMap = {
            'departure': (card) => {
                const element = card.querySelector('.card-details .detail-value[data-departure]');
                return element ? element.textContent.trim() : '';
            },
            'arrival': (card) => {
                const element = card.querySelector('.card-details .detail-value[data-arrival]');
                return element ? element.textContent.trim() : '';
            },
            'price': (card) => {
                const element = card.querySelector('.card-price');
                return element ? element.textContent.replace('$', '').trim() : '';
            },
            'stops': (card) => {
                const detailGroups = card.querySelectorAll('.card-details .detail-group');
                const stopsGroup = Array.from(detailGroups).find(group => 
                    group.querySelector('.detail-label').textContent.trim() === 'Stops'
                );
                const element = stopsGroup?.querySelector('.detail-value');
                return element ? element.textContent.trim() : '0';
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
            return new Date(data);
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
    sortButton.innerHTML = `
        <span><img src="/assets/sort_icon.svg" alt="Sort" class="sort-icon"> <span id="currentSort">Price</span></span>
        <div class="sort-dropdown">
            <div class="sort-option selected" data-sort="price">
                Price
            </div>
            <div class="sort-option" data-sort="departure">
                Departure Time
            </div>
            <div class="sort-option" data-sort="arrival">
                Arrival Time
            </div>
            <div class="sort-option" data-sort="duration">
                Duration
            </div>
            <div class="sort-option" data-sort="stops">
                Stops
            </div>
        </div>
    `;

    // Update sort button event listeners
    sortButton.addEventListener('click', (e) => {
        const dropdown = sortButton.querySelector('.sort-dropdown');
        dropdown.classList.toggle('active');
        if (dropdown.classList.contains('active')) {
            uiHandling.positionDropdown(sortButton, dropdown);
        }
        e.stopPropagation();
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
        const dropdown = sortButton.querySelector('.sort-dropdown');
        dropdown.classList.remove('active');
    });

    // Handle sort options
    sortButton.querySelectorAll('.sort-option').forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            const sortField = option.getAttribute('data-sort');
            const currentSort = document.getElementById('currentSort');
            currentSort.textContent = option.textContent.trim().split('\n')[0];

            // Remove selected class from all options
            sortButton.querySelectorAll('.sort-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            option.classList.add('selected');

            const container = document.querySelector('.route-cards-container');
            sortDeckByField(container, sortField);

            const dropdown = sortButton.querySelector('.sort-dropdown');
            dropdown.classList.remove('active');
        });
    });

    return sortButton;
}