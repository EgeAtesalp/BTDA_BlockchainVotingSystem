# BTDA_BlockchainVotingSystem
Project repository for the BDTA SS2025, Group H

Inspired by https://skemman.is/bitstream/1946/31161/1/Research-Paper-BBEVS.pdf.

#  Setup & Run Instructions

## Prerequisites

- **Python 3.10+**
- **Node.js (v18+)**
- **npm (Node Package Manager)**

---

## 1. Clone the Repository

```sh
git clone https://github.com/EgeAtesalp/BTDA_BlockchainVotingSystem.git
cd BTDA_BlockchainVotingSystem
```

---

## 2. Python Environment Setup

###  Install Python dependencies

```sh
pip install -r requirements.txt
```

---

## 3. Node.js & Hardhat Setup

### a. Install Hardhat and compile the smart contracts

```sh
npm install --save-dev hardhat
npm install
npx hardhat compile
```

### b. Start a local Hardhat node

```sh
npx hardhat node
```

---

## 4. FastAPI Backend Setup

### Run the FastAPI server

```sh
cd app
uvicorn server:app --reload
```

- The API of the app will be available at: [http://127.0.0.1:8000](http://127.0.0.1:8000).

---

## 5. Running Experiments

- Open [`index.html`](app/index.html) or [http://127.0.0.1:8000](http://127.0.0.1:8000) for the UI.
- Use the `/election` endpoint to run election simulations.

---

## To run the simulation used for the evaluation execute:


```
npx hardhat test test/scaling-experiments-par.js
```