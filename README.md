# Charlotte Land Map - Land Development Opportunity Tool

A comprehensive land parcel mapping and analysis system designed specifically for real estate brokers and investors specializing in land development in Charlotte, NC.

## Features

### 🗺️ **Interactive Parcel Mapping**
- Interactive map interface using Leaflet and OpenStreetMap
- Real-time parcel data from Charlotte's ArcGIS services
- Visual distinction between vacant and developed parcels
- Zoom and pan functionality with parcel highlighting

### 🔍 **Advanced Search & Filtering**
- Filter by minimum acreage
- Search for vacant land only
- Filter by parcel ID
- Road frontage analysis
- Slope analysis (when elevation data available)
- Zoning-based filtering

### 📊 **Development Analysis**
- Zoning regulation lookup
- Subdivision potential analysis
- Setback requirements
- Maximum density calculations
- Height restrictions

### 👥 **Owner Contact Information**
- Integration with WhitePages API
- Integration with TruePeopleSearch API
- Owner phone numbers and contact details
- Deed information lookup

### 🏗️ **Regulatory Compliance**
- City/county subdivision regulations
- Zoning code explanations
- Re-zoning process guidance
- Development requirements

## System Architecture

```
Frontend (HTML/JavaScript) ←→ Backend (Python Flask) ←→ Database (PostgreSQL + PostGIS)
                                    ↓
                            ArcGIS Services (Charlotte GIS)
                                    ↓
                            External APIs (WhitePages, etc.)
```

## Prerequisites

### Required Software
- **Python 3.8+** - Backend programming language
- **PostgreSQL 12+** - Database server
- **PostGIS 3.0+** - Spatial database extension
- **Web Browser** - For frontend interface

### API Keys Required
- **WhitePages API Key** - For owner contact lookup
- **TruePeopleSearch API Key** - Alternative contact lookup
- **Google Maps API Key** - Enhanced mapping features (optional)

## Installation & Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd CLT-Land-Map
```

### 2. Install Python Dependencies
```bash
pip install -r requirements.txt
```

### 3. Install PostgreSQL & PostGIS

#### Windows
1. Download PostgreSQL from [postgresql.org](https://www.postgresql.org/download/windows/)
2. During installation, ensure PostGIS extension is selected
3. Note your password and port number

#### macOS
```bash
brew install postgresql postgis
```

#### Ubuntu/Debian
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib postgis
```

### 4. Create Database
```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Create database and user
CREATE DATABASE charlotte_land_map;
CREATE USER clt_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE charlotte_land_map TO clt_user;
\q

# Enable PostGIS extension
psql -U clt_user -d charlotte_land_map -c "CREATE EXTENSION postgis;"
```

### 5. Configure Environment
```bash
# Copy configuration template
cp config.env .env

# Edit .env file with your actual values
nano .env
```

### 6. Run Setup Script
```bash
python setup.py
```

### 7. Start the Application
```bash
# Start backend server
python app.py

# Open frontend in browser
# Navigate to index.html
```

## Configuration

### Environment Variables (.env file)

```bash
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/charlotte_land_map

# API Keys
WHITEPAGES_API_KEY=your-whitepages-api-key
TRUEPEOPLESEARCH_API_KEY=your-truepeoplesearch-api-key

# Flask Settings
FLASK_ENV=development
SECRET_KEY=your-secret-key
PORT=5000
```

### ArcGIS Service URLs
The system is pre-configured to use Charlotte's official GIS services:
- **Vacant Land**: `https://gis.charlottenc.gov/arcgis/rest/services/PLN/VacantLand/MapServer`
- **Parcel Lookup**: `https://gis.charlottenc.gov/arcgis/rest/services/CLT_Ex/CLTEx_MoreInfo/MapServer`
- **Zoning**: `https://gis.charlottenc.gov/arcgis/rest/services/PLN/Zoning/MapServer`

## Usage

### 1. **Map Interface**
- Open `index.html` in your web browser
- Use mouse to zoom and pan around Charlotte
- Click on parcels to view detailed information

### 2. **Search & Filtering**
- **Minimum Acres**: Set minimum parcel size
- **Vacant Only**: Show only undeveloped land
- **Parcel ID**: Search for specific parcels
- **Apply Filters**: Update map display

