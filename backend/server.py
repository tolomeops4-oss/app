from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Any, Dict
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Progetto Oliveto API")
api_router = APIRouter(prefix="/api")


# ------------ Models ------------

class Vertex(BaseModel):
    id: str
    lat: float
    lng: float


class Obstacle(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str
    type: str  # 'palo' | 'fabbricato' | 'pozzo' | 'roccia' | 'albero'
    geomType: str  # 'point' | 'polygon'
    points: List[Vertex]
    bufferAlong: float = 4.0
    bufferSide: float = 2.0
    label: Optional[str] = None


class PlantingConfig(BaseModel):
    interRow: float = 4.0
    interPlant: float = 1.5
    headland: float = 10.0
    sideMargin: float = 2.0
    minSegment: float = 30.0
    variety: str = "Arbequina"


class IrrigationConfig(BaseModel):
    linesPerRow: int = 1
    emitterFlow: float = 1.5  # L/h
    emitterSpacing: float = 0.5  # m
    pressure: float = 1.0  # bar
    pipeType: str = "PC"  # PC | NON_PC
    sectorMode: str = "auto"  # auto | manual
    numSectors: int = 2
    pumpCapacity: float = 20.0  # m3/h
    manualAssignments: Dict[str, int] = Field(default_factory=dict)


class NetworkElement(BaseModel):
    id: str
    type: str  # 'pozzo' | 'filtro' | 'valvola' | 'condotta'
    lat: float
    lng: float
    label: Optional[str] = None
    sectorIndex: Optional[int] = None


class FieldDoc(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    vertices: List[Vertex] = Field(default_factory=list)
    closed: bool = False
    obstacles: List[Obstacle] = Field(default_factory=list)
    config: PlantingConfig = Field(default_factory=PlantingConfig)
    irrigation: IrrigationConfig = Field(default_factory=IrrigationConfig)
    networkElements: List[NetworkElement] = Field(default_factory=list)
    azimuth: float = 0.0
    tileLayer: str = "google_hybrid"
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updatedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class FieldCreate(BaseModel):
    name: str


class FieldUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: Optional[str] = None
    vertices: Optional[List[Vertex]] = None
    closed: Optional[bool] = None
    obstacles: Optional[List[Obstacle]] = None
    config: Optional[PlantingConfig] = None
    irrigation: Optional[IrrigationConfig] = None
    networkElements: Optional[List[NetworkElement]] = None
    azimuth: Optional[float] = None
    tileLayer: Optional[str] = None


# ------------ Routes ------------

@api_router.get("/")
async def root():
    return {"message": "Progetto Oliveto API", "status": "ok"}


@api_router.get("/fields", response_model=List[FieldDoc])
async def list_fields():
    docs = await db.fields.find({}, {"_id": 0}).to_list(1000)
    return docs


@api_router.post("/fields", response_model=FieldDoc)
async def create_field(payload: FieldCreate):
    field = FieldDoc(name=payload.name)
    await db.fields.insert_one(field.model_dump())
    return field


@api_router.get("/fields/{field_id}", response_model=FieldDoc)
async def get_field(field_id: str):
    doc = await db.fields.find_one({"id": field_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Campo non trovato")
    return doc


@api_router.put("/fields/{field_id}", response_model=FieldDoc)
async def update_field(field_id: str, payload: FieldUpdate):
    update_data = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Nessun campo da aggiornare")
    update_data["updatedAt"] = datetime.now(timezone.utc).isoformat()
    result = await db.fields.find_one_and_update(
        {"id": field_id},
        {"$set": update_data},
        return_document=True,
        projection={"_id": 0},
    )
    if not result:
        raise HTTPException(status_code=404, detail="Campo non trovato")
    return result


@api_router.delete("/fields/{field_id}")
async def delete_field(field_id: str):
    res = await db.fields.delete_one({"id": field_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Campo non trovato")
    return {"deleted": True, "id": field_id}


@api_router.post("/fields/{field_id}/duplicate", response_model=FieldDoc)
async def duplicate_field(field_id: str):
    src = await db.fields.find_one({"id": field_id}, {"_id": 0})
    if not src:
        raise HTTPException(status_code=404, detail="Campo non trovato")
    src["id"] = str(uuid.uuid4())
    src["name"] = f"{src['name']} (Copia)"
    src["createdAt"] = datetime.now(timezone.utc).isoformat()
    src["updatedAt"] = src["createdAt"]
    await db.fields.insert_one(src)
    return src


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
