# Quick Start Guide - Charlotte Land Map

## 🚀 Get Up and Running in 10 Minutes

### Prerequisites Check
- [ ] Python 3.8+ installed
- [ ] PostgreSQL installed with PostGIS extension
- [ ] Internet connection for ArcGIS data

### Step 1: Install Python Dependencies
```bash
pip install -r requirements.txt
```

### Step 2: Set Up Database
```bash
# Create database (if not exists)
createdb charlotte_land_map

# Enable PostGIS extension
psql -d charlotte_land_map -c "CREATE EXTENSION postgis;"
```

### Step 3: Configure Environment
```bash
# Copy config template
cp config.env .env

# Edit .env with your database credentials
# DATABASE_URL=postgresql://username:password@localhost:5432/charlotte_land_map
```

### Step 4: Run Setup
```bash
python setup.py
```

### Step 5: Start the System
```bash
# Start backend
python app.py

# Open frontend
# Navigate to index.html in your browser
```

## 🎯 What You'll See

1. **Interactive Map** - Charlotte with parcel boundaries
2. **Search Filters** - Find land by size, vacancy, zoning
3. **Parcel Details** - Click parcels for information
4. **Owner Lookup** - Get contact information
5. **Development Analysis** - Zoning and subdivision potential

## 🔧 Troubleshooting

### Common Issues & Solutions

**Database Connection Error**
```bash
# Check PostgreSQL is running
pg_isready

# Verify database exists
psql -l | grep charlotte_land_map
```

**Python Package Issues**
```bash
# Upgrade pip
python -m pip install --upgrade pip

# Install with specific versions
pip install -r requirements.txt --force-reinstall
```

**ArcGIS Data Not Loading**
- Check browser console for errors
- Verify internet connection
- Check if Charlotte GIS services are accessible

## 📱 Using the System

### Basic Operations
1. **Zoom/Pan** - Use mouse wheel and drag
2. **Search Parcels** - Use filters on the left
3. **View Details** - Click any parcel
4. **Get Owner Info** - Use "Get Owner Contact Info" button

### Advanced Features
- **Vacant Land Only** - Check "Vacant Only" filter
- **Minimum Acreage** - Set size requirements
- **Parcel ID Search** - Find specific properties
- **Development Analysis** - View zoning requirements

## 🆘 Need Help?

1. **Check Logs** - Backend console output
2. **Browser Console** - Press F12 for errors
3. **Database Status** - Check PostgreSQL logs
4. **API Health** - Visit `http://localhost:5000/api/health`

## 🎉 Success!

You now have a professional land development analysis tool running locally!

- **Backend API**: http://localhost:5000
- **Frontend**: Open `index.html` in browser
- **Database**: PostgreSQL with PostGIS
- **Data Source**: Charlotte GIS ArcGIS services

---

**Ready to find your next development opportunity! 🏗️**


