from web3 import Web3
from math import floor
from models import InputConfiguration
import asyncio
from concurrent.futures import ThreadPoolExecutor
import json
import random
import csv
import time
from eth_account import Account
import secrets

voting_strategies = dict()


def generate_scores(strategy, score_range_min, score_range_max, candidates):
    strategy_fn = voting_strategies.get(strategy)

    if not strategy_fn:
        # Fallback to random if unknown strategy
        return score_random(score_range_min, score_range_max, len(candidates), candidates)

    return strategy_fn(score_range_min, score_range_max, len(candidates), candidates)


def register_strategy(strategy: str):
    def wrapper(func):
        voting_strategies[strategy] = func
        return func
    return wrapper


@register_strategy("polarized")
def score_polarized(score_range_min, score_range_max, candidate_count, candidates):
    # Assigns the maximum score to a randomly chosen half of the candidates and the minimum to the rest
    winners = set(random.sample(range(candidate_count), k=(candidate_count + 1) // 2))
    return [score_range_max if i in winners else score_range_min for i in range(candidate_count)]


@register_strategy("random")
def score_random(score_range_min, score_range_max, candidate_count, candidates):
    # Assigns a random score within the allowed range to each candidate
    return [random.randint(score_range_min, score_range_max) for _ in range(candidate_count)]


@register_strategy("strategic_undervoting")
def score_strategic_undervoting(score_range_min, score_range_max, candidate_count, candidates):
    # Assigns the maximum score to one randomly chosen favorite candidate and a low score to all others
    fav = random.randrange(candidate_count)
    # Calculate a "low" score that's still within the valid range
    low_score = min(score_range_min + 1, score_range_max - 2)  # Ensure it's above minimum but still low
    if low_score < score_range_min:
        low_score = score_range_min
    return [score_range_max if i == fav else low_score for i in range(candidate_count)]


@register_strategy("bullet")
def score_bullet(score_range_min, score_range_max, candidate_count, candidates):
    # Assigns a maximum score to one candidate and minimum to all others
    fav = random.randrange(candidate_count)
    return [score_range_max if i == fav else score_range_min for i in range(candidate_count)]


@register_strategy("biased_towards_left_wing_candidates")
def score_biased_towards_left_wing_candidates(score_range_min, score_range_max, candidate_count, candidates):
    # Favors candidates with 'Left' or 'Far Left' political positions by giving them the highest score
    # and the lowest score to every other condidate
    scores = []
    for candidate in candidates:
        if candidate["political_position"] in ["Left", "Far Left"]:
            scores.append(score_range_max)
        else:
            scores.append(score_range_min)
    return scores


@register_strategy("biased_towards_right_wing_candidates")
def score_biased_towards_right_wing_candidates(score_range_min, score_range_max, candidate_count, candidates):
    # Favors candidates with 'Right' or 'Far Right' political positions by giving them the highest score
    # and the lowest score to every other condidate
    scores = []
    for candidate in candidates:
        if candidate["political_position"] in ["Right", "Far Right"]:
            scores.append(score_range_max)
        else:
            scores.append(score_range_min)
    return scores


@register_strategy("biased_towards_experienced_candidates")
def score_biased_towards_experienced_candidates(score_range_min, score_range_max, candidate_count, candidates):
    # Assigns higher scores to more experienced candidates, normalized to the score range
    max_exp = max(int(candidate["experience"]) for candidate in candidates)
    scores = []
    for candidate in candidates:
        exp = int(candidate["experience"])
        # Normalize experience to range
        score = score_range_min + (exp / max_exp) * (score_range_max - score_range_min)
        scores.append(max(score_range_min, min(score_range_max, round(score))))
    return scores


@register_strategy("biased_towards_young_candidates")
def score_biased_towards_young_candidates(score_range_min, score_range_max, candidate_count, candidates):
    # Favors younger candidates by assigning higher scores to lower ages, normalized to the score range
    max_age = max(int(candidate["age"]) for candidate in candidates)
    min_age = min(int(candidate["age"]) for candidate in candidates)
    scores = []
    for candidate in candidates:
        age = int(candidate["age"])
        # Younger -> higher score (invert the age)
        if max_age == min_age:  # Handle edge case where all candidates are same age
            score = score_range_max
        else:
            score = score_range_min + ((max_age - age) / (max_age - min_age)) * (score_range_max - score_range_min)
        scores.append(max(score_range_min, min(score_range_max, round(score))))  # Ensure within bounds
    return scores


def generate_candidates(number_of_candidates: int) -> list[dict]:
    with open("candidates.csv", newline='', encoding="utf-8") as f:
        records = list(csv.DictReader(f))

    # Guard against asking for more rows than exist
    if number_of_candidates > len(records):
        raise ValueError(f"Requested {number_of_candidates} candidates from 'candidates.csv', but only {len(records)} available.")

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


def generate_voter_wallets(total_voters):
    print(f"🔧 Generating {total_voters} voter wallets...")

    wallets = []
    for i in range(total_voters):
        # Generate random private key
        private_key = secrets.token_hex(32)
        # Create account from private key
        account = Account.from_key(private_key)

        wallet_data = {
            'address': account.address,
            'privateKey': private_key,
            'account': account,
            'index': i
        }
        wallets.append(wallet_data)

    return wallets


def fund_wallets_batch(w3, admin_account, wallet_addresses, funding_amount_eth="1.0", batch_size=50):
    print(f"💰 Funding {len(wallet_addresses)} wallets with {funding_amount_eth} ETH each...")

    funding_amount_wei = w3.to_wei(funding_amount_eth, 'ether')

    for i in range(0, len(wallet_addresses), batch_size):
        batch = wallet_addresses[i:i + batch_size]

        for address in batch:
            try:
                # Get nonce for admin account
                nonce = w3.eth.get_transaction_count(admin_account)

                # Build funding transaction
                transaction = {
                    'to': address,
                    'value': funding_amount_wei,
                    'gas': 21000,
                    'gasPrice': w3.to_wei(20, 'gwei'),
                    'nonce': nonce,
                }

                # Send transaction
                tx_hash = w3.eth.send_transaction(transaction)
                w3.eth.wait_for_transaction_receipt(tx_hash)

            except Exception as e:
                print(f"   ⚠️ Failed to fund {address}: {str(e)}")

        if (i // batch_size + 1) % 10 == 0:
            print(f"   📊 Funded {min(i + batch_size, len(wallet_addresses))}/{len(wallet_addresses)} wallets")


def distribute_strategies_to_voters(district_voters, voting_strategies_config):
    strategies, weights = zip(*voting_strategies_config.items())
    strategies = list(strategies)
    weights = list(weights)

    # Normalise if weights don't sum to 1.0
    total_w = sum(weights)
    weights = [w / total_w for w in weights]

    # Initial seat counts = floor(expected seats)
    raw = [w * len(district_voters) for w in weights]
    counts = [floor(r) for r in raw]

    # Distribute the leftover seats to the largest remainders
    leftover = len(district_voters) - sum(counts)
    remainders = sorted(((raw[i] - counts[i], i) for i in range(len(strategies))), reverse=True)
    for _, idx in remainders[:leftover]:
        counts[idx] += 1

    # Build a deterministic pool of strategies
    strategy_pool = [strategy for strategy, cnt in zip(strategies, counts) for _ in range(cnt)]

    return strategy_pool


def register_district_sync(district, orchestrator_contract, voting_strategies_config, gas_tracker):
    print(f"   Registering {len(district['voters'])} voters in {district['name']}...")

    if len(district['voters']) == 0:
        print(f"   ⚠️ Skipping {district['name']} - no voters assigned")
        return {
            "success": True,
            "districtId": district["id"],
            "votersRegistered": 0,
            "skipped": True
        }

    voter_addresses = district["voters"]

    try:
        tx_hash = orchestrator_contract.functions.batchRegisterVoters(district["id"], voter_addresses).transact({
            'from': orchestrator_contract.w3.eth.default_account})
        receipt = track_gas(orchestrator_contract.w3, tx_hash, gas_tracker)
        print(f"   {district['name']} registration transaction: {receipt.transactionHash.hex()}")

        district["strategies"] = distribute_strategies_to_voters(district["voters"], voting_strategies_config)

        return {
            "success": True,
            "districtId": district["id"],
            "votersRegistered": len(voter_addresses)
        }

    except Exception as e:
        print(f"   ❌ Registration failed for {district['name']}: {str(e)}")
        return {
            "success": False,
            "districtId": district["id"],
            "error": str(e)
        }


async def register_voters_parallel(districts, orchestrator_contract, voting_strategies_config, gas_tracker):
    loop = asyncio.get_running_loop()
    with ThreadPoolExecutor() as pool:
        tasks = [
            loop.run_in_executor(pool, register_district_sync, district,
                                 orchestrator_contract, voting_strategies_config, gas_tracker)
            for district in districts
        ]
        print("⏳ Starting parallel registration...")
        results = await asyncio.gather(*tasks)
        print("✅ Parallel Registration completed.")
        return results


def check_registration_results(registration_results, orchestrator_contract, district_count):
    successful_registrations = [r for r in registration_results if r.get("success")]
    failed_registrations = [r for r in registration_results if not r.get("success")]

    print(f"   ✅ Successful registrations: {len(successful_registrations)}/{district_count}")

    if failed_registrations:
        print("   ❌ Failed registrations:")
        for r in failed_registrations:
            print(f"      District {r.get('districtId')}: {r.get('error')}")

    reg_stats = orchestrator_contract.functions.getElectionStats().call()
    total_voters_registered = reg_stats._totalVotersRegistered if hasattr(
        reg_stats, '_totalVotersRegistered') else reg_stats[1]  # fallback if tuple

    print(f"✅ {total_voters_registered} voters registered in parallel")

    expected_registrations = sum(r.get("votersRegistered", 0) for r in successful_registrations)
    assert total_voters_registered == expected_registrations, (
        f"Mismatch: Registered voters {total_voters_registered} != Expected {expected_registrations}"
    )


def cast_vote_sync(contract, voter_address, voter_private_key, scores, voter_index, district_id, gas_tracker, w3):
    """Modified to work with generated wallets and private keys"""
    try:
        # Get nonce for voter
        nonce = w3.eth.get_transaction_count(voter_address)

        # Get estimated gas for the transaction
        estimated_gas = contract.functions.castVote(scores).estimate_gas({'from': voter_address})

        # Build transaction
        transaction = contract.functions.castVote(scores).build_transaction({
            'from': voter_address,
            'nonce': nonce,
            'gas': estimated_gas + 10000,  # Add a buffer to estimated gas
            'gasPrice': w3.to_wei(20, 'gwei'),
        })

        # Sign transaction
        signed_txn = w3.eth.account.sign_transaction(transaction, voter_private_key)

        # Send transaction
        tx_hash = w3.eth.send_raw_transaction(signed_txn.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)

        # Track gas
        gas_used = receipt.gasUsed
        gas_price = receipt.effectiveGasPrice
        eth_used = w3.from_wei(gas_used * gas_price, 'ether')
        gas_tracker['gas'] += gas_used
        gas_tracker['eth'] += eth_used

        if voter_index % 5 == 0:
            print(f"     📊 District {district_id}: {voter_index + 1} votes cast")

        return {'district': district_id, 'voter': voter_index, 'success': True, 'gasUsed': receipt['gasUsed']}
    except Exception as e:
        print(f"     ⚠️ Vote failed in District {district_id}, Voter {voter_index}: {str(e)}")
        return {'district': district_id, 'voter': voter_index, 'success': False, 'error': str(e)}


async def cast_votes_for_district(district, score_range_min, score_range_max, candidates, executor, gas_tracker, w3):
    district_id = district["id"]
    voter_wallets = district["voter_wallets"]
    contract = district["contract"]
    strategies = district["strategies"]
    print(f"   🗳️ District {district_id}: Starting {len(voter_wallets)} parallel votes...")

    loop = asyncio.get_event_loop()

    vote_tasks = [
        loop.run_in_executor(
            executor,
            cast_vote_sync,
            contract,
            voter_wallets[i]['address'],
            voter_wallets[i]['privateKey'],
            generate_scores(strategies[i], score_range_min, score_range_max, candidates),
            i,
            district_id,
            gas_tracker,
            w3
        )
        for i in range(len(voter_wallets))
    ]

    results = await asyncio.gather(*vote_tasks)
    successful = sum(1 for r in results if r["success"])
    print(f"   ✅ District {district_id}: {successful}/{len(voter_wallets)} votes completed")

    return {
        "districtId": district_id,
        "districtName": district["name"],
        "totalVoters": len(voter_wallets),
        "successfulVotes": successful,
        "results": results
    }


async def run_parallel_voting(districts, score_range_min, score_range_max, candidates, gas_tracker, w3):
    executor = ThreadPoolExecutor()
    voting_tasks = [
        cast_votes_for_district(district, score_range_min, score_range_max, candidates, executor, gas_tracker, w3)
        for district in districts
    ]
    await asyncio.gather(*voting_tasks)


def calculate_voters_per_district(number_of_voters, number_of_districts):
    if number_of_districts > number_of_voters:
        raise ValueError("Number of districts must be larger or equal to the number of voters")

    if number_of_districts <= 0:
        raise ValueError("Number of districts must be positive")

    if number_of_voters < 0:
        raise ValueError("Number of voters cannot be negative")

    # Base number of voters per district
    base_voters_per_district = number_of_voters // number_of_districts

    # Number of districts that will get one extra voter
    extra_voters = number_of_voters % number_of_districts

    # Create list of voter counts per district
    voters_per_district_list = []
    for district in range(number_of_districts):
        if district < extra_voters:
            # First 'extra_voters' districts get one additional voter
            voters_per_district_list.append(base_voters_per_district + 1)
        else:
            # Remaining districts get the base amount
            voters_per_district_list.append(base_voters_per_district)

    return voters_per_district_list


async def run_election(config: InputConfiguration):
    # Connect to Hardhat local node
    w3 = Web3(Web3.HTTPProvider("http://127.0.0.1:8545"))
    assert w3.is_connected(), "❌ Failed to connect to Hardhat node."

    # Load the ABI of the ElectionOrchestrator contract
    with open("../artifacts/contracts/ElectionOrchestrator.sol/ElectionOrchestrator.json") as f:
        contract_data = json.load(f)
        abi = contract_data["abi"]
        bytecode = contract_data["bytecode"]

    w3.eth.default_account = w3.eth.accounts[0]
    admin = w3.eth.accounts[0]

    # Create contract factory
    ElectionOrchestrator = w3.eth.contract(abi=abi, bytecode=bytecode)

    gas_tracker = {"gas": 0, "eth": 0}

    # Deploy ElectionOrchestrator contract transaction
    tx_hash = ElectionOrchestrator.constructor().transact()
    receipt = track_gas(w3, tx_hash, gas_tracker)
    # Get deployed contract address
    orchestrator_contract_address = receipt["contractAddress"]
    print("Contract deployed at:", orchestrator_contract_address)

    # Creates the contract instance using the address
    orchestrator_contract = w3.eth.contract(address=orchestrator_contract_address, abi=abi)

    # Parse Configuration dictionary to variables
    number_of_districts = config.number_of_districts
    candidates = generate_candidates(config.number_of_candidates)
    number_of_voters = config.number_of_voters
    score_range_min = config.score_range_min
    score_range_max = config.score_range_max

    voters_per_district_list = calculate_voters_per_district(number_of_voters, number_of_districts)

    # Wallet Generation
    print("🔧 Wallet Generation")

    # Generate voter wallets instead of using pre-funded accounts
    voter_wallets = generate_voter_wallets(number_of_voters)
    print("✅ Wallet generation completed")

    # Extract addresses from generated wallets
    voter_addresses = [wallet['address'] for wallet in voter_wallets]

    # Fund the generated wallets
    fund_wallets_batch(w3, admin, voter_addresses, funding_amount_eth="1.0", batch_size=50)

    # Add candidates
    for candidate in candidates:
        tx = orchestrator_contract.functions.addCandidate(candidate["name"], candidate["party"]).transact({'from': admin})
        receipt = track_gas(w3, tx, gas_tracker)
    print(f"✅ Added {len(candidates)} candidates")

    # Load the DistrictVoting ABI from JSON artifact file
    with open("../artifacts/contracts/DistrictVoting.sol/DistrictVoting.json") as f:
        district_data = json.load(f)
        district_abi = district_data["abi"]

    districts = []

    # Set score range
    tx = orchestrator_contract.functions.setGradingScale(score_range_min, score_range_max).transact({'from': admin})
    receipt = track_gas(w3, tx, gas_tracker)

    # Create districts
    for district in range(number_of_districts):
        tx = orchestrator_contract.functions.createDistrict(str(district)).transact({'from': admin})
        receipt = track_gas(w3, tx, gas_tracker)

        district_address = orchestrator_contract.functions.getDistrictAddress(district).call()

        # Create contract instance at the district address
        district_contract = w3.eth.contract(address=district_address, abi=district_abi)

        # Distribute wallet data to districts
        start_index = sum(voters_per_district_list[:district])
        end_index = start_index + voters_per_district_list[district]
        district_voter_wallets = voter_wallets[start_index:end_index]
        district_voter_addresses = [wallet['address'] for wallet in district_voter_wallets]

        districts.append({
            "id": district,
            "name": str(district),
            "address": district_address,
            "contract": district_contract,
            "voters": district_voter_addresses,
            "voter_wallets": district_voter_wallets
        })

    print(f"✅ Created {number_of_districts} districts")

    district_creation_stats = orchestrator_contract.functions.getElectionStats().call()
    district_count = district_creation_stats[0]

    # Register Voters in parallel
    tx = orchestrator_contract.functions.startRegistration().transact({'from': admin})
    receipt = track_gas(w3, tx, gas_tracker)
    strategies_config = config.voting_strategies.model_dump()

    registration_results = await register_voters_parallel(districts, orchestrator_contract, strategies_config, gas_tracker)
    check_registration_results(registration_results, orchestrator_contract, district_count)

    # Start voting phase
    tx = orchestrator_contract.functions.startVoting().transact({'from': admin})
    receipt = track_gas(w3, tx, gas_tracker)
    print("✅ Voting started")

    # Cast votes
    start = time.time()
    await run_parallel_voting(districts, score_range_min, score_range_max, candidates, gas_tracker, w3)

    end = time.time()

    # End election
    tx = orchestrator_contract.functions.endVoting().transact({'from': admin})
    receipt = track_gas(w3, tx, gas_tracker)
    print("✅ Election ended")

    # Collect results
    tx = orchestrator_contract.functions.collectResults().transact({'from': admin})
    receipt = track_gas(w3, tx, gas_tracker)

    results = orchestrator_contract.functions.getElectionResults().call()

    # Fetch and display results
    names, parties, total_scores, vote_counts = results

    print("\n🏁 Election Results:")
    # Create a list of tuples combining candidate data with results
    combined = []
    for i, (name, party, total_score, votes) in enumerate(zip(names, parties, total_scores, vote_counts)):
        # Find the original candidate data
        original_candidate = None
        for candidate in candidates:
            if candidate['name'] == name and candidate['party'] == party:
                original_candidate = candidate
                break

        if original_candidate:
            combined.append((original_candidate, total_score, votes))
        else:
            # Fallback if candidate not found
            fallback_candidate = {
                "name": name,
                "party": party,
                "political_position": "Unknown",
                "age": "Unknown",
                "gender": "Unknown",
                "experience": "Unknown"
            }
            combined.append((fallback_candidate, total_score, votes))

    # Sort by total score in descending order
    combined.sort(key=lambda x: x[1], reverse=True)

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

    # Get winner information
    winner_info = orchestrator_contract.functions.getWinner().call()
    winner_id, winner_name, winner_party, winner_score = winner_info
    print(f"\n🏆 Winner: {winner_name} ({winner_party}) with {winner_score} total points")

    # Get election statistics
    stats = orchestrator_contract.functions.getElectionStats().call()
    total_districts, total_voters_registered, total_votes_cast, results_submitted, state_num, turnout = stats

    print("\n📊 Election Statistics:")
    print(f"   Total Districts: {total_districts}")
    print(f"   Voters Registered: {total_voters_registered}")
    print(f"   Votes Cast: {total_votes_cast}")
    print(f"   Results Submitted: {results_submitted}")
    print(f"   Turnout: {turnout}%")

    metrics = {
        "voting_duration_secs": round(end - start, 2),
        "total_gas_used": gas_tracker["gas"],
        "total_eth_spent": float(gas_tracker["eth"]),
        "gas_per_voter": gas_tracker["gas"] // number_of_voters if number_of_voters > 0 else 0,
        "gas_per_candidate": gas_tracker["gas"] // len(candidates) if len(candidates) > 0 else 0,
        "turnout_percentage": turnout,
        "total_districts": total_districts,
        "total_voters_registered": total_voters_registered,
        "total_votes_cast": total_votes_cast
    }

    response = {
        "election_results": formatted_results,
        "metrics": metrics,
        "winner": {
            "name": winner_name if 'winner_name' else "Unknown",
            "party": winner_party if 'winner_party' else "Unknown",
            "total_score": winner_score if 'winner_score' else 0
        }
    }

    return response
