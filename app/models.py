from pydantic import BaseModel
class VotingStrategies(BaseModel):
    polarized: float
    random: float
    strategic_undervoting: float
    bullet: float
    biased_towards_left_wing_candidates: float
    biased_towards_right_wing_candidates: float
    biased_towards_experienced_candidates: float
    biased_towards_young_candidates : float


class InputConfiguration(BaseModel):
    number_of_voters: int
    number_of_districts: int
    number_of_candidates: int
    score_range_min: int
    score_range_max: int
    voting_strategies: VotingStrategies
