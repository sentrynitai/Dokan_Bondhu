import os
import sys

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from sqlalchemy import inspect, text
from app.database import engine

try:
    with engine.connect() as connection:
        database_name = connection.execute(
            text("SELECT DATABASE()")
        ).scalar_one()

        print("MySQL connected successfully!")
        print("Database:", database_name)

        inspector = inspect(engine)
        tables = inspector.get_table_names()
        print("Tables found:", tables if tables else "None (tables not created yet)")

except Exception as error:
    print("Database connection failed:")
    print(error)
