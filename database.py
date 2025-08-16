#!/usr/bin/env python3
"""
Database configuration and utilities for Charlotte Land Map
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor
import geopandas as gpd
from shapely.geometry import shape
import logging

logger = logging.getLogger(__name__)

class DatabaseManager:
    """Manages database connections and operations"""
    
    def __init__(self):
        self.connection_string = os.getenv('DATABASE_URL', 'postgresql://localhost/charlotte_land_map')
        self.conn = None
    
    def connect(self):
        """Establish database connection"""
        try:
            self.conn = psycopg2.connect(self.connection_string)
            logger.info("Database connection established")
            return True
        except Exception as e:
            logger.error(f"Database connection failed: {str(e)}")
            return False
    
    def disconnect(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()
            self.conn = None
            logger.info("Database connection closed")
    
    def execute_query(self, query, params=None):
        """Execute a database query"""
        try:
            if not self.conn:
                if not self.connect():
                    return None
            
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute(query, params)
            
            if query.strip().upper().startswith('SELECT'):
                results = cursor.fetchall()
                return [dict(row) for row in results]
            else:
                self.conn.commit()
                return cursor.rowcount
                
        except Exception as e:
            logger.error(f"Query execution failed: {str(e)}")
            if self.conn:
                self.conn.rollback()
            return None
        finally:
            if 'cursor' in locals():
                cursor.close()
    
    def create_tables(self):
        """Create necessary database tables"""
        tables_sql = """
        -- Enable PostGIS extension
        CREATE EXTENSION IF NOT EXISTS postgis;
        
        -- Parcels table
        CREATE TABLE IF NOT EXISTS parcels (
            id SERIAL PRIMARY KEY,
            parcel_id VARCHAR(50) UNIQUE NOT NULL,
            address TEXT,
            owner_name VARCHAR(255),
            owner_address TEXT,
            acres DECIMAL(10,4),
            zoning_code VARCHAR(20),
            land_use VARCHAR(100),
            road_frontage INTEGER,
            slope_percent DECIMAL(5,2),
            utilities TEXT[],
            geometry GEOMETRY(POLYGON, 4326),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Zoning regulations table
        CREATE TABLE IF NOT EXISTS zoning_regulations (
            id SERIAL PRIMARY KEY,
            zone_code VARCHAR(20) UNIQUE NOT NULL,
            zone_description TEXT,
            min_lot_size DECIMAL(10,4),
            max_density DECIMAL(10,4),
            front_setback INTEGER,
            side_setback INTEGER,
            rear_setback INTEGER,
            max_height INTEGER,
            max_coverage DECIMAL(5,2),
            allowed_uses TEXT[],
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Owner contact information table
        CREATE TABLE IF NOT EXISTS owner_contacts (
            id SERIAL PRIMARY KEY,
            parcel_id VARCHAR(50) REFERENCES parcels(parcel_id),
            name VARCHAR(255),
            phone VARCHAR(20),
            email VARCHAR(255),
            address TEXT,
            source VARCHAR(100),
            last_verified TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Create spatial index on parcels geometry
        CREATE INDEX IF NOT EXISTS idx_parcels_geometry ON parcels USING GIST (geometry);
        
        -- Create index on common search fields
        CREATE INDEX IF NOT EXISTS idx_parcels_acres ON parcels(acres);
        CREATE INDEX IF NOT EXISTS idx_parcels_zoning ON parcels(zoning_code);
        CREATE INDEX IF NOT EXISTS idx_parcels_owner ON parcels(owner_name);
        """
        
        try:
            self.execute_query(tables_sql)
            logger.info("Database tables created successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to create tables: {str(e)}")
            return False
    
    def insert_parcel_data(self, parcel_data):
        """Insert parcel data into database"""
        insert_sql = """
        INSERT INTO parcels (
            parcel_id, address, owner_name, owner_address, acres, 
            zoning_code, land_use, road_frontage, slope_percent, 
            utilities, geometry
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, ST_GeomFromGeoJSON(%s)
        ) ON CONFLICT (parcel_id) 
        DO UPDATE SET
            address = EXCLUDED.address,
            owner_name = EXCLUDED.owner_name,
            owner_address = EXCLUDED.owner_address,
            acres = EXCLUDED.acres,
            zoning_code = EXCLUDED.zoning_code,
            land_use = EXCLUDED.land_use,
            road_frontage = EXCLUDED.road_frontage,
            slope_percent = EXCLUDED.slope_percent,
            utilities = EXCLUDED.utilities,
            geometry = EXCLUDED.geometry,
            updated_at = CURRENT_TIMESTAMP
        """
        
        try:
            # Convert geometry to GeoJSON string if it's a Shapely object
            if hasattr(parcel_data.get('geometry'), '__geo_interface__'):
                geometry = parcel_data['geometry'].__geo_interface__
            else:
                geometry = parcel_data.get('geometry')
            
            params = (
                parcel_data.get('parcel_id'),
                parcel_data.get('address'),
                parcel_data.get('owner_name'),
                parcel_data.get('owner_address'),
                parcel_data.get('acres'),
                parcel_data.get('zoning_code'),
                parcel_data.get('land_use'),
                parcel_data.get('road_frontage'),
                parcel_data.get('slope_percent'),
                parcel_data.get('utilities', []),
                geometry
            )
            
            result = self.execute_query(insert_sql, params)
            return result is not None
            
        except Exception as e:
            logger.error(f"Failed to insert parcel data: {str(e)}")
            return False
    
    def search_parcels(self, criteria):
        """Search parcels based on criteria"""
        where_conditions = []
        params = []
        param_count = 0
        
        if criteria.get('min_acres'):
            param_count += 1
            where_conditions.append(f"acres >= %s")
            params.append(criteria['min_acres'])
        
        if criteria.get('max_acres'):
            param_count += 1
            where_conditions.append(f"acres <= %s")
            params.append(criteria['max_acres'])
        
        if criteria.get('zoning_type'):
            param_count += 1
            where_conditions.append(f"zoning_code = %s")
            params.append(criteria['zoning_type'])
        
        if criteria.get('vacant_only'):
            where_conditions.append("owner_name IS NULL OR owner_name = ''")
        
        if criteria.get('road_frontage'):
            param_count += 1
            where_conditions.append(f"road_frontage >= %s")
            params.append(criteria['road_frontage'])
        
        if criteria.get('slope_range'):
            # Assuming slope_range is a tuple (min, max)
            if len(criteria['slope_range']) == 2:
                param_count += 1
                where_conditions.append(f"slope_percent BETWEEN %s AND %s")
                params.extend(criteria['slope_range'])
        
        where_clause = " AND ".join(where_conditions) if where_conditions else "1=1"
        
        search_sql = f"""
        SELECT 
            parcel_id, address, owner_name, acres, zoning_code, 
            land_use, road_frontage, slope_percent, utilities,
            ST_AsGeoJSON(geometry) as geometry
        FROM parcels 
        WHERE {where_clause}
        ORDER BY acres DESC
        LIMIT 100
        """
        
        return self.execute_query(search_sql, params)

# Global database manager instance
db_manager = DatabaseManager()

