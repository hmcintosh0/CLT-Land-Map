// script.js (Updated for Phase 3)

// --- Define your ArcGIS Feature Service URLs here ---
const VACANT_LAND_SERVICE_URL = 'YOUR_VACANT_LAND_FEATURE_SERVICE_URL/FeatureServer'; // Ensure you've replaced this
const PARCEL_LOOKUP_SERVICE_URL = 'YOUR_PARCEL_LOOKUP_FEATURE_SERVICE_URL/FeatureServer'; // Ensure you've replaced this
// New: Add Zoning Service URL - You'll need to find this URL similar to how you found the others.
// For example: const ZONING_SERVICE_URL = 'https://services.arcgis.com/your-org-id/arcgis/rest/services/Zoning/FeatureServer';
const ZONING_SERVICE_URL = 'https://gis.charlottenc.gov/arcgis/rest/services/PLN/Zoning/MapServer/0'; // Find this on the Charlotte Open Data Portal

// Global variables for map and data layers
let map;
let parcelLayer; // Holds the Leaflet GeoJSON layer for parcels
let allParcelFeatures = []; // Stores all fetched parcel features for client-side filtering
let vacantParcelIds = new Set(); // To store IDs of vacant parcels for quick lookup
let zoningData = null; // To store zoning data once fetched

