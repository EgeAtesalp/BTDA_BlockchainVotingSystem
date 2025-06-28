from fastapi import FastAPI
from pydantic import BaseModel
from simulation import run_election

app = FastAPI()

class InputConfiguration(BaseModel):
    number_of_voters: int
    number_of_districts: int
    number_of_candidates: int

class Results(BaseModel):
    ...


@app.post("/election")
def add_configuration(config: InputConfiguration):
    # Convert Pydantic object to dicionary
    config_dict = config.model_dump()
    results = run_election(config_dict)
    return results
