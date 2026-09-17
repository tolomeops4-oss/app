from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import jwt
import bcrypt
import requests as httpx
from pathlib import Path
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import List, Optional, Dict
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALG = "HS256"
ACCESS_TTL_MIN = 60 * 24 * 7  # 7 days

app = FastAPI(title="Progetto Oliveto API")
api_router = APIRouter(prefix="/api")
auth_router = APIRouter(prefix="/api/auth")

# =============== Models ===============

class Vertex(BaseModel):
    id: str
    lat: float
    lng: float


class Obstacle(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str
    type: str
    geomType: str
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
    emitterFlow: float = 1.5
    emitterSpacing: float = 0.5
    pressure: float = 1.0
    pipeType: str = "PC"
    sectorMode: str = "auto"
    numSectors: int = 2
    pumpCapacity: float = 20.0
    manualAssignments: Dict[str, int] = Field(default_factory=dict)


class NetworkElement(BaseModel):
    id: str
    type: str
    lat: float
    lng: float
    label: Optional[str] = None
    sectorIndex: Optional[int] = None
    rowId: Optional[str] = None


class FieldDoc(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    ownerId: Optional[str] = None
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


class RegisterReq(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None


class LoginReq(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    user_id: str
    email: str
    name: Optional[str] = None
    picture: Optional[str] = None
    provider: str = "local"


# =============== Auth helpers ===============

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id, "email": email, "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TTL_MIN),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

async def get_current_user(request: Request) -> Optional[dict]:
    """Returns user dict or None (guest mode)."""
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        return None
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        uid = payload.get("sub")
        if not uid:
            return None
        user = await db.users.find_one({"user_id": uid}, {"_id": 0, "password_hash": 0})
        return user
    except Exception:
        return None

async def require_user(request: Request) -> dict:
    u = await get_current_user(request)
    if not u:
        raise HTTPException(status_code=401, detail="Autenticazione richiesta")
    return u


def set_auth_cookie(response: Response, token: str):
    response.set_cookie(
        key="access_token", value=token, httponly=True, secure=True,
        samesite="none", max_age=ACCESS_TTL_MIN * 60, path="/",
    )


# =============== Auth Routes ===============

@auth_router.post("/register", response_model=UserOut)
async def register(payload: RegisterReq, response: Response):
    email = payload.email.strip().lower()
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password minimo 6 caratteri")
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing and existing.get("password_hash"):
        raise HTTPException(status_code=400, detail="Email già registrata")
    user_id = existing.get("user_id") if existing else f"user_{uuid.uuid4().hex[:12]}"
    doc = {
        "user_id": user_id,
        "email": email,
        "name": (payload.name or email.split("@")[0]),
        "password_hash": hash_password(payload.password),
        "provider": "local" if not existing else existing.get("provider", "local"),
        "picture": existing.get("picture") if existing else None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if existing:
        await db.users.update_one({"user_id": user_id}, {"$set": doc})
    else:
        await db.users.insert_one(doc)
    token = create_access_token(user_id, email)
    set_auth_cookie(response, token)
    return UserOut(user_id=user_id, email=email, name=doc["name"], picture=doc.get("picture"), provider=doc["provider"])


@auth_router.post("/login", response_model=UserOut)
async def login(payload: LoginReq, response: Response):
    email = payload.email.strip().lower()
    u = await db.users.find_one({"email": email}, {"_id": 0})
    if not u or not u.get("password_hash"):
        raise HTTPException(status_code=401, detail="Credenziali non valide")
    if not verify_password(payload.password, u["password_hash"]):
        raise HTTPException(status_code=401, detail="Credenziali non valide")
    token = create_access_token(u["user_id"], email)
    set_auth_cookie(response, token)
    return UserOut(user_id=u["user_id"], email=email, name=u.get("name"), picture=u.get("picture"), provider=u.get("provider", "local"))


@auth_router.post("/session")
async def emergent_session(payload: dict, response: Response):
    """Exchange Emergent Google session_id for our JWT."""
    session_id = payload.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id mancante")
    try:
        r = httpx.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}, timeout=10,
        )
        r.raise_for_status()
        data = r.json()
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Sessione Emergent non valida: {e}")

    email = (data.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=401, detail="Email non fornita da Google")
    name = data.get("name") or email.split("@")[0]
    picture = data.get("picture")

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture, "provider": existing.get("provider") or "google"}},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id, "email": email, "name": name, "picture": picture,
            "provider": "google", "created_at": datetime.now(timezone.utc).isoformat(),
        })
    token = create_access_token(user_id, email)
    set_auth_cookie(response, token)
    return {"user_id": user_id, "email": email, "name": name, "picture": picture, "provider": "google"}


@auth_router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/", samesite="none", secure=True)
    return {"ok": True}


@auth_router.get("/me")
async def me(request: Request):
    user = await get_current_user(request)
    if not user:
        return None
    return {
        "user_id": user["user_id"], "email": user["email"],
        "name": user.get("name"), "picture": user.get("picture"),
        "provider": user.get("provider", "local"),
    }


