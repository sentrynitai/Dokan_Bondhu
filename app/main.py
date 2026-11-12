import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routers.auth import router as auth_router
from app.routers.shops import router as shops_router
from app.routers.categories import router as categories_router
from app.routers.products import router as products_router
from app.routers.inventory import router as inventory_router
from app.routers.customers import router as customers_router
from app.routers.suppliers import router as suppliers_router
from app.routers.purchases import router as purchases_router
from app.routers.sales import router as sales_router
from app.routers.payments import router as payments_router
from app.routers.dashboard import router as dashboard_router
from app.routers.reports import router as reports_router

logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Skip creating tables on startup during tests or if database is managed by Alembic
    if os.getenv("TESTING", "").lower() != "true":
        try:
            Base.metadata.create_all(bind=engine)
        except Exception as err:
            logger.warning("Could not connect to database at startup: %s", err)
    yield


app = FastAPI(
    title="Dokan Bandhu API",
    description="Shop Management System",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration for web/mobile frontend access
# Supports both explicit dev ports, localhost & 127.0.0.1, with credentials enabled
allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]

cors_env = os.getenv("CORS_ORIGINS", "")
if cors_env:
    for origin in cors_env.split(","):
        origin = origin.strip()
        if origin and origin not in allowed_origins:
            allowed_origins.append(origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if not os.getenv("ALLOW_ALL_ORIGINS") else ["*"],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:[0-9]+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(shops_router)
app.include_router(categories_router)
app.include_router(products_router)
app.include_router(inventory_router)
app.include_router(customers_router)
app.include_router(suppliers_router)
app.include_router(purchases_router)
app.include_router(sales_router)
app.include_router(payments_router)
app.include_router(dashboard_router)
app.include_router(reports_router)


@app.get("/", tags=["General"])
def home():
    return {
        "message": "Welcome to Dokan Bandhu API"
    }


@app.get("/health", tags=["General"])
def health_check():
    return {
        "status": "healthy"
    }
