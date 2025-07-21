import json
import matplotlib.pyplot as plt
import pandas as pd
import os

# Path to results JSON
RESULTS_PATH = os.path.join("results", "complete_scaling_analysis_par.json")

# Load JSON data
with open(RESULTS_PATH, "r") as f:
    data = json.load(f)

# Filter out empty/error entries
data = [d for d in data if "experimentType" in d]

# Convert to DataFrame
df = pd.DataFrame(data)

# Define phases and convert ms to seconds
phases = [
    ("walletGenerationTime", "Wallet Generation"),
    ("walletFundingTime", "Wallet Funding"),
    ("contractDeploymentTime", "Contract Deployment"),
    ("electionSetupTime", "Election Setup"),
    ("voterRegistrationTime", "Voter Registration"),
    ("votingTime", "Voting"),
    ("resultsCollectionTime", "Results Collection"),
]

for col, _ in phases:
    df[col + "_s"] = df[col] / 1000

def plot_phase_times(df, experiment_type):
    subset = df[df["experimentType"] == experiment_type]
    if experiment_type == "VOTER_SCALING":
        labels = [cfg.get("votersPerDistrict", str(i)) for i, cfg in enumerate(subset["config"])]
    elif experiment_type == "DISTRICT_SCALING":
        labels = [cfg.get("districts", str(i)) for i, cfg in enumerate(subset["config"])]
    x = range(len(labels))

    plt.figure(figsize=(15, 8))
    bottom = [0] * len(labels)
    for idx, (col, label) in enumerate(phases):
        plt.bar(
            x,
            subset[col + "_s"],
            bottom=bottom,
            label=label,
            edgecolor='white',
            linewidth=1.5
        )
        bottom = [b + v for b, v in zip(bottom, subset[col + "_s"])]

    plt.xticks(x, labels, rotation=30, fontsize=13, fontweight='bold')
    plt.yticks(fontsize=13)
    plt.ylabel("Time (seconds)", fontsize=15, fontweight='bold')

    # Add extra info to the title
    if experiment_type == "VOTER_SCALING":
        plt.xlabel("Voters per District", fontsize=15, fontweight='bold')
        plt.title("Time Spent Per Phase: Voter Scaling\nDistricts = 5", fontsize=18, fontweight='bold', color='#2a3a4d')
    elif experiment_type == "DISTRICT_SCALING":
        plt.xlabel("Districts", fontsize=15, fontweight='bold')
        plt.title("Time Spent Per Phase: District Scaling\nTotal Voters = 10000", fontsize=18, fontweight='bold', color='#2a3a4d')
    else:
        plt.title(f"Time Spent Per Phase: {experiment_type}", fontsize=18, fontweight='bold', color='#2a3a4d')
    # Place legend at upper left outside plot
    leg = plt.legend(fontsize=13, loc='upper left', bbox_to_anchor=(1, 1), frameon=True)
    plt.grid(axis='y', linestyle=':', alpha=0.6)
    plt.tight_layout(pad=4)


    plt.show()

plot_phase_times(df, "VOTER_SCALING")
plot_phase_times(df, "DISTRICT_SCALING")