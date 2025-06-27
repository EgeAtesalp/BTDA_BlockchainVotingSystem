from web3 import Web3
import json
import random

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

# Deploy contract transaction
tx_hash = ScoreVotingElection.constructor().transact()
tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash)

# Get deployed contract address
contract_address = tx_receipt["contractAddress"]
print("Contract deployed at:", contract_address)

# Now create the contract instance using the address
contract = w3.eth.contract(address=contract_address, abi=abi)

# Accounts
accounts = w3.eth.accounts

# Configuration
configuration = {
    "number_of_districts": 5,
    "candidates": [
        {"name": "Alice Progressive", "party": "Progressive"},
        {"name": "Bob Conservative", "party": "Conservative"},
        {"name": "Carol Moderate", "party": "Moderate"},
    ],
    "number_of_voters": 50,
}

number_of_districts = configuration["number_of_districts"]
candidates = configuration["candidates"]
number_of_voters = configuration["number_of_voters"]

# Configuration
print("Welcome to the Election! Please enter Election configuration details below.")
number_of_voters = int(input("Enter the number of voters:"))

candidates = []

while True:
    name = input("Enter Candidate's Name:")
    party = input("Enter Candidate's Party:")
    candidates.append({"name": name, "party": party})
    while True:
        answer = input("Would you like to add another candidate [y/n]?")
        if answer == "n" or answer == "y":
            break
    if answer == "n":
        break
number_of_districts = int(input("Enter number of Districts:"))

admin = accounts[0]
voters = accounts[1:number_of_voters+1]


# Virtual Agent class to simulate voting behavior
class VirtualAgent:
    def __init__(self, address, district_id, preferences=None, strategy="honest"):
        self.address = address
        self.district_id = district_id
        self.strategy = strategy
        self.preferences = preferences

    def generate_scores(self, candidate_count):
        # Generate default preferences if missing or mismatched
        if not self.preferences or len(self.preferences) != candidate_count:
            self.preferences = [random.randint(0, 10) for _ in range(candidate_count)]

        if self.strategy == "honest":
            return self.preferences
        elif self.strategy == "strategic":
            max_index = self.preferences.index(max(self.preferences))
            return [10 if i == max_index else max(0, s - 3) for i, s in enumerate(self.preferences)]
        elif self.strategy == "polarized":
            return [10 if s > 5 else 0 for s in self.preferences]
        elif self.strategy == "random":
            return [random.randint(0, 10) for _ in range(candidate_count)]
        return self.preferences

        # Polarized Scoring: Agents give only extreme scores (0 or 10) to maximize their preferred candidate's advantage
        # Strategic Undervoting: Agents give low scores to viable competitors while maximizing their preferred candidate's score
        # Bullet Voting: Agents give maximum score to one candidate and minimum to all others


# --- Create districts ---
for district in range(number_of_districts):
    tx = contract.functions.createDistrict(str(district)).transact({'from': admin})
    w3.eth.wait_for_transaction_receipt(tx)
print(f"✅ Created {number_of_districts} districts")

# --- Add candidates ---
for candidate in candidates:
    tx = contract.functions.addCandidate(candidate["name"], candidate["party"]).transact({'from': admin})
    w3.eth.wait_for_transaction_receipt(tx)
print(f"✅ Added {len(candidates)} candidates")

# Fetch counts from contract
candidate_count = contract.functions.candidateCount().call()
district_count = contract.functions.districtCount().call()

# --- Register voters ---
agents = []
for i, acct in enumerate(voters):
    district_id = i % district_count
    # Random preferences per candidate count
    preferences = [random.randint(0, 10) for _ in range(candidate_count)]
    strategy = "honest" if random.random() < 0.8 else "strategic"
    agent = VirtualAgent(acct, district_id, preferences, strategy)
    agents.append(agent)

    tx = contract.functions.registerVoter(agent.address, agent.district_id).transact({'from': admin})
    w3.eth.wait_for_transaction_receipt(tx)
print(f"✅ Registered {len(agents)} voters")

# --- Start voting phase ---
tx = contract.functions.startVoting().transact({'from': admin})
w3.eth.wait_for_transaction_receipt(tx)
print("✅ Voting started")

# --- Cast votes ---
for agent in agents:
    scores = agent.generate_scores(candidate_count)
    assert len(scores) == candidate_count, "Score list length mismatch"
    assert all(0 <= s <= 10 for s in scores), "Score out of valid range"

    tx = contract.functions.castVote(scores).transact({'from': agent.address})
    w3.eth.wait_for_transaction_receipt(tx)
print(f"✅ All {len(agents)} voters cast their votes")

# --- End election ---
tx = contract.functions.endElection().transact({'from': admin})
w3.eth.wait_for_transaction_receipt(tx)
print("✅ Election ended")

# --- Fetch and display results ---
results = contract.functions.getResults().call()
total_scores = results[1]
vote_counts = results[2]

# Zip candidates with their results
combined = list(zip(candidates, total_scores, vote_counts))
# Sort by total score (index 1) in descending order
combined.sort(key=lambda x: x[1], reverse=True)

print("\n🏁 Election Results:")
for cand, total, votes in combined:
    avg = total / votes if votes > 0 else 0
    print(f"- {cand['name']} ({cand['party']}):")
    print(f"  Total Score: {total}")
    print(f"  Votes: {votes}")
    print(f"  Avg Score: {avg:.2f}")