### 3. **Parcel Details**
- Click any parcel to view popup with basic info
- Click "View Details" for comprehensive analysis
- Access owner contact information
- View development potential analysis

### 4. **Owner Lookup**
- Use address or owner name to search
- Retrieve phone numbers and contact details
- Access through WhitePages/TruePeopleSearch APIs

### 5. **Development Analysis**
- Zoning regulation lookup
- Subdivision requirements
- Setback calculations
- Density analysis

## API Endpoints

### Backend API (Flask)

- `GET /` - Home endpoint
- `GET /api/health` - Health check
- `POST /api/parcels/search` - Search parcels
- `GET /api/parcels/<id>/details` - Parcel details
- `POST /api/owner/search` - Owner lookup
- `GET /api/zoning/regulations` - Zoning info

### Example API Usage

```bash
# Search for parcels with minimum 5 acres
curl -X POST http://localhost:5000/api/parcels/search \
  -H "Content-Type: application/json" \
  -d '{"min_acres": 5, "vacant_only": true}'

# Get parcel details
curl http://localhost:5000/api/parcels/P001/details

# Search for owner
curl -X POST http://localhost:5000/api/owner/search \
  -H "Content-Type: application/json" \
  -d '{"address": "123 Main St, Charlotte, NC"}'
```

## Data Sources

### Primary Data
- **Charlotte GIS ArcGIS Services** - Official parcel, zoning, and vacant land data
- **PostgreSQL + PostGIS** - Local spatial database for analysis

### External APIs
- **WhitePages** - Owner contact information
- **TruePeopleSearch** - Alternative contact lookup
- **Google Maps** - Enhanced mapping (optional)

## Development

### Project Structure
```
CLT-Land-Map/
├── index.html          # Frontend interface
├── script.js           # Frontend JavaScript
├── app.py              # Flask backend
├── database.py         # Database management
├── data_import.py      # ArcGIS data import
├── requirements.txt    # Python dependencies
├── setup.py            # Installation script
├── config.env          # Configuration template
└── README.md           # This file
```

### Adding New Features
1. **Backend**: Add new routes in `app.py`
2. **Database**: Extend schema in `database.py`
3. **Frontend**: Update `script.js` and `index.html`
4. **Data**: Extend `data_import.py` for new data sources

### Testing
```bash
# Run tests
python -m pytest

# Check code quality
flake8 .
black .
```

## Troubleshooting

### Common Issues

#### Database Connection Failed
- Ensure PostgreSQL is running
- Check database credentials in `.env`
- Verify PostGIS extension is enabled

#### ArcGIS Data Not Loading
- Check internet connection
- Verify ArcGIS service URLs are accessible
- Check browser console for CORS errors

#### API Keys Not Working
- Verify API keys are correct
- Check API service status
- Ensure proper billing/quotas

#### Frontend Not Displaying
- Check browser console for JavaScript errors
- Verify backend server is running
- Check CORS configuration

### Logs
- Backend logs: Console output when running `python app.py`
- Database logs: PostgreSQL logs
- Frontend logs: Browser developer console

## Support & Contributing

### Getting Help
1. Check this README for common solutions
2. Review browser console and backend logs
3. Check GitHub issues for known problems
4. Create new issue with detailed error description

### Contributing
1. Fork the repository
2. Create feature branch
3. Make changes with tests
4. Submit pull request

## License

This project is licensed under the MIT License - see LICENSE file for details.

## Acknowledgments

- **City of Charlotte GIS** - For providing public ArcGIS services
- **OpenStreetMap** - For base mapping data
- **Leaflet** - For interactive mapping library
- **PostGIS** - For spatial database capabilities

## Roadmap

### Phase 2: Enhanced Analysis
- Slope analysis with elevation data
- Flood plain mapping
- Utility availability mapping
- Traffic analysis

### Phase 3: Advanced Features
- Automated valuation models
- Market trend analysis
- Development cost estimation
- ROI calculations

### Phase 4: Integration
- CRM system integration
- Document management
- Workflow automation
- Mobile app development

---

**Built for real estate professionals by real estate professionals**
