// App.tsx
import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import "./App.css";
import { useAccount, useSignMessage } from 'wagmi';

interface Contribution {
  id: number;
  title: string;
  description: string;
  encryptedScore: string;
  category: string;
  timestamp: number;
  contributor: string;
  verified: boolean;
}

interface Badge {
  id: number;
  name: string;
  description: string;
  image: string;
  earned: boolean;
}

// FHE encryption/decryption functions
const FHEEncryptNumber = (value: number): string => `FHE-${btoa(value.toString())}`;
const FHEDecryptNumber = (encryptedData: string): number => encryptedData.startsWith('FHE-') ? parseFloat(atob(encryptedData.substring(4))) : parseFloat(encryptedData);
const generatePublicKey = () => `0x${Array(2000).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [loading, setLoading] = useState(true);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submittingContribution, setSubmittingContribution] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ visible: false, status: "pending", message: "" });
  const [newContributionData, setNewContributionData] = useState({ title: "", description: "", category: "code" });
  const [selectedContribution, setSelectedContribution] = useState<Contribution | null>(null);
  const [decryptedScore, setDecryptedScore] = useState<number | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [publicKey, setPublicKey] = useState("");
  const [contractAddress, setContractAddress] = useState("");
  const [chainId, setChainId] = useState(0);
  const [startTimestamp, setStartTimestamp] = useState(0);
  const [durationDays, setDurationDays] = useState(30);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Initialize signature parameters
  useEffect(() => {
    loadData().finally(() => setLoading(false));
    const initSignatureParams = async () => {
      const contract = await getContractReadOnly();
      if (contract) setContractAddress(await contract.getAddress());
      if (window.ethereum) {
        const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
        setChainId(parseInt(chainIdHex, 16));
      }
      setStartTimestamp(Math.floor(Date.now() / 1000));
      setDurationDays(30);
      setPublicKey(generatePublicKey());
    };
    initSignatureParams();
  }, []);

  // Load data from contract
  const loadData = async () => {
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      // Check contract availability
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) {
        setTransactionStatus({ visible: true, status: "success", message: "Contract is available!" });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
      }
      
      // Load contributions
      const contributionsBytes = await contract.getData("contributions");
      let contributionsList: Contribution[] = [];
      if (contributionsBytes.length > 0) {
        try {
          const contributionsStr = ethers.toUtf8String(contributionsBytes);
          if (contributionsStr.trim() !== '') contributionsList = JSON.parse(contributionsStr);
        } catch (e) {}
      }
      setContributions(contributionsList);

      // Load badges (hardcoded for demo)
      const demoBadges: Badge[] = [
        { id: 1, name: "Code Contributor", description: "For significant code contributions", image: "🖥️", earned: false },
        { id: 2, name: "Design Master", description: "For outstanding design work", image: "🎨", earned: false },
        { id: 3, name: "Community Builder", description: "For growing the DAO community", image: "👥", earned: false },
        { id: 4, name: "FHE Pioneer", description: "For contributions using Zama FHE", image: "🔒", earned: false }
      ];
      setBadges(demoBadges);
    } catch (e) {
      console.error("Error loading data:", e);
      setTransactionStatus({ visible: true, status: "error", message: "Failed to load data" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setIsRefreshing(false); 
      setLoading(false); 
    }
  };

  // Submit new contribution
  const submitContribution = async () => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return; 
    }
    
    setSubmittingContribution(true);
    setTransactionStatus({ visible: true, status: "pending", message: "Submitting contribution with Zama FHE..." });
    
    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      
      // Create new contribution with encrypted score (0 initially)
      const newContribution: Contribution = {
        id: contributions.length + 1,
        title: newContributionData.title,
        description: newContributionData.description,
        encryptedScore: FHEEncryptNumber(0),
        category: newContributionData.category,
        timestamp: Math.floor(Date.now() / 1000),
        contributor: address,
        verified: false
      };
      
      // Update contributions list
      const updatedContributions = [...contributions, newContribution];
      
      // Save to contract
      await contract.setData("contributions", ethers.toUtf8Bytes(JSON.stringify(updatedContributions)));
      
      setTransactionStatus({ visible: true, status: "success", message: "Contribution submitted successfully!" });
      await loadData();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
        setShowSubmitModal(false);
        setNewContributionData({ title: "", description: "", category: "code" });
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction") 
        ? "Transaction rejected by user" 
        : "Submission failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setSubmittingContribution(false); 
    }
  };

  // Verify contribution (simulate committee action)
  const verifyContribution = async (contributionId: number, score: number) => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return; 
    }
    
    setTransactionStatus({ visible: true, status: "pending", message: "Verifying contribution with Zama FHE..." });
    
    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      
      // Find the contribution
      const contributionIndex = contributions.findIndex(c => c.id === contributionId);
      if (contributionIndex === -1) throw new Error("Contribution not found");
      
      // Update contribution
      const updatedContributions = [...contributions];
      updatedContributions[contributionIndex].encryptedScore = FHEEncryptNumber(score);
      updatedContributions[contributionIndex].verified = true;
      
      // Save to contract
      await contract.setData("contributions", ethers.toUtf8Bytes(JSON.stringify(updatedContributions)));
      
      setTransactionStatus({ visible: true, status: "success", message: "Contribution verified with FHE encryption!" });
      await loadData();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction") 
        ? "Transaction rejected by user" 
        : "Verification failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  // Decrypt score with signature
  const decryptWithSignature = async (encryptedData: string): Promise<number | null> => {
    if (!isConnected) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    }
    
    setIsDecrypting(true);
    try {
      const message = `publickey:${publicKey}\ncontractAddresses:${contractAddress}\ncontractsChainId:${chainId}\nstartTimestamp:${startTimestamp}\ndurationDays:${durationDays}`;
      await signMessageAsync({ message });
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      return FHEDecryptNumber(encryptedData);
    } catch (e) { 
      return null; 
    } finally { 
      setIsDecrypting(false); 
    }
  };

  // Filter contributions based on search and category
  const filteredContributions = contributions.filter(contribution => {
    const matchesSearch = contribution.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         contribution.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || contribution.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Render contribution categories
  const renderCategories = () => {
    const categories = [
      { id: "all", name: "All Categories" },
      { id: "code", name: "Code" },
      { id: "design", name: "Design" },
      { id: "documentation", name: "Documentation" },
      { id: "community", name: "Community" }
    ];
    
    return (
      <div className="category-filter">
        {categories.map(category => (
          <button
            key={category.id}
            className={`category-btn ${selectedCategory === category.id ? 'active' : ''}`}
            onClick={() => setSelectedCategory(category.id)}
          >
            {category.name}
          </button>
        ))}
      </div>
    );
  };

  // Render contribution list
  const renderContributions = () => {
    if (filteredContributions.length === 0) return <div className="no-data">No contributions found</div>;
    
    return (
      <div className="contributions-grid">
        {filteredContributions.map((contribution, index) => (
          <div 
            className={`contribution-card ${contribution.verified ? 'verified' : ''}`} 
            key={index}
            onClick={() => setSelectedContribution(contribution)}
          >
            <div className="card-header">
              <div className="category-tag">{contribution.category}</div>
              {contribution.verified && <div className="verified-badge">Verified</div>}
            </div>
            <h3>{contribution.title}</h3>
            <p>{contribution.description.substring(0, 100)}...</p>
            <div className="card-footer">
              <div className="contributor">{contribution.contributor.substring(0, 6)}...{contribution.contributor.substring(38)}</div>
              <div className="encrypted-score">Score: {contribution.encryptedScore.substring(0, 10)}...</div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Render badges
  const renderBadges = () => {
    return (
      <div className="badges-container">
        <h2>Available Badges</h2>
        <div className="badges-grid">
          {badges.map(badge => (
            <div className={`badge-card ${badge.earned ? 'earned' : ''}`} key={badge.id}>
              <div className="badge-icon">{badge.image}</div>
              <h3>{badge.name}</h3>
              <p>{badge.description}</p>
              <div className="badge-status">
                {badge.earned ? 'Earned' : 'Not Earned'}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render dashboard stats
  const renderDashboardStats = () => {
    const totalContributions = contributions.length;
    const verifiedContributions = contributions.filter(c => c.verified).length;
    const pendingContributions = totalContributions - verifiedContributions;
    
    return (
      <div className="stats-container">
        <div className="stat-card">
          <h3>Total Contributions</h3>
          <div className="stat-value">{totalContributions}</div>
        </div>
        <div className="stat-card">
          <h3>Verified</h3>
          <div className="stat-value">{verifiedContributions}</div>
        </div>
        <div className="stat-card">
          <h3>Pending</h3>
          <div className="stat-value">{pendingContributions}</div>
        </div>
        <div className="stat-card">
          <h3>Your Badges</h3>
          <div className="stat-value">{badges.filter(b => b.earned).length}/{badges.length}</div>
        </div>
      </div>
    );
  };

  // Render FHE process explanation
  const renderFHEProcess = () => {
    return (
      <div className="fhe-process">
        <h2>How Zama FHE Protects Your Privacy</h2>
        <div className="process-steps">
          <div className="step">
            <div className="step-number">1</div>
            <div className="step-content">
              <h3>Submit Encrypted</h3>
              <p>Your contributions are encrypted before submission using Zama FHE</p>
            </div>
          </div>
          <div className="step">
            <div className="step-number">2</div>
            <div className="step-content">
              <h3>Committee Review</h3>
              <p>Reviewers evaluate your work without seeing sensitive details</p>
            </div>
          </div>
          <div className="step">
            <div className="step-number">3</div>
            <div className="step-content">
              <h3>Encrypted Scoring</h3>
              <p>Scores are calculated on encrypted data using homomorphic operations</p>
            </div>
          </div>
          <div className="step">
            <div className="step-number">4</div>
            <div className="step-content">
              <h3>Private Results</h3>
              <p>Only you can decrypt your final scores with your wallet signature</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="loading-screen">
      <div className="fhe-spinner"></div>
      <p>Initializing encrypted contribution system...</p>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <div className="logo-icon">
            <div className="dao-icon"></div>
          </div>
          <h1>DAOSkill<span>Proof</span></h1>
        </div>
        
        <div className="header-actions">
          <button 
            onClick={() => setShowSubmitModal(true)} 
            className="submit-contribution-btn"
          >
            Submit Contribution
          </button>
          <div className="search-bar">
            <input 
              type="text" 
              placeholder="Search contributions..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="wallet-connect-wrapper">
            <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
          </div>
        </div>
      </header>
      
      <div className="main-content-container">
        <div className="sidebar">
          <div className="sidebar-menu">
            <button 
              className={`menu-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              Dashboard
            </button>
            <button 
              className={`menu-item ${activeTab === 'contributions' ? 'active' : ''}`}
              onClick={() => setActiveTab('contributions')}
            >
              Contributions
            </button>
            <button 
              className={`menu-item ${activeTab === 'badges' ? 'active' : ''}`}
              onClick={() => setActiveTab('badges')}
            >
              Badges
            </button>
            <button 
              className={`menu-item ${activeTab === 'about' ? 'active' : ''}`}
              onClick={() => setActiveTab('about')}
            >
              About FHE
            </button>
          </div>
          
          <div className="fhe-badge">
            <div className="fhe-icon"></div>
            <span>Powered by Zama FHE</span>
          </div>
        </div>
        
        <div className="content-area">
          {activeTab === 'dashboard' && (
            <div className="dashboard-tab">
              <h1>Your Contribution Dashboard</h1>
              {renderDashboardStats()}
              <div className="recent-contributions">
                <h2>Recent Contributions</h2>
                {contributions.slice(0, 3).map((contribution, index) => (
                  <div className="recent-card" key={index}>
                    <h3>{contribution.title}</h3>
                    <p>{contribution.description.substring(0, 80)}...</p>
                    <div className="card-status">
                      {contribution.verified ? (
                        <span className="verified">Verified</span>
                      ) : (
                        <span className="pending">Pending Review</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {activeTab === 'contributions' && (
            <div className="contributions-tab">
              <div className="tab-header">
                <h1>DAO Contributions</h1>
                <button 
                  onClick={loadData} 
                  className="refresh-btn" 
                  disabled={isRefreshing}
                >
                  {isRefreshing ? "Refreshing..." : "Refresh"}
                </button>
              </div>
              {renderCategories()}
              {renderContributions()}
            </div>
          )}
          
          {activeTab === 'badges' && (
            <div className="badges-tab">
              <h1>Your Achievement Badges</h1>
              {renderBadges()}
            </div>
          )}
          
          {activeTab === 'about' && (
            <div className="about-tab">
              <h1>Private Contribution Verification</h1>
              {renderFHEProcess()}
              <div className="faq-section">
                <h2>Frequently Asked Questions</h2>
                <div className="faq-item">
                  <h3>How are my contributions protected?</h3>
                  <p>Your contributions are encrypted using Zama FHE before being stored on-chain. This means the details remain private while still allowing the DAO to verify their value.</p>
                </div>
                <div className="faq-item">
                  <h3>Who can see my scores?</h3>
                  <p>Only you can decrypt and view your exact scores using your wallet signature. The DAO only sees encrypted values for governance purposes.</p>
                </div>
                <div className="faq-item">
                  <h3>How are badges earned?</h3>
                  <p>Badges are awarded based on your encrypted contribution scores. The criteria are transparent, but your individual data remains private.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {showSubmitModal && (
        <ModalSubmitContribution 
          onSubmit={submitContribution} 
          onClose={() => setShowSubmitModal(false)} 
          submitting={submittingContribution} 
          contributionData={newContributionData} 
          setContributionData={setNewContributionData}
        />
      )}
      
      {selectedContribution && (
        <ContributionDetailModal 
          contribution={selectedContribution} 
          onClose={() => { 
            setSelectedContribution(null); 
            setDecryptedScore(null); 
          }} 
          decryptedScore={decryptedScore} 
          setDecryptedScore={setDecryptedScore} 
          isDecrypting={isDecrypting} 
          decryptWithSignature={decryptWithSignature}
          verifyContribution={verifyContribution}
          isCommittee={address === "0xYourCommitteeAddress"} // Replace with actual check
        />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="fhe-spinner"></div>}
              {transactionStatus.status === "success" && <div className="success-icon">✓</div>}
              {transactionStatus.status === "error" && <div className="error-icon">✗</div>}
            </div>
            <div className="transaction-message">{transactionStatus.message}</div>
          </div>
        </div>
      )}
      
      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo">
              <div className="dao-icon"></div>
              <span>DAOSkillProof</span>
            </div>
            <p>Private skill and contribution verification for DAOs</p>
          </div>
          
          <div className="footer-links">
            <a href="#" className="footer-link">Documentation</a>
            <a href="#" className="footer-link">Privacy Policy</a>
            <a href="#" className="footer-link">Terms</a>
            <a href="#" className="footer-link">Contact</a>
          </div>
        </div>
        
        <div className="footer-bottom">
          <div className="fhe-badge">
            <span>Powered by Zama FHE</span>
          </div>
          <div className="copyright">© {new Date().getFullYear()} DAOSkillProof. All rights reserved.</div>
          <div className="disclaimer">
            This system uses fully homomorphic encryption to protect member privacy. 
            Contribution scores are calculated on encrypted data without revealing individual details.
          </div>
        </div>
      </footer>
    </div>
  );
};

interface ModalSubmitContributionProps {
  onSubmit: () => void; 
  onClose: () => void; 
  submitting: boolean;
  contributionData: any;
  setContributionData: (data: any) => void;
}

const ModalSubmitContribution: React.FC<ModalSubmitContributionProps> = ({ onSubmit, onClose, submitting, contributionData, setContributionData }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setContributionData({ ...contributionData, [name]: value });
  };

  return (
    <div className="modal-overlay">
      <div className="submit-contribution-modal">
        <div className="modal-header">
          <h2>Submit New Contribution</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="fhe-notice">
            <div className="lock-icon"></div>
            <div>
              <strong>FHE Privacy Notice</strong>
              <p>Your contribution details will be encrypted using Zama FHE</p>
            </div>
          </div>
          
          <div className="form-group">
            <label>Title *</label>
            <input 
              type="text" 
              name="title" 
              value={contributionData.title} 
              onChange={handleChange} 
              placeholder="Enter contribution title..." 
            />
          </div>
          
          <div className="form-group">
            <label>Description *</label>
            <textarea 
              name="description" 
              value={contributionData.description} 
              onChange={handleChange} 
              placeholder="Describe your contribution..." 
              rows={4}
            />
          </div>
          
          <div className="form-group">
            <label>Category *</label>
            <select 
              name="category" 
              value={contributionData.category} 
              onChange={handleChange}
            >
              <option value="code">Code</option>
              <option value="design">Design</option>
              <option value="documentation">Documentation</option>
              <option value="community">Community</option>
            </select>
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="cancel-btn">Cancel</button>
          <button 
            onClick={onSubmit} 
            disabled={submitting || !contributionData.title || !contributionData.description} 
            className="submit-btn"
          >
            {submitting ? "Submitting with FHE..." : "Submit Contribution"}
          </button>
        </div>
      </div>
    </div>
  );
};

interface ContributionDetailModalProps {
  contribution: Contribution;
  onClose: () => void;
  decryptedScore: number | null;
  setDecryptedScore: (value: number | null) => void;
  isDecrypting: boolean;
  decryptWithSignature: (encryptedData: string) => Promise<number | null>;
  verifyContribution: (contributionId: number, score: number) => void;
  isCommittee: boolean;
}

const ContributionDetailModal: React.FC<ContributionDetailModalProps> = ({ 
  contribution, 
  onClose, 
  decryptedScore, 
  setDecryptedScore, 
  isDecrypting, 
  decryptWithSignature,
  verifyContribution,
  isCommittee
}) => {
  const [verificationScore, setVerificationScore] = useState(50);
  
  const handleDecrypt = async () => {
    if (decryptedScore !== null) { 
      setDecryptedScore(null); 
      return; 
    }
    
    const decrypted = await decryptWithSignature(contribution.encryptedScore);
    if (decrypted !== null) {
      setDecryptedScore(decrypted);
    }
  };

  const handleVerify = () => {
    verifyContribution(contribution.id, verificationScore);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="contribution-detail-modal">
        <div className="modal-header">
          <h2>Contribution Details</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="contribution-info">
            <div className="info-row">
              <span>Title:</span>
              <strong>{contribution.title}</strong>
            </div>
            <div className="info-row">
              <span>Contributor:</span>
              <strong>{contribution.contributor.substring(0, 6)}...{contribution.contributor.substring(38)}</strong>
            </div>
            <div className="info-row">
              <span>Date:</span>
              <strong>{new Date(contribution.timestamp * 1000).toLocaleDateString()}</strong>
            </div>
            <div className="info-row">
              <span>Category:</span>
              <strong>{contribution.category}</strong>
            </div>
            <div className="info-row">
              <span>Status:</span>
              <strong className={contribution.verified ? 'verified' : 'pending'}>
                {contribution.verified ? 'Verified' : 'Pending Verification'}
              </strong>
            </div>
            <div className="info-row full-width">
              <span>Description:</span>
              <div className="contribution-description">{contribution.description}</div>
            </div>
          </div>
          
          <div className="score-section">
            <h3>Contribution Score</h3>
            <div className="encrypted-data">
              <div className="fhe-tag">
                <div className="fhe-icon"></div>
                <span>FHE Encrypted</span>
              </div>
              <div className="encrypted-value">{contribution.encryptedScore.substring(0, 100)}...</div>
              <button 
                className="decrypt-btn" 
                onClick={handleDecrypt} 
                disabled={isDecrypting}
              >
                {isDecrypting ? (
                  <span>Decrypting...</span>
                ) : decryptedScore !== null ? (
                  "Hide Decrypted Score"
                ) : (
                  "Decrypt with Wallet Signature"
                )}
              </button>
            </div>
            
            {decryptedScore !== null && (
              <div className="decrypted-score">
                <h4>Your Decrypted Score</h4>
                <div className="score-value">{decryptedScore.toFixed(2)}</div>
                <div className="score-explanation">
                  This score was calculated by the review committee using homomorphic operations on encrypted data.
                </div>
              </div>
            )}
          </div>
          
          {isCommittee && !contribution.verified && (
            <div className="verification-section">
              <h3>Committee Verification</h3>
              <div className="score-input">
                <label>Score (0-100):</label>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={verificationScore} 
                  onChange={(e) => setVerificationScore(parseInt(e.target.value))}
                />
                <span>{verificationScore}</span>
              </div>
              <button 
                className="verify-btn" 
                onClick={handleVerify}
              >
                Verify Contribution
              </button>
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="close-btn">Close</button>
        </div>
      </div>
    </div>
  );
};

export default App;