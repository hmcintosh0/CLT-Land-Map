#!/usr/bin/env python3
"""
Data import utilities for Charlotte Land Map
Handles fetching data from ArcGIS services and importing into database
"""

import requests
import json
import logging
from typing import Dict, List, Optional
import geopandas as gpd
from shapely.geometry import shape
from database import db_manager

logger = logging.getLogger(__name__)

class ArcGISDataImporter:
    """Handles importing data from ArcGIS services"""
    
    def __init__(self):
        # Charlotte GIS service URLs
        self.vacant_land_url = "https://gis.charlottenc.gov/arcgis/rest/services/PLN/VacantLand/MapServer"
        self.parcel_lookup_url = "https://gis.charlottenc.gov/arcgis/rest/services/CLT_Ex/CLTEx_MoreInfo/MapServer"
        self.zoning_url = "https://gis.charlottenc.gov/arcgis/rest/services/PLN/Zoning/MapServer"
        
        # Field mappings for different services
        self.field_mappings = {
            'vacant_land': {
                'parcel_id': 'PID',
                'address': 'ADDRESS',
                'acres': 'ACRES',
                'zoning': 'ZONING'
            },
            'parcels': {
                'parcel_id': 'PID',
                'owner_first': 'Owner_FirstName',
                'owner_last': 'Owner_LastName',
                'acres': 'Total_Acreage',
                'address': 'Mailing_Address',
                'zip_code': 'Zip_Code'
            },
            'zoning': {
                'zone_code': 'ZoneDes',
                'zone_description': 'ZoneDesc'
            }
        }
    
    def fetch_arcgis_data(self, service_url: str, layer_id: str = '0', 
                          where_clause: str = '1=1', out_fields: str = '*',
                          max_records: int = 1000) -> Optional[Dict]:
        """Fetch data from ArcGIS service"""
        try:
            # Construct query URL
            query_url = f"{service_url}/{layer_id}/query"
            params = {
                'where': where_clause,
                'outFields': out_fields,
                'f': 'geojson',
                'returnGeometry': 'true',
                'resultRecordCount': max_records
            }
            
            logger.info(f"Fetching data from: {query_url}")
            response = requests.get(query_url, params=params, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            logger.info(f"Successfully fetched {len(data.get('features', []))} features")
            return data
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Request failed: {str(e)}")
            return None
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode failed: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error: {str(e)}")
            return None
    
    def process_parcel_data(self, arcgis_data: Dict) -> List[Dict]:
        """Process ArcGIS parcel data into database format"""
        processed_parcels = []
        
        if not arcgis_data or 'features' not in arcgis_data:
            logger.warning("No features found in ArcGIS data")
            return processed_parcels
        
        for feature in arcgis_data['features']:
            try:
                properties = feature.get('properties', {})
                geometry = feature.get('geometry')
                
                if not geometry:
                    continue
                
                # Extract parcel information
                parcel_data = {
                    'parcel_id': properties.get('PID') or properties.get('parcel_id'),
                    'address': properties.get('Mailing_Address') or properties.get('address'),
                    'owner_name': self._combine_owner_names(properties),
                    'owner_address': properties.get('Mailing_Address'),
                    'acres': self._parse_acres(properties.get('Total_Acreage') or properties.get('acres')),
                    'zoning_code': properties.get('ZoneDes') or properties.get('zoning'),
                    'land_use': self._determine_land_use(properties),
                    'road_frontage': self._calculate_road_frontage(geometry),
                    'slope_percent': None,  # Would need elevation data
                    'utilities': self._determine_utilities(properties),
                    'geometry': geometry
                }
                
                # Validate required fields
                if parcel_data['parcel_id'] and parcel_data['geometry']:
                    processed_parcels.append(parcel_data)
                
            except Exception as e:
                logger.error(f"Error processing feature: {str(e)}")
                continue
        
        logger.info(f"Processed {len(processed_parcels)} parcels")
        return processed_parcels
    
    def _combine_owner_names(self, properties: Dict) -> str:
        """Combine first and last name fields"""
        first_name = properties.get('Owner_FirstName', '').strip()
        last_name = properties.get('Owner_LastName', '').strip()
        
        if first_name and last_name:
            return f"{first_name} {last_name}"
        elif first_name:
            return first_name
        elif last_name:
            return last_name
        else:
            return ""
    
    def _parse_acres(self, acres_value) -> Optional[float]:
        """Parse acres value to float"""
        if acres_value is None:
            return None
        
        try:
            return float(acres_value)
        except (ValueError, TypeError):
            return None
    
    def _determine_land_use(self, properties: Dict) -> str:
        """Determine land use based on properties"""
        zoning = properties.get('ZoneDes') or properties.get('zoning', '').upper()
        
        if any(code in zoning for code in ['R-', 'RES']):
            return 'Residential'
        elif any(code in zoning for code in ['C-', 'COM']):
            return 'Commercial'
        elif any(code in zoning for code in ['I-', 'IND']):
            return 'Industrial'
        elif any(code in zoning for code in ['AG', 'AGR']):
            return 'Agricultural'
        else:
            return 'Mixed Use'
    
    def _calculate_road_frontage(self, geometry: Dict) -> Optional[int]:
        """Calculate road frontage from geometry (simplified)"""
        try:
            # This is a simplified calculation
            # In practice, you'd need to intersect with road centerlines
            if geometry['type'] == 'Polygon':
                coords = geometry['coordinates'][0]
                # Calculate perimeter as rough estimate
                perimeter = 0
                for i in range(len(coords) - 1):
                    dx = coords[i+1][0] - coords[i][0]
                    dy = coords[i+1][1] - coords[i][1]
                    perimeter += (dx**2 + dy**2)**0.5
                return int(perimeter * 111000)  # Rough conversion to feet
        except Exception as e:
            logger.debug(f"Could not calculate road frontage: {str(e)}")
        
        return None
    
    def _determine_utilities(self, properties: Dict) -> List[str]:
        """Determine available utilities (placeholder)"""
        # This would need to be enhanced with actual utility data
        return ['Water', 'Sewer', 'Electric']  # Default assumption
    
    def import_all_data(self) -> bool:
        """Import all data from ArcGIS services"""
        try:
            logger.info("Starting data import process...")
            
            # 1. Import parcel data
            logger.info("Importing parcel data...")
            parcel_data = self.fetch_arcgis_data(
                self.parcel_lookup_url, 
                out_fields='PID,Owner_FirstName,Owner_LastName,Total_Acreage,Mailing_Address,Zip_Code'
            )
            
            if parcel_data:
                processed_parcels = self.process_parcel_data(parcel_data)
                for parcel in processed_parcels:
                    db_manager.insert_parcel_data(parcel)
            
            # 2. Import vacant land data
            logger.info("Importing vacant land data...")
            vacant_data = self.fetch_arcgis_data(
                self.vacant_land_url,
                out_fields='PID,ADDRESS,ACRES,ZONING'
            )
            
            if vacant_data:
                processed_vacant = self.process_parcel_data(vacant_data)
                for parcel in processed_vacant:
                    # Mark as vacant by setting owner to empty
                    parcel['owner_name'] = ''
                    db_manager.insert_parcel_data(parcel)
            
            # 3. Import zoning data
            logger.info("Importing zoning data...")
            zoning_data = self.fetch_arcgis_data(
                self.zoning_url,
                out_fields='ZoneDes,ZoneDesc'
            )
            
            if zoning_data:
                self._import_zoning_data(zoning_data)
            
            logger.info("Data import completed successfully")
            return True
            
        except Exception as e:
            logger.error(f"Data import failed: {str(e)}")
            return False
    
    def _import_zoning_data(self, zoning_data: Dict):
        """Import zoning regulations data"""
        if not zoning_data or 'features' not in zoning_data:
            return
        
        for feature in zoning_data['features']:
            try:
                properties = feature.get('properties', {})
                zone_code = properties.get('ZoneDes')
                zone_desc = properties.get('ZoneDesc')
                
                if zone_code:
                    # Insert zoning regulation
                    insert_sql = """
                    INSERT INTO zoning_regulations (
                        zone_code, zone_description
                    ) VALUES (%s, %s)
                    ON CONFLICT (zone_code) 
                    DO UPDATE SET zone_description = EXCLUDED.zone_description
                    """
                    
                    db_manager.execute_query(insert_sql, (zone_code, zone_desc))
                    
            except Exception as e:
                logger.error(f"Error importing zoning data: {str(e)}")
                continue

def main():
    """Main function for data import"""
    # Initialize database
    if not db_manager.connect():
        logger.error("Failed to connect to database")
        return
    
    try:
        # Create tables if they don't exist
        db_manager.create_tables()
        
        # Import data
        importer = ArcGISDataImporter()
        success = importer.import_all_data()
        
        if success:
            logger.info("Data import completed successfully")
        else:
            logger.error("Data import failed")
            
    finally:
        db_manager.disconnect()

if __name__ == "__main__":
    main()

