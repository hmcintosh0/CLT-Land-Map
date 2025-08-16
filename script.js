// script.js (Updated with exact field names, including correct capitalization)

// --- Define your ArcGIS MapService URLs here ---
// IMPORTANT: Ensure these are the BASE MapServer URLs (e.g., ending in /MapServer, not /MapServer/0)
const VACANT_LAND_SERVICE_URL = 'https://gis.charlottenc.gov/arcgis/rest/services/PLN/VacantLand/MapServer'; // e.g., https://services.arcgis.com/.../Vacant_Land/MapServer
const PARCEL_LOOKUP_SERVICE_URL = 'https://gis.charlottenc.gov/arcgis/rest/services/CLT_Ex/CLTEx_MoreInfo/MapServer'; // e.g., https://services.arcgis.com/.../Parcel_Look_Up/MapServer
const ZONING_SERVICE_URL = 'https://gis.charlottenc.gov/arcgis/rest/services/PLN/Zoning/MapServer'; // e.g., https://gis.charlottenc.gov/arcgis/rest/services/PLN/Zoning/MapServer

// Global variables for map and data layers
let map;
let parcelLayer; // Holds the Leaflet GeoJSON layer for parcels
let allParcelFeatures = []; // Stores all fetched parcel features for client-side filtering
let vacantParcelIds = new Set(); // To store IDs of vacant parcels for quick lookup
let zoningData = null; // To store zoning data once fetched

// Utility function to fetch ArcGIS data as GeoJSON from a MapServer Layer
async function fetchArcGISDataAsGeoJSON(serviceUrl, layerId = '0', whereClause = '1=1', outFields = '*') {
    // Construct the query URL for a specific layer within a MapServer
    // 'returnGeometry=true' is often crucial for MapServer queries to return spatial data
    const queryUrl = `${serviceUrl}/${layerId}/query?where=${encodeURIComponent(whereClause)}&outFields=${outFields}&f=geojson&returnGeometry=true&resultRecordCount=1000`;

    console.log(`Fetching data from: ${queryUrl}`);
    document.getElementById('mapLoadingStatus').textContent = `Fetching ${serviceUrl.includes("Vacant_Land") ? "vacant land" : serviceUrl.includes("Zoning") ? "zoning" : "parcel"} data...`;

    try {
        const response = await fetch(queryUrl);
        if (!response.ok) {
            // Log full response text for debugging server errors
            const errorText = await response.text();
            console.error(`Server response for ${queryUrl}:`, errorText);
            throw new Error(`HTTP error! status: ${response.status} - ${errorText.substring(0, 100)}...`);
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
    // 1. Fetch Parcel Data - UPDATED outFields with correct capitalization
    // IMPORTANT: Verify these field names EXACTLY match what's in your MapServer's "Fields" section.
    // Go to your PARCEL_LOOKUP_SERVICE_URL in a browser, click Layer 0, and find the "Fields" section.
    // Example: 'PID,Owner_FirstName,Owner_LastName,Total_Acreage,Mailing_Address,Zip_Code'
    const parcelFields = 'PID,Owner_FirstName,Owner_LastName,Total_Acreage,Mailing_Address,Zip_Code'; // <<< VERIFY THESE FIELD NAMES FROM ARCGIS SERVICE PAGE
    const parcelGeoJSON = await fetchArcGISDataAsGeoJSON(PARCEL_LOOKUP_SERVICE_URL, '0', '1=1', parcelFields);
    if (!parcelGeoJSON || !parcelGeoJSON.features) {
        document.getElementById('mapLoadingStatus').textContent = 'Failed to load parcel data.';
        return;
    }
    allParcelFeatures = parcelGeoJSON.features; // Store all features for filtering

    // 2. Fetch Vacant Land Data - UPDATED outFields
    // IMPORTANT: Verify 'PID' (or whatever the parcel ID field is) EXACTLY matches in your Vacant Land MapServer.
    const vacantLandFields = 'PID'; // <<< VERIFY THIS FIELD NAME
    const vacantLandGeoJSON = await fetchArcGISDataAsGeoJSON(VACANT_LAND_SERVICE_URL, '0', '1=1', vacantLandFields);
    if (vacantLandGeoJSON && vacantLandGeoJSON.features) {
        vacantParcelIds = new Set(vacantLandGeoJSON.features.map(f => f.properties && f.properties.PID).filter(Boolean)); // Use PID
        console.log(`Identified ${vacantParcelIds.size} vacant parcels.`);
    } else {
        console.warn('Could not load vacant land data. Vacant parcel highlighting might not work.');
    }

    // 3. Fetch Zoning Data (for conceptual subdivision potential)
    // IMPORTANT: Verify 'ZONING' and 'ZONE_DESC' (or whatever the zoning fields are) EXACTLY match in your Zoning MapServer.
    const zoningFields = 'ZoneDes'; // <<< VERIFY THESE FIELD NAMES
    zoningData = await fetchArcGISDataAsGeoJSON(ZONING_SERVICE_URL, '0', '1=1', zoningFields);
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

        const parcelId = props.PID; // Use PID
        const acres = props.Total_Acreage ? parseFloat(props.Total_Acreage) : 0; // Use Total_Acreage
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
            const parcelId = feature.properties ? feature.properties.PID : null; // Use PID
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
                const parcelId = props.PID || 'N/A'; // Use PID
                // Construct address using Mailing_Address and Zip_Code
                const address = `${props.Mailing_Address || 'N/A'}, ${props.Zip_Code || ''}`.trim(); // Use Mailing_Address, Zip_Code
                const owner = `${props.Owner_FirstName || ''} ${props.Owner_LastName || ''}`.trim() || 'N/A'; // Combine first and last name
                const acres = props.Total_Acreage ? parseFloat(props.Total_Acreage).toFixed(2) : 'N/A'; // Use Total_Acreage
                const isVacant = vacantParcelIds.has(parcelId) ? 'Yes' : 'No';

                // Get zoning info if available
                let zoningCode = 'N/A';
                let zoningDescription = 'N/A';
                if (zoningData && zoningData.features) {
                    // This is a simplified lookup for display.
                    // For accurate per-parcel zoning, you would typically need to:
                    // 1. Perform a spatial query to the Zoning MapServer layer using the parcel's geometry.
                    // 2. If the MapServer provides a 'ZONING' or 'ZONE_DESC' field directly on the parcel, use that.
                    // For now, we'll indicate if zoning data was loaded in general.
                    zoningCode = 'Data Loaded';
                    zoningDescription = 'Check specific parcel details/zoning site for rules.';
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
