import React, { useState } from "react";
import "./settings.css";

const SettingsComponent: React.FC = () => {
  const [accountName, setAccountName] = useState<string>("");
  const [accountKey, setAccountKey] = useState<string>("");
  const [shareName, setShareName] = useState<string>("");
  const [privateKey, setPrivateKey] = useState<string>("");

  const handleSave = () => {
    const storageData = {
      accountName,
      accountKey,
      shareName,
      privateKey,
    };
    localStorage.setItem("configuration", JSON.stringify(storageData));
  };

  return (
    <div className="container">
      <label htmlFor="accountName">Account Name:</label>
      <input
        type="text"
        id="accountName"
        value={accountName}
        onChange={(e) => setAccountName(e.target.value)}
      />
      <br />

      <label htmlFor="accountKey">Account Key:</label>
      <input
        type="text"
        id="accountKey"
        value={accountKey}
        onChange={(e) => setAccountKey(e.target.value)}
      />
      <br />

      <label htmlFor="shareName">Share Name:</label>
      <input
        type="text"
        id="shareName"
        value={shareName}
        onChange={(e) => setShareName(e.target.value)}
      />
      <br />

      <label htmlFor="privateKey">Private Key:</label>
      <input
        type="text"
        id="privateKey"
        value={privateKey}
        onChange={(e) => setPrivateKey(e.target.value)}
      />
      <br />

      <button onClick={handleSave}>Save</button>
    </div>
  );
};

export default SettingsComponent;