@auth_router.post("/claim-guest-fields")
async def claim_guest_fields(request: Request):
    """Assign all ownerless fields to the current user."""
    user = await require_user(request)
    res = await db.fields.update_many(
        {"$or": [{"ownerId": None}, {"ownerId": {"$exists": False}}]},
        {"$set": {"ownerId": user["user_id"], "updatedAt": datetime.now(timezone.utc).isoformat()}},
    )
    return {"claimed": res.modified_count}


# =============== Field routes (auth-aware) ===============

def field_filter_for(user: Optional[dict]) -> dict:
    if user:
        return {"$or": [{"ownerId": user["user_id"]}, {"ownerId": None}, {"ownerId": {"$exists": False}}]}
    return {"$or": [{"ownerId": None}, {"ownerId": {"$exists": False}}]}


@api_router.get("/")
async def root():
    return {"message": "Progetto Oliveto API", "status": "ok"}


@api_router.get("/fields", response_model=List[FieldDoc])
async def list_fields(request: Request):
    user = await get_current_user(request)
    docs = await db.fields.find(field_filter_for(user), {"_id": 0}).to_list(1000)
    return docs


@api_router.post("/fields", response_model=FieldDoc)
async def create_field(payload: FieldCreate, request: Request):
    user = await get_current_user(request)
    field = FieldDoc(name=payload.name, ownerId=user["user_id"] if user else None)
    await db.fields.insert_one(field.model_dump())
    return field


@api_router.get("/fields/{field_id}", response_model=FieldDoc)
async def get_field(field_id: str, request: Request):
    user = await get_current_user(request)
    q = {"id": field_id, **field_filter_for(user)}
    doc = await db.fields.find_one(q, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Campo non trovato")
    return doc


@api_router.put("/fields/{field_id}", response_model=FieldDoc)
async def update_field(field_id: str, payload: FieldUpdate, request: Request):
    user = await get_current_user(request)
    update_data = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Nessun campo da aggiornare")
    update_data["updatedAt"] = datetime.now(timezone.utc).isoformat()
    q = {"id": field_id, **field_filter_for(user)}
    result = await db.fields.find_one_and_update(
        q, {"$set": update_data}, return_document=True, projection={"_id": 0},
    )
    if not result:
        raise HTTPException(status_code=404, detail="Campo non trovato")
    return result


@api_router.delete("/fields/{field_id}")
async def delete_field(field_id: str, request: Request):
    user = await get_current_user(request)
    q = {"id": field_id, **field_filter_for(user)}
    res = await db.fields.delete_one(q)
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Campo non trovato")
    return {"deleted": True, "id": field_id}


@api_router.post("/fields/{field_id}/duplicate", response_model=FieldDoc)
async def duplicate_field(field_id: str, request: Request):
    user = await get_current_user(request)
    q = {"id": field_id, **field_filter_for(user)}
    src = await db.fields.find_one(q, {"_id": 0})
    if not src:
        raise HTTPException(status_code=404, detail="Campo non trovato")
    src["id"] = str(uuid.uuid4())
    src["name"] = f"{src['name']} (Copia)"
    src["ownerId"] = user["user_id"] if user else None
    src["createdAt"] = datetime.now(timezone.utc).isoformat()
    src["updatedAt"] = src["createdAt"]
    await db.fields.insert_one(src)
    return src


# =============== Backup / Restore ===============

@api_router.get("/backup")
async def backup_fields(request: Request):
    user = await get_current_user(request)
    docs = await db.fields.find(field_filter_for(user), {"_id": 0}).to_list(10000)
    return {
        "app": "Progetto Oliveto",
        "version": 1,
        "exportedAt": datetime.now(timezone.utc).isoformat(),
        "ownerId": user["user_id"] if user else None,
        "count": len(docs),
        "fields": docs,
    }


@api_router.post("/backup/restore")
async def restore_backup(payload: dict, request: Request):
    user = await get_current_user(request)
    fields = payload.get("fields") or []
    if not isinstance(fields, list):
        raise HTTPException(status_code=400, detail="Formato backup non valido")
    n_imported = 0
    for f in fields:
        try:
            # Assign new id to avoid collisions and set ownership
            f = dict(f)
            f["id"] = str(uuid.uuid4())
            f["ownerId"] = user["user_id"] if user else None
            f["createdAt"] = datetime.now(timezone.utc).isoformat()
            f["updatedAt"] = f["createdAt"]
            fd = FieldDoc(**f)
            await db.fields.insert_one(fd.model_dump())
            n_imported += 1
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.warning(f"Skip invalid backup field: {e}")
            continue
    return {"imported": n_imported}


# =============== Startup ===============

@app.on_event("startup")
async def on_start():
    try:
        await db.users.create_index("email", unique=True)
        await db.users.create_index("user_id", unique=True)
        await db.fields.create_index("id", unique=True)
        await db.fields.create_index("ownerId")
    except Exception:
        pass


app.include_router(api_router)
app.include_router(auth_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
