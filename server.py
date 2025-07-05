from fastapi import FastAPI
from models import InputConfiguration
from simulation import run_election

app = FastAPI()


@app.post("/election")
def add_configuration(config: InputConfiguration):
    return run_election(config)
