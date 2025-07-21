from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from models import InputConfiguration
from simulation import run_election

app = FastAPI()

# Add CORS middleware with more specific settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],  # Explicitly allow OPTIONS
    allow_headers=["*"],
)

@app.post("/election")
async def add_configuration(config: InputConfiguration):
    return await run_election(config)

@app.get("/")
def read_root():
    return FileResponse("index.html")