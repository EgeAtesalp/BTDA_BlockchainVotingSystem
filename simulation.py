from web3 import Web3
from math import floor
from models import InputConfiguration
import json
import random
import csv
import time


class VirtualAgent:
    # Virtual Agent class to simulate voting behavior
    def __init__(self, address, district_id, strategy):
        self.address = address
        self.district_id = district_id
        self.strategy = strategy

    def generate_scores(self, candidate_count, score_range_min, score_range_max, candidates):
        strategy_fn = voting_strategies.get(self.strategy)

        if not strategy_fn:
            # Fallback to random if unknown strategy
            return score_random(score_range_min, score_range_max, candidate_count, candidates)

        return strategy_fn(score_range_min, score_range_max, candidate_count, candidates)

        # Polarized Scoring: Agents give only extreme scores (0 or 10) to maximize their preferred candidate's advantage
        # Strategic Undervoting: Agents give low scores to viable competitors while maximizing their preferred candidate's score
        # Bullet Voting: Agents give maximum score to one candidate and minimum to all others


voting_strategies = dict()


def register_strategy(strategy: str):
    def wrapper(func):
        voting_strategies[strategy] = func
        return func
    return wrapper


@register_strategy("polarized")
def score_polarized(score_range_min, score_range_max, candidate_count, candidates):
    # Assigns the maximum score to a randomly chosen half of the candidates and the minimum to the rest.
    winners = set(random.sample(range(candidate_count), k=(candidate_count + 1) // 2))
    return [score_range_max if i in winners else score_range_min for i in range(candidate_count)]


@register_strategy("random")
def score_random(score_range_min, score_range_max, candidate_count, candidates):
    # Assigns a random score within the allowed range to each candidate.
    return [random.randint(score_range_min, score_range_max) for _ in range(candidate_count)]


@register_strategy("strategic_undervoting")
def score_strategic_undervoting(score_range_min, score_range_max, candidate_count, candidates):
    # Assigns the maximum score to one randomly chosen favorite candidate and a low score to all others.
    fav = random.randrange(candidate_count)
    low = max(score_range_min, score_range_max - 3)
    return [score_range_max if i == fav else low for i in range(candidate_count)]


@register_strategy("bullet")
def score_bullet(score_range_min, score_range_max, candidate_count, candidates):
    # Assigns a score of 10 to one favorite candidate and 0 to all others — classic bullet voting.
    fav = random.randrange(candidate_count)
    return [10 if i == fav else 0 for i in range(candidate_count)]


@register_strategy("biased_towards_left_wing_candidates")
def score_biased_towards_left_wing_candidates(score_range_min, score_range_max, candidate_count, candidates):
    # Favors candidates with 'Left' or 'Far Left' political positions by giving them the highest score
    # and the lowest score to every other condidate.
    scores = []
    for candidate in candidates:
        if "Left" or "Far Left" in candidate["political_position"]:
            scores.append(score_range_max)
        else:
            scores.append(score_range_min)
    return scores


@register_strategy("biased_towards_right_wing_candidates")
def score_biased_towards_right_wing_candidates(score_range_min, score_range_max, candidate_count, candidates):
    # Favors candidates with 'Right' or 'Far Right' political positions by giving them the highest score
    # and the lowest score to every other condidate.
    scores = []
    for candidate in candidates:
        if "Right" or "Far Right" in candidate["political_position"]:
            scores.append(score_range_max)
        else:
            scores.append(score_range_min)
    return scores


@register_strategy("biased_towards_experienced_candidates")
def score_biased_towards_experienced_candidates(score_range_min, score_range_max, candidate_count, candidates):
    # Assigns higher scores to more experienced candidates, normalized to the score range.
    max_exp = max(int(candidate["experience"]) for candidate in candidates)
    scores = []
    for candidate in candidates:
        exp = int(candidate["experience"])
        # Normalize experience to range
        score = score_range_min + (exp / max_exp) * (score_range_max - score_range_min)
        scores.append(round(score))
    return scores


@register_strategy("biased_towards_young_candidates")
def score_biased_towards_young_candidates(score_range_min, score_range_max, candidate_count, candidates):
    # Favors younger candidates by assigning higher scores to lower ages, normalized to the score range.
    max_age = max(int(candidate["age"]) for candidate in candidates)
    scores = []
    for candidate in candidates:
        age = int(candidate["age"])
        # Younger -> higher score
        score = score_range_min + ((max_age - age) / max_age) * (score_range_max - score_range_min)
        scores.append(round(score))
    return scores


def generate_candidates(number_of_candidates: int) -> list[dict]:
    with open("candidates.csv", newline='', encoding="utf-8") as f:
        records = list(csv.DictReader(f))

    # Guard against asking for more rows than exist
    if number_of_candidates > len(records):
        raise ValueError(
            f"Requested {number_of_candidates} candidates, "
            f"but only {len(records)} are available."
        )

    # Pick distinct rows without replacement
    return random.sample(records, number_of_candidates)


def track_gas(w3, tx_hash, gas_tracker):
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    gas_used = receipt.gasUsed
    gas_price = receipt.effectiveGasPrice
    eth_used = w3.from_wei(gas_used * gas_price, 'ether')
    gas_tracker['gas'] += gas_used
    gas_tracker['eth'] += eth_used
    return receipt


def run_election(config: InputConfiguration):
    # Connect to Hardhat local node
    w3 = Web3(Web3.HTTPProvider("http://127.0.0.1:8545"))
    assert w3.is_connected(), "❌ Failed to connect to Hardhat node."

    # Load the ABI
    with open("artifacts/contracts/ScoreVotingElection.sol/ScoreVotingElection.json") as f:
        contract_data = json.load(f)
        abi = contract_data["abi"]
        bytecode = contract_data["bytecode"]

    w3.eth.default_account = w3.eth.accounts[0]

    # Create contract factory
    ScoreVotingElection = w3.eth.contract(abi=abi, bytecode=bytecode)

    gas_tracker = {"gas": 0, "eth": 0}

    # Deploy contract transaction
    tx_hash = ScoreVotingElection.constructor().transact()
    receipt = track_gas(w3, tx_hash, gas_tracker)
    # Get deployed contract address
    contract_address = receipt["contractAddress"]
    print("Contract deployed at:", contract_address)

    # Now create the contract instance using the address
    contract = w3.eth.contract(address=contract_address, abi=abi)

    # Parse Configuration dicionary to variables
    number_of_districts = config.number_of_districts
    candidates = generate_candidates(config.number_of_candidates)
    number_of_voters = config.number_of_voters
    score_range_min = config.score_range_min
    score_range_max = config.score_range_max

    # Accounts
    accounts = w3.eth.accounts
    admin = accounts[0]
    voters = accounts[1:number_of_voters+1]

    # --- Create districts ---
    for district in range(number_of_districts):
        tx = contract.functions.createDistrict(str(district)).transact({'from': admin})
        receipt = track_gas(w3, tx, gas_tracker)
    print(f"✅ Created {number_of_districts} districts")

    # --- Add candidates ---
    for candidate in candidates:
        tx = contract.functions.addCandidate(candidate["name"], candidate["party"]).transact({'from': admin})
        receipt = track_gas(w3, tx, gas_tracker)
    print(f"✅ Added {len(candidates)} candidates")

    # Fetch counts from contract
    candidate_count = contract.functions.candidateCount().call()
    district_count = contract.functions.districtCount().call()

    # --- Register voters ---
    agents = []
    strategies, weights = map(list, zip(*config.voting_strategies.model_dump().items()))

    # Normalise if weights don’t sum to 1.0
    total_w = sum(weights)
    weights = [w / total_w for w in weights]

    # 1) Initial seat counts = floor(expected seats)
    raw = [w * number_of_voters for w in weights]
    counts = [floor(r) for r in raw]

    # 2) Distribute the leftover seats to the largest remainders
    leftover = number_of_voters - sum(counts)
    remainders = sorted(
        ((raw[i] - counts[i], i) for i in range(len(strategies))),
        reverse=True
    )
    for _, idx in remainders[:leftover]:
        counts[idx] += 1

    # 3) Build a deterministic pool of strategies
    strategy_pool = [
        strategy
        for strategy, cnt in zip(strategies, counts)
        for _ in range(cnt)
    ]
    for i, acct in enumerate(voters):
        district_id = i % district_count
        strategy = strategy_pool.pop()
        agent = VirtualAgent(acct, district_id, strategy)
        agents.append(agent)

        tx = contract.functions.registerVoter(agent.address, agent.district_id).transact({'from': admin})
        receipt = track_gas(w3, tx, gas_tracker)
    print(f"✅ Registered {len(agents)} voters")

    # --- Start voting phase ---
    tx = contract.functions.startVoting().transact({'from': admin})
    receipt = track_gas(w3, tx, gas_tracker)
    print("✅ Voting started")

    # --- Cast votes ---
    start = time.time()
    for agent in agents:
        scores = agent.generate_scores(candidate_count, score_range_min, score_range_max, candidates)
        assert len(scores) == candidate_count, "Score list length mismatch"
        assert all(score_range_min <= s <= score_range_max for s in scores), "Score out of valid range"

        tx = contract.functions.castVote(scores).transact({'from': agent.address})
        receipt = track_gas(w3, tx, gas_tracker)
    print(f"✅ All {len(agents)} voters cast their votes")
    end = time.time()

    # --- End election ---
    tx = contract.functions.endElection().transact({'from': admin})
    receipt = track_gas(w3, tx, gas_tracker)
    print("✅ Election ended")

    # --- Fetch and display results ---
    results = contract.functions.getResults().call()
    print(results)
    total_scores = results[1]
    vote_counts = results[2]

    # Zip candidates with their results
    combined = list(zip(candidates, total_scores, vote_counts))
    # Sort by total score (index 1) in descending order
    combined.sort(key=lambda x: x[1], reverse=True)

    print("\n🏁 Election Results:")
    formatted_results = []
    for candidate, total, votes in combined:
        avg = total / votes if votes > 0 else 0
        formatted_results.append({
            **candidate,  # ⬅ all fields from candidate: name, party, political_position, age, gender, experience
            "total_score": total,
            "votes": votes,
            "average_score": round(avg, 2)
        })
        print(f"- {candidate['name']} ({candidate['party']}):")
        print(f"  Total Score: {total}")
        print(f"  Votes: {votes}")
        print(f"  Avg Score: {avg:.2f}")

    metrics = {
        "voting_duration_secs": round(end - start, 2),
        "total_gas_used": gas_tracker["gas"],
        "total_eth_spent": gas_tracker["eth"],
        "gas_per_voter": gas_tracker["gas"] // number_of_voters,
        "gas_per_candidate": gas_tracker["gas"] // candidate_count
    }

    response = {
        "election_results": formatted_results,
        "metrics": metrics
    }
    return response