// Utility function to fetch ArcGIS data as GeoJSON
async function fetchArcGISDataAsGeoJSON(serviceUrl, layerId = '0', whereClause = '1=1', outFields = '*') {
    // Limit to 1000 features per request to avoid too large responses for initial load,
    // or implement pagination for very large datasets if needed.
    const queryUrl = `${serviceUrl}/${layerId}/query?where=${encodeURIComponent(whereClause)}&outFields=${outFields}&f=geojson&resultRecordCount=1000`; // Added resultRecordCount

    console.log(`Workspaceing data from: ${queryUrl}`);
    document.getElementById('mapLoadingStatus').textContent = `Workspaceing ${serviceUrl.includes("Vacant_Land") ? "vacant land" : serviceUrl.includes("Zoning") ? "zoning" : "parcel"} data...`;

    try {
        const response = await fetch(queryUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Fetched ArcGIS Data:', data);
        return data;
    } catch (error) {
        console.error('Error fetching ArcGIS data:', error);
        document.getElementById('mapLoadingStatus').textContent = `Error loading data: ${error.message}`;
        return null;
    }
}

// Function to initialize the map
function initializeMap() {
    map = L.map('map').setView([35.2271, -80.8431], 12); // Centered on Charlotte, NC

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    console.log('Leaflet map initialized.');
    document.getElementById('mapLoadingStatus').textContent = 'Map initialized. Loading parcel data...';
}

// Function to load all necessary data and display initial parcels
async function loadAllDataAndParcels() {
    // 1. Fetch Parcel Data
    const parcelGeoJSON = await fetchArcGISDataAsGeoJSON(PARCEL_LOOKUP_SERVICE_URL, '0', '1=1', 'PARCELID,ADDRNO,PREDIR,STNAME,STTYPE,SUFDIR,UNIT,CITY,STATE,ZIPCODE,PROP_ADDR,OWNERNAME,DEED_ACRES');
    if (!parcelGeoJSON || !parcelGeoJSON.features) {
        document.getElementById('mapLoadingStatus').textContent = 'Failed to load parcel data.';
        return;
    }
    allParcelFeatures = parcelGeoJSON.features; // Store all features for filtering

    // 2. Fetch Vacant Land Data
    const vacantLandGeoJSON = await fetchArcGISDataAsGeoJSON(VACANT_LAND_SERVICE_URL, '0', '1=1', 'PARCELID');
    if (vacantLandGeoJSON && vacantLandGeoJSON.features) {
        vacantParcelIds = new Set(vacantLandGeoJSON.features.map(f => f.properties && f.properties.PARCELID).filter(Boolean));
        console.log(`Identified ${vacantParcelIds.size} vacant parcels.`);
    } else {
        console.warn('Could not load vacant land data. Vacant parcel highlighting might not work.');
    }

    // 3. Fetch Zoning Data (for conceptual subdivision potential)
    // You'll need to find the specific URL for Charlotte's Zoning dataset
    zoningData = await fetchArcGISDataAsGeoJSON(ZONING_SERVICE_URL, '0', '1=1', 'ZONING,ZONE_DESC'); // Adjust 'ZONING,ZONE_DESC' to actual field names
    if (!zoningData) {
        console.warn('Could not load zoning data. Subdivision potential analysis will be limited.');
    } else {
        console.log('Zoning data loaded.');
    }

    // Initial display of parcels based on default filters
    updateMapDisplay();
}


// Function to update the map display based on current filters
function updateMapDisplay() {
    if (parcelLayer) {
        map.removeLayer(parcelLayer); // Clear existing layer
    }

    const minAcres = parseFloat(document.getElementById('minAcres').value);
    const vacantOnly = document.getElementById('vacantOnly').checked;
    const parcelIdFilter = document.getElementById('parcelId').value.trim().toUpperCase();

    const filteredFeatures = allParcelFeatures.filter(feature => {
        const props = feature.properties;
        if (!props) return false; // Skip if no properties

        const parcelId = props.PARCELID;
        const acres = props.DEED_ACRES ? parseFloat(props.DEED_ACRES) : 0;
        const isVacant = vacantParcelIds.has(parcelId);

        // Filter by Parcel ID
        if (parcelIdFilter && parcelId && !parcelId.includes(parcelIdFilter)) {
            return false;
        }

        // Filter by Minimum Acres
        if (acres < minAcres) {
            return false;
        }

        // Filter by Vacant Only
        if (vacantOnly && !isVacant) {
            return false;
        }

        return true; // Keep the feature if all filters pass
    });

    parcelLayer = L.geoJSON(filteredFeatures, {
        style: function(feature) {
            const parcelId = feature.properties ? feature.properties.PARCELID : null;
            const isVacant = parcelId && vacantParcelIds.has(parcelId);

            if (isVacant) {
                return {
                    className: 'vacant-parcel',
                    fillColor: '#ef4444', // Red
                    color: '#b91c1c',
                    weight: 2,
                    opacity: 0.8,
                    fillOpacity: 0.5
                };
            } else {
                return {
                    className: 'default-parcel',
                    fillColor: '#3b82f6', // Blue
                    color: '#1d4ed8',
                    weight: 1,
                    opacity: 0.6,
                    fillOpacity: 0.3
                };
            }
        },
        onEachFeature: function(feature, layer) {
            if (feature.properties) {
                const props = feature.properties;
                const parcelId = props.PARCELID || 'N/A';
                const address = `${props.ADDRNO || ''} ${props.PREDIR || ''} ${props.STNAME || ''} ${props.STTYPE || ''} ${props.SUFDIR || ''}, ${props.CITY || ''}, ${props.STATE || ''} ${props.ZIPCODE || ''}`.trim();
                const owner = props.OWNERNAME || 'N/A';
                const acres = props.DEED_ACRES ? parseFloat(props.DEED_ACRES).toFixed(2) : 'N/A';
                const isVacant = vacantParcelIds.has(parcelId) ? 'Yes' : 'No';

                // Get zoning info if available
                let zoningCode = 'N/A';
                let zoningDescription = 'N/A';
                if (zoningData && zoningData.features) {
                    // This is a simplified spatial lookup. For accuracy, you'd use a more robust spatial library
                    // or request specific zoning for the parcel from the API.
                    // For now, we'll just show 'Available' if any zoning data exists, or you could try a point-in-polygon check.
                    // A proper spatial join is out of scope for client-side JS without a dedicated library.
                    // The best way is to query the zoning service with the parcel's geometry or centroid.
                    // For demonstration, let's assume we can get a zoning code from a related service or attribute on the parcel itself later.
                    // For now, we'll note if zoning data was loaded.
                    zoningCode = 'Zoning data loaded (details on click)';
                    zoningDescription = 'Check zoning for subdivision rules.';
                }


                layer.bindPopup(`
                    <h4 class="font-semibold text-lg mb-1">${parcelId}</h4>
                    <p><strong>Address:</strong> ${address}</p>
                    <p><strong>Owner:</strong> ${owner}</p>
                    <p><strong>Acres:</strong> ${acres}</p>
                    <p><strong>Vacant:</strong> ${isVacant}</p>
                    <p><strong>Zoning:</strong> ${zoningCode}</p>
                    <button class="mt-2 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                            onclick="showParcelDetails('${parcelId}', '${address}', '${owner}', '${acres}', '${isVacant}', '${zoningCode}', '${zoningDescription}')">
                        View Details
                    </button>
                `);

                // Store properties on the layer for easy access later
                layer.feature.properties._fullAddress = address; // Custom property
                layer.feature.properties._isVacant = isVacant; // Custom property
                layer.feature.properties._zoningCode = zoningCode; // Custom property
                layer.feature.properties._zoningDescription = zoningDescription; // Custom property
            }
        }
    }).addTo(map);

    // Zoom to layer bounds if features are present
    if (filteredFeatures.length > 0 && parcelLayer.getBounds().isValid()) {
        map.fitBounds(parcelLayer.getBounds());
    } else {
        map.setView([35.2271, -80.8431], 12); // Reset view if no features found
    }
    document.getElementById('mapLoadingStatus').textContent = `Displaying ${filteredFeatures.length} parcels.`;
}

// Function to show parcel details in the sidebar (updated for zoning)
function showParcelDetails(parcelId, address, owner, acres, isVacant, zoningCode, zoningDescription) {
    const parcelDetailsDiv = document.getElementById('parcelDetails');
    parcelDetailsDiv.innerHTML = `
        <h4 class="font-semibold text-lg mb-2 text-blue-800">Details for ${parcelId}</h4>
        <p><strong>Address:</strong> ${address}</p>
        <p><strong>Owner:</strong> ${owner}</p>
        <p><strong>Acres:</strong> ${acres}</p>
        <p><strong>Vacant:</strong> ${isVacant}</p>
        <p><strong>Zoning:</strong> ${zoningCode} (${zoningDescription})</p>
        <button class="mt-4 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                onclick="getAndDisplayOwnerContact('${address}')">
            Get Owner Contact Info
        </button>
        <button class="mt-2 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors"
                onclick="zoomToParcelInGoogleEarth('${address}', '${parcelId}')">
            View in Google Earth
        </button>
    `;
}

// Placeholder for fetching and displaying owner contact info (from Phase 4)
async function getAndDisplayOwnerContact(address) {
    const parcelDetailsDiv = document.getElementById('parcelDetails');
    parcelDetailsDiv.innerHTML += '<p class="mt-4 text-gray-600">Fetching owner contact info...</p>';

    // This is where you would call your TruePeopleSearch/WhitePages API functions
    // For now, it's a placeholder
    const ownerInfo = await new Promise(resolve => setTimeout(() => {
        resolve({
            name: "John Doe (Placeholder)",
            phone: "555-123-4567",
            email: "john.doe@example.com"
        });
    }, 2000)); // Simulate API call

    if (ownerInfo) {
        parcelDetailsDiv.innerHTML += `
            <h5 class="font-semibold text-md mt-4 mb-2 text-blue-800">Owner Contact Info:</h5>
            <p><strong>Name:</strong> ${ownerInfo.name}</p>
            <p><strong>Phone:</strong> ${ownerInfo.phone}</p>
            <p><strong>Email:</strong> ${ownerInfo.email}</p>
            <p class="text-sm text-gray-500 mt-1">
                (Note: This is placeholder data. Real API integration needed.)
            </p>
        `;
    } else {
        parcelDetailsDiv.innerHTML += '<p class="mt-4 text-red-500">Failed to retrieve owner contact information.</p>';
    }
}

// Placeholder for Google Earth integration (from Phase 4)
function zoomToParcelInGoogleEarth(address, parcelId) {
    console.log(`Attempting to view parcel ${parcelId} at ${address} in Google Earth.`);
    alert("Google Earth integration is conceptual. We will implement this in Phase 4.");
    // In Phase 4, we'll replace this with actual Google Earth API calls
}

// --- Main execution when the DOM is loaded ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('Charlotte Land Opportunity Tool is ready!');
    initializeMap();
    loadAllDataAndParcels(); // Load all data initially

    // Event listener for the Apply Filters button
    const applyFiltersButton = document.getElementById('applyFilters');
    if (applyFiltersButton) {
        applyFiltersButton.addEventListener('click', () => {
            updateMapDisplay(); // Re-render map with current filter settings
        });
    }

    // You can also add change listeners to filter inputs for real-time updates (optional)
    document.getElementById('minAcres').addEventListener('change', updateMapDisplay);
    document.getElementById('vacantOnly').addEventListener('change', updateMapDisplay);
    document.getElementById('parcelId').addEventListener('input', updateMapDisplay); // Live search as you type

    // --- Future API Key Management (Conceptual) ---
    const TRUE_PEOPLE_SEARCH_API_KEY = 'YOUR_TRUE_PEOPLE_SEARCH_API_KEY'; // Replace with your actual key
    const WHITE_PAGES_API_KEY = 'YOUR_WHITE_PAGES_API_KEY'; // Replace with your actual key
    const GOOGLE_EARTH_API_KEY = 'YOUR_GOOGLE_EARTH_API_KEY'; // Replace with your actual key
});
