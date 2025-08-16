#!/usr/bin/env python3
"""
Setup script for Charlotte Land Map
Automates the installation and configuration process
"""

import os
import sys
import subprocess
import platform
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def check_python_version():
    """Check if Python version is compatible"""
    if sys.version_info < (3, 8):
        logger.error("Python 3.8 or higher is required")
        return False
    logger.info(f"Python {sys.version_info.major}.{sys.version_info.minor} detected")
    return True

def install_python_packages():
    """Install required Python packages"""
    logger.info("Installing Python packages...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        logger.info("Python packages installed successfully")
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to install Python packages: {e}")
        return False

def check_postgresql():
    """Check if PostgreSQL is installed and running"""
    logger.info("Checking PostgreSQL installation...")
    
    try:
        # Try to connect to PostgreSQL
        import psycopg2
        logger.info("psycopg2 is available")
    except ImportError:
        logger.error("psycopg2 not found. Please install PostgreSQL and psycopg2")
        return False
    
    # Check if PostgreSQL service is running
    system = platform.system().lower()
    if system == "windows":
        try:
            result = subprocess.run(["sc", "query", "postgresql"], capture_output=True, text=True)
            if "RUNNING" in result.stdout:
                logger.info("PostgreSQL service is running")
                return True
            else:
                logger.warning("PostgreSQL service is not running")
                return False
        except FileNotFoundError:
            logger.error("PostgreSQL service not found")
            return False
    else:
        # Linux/Mac
        try:
            result = subprocess.run(["pg_isready"], capture_output=True, text=True)
            if result.returncode == 0:
                logger.info("PostgreSQL is running and accepting connections")
                return True
            else:
                logger.warning("PostgreSQL is not accepting connections")
                return False
        except FileNotFoundError:
            logger.error("PostgreSQL not found. Please install PostgreSQL")
            return False

def create_database():
    """Create the database and tables"""
    logger.info("Creating database and tables...")
    try:
        from database import db_manager
        
        if db_manager.connect():
            db_manager.create_tables()
            db_manager.disconnect()
            logger.info("Database setup completed")
            return True
        else:
            logger.error("Failed to connect to database")
            return False
            
    except Exception as e:
        logger.error(f"Database setup failed: {e}")
        return False

def run_data_import():
    """Run the initial data import"""
    logger.info("Running initial data import...")
    try:
        from data_import import main as import_main
        import_main()
        logger.info("Data import completed")
        return True
    except Exception as e:
        logger.error(f"Data import failed: {e}")
        return False

def create_env_file():
    """Create .env file from template"""
    if not os.path.exists('.env'):
        logger.info("Creating .env file...")
        try:
            with open('config.env', 'r') as template:
                content = template.read()
            
            with open('.env', 'w') as env_file:
                env_file.write(content)
            
            logger.info(".env file created. Please edit it with your actual values.")
            return True
        except Exception as e:
            logger.error(f"Failed to create .env file: {e}")
            return False
    else:
        logger.info(".env file already exists")
        return True

def main():
    """Main setup function"""
    logger.info("Starting Charlotte Land Map setup...")
    
    # Check Python version
    if not check_python_version():
        sys.exit(1)
    
    # Install Python packages
    if not install_python_packages():
        logger.error("Setup failed at package installation")
        sys.exit(1)
    
    # Create environment file
    if not create_env_file():
        logger.error("Setup failed at environment file creation")
        sys.exit(1)
    
    # Check PostgreSQL
    if not check_postgresql():
        logger.error("Setup failed at PostgreSQL check")
        logger.info("Please install PostgreSQL and ensure it's running")
        sys.exit(1)
    
    # Create database
    if not create_database():
        logger.error("Setup failed at database creation")
        sys.exit(1)
    
    # Run data import
    if not run_data_import():
        logger.warning("Data import failed, but setup can continue")
    
    logger.info("Setup completed successfully!")
    logger.info("Next steps:")
    logger.info("1. Edit .env file with your actual API keys and database credentials")
    logger.info("2. Run 'python app.py' to start the backend server")
    logger.info("3. Open index.html in your browser to use the frontend")

if __name__ == "__main__":
    main()


