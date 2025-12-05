# DAOSkillProof: Private Skill & Contribution Verification for DAOs

DAOSkillProof is an innovative solution designed for Decentralized Autonomous Organizations (DAOs) that leverages **Zama's Fully Homomorphic Encryption technology** to ensure privacy and security. It enables DAO members to submit off-chain skill and contribution proofs, such as code submissions and design projects, providing a quantifiable assessment without revealing sensitive details. 

## Navigating the Challenges of DAO Verification

In the world of DAOs, assessing individual contributions can be a contentious and opaque process. Traditional methods expose sensitive information, leading to privacy concerns and potential bias in the evaluation of skills. This lack of confidentiality can discourage active participation and fair assessment, hindering the growth of decentralized communities. 

## The FHE Solution: Empowering Privacy and Fairness

**Zama's Fully Homomorphic Encryption (FHE) technology** provides a robust solution to the privacy challenges faced in DAOs. By enabling the evaluation of encrypted contributions without exposing their underlying details, organizations can ensure that assessments are fair, objective, and secure. Utilizing Zama's open-source libraries, including **Concrete** and the **zama-fhe SDK**, DAOSkillProof transforms how individual contributions are measured and rewarded, paving the way for a more transparent and inclusive governance model. 

## Key Features of DAOSkillProof

- **Encrypted Metadata Assessment:** All proof materials are encrypted, ensuring privacy during the evaluation process.
- **Scoring by Review Committees:** Reviewers evaluate contributions based on encrypted data, maintaining confidentiality.
- **Cryptographic Contribution Scores:** Generates a secure, encrypted score for contributions that can be used for equitable token distribution and privilege granting.
- **Personal Contribution Dashboard:** Offers users a personalized dashboard to showcase their skills and contributions visually.
- **Badge System:** Users earn badges as they meet specific contribution milestones, promoting engagement and healthy competition.

## Technology Stack

- **Zama FHE SDK:** The core component for enabling confidential computing.
- **Node.js:** JavaScript runtime for running the server and handling requests.
- **Hardhat:** Development environment for compiling, deploying, and testing smart contracts.
- **Solidity:** The programming language for defining smart contracts.

## Directory Structure

Below is the directory structure of the DAOSkillProof project, showcasing the organization of files:

```
DAOSkillProof/
│
├── contracts/
│   └── DAOSkillProof.sol
│
├── scripts/
│   └── deploy.js
│
├── test/
│   └── DAOSkillProof.test.js
│
├── package.json
│
└── README.md
```

## Installation Guide

Before you proceed to set up DAOSkillProof, ensure you have the following dependencies installed:

- Node.js
- Hardhat

1. Navigate to the project directory in your terminal.
2. Run the following command to install dependencies:

   ```bash
   npm install
   ```

This command will fetch all required libraries, including Zama's FHE components, ensuring you have everything needed to get started.

## Building and Running DAOSkillProof

Once your environment is set up, you can build, test, and run the project using the following commands:

1. **Compile the smart contracts:**

   ```bash
   npx hardhat compile
   ```

2. **Run the tests to ensure everything works correctly:**

   ```bash
   npx hardhat test
   ```

3. **Deploy the contracts to a desired network:**

   ```bash
   npx hardhat run scripts/deploy.js --network <your-network-name>
   ```

Replace `<your-network-name>` with your target blockchain network.

## Example Usage

Below is an example code snippet that demonstrates how to submit a contribution in a secure and private manner:

```javascript
const { encryptContribution, submitToDAOSkillProof } = require('./utils');

async function main() {
    const contributionData = {
        contributionType: 'code submission',
        contributionDetails: 'My awesome code...',
    };

    // Encrypt the contribution using Zama's SDK
    const encryptedContribution = await encryptContribution(contributionData);

    // Submit the encrypted contribution to DAOSkillProof
    const submissionResult = await submitToDAOSkillProof(encryptedContribution);
    
    console.log('Contribution submitted successfully:', submissionResult);
}

main();
```

In this example, `encryptContribution` utilizes Zama's FHE SDK to encrypt the contribution details before submission, ensuring privacy throughout the process.

## Acknowledgements

**Powered by Zama:** A heartfelt thank you to the Zama team for their pioneering work in Fully Homomorphic Encryption and for providing open-source tools and libraries that enable the creation of confidential applications in the blockchain domain. Your innovation inspires us to enhance privacy and security in decentralized ecosystems.
```

This README captures the essence of the DAOSkillProof project, highlighting its purpose, how it addresses a critical issue, and the technology backing it. It is structured for ease of understanding, complete with detailed instructions and innovative examples.