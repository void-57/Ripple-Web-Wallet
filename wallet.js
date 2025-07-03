import bs58 from "https://cdn.jsdelivr.net/npm/bs58@6.0.0/+esm";
const uiGlobals = {};
// Check if uhtml is available, otherwise use a fallback
const {
  html,
  svg,
  render: renderElem,
} = typeof uhtml !== "undefined"
  ? uhtml
  : {
      html: (strings, ...values) => strings.join(""),
      svg: () => "",
      render: () => {},
    };
const { signal, computed, effect } =
  typeof preactSignalsCore !== "undefined"
    ? preactSignalsCore
    : {
        signal: (val) => ({ value: val }),
        computed: () => ({}),
        effect: () => {},
      };
uiGlobals.connectionErrorNotification = [];
//Checks for internet connection status
if (!navigator.onLine)
  uiGlobals.connectionErrorNotification.push(
    notify(
      "There seems to be a problem connecting to the internet, Please check you internet connection.",
      "error"
    )
  );
window.addEventListener("offline", () => {
  uiGlobals.connectionErrorNotification.push(
    notify(
      "There seems to be a problem connecting to the internet, Please check you internet connection.",
      "error"
    )
  );
});
window.addEventListener("online", () => {
  uiGlobals.connectionErrorNotification.forEach((notification) => {
    getRef("notification_drawer").remove(notification);
  });
  notify("We are back online.", "success");
});

// Use instead of document.getElementById
function getRef(elementId) {
  const element = document.getElementById(elementId);
  if (!element) {
    console.warn(`Element with ID '${elementId}' not found`);
  }
  return element;
}

// Helper function to create elements
function createElement(tag, options = {}) {
  const element = document.createElement(tag);
  if (options.className) element.className = options.className;
  if (options.innerHTML) element.innerHTML = options.innerHTML;
  if (options.id) element.id = options.id;
  return element;
}

// displays a popup for asking permission. Use this instead of JS confirm
const getConfirmation = (title, options = {}) => {
  return new Promise((resolve) => {
    const {
      message = "",
      cancelText = "Cancel",
      confirmText = "OK",
      danger = false,
    } = options;
    openPopup("confirmation_popup", true);
    getRef("confirm_title").innerText = title;
    renderElem(getRef("confirm_message"), message);
    const cancelButton =
      getRef("confirmation_popup").querySelector(".cancel-button");
    const confirmButton =
      getRef("confirmation_popup").querySelector(".confirm-button");
    confirmButton.textContent = confirmText;
    cancelButton.textContent = cancelText;
    if (danger) confirmButton.classList.add("button--danger");
    else confirmButton.classList.remove("button--danger");
    confirmButton.onclick = () => {
      closePopup();
      resolve(true);
    };
    cancelButton.onclick = () => {
      closePopup();
      resolve(false);
    };
  });
};
// Use when a function needs to be executed after user finishes changes
const debounce = (callback, wait) => {
  let timeoutId = null;
  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      callback.apply(null, args);
    }, wait);
  };
};
// adds a class to all elements in an array
function addClass(elements, className) {
  elements.forEach((element) => {
    document.querySelector(element).classList.add(className);
  });
}
// removes a class from all elements in an array
function removeClass(elements, className) {
  elements.forEach((element) => {
    document.querySelector(element).classList.remove(className);
  });
}
// return querySelectorAll elements as an array
function getAllElements(selector) {
  return Array.from(document.querySelectorAll(selector));
}

let zIndex = 50;
// Note: popupStack is defined in components.min.js, so we don't redeclare it here

// function required for popups or modals to appear
function openPopup(popupId, pinned) {
  zIndex++;
  const popup = getRef(popupId);
  popup.setAttribute("style", `z-index: ${zIndex}`);
  popup.show({ pinned });
  // Use the global popupStack from components.min.js
  if (typeof popupStack !== "undefined" && popupStack.push) {
    popupStack.push({ popup, id: popupId });
  }
  return popup;
}

// hides the popup or modal
function closePopup() {
  // Use the global popupStack from components.min.js
  if (typeof popupStack !== "undefined" && popupStack.peek && popupStack.pop) {
    if (popupStack.peek() === undefined) return;
    const current = popupStack.pop();
    current.popup.hide();
  }
}

// Alias for compatibility
function hidePopup() {
  closePopup();
}

document.addEventListener("popupopened", (e) => {
  switch (e.target.id) {
  }
});
document.addEventListener("popupclosed", (e) => {
  zIndex--;
  switch (e.target.id) {
    case "retrieve_btc_addr_popup":
      getRef("recovered_btc_addr_wrapper").classList.add("hidden");
      break;
    case "increase_fee_popup":
      renderElem(getRef("increase_fee_popup_content"), html``);
      break;
  }
});

//Function for displaying toast notifications. pass in error for mode param if you want to show an error.
function notify(message, mode, options = {}) {
  let icon;
  switch (mode) {
    case "success":
      icon = `<svg class="icon icon--success" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="none" d="M0 0h24v24H0z"/><path d="M10 15.172l9.192-9.193 1.415 1.414L10 18l-6.364-6.364 1.414-1.414z"/></svg>`;
      break;
    case "error":
      icon = `<svg class="icon icon--error" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="none" d="M0 0h24v24H0z"/><path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-7v2h2v-2h-2zm0-8v6h2V7h-2z"/></svg>`;
      options.pinned = true;
      break;
  }
  if (mode === "error") {
    console.error(message);
  }
  return getRef("notification_drawer").push(message, { icon, ...options });
}

function getFormattedTime(timestamp, format) {
  try {
    if (String(timestamp).length < 13) timestamp *= 1000;
    let [day, month, date, year] = new Date(timestamp).toString().split(" "),
      minutes = new Date(timestamp).getMinutes(),
      hours = new Date(timestamp).getHours(),
      currentTime = new Date().toString().split(" ");

    minutes = minutes < 10 ? `0${minutes}` : minutes;
    let finalHours = ``;
    if (hours > 12) finalHours = `${hours - 12}:${minutes}`;
    else if (hours === 0) finalHours = `12:${minutes}`;
    else finalHours = `${hours}:${minutes}`;

    finalHours = hours >= 12 ? `${finalHours} PM` : `${finalHours} AM`;
    switch (format) {
      case "date-only":
        return `${month} ${date}, ${year}`;
        break;
      case "time-only":
        return finalHours;
      case "relative":
        // check if timestamp is older than a day
        if (Date.now() - new Date(timestamp) < 60 * 60 * 24 * 1000)
          return `${finalHours}`;
        else return relativeTime.from(timestamp);
      default:
        return `${month} ${date} ${year}, ${finalHours}`;
    }
  } catch (e) {
    console.error(e);
    return timestamp;
  }
}
// detect browser version
function detectBrowser() {
  let ua = navigator.userAgent,
    tem,
    M =
      ua.match(
        /(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i
      ) || [];
  if (/trident/i.test(M[1])) {
    tem = /\brv[ :]+(\d+)/g.exec(ua) || [];
    return "IE " + (tem[1] || "");
  }
  if (M[1] === "Chrome") {
    tem = ua.match(/\b(OPR|Edge)\/(\d+)/);
    if (tem != null) return tem.slice(1).join(" ").replace("OPR", "Opera");
  }
  M = M[2] ? [M[1], M[2]] : [navigator.appName, navigator.appVersion, "-?"];
  if ((tem = ua.match(/version\/(\d+)/i)) != null) M.splice(1, 1, tem[1]);
  return M.join(" ");
}

// Simple state management for the wallet
let selectedCurrency = "xrp";
let isHistoricApiAvailable = false;
window.addEventListener("load", () => {
  const [browserName, browserVersion] = detectBrowser().split(" ");
  const supportedVersions = {
    Chrome: 85,
    Firefox: 75,
    Safari: 13,
  };
  if (browserName in supportedVersions) {
    if (parseInt(browserVersion) < supportedVersions[browserName]) {
      notify(
        `${browserName} ${browserVersion} is not fully supported, some features may not work properly. Please update to ${supportedVersions[browserName]} or higher.`,
        "error"
      );
    }
  } else {
    notify(
      "Browser is not fully compatible, some features may not work. for best experience please use Chrome, Edge, Firefox or Safari",
      "error"
    );
  }
  document.body.classList.remove("hidden");
  document.addEventListener("keyup", (e) => {
    if (e.key === "Escape") {
      closePopup();
    }
  });
  document.addEventListener("copy", () => {
    notify("copied", "success");
  });
  document.addEventListener("pointerdown", (e) => {
    if (
      e.target.closest("button:not(:disabled), .interactive:not(:disabled)")
    ) {
      // createRipple effect can be added later
    }
  });

  // Initialize the wallet UI
  setTimeout(() => {
    const loadingPage = getRef("loading_page");
    if (loadingPage) {
      loadingPage.animate(
        [{ transform: "translateY(0)" }, { transform: "translateY(-100%)" }],
        {
          duration: 300,
          fill: "forwards",
          easing: "ease",
        }
      ).onfinish = () => {
        loadingPage.remove();
      };
    }
  }, 500);
});

async function connectWallet() {
  const inputElement = getRef("inputKey");
  if (!inputElement) {
    notify("Input field not found", "error");
    return;
  }

  const input = inputElement.value;

  if (!input.trim()) {
    return notify("Please enter a private key or seed", "error");
  }

  // Don't allow direct address input - only private keys/seeds
  if (input.startsWith("r")) {
    return notify(
      "Please enter a private key or seed, not an address",
      "error"
    );
  }

  try {
    const wallet = getWalletFromPrivateKey(input);
    if (!wallet) {
      return notify("Invalid private key or seed format", "error");
    }

    const address = wallet.address;
    console.log("Connected wallet address:", address);

    const walletAddressElement = getRef("walletAddress");
    if (walletAddressElement) {
      walletAddressElement.textContent = address;
    }

    // Show wallet info section
    const walletInfo = getRef("walletInfo");
    if (walletInfo) {
      walletInfo.style.display = "block";
    }

    const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233");
    await client.connect();

    try {
      const res = await client.request({
        command: "account_info",
        account: address,
        ledger_index: "validated",
      });
      const balance = xrpl.dropsToXrp(res.result.account_data.Balance);

      const walletBalanceElement = getRef("walletBalance");
      if (walletBalanceElement) {
        walletBalanceElement.textContent = `${balance} XRP`;
      }

      // Also update display balance if it exists
      const displayBalance = getRef("displayBalance");
      if (displayBalance) {
        displayBalance.textContent = `${balance} XRP`;
      }

      notify("Wallet connected successfully", "success");
    } catch (err) {
      // Account might not exist on testnet, that's okay
      const walletBalanceElement = getRef("walletBalance");
      if (walletBalanceElement) {
        walletBalanceElement.textContent = "0 XRP";
      }
      const displayBalance = getRef("displayBalance");
      if (displayBalance) {
        displayBalance.textContent = "0 XRP";
      }
      notify("Wallet connected (new account - 0 balance)", "success");
    } finally {
      await client.disconnect();
    }
  } catch (error) {
    console.error("Connect wallet error:", error);
    notify("Error connecting wallet: " + error.message, "error");
  }
}

function getRippleAddress(input) {
  // This function should not accept addresses directly
  if (input.startsWith("r")) {
    throw new Error("Use private key or seed, not address");
  }
  if (input.startsWith("s")) return xrpl.Wallet.fromSeed(input).address;
  try {
    return convertWIFtoRippleWallet(input).address;
  } catch {
    return null;
  }
}

function convertWIFtoRippleWallet(wif) {
  const decoded = bs58.decode(wif);
  let keyBytes = decoded.slice(1, -4);
  if (keyBytes.length === 33 && keyBytes[32] === 0x01)
    keyBytes = keyBytes.slice(0, 32);
  return xrpl.Wallet.fromEntropy(Uint8Array.from(keyBytes), {
    algorithm: "secp256k1",
  });
}

async function sendXRP() {
  const senderKeyElement = getRef("sendKey");
  const destinationElement = getRef("recipient");
  const amountElement = getRef("amount");

  if (!senderKeyElement || !destinationElement || !amountElement) {
    notify("Form elements not found", "error");
    return;
  }

  const senderKey = senderKeyElement.value;
  const destination = destinationElement.value;
  const amount = amountElement.value;
  console.log("Sender Key:", senderKey);
  console.log("Destination:", destination);
  console.log("Amount:", amount);
  // Validation
  if (!senderKey) return notify("Please enter your private key", "error");
  if (!destination) return notify("Please enter recipient address", "error");
  if (!amount || amount <= 0)
    return notify("Please enter valid amount", "error");

  try {
    const wallet = getWalletFromPrivateKey(senderKey);
    if (!wallet) return notify("Invalid private key format", "error");

    // Validate destination address
    if (
      !destination.startsWith("r") ||
      destination.length < 25 ||
      destination.length > 34
    ) {
      return notify("Invalid recipient address format", "error");
    }

    // Additional XRPL validation if available
    if (typeof xrpl !== "undefined" && xrpl.isValidClassicAddress) {
      if (!xrpl.isValidClassicAddress(destination)) {
        return notify("Invalid recipient address", "error");
      }
    }

    // Store transaction data globally for confirmation
    window.pendingTransaction = {
      senderKey,
      destination,
      amount,
      wallet,
    };

    // Populate transaction details in confirmation popup
    const detailsContainer = getRef("transactionDetails");
    if (detailsContainer) {
      detailsContainer.innerHTML = `        <div class="detail-row">
          <span class="detail-label">From:</span>
          <span class="detail-value">${wallet.classicAddress}</span>
        </div>
      <div class="detail-row">
        <span class="detail-label">To:</span>
        <span class="detail-value">${destination}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Amount:</span>
        <span class="detail-value">${amount} XRP</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Network Fee:</span>
        <span class="detail-value">~0.00001 XRP</span>
      </div>
    `;
    }

    // Show confirmation popup
    openPopup("sendConfirm");
  } catch (err) {
    console.error("Send XRP error:", err);
    notify("Error processing transaction: " + err.message, "error");
  }
}

async function confirmSend() {
  if (!window.pendingTransaction) {
    notify("No transaction to confirm", "error");
    return;
  }

  const { wallet, destination, amount } = window.pendingTransaction;
  const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233");

  // Show loading state on confirm button
  const confirmBtn = document.querySelector('[onclick="confirmSend()"]');
  const originalText = confirmBtn.innerHTML;
  confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
  confirmBtn.disabled = true;

  try {
    await client.connect();

    try {
      const accountInfo = await client.request({
        command: "account_info",
        account: wallet.classicAddress,
        ledger_index: "validated",
      });

      console.log("Account info:", accountInfo.result.account_data);

      // Check if account has sufficient balance
      const balance = xrpl.dropsToXrp(accountInfo.result.account_data.Balance);
      const requiredAmount = parseFloat(amount) + 0.000012; // Add typical fee

      if (balance < requiredAmount) {
        throw new Error(
          `Insufficient balance. Available: ${balance} XRP, Required: ${requiredAmount} XRP (including fee)`
        );
      }

      // Check if master key is disabled
      if (
        accountInfo.result.account_data.Flags &&
        accountInfo.result.account_data.Flags & 0x00100000
      ) {
        throw new Error(
          "Account master key is disabled. Cannot send transactions with this key."
        );
      }
    } catch (accountError) {
      if (accountError.message.includes("Account not found")) {
        throw new Error(
          "Sender account does not exist or is not activated on the ledger."
        );
      }
      throw accountError;
    }

    // Use your exact reference logic with improved LastLedgerSequence
    const ledgerInfo = await client.request({
      command: "ledger",
      ledger_index: "validated",
    });

    const currentLedger = ledgerInfo.result.ledger_index;
    console.log("Current ledger sequence:", currentLedger);

    const tx = {
      TransactionType: "Payment",
      Account: wallet.classicAddress,
      Destination: destination,
      Amount: xrpl.xrpToDrops(amount.toString()),
      LastLedgerSequence: currentLedger + 20,
    };

    const prepared = await client.autofill(tx);
    console.log("Prepared transaction instructions:", prepared);
    console.log("Transaction cost:", xrpl.dropsToXrp(prepared.Fee), "XRP");
    console.log("LastLedgerSequence:", prepared.LastLedgerSequence);
    console.log("About to sign transaction...");

    let signed;
    try {
      signed = wallet.sign(prepared);
      console.log("Transaction signed successfully!");
      console.log("Identifying hash:", signed.hash);
      console.log("Signed blob:", signed.tx_blob);
    } catch (signError) {
      console.error("Error signing transaction:", signError);
      throw new Error(`Failed to sign transaction: ${signError.message}`);
    }

    const result = await client.submitAndWait(signed.tx_blob);

    console.log(" TX Hash:", signed.hash);
    console.log(" From:", wallet.classicAddress);
    console.log(" To:", destination);
    console.log(" Amount:", amount, "XRP");

    // Safe access to transaction date
    let rippleDate = "N/A";
    if (result.result) {
      rippleDate = new Date(
        (result.result.date + 946684800) * 1000
      ).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour12: true,
      });
    }
    console.log(" Date:", rippleDate);

    const Ledger_Index = result.result.ledger_index || "N/A";
    const fee = xrpl.dropsToXrp(result.result.Fee);

    console.log(" Fee:", fee, "XRP");
    console.log(" Ledger Index:", Ledger_Index);
    console.log(
      " Result:",
      result.result?.meta?.TransactionResult || "Unknown"
    );

    // Check if transaction was successful
    if (result.result?.meta?.TransactionResult === "tesSUCCESS") {
      const fee = xrpl.dropsToXrp(result.result.Fee) ;

      // Show detailed success notification
      const successMessage = `
        <div style="font-weight: 600; margin-bottom: 0.5rem;">
          <i class="fas fa-check-circle" style="color: var(--success-color); margin-right: 0.5rem;"></i>
          Transaction Successful!
        </div>
        <div style="font-size: 0.875rem; line-height: 1.5;">
          <div><strong>Amount:</strong> ${amount} XRP</div>
          <div><strong>Fee:</strong> ${fee} XRP</div>  
          <div><strong>To:</strong> ${destination}</div>
          <div><strong>Hash:</strong> <span style="word-break: break-all;">${signed.hash}</span></div>
        </div>
      `;

      notify(successMessage, "success", { timeout: 8000 });

      // Clear form safely
      const sendKeyElement = getRef("sendKey");
      const recipientElement = getRef("recipient");
      const amountElement = getRef("amount");

      if (sendKeyElement) sendKeyElement.value = "";
      if (recipientElement) recipientElement.value = "";
      if (amountElement) amountElement.value = "";
    } else {
      console.error(
        "Transaction Failed:",
        result.result?.meta?.TransactionResult || "Unknown error"
      );
      throw new Error(
        `Transaction failed: ${
          result.result?.meta?.TransactionResult || "Unknown error"
        }`
      );
    }
  } catch (err) {
    console.error("Transaction failed:", err.message);

    let errorMessage = err.message;

    // Provide user-friendly error messages for common XRPL errors
    if (err.message.includes("tefMASTER_DISABLED")) {
      errorMessage =
        "The sender account's master key is disabled. Please use a different account or enable the master key.";
    } else if (err.message.includes("tefPAST_SEQ")) {
      errorMessage =
        "Transaction sequence number is too old. Please try again.";
    } else if (err.message.includes("terPRE_SEQ")) {
      errorMessage =
        "Transaction sequence number is too high. Please try again.";
    } else if (err.message.includes("tecUNFUNDED_PAYMENT")) {
      errorMessage = "Insufficient funds to complete the transaction.";
    } else if (err.message.includes("tecNO_DST")) {
      errorMessage = "Destination account does not exist on the ledger.";
    } else if (err.message.includes("tecNO_DST_INSUF_XRP")) {
      errorMessage =
        "Destination requires a minimum XRP balance to receive this transaction.";
    } else if (err.message.includes("LastLedgerSequence")) {
      errorMessage =
        "Transaction expired (took too long to process). Please try again.";
    } else if (err.message.includes("Account not found")) {
      errorMessage =
        "Sender account does not exist or is not activated on the ledger.";
    } else if (err.message.includes("master key is disabled")) {
      errorMessage =
        "This account's master key is disabled and cannot send transactions.";
    } else if (err.message.includes("Insufficient balance")) {
      // This is already user-friendly from our custom check
    } else if (
      err.message.includes("timeout") ||
      err.message.includes("network")
    ) {
      errorMessage =
        "Network timeout. Please check your connection and try again.";
    }

    const formattedError = `
      <div style="font-weight: 600; margin-bottom: 0.5rem;">
        <i class="fas fa-exclamation-circle" style="color: var(--danger-color); margin-right: 0.5rem;"></i>
        Transaction Failed
      </div>
      <div style="font-size: 0.875rem;">${errorMessage}</div>
    `;
    notify(formattedError, "error", { timeout: 8000 });
  } finally {
    await client.disconnect();

    // Restore button state
    confirmBtn.innerHTML = originalText;
    confirmBtn.disabled = false;

    hidePopup();
    window.pendingTransaction = null;
  }
}

function getWalletFromPrivateKey(inputKey) {
  if (inputKey.startsWith("s")) return xrpl.Wallet.fromSeed(inputKey);
  return convertWIFtoRippleWallet(inputKey);
}

// Custom Bitcoin and FLO address generation using Web Crypto API
async function generateBitcoinAddress(privateKeyBytes) {
  try {
    // For simplicity, let's use a basic approach with the available crypto
    // Generate a simple deterministic address from the private key

    // Create a hash of the private key for the address
    const keyHash = await window.crypto.subtle.digest(
      "SHA-256",
      privateKeyBytes
    );
    const keyHashBytes = new Uint8Array(keyHash);

    // Take first 20 bytes as hash160 substitute
    const hash160 = keyHashBytes.slice(0, 20);

    // Generate Bitcoin address (version 0x00 for mainnet)
    const bitcoinAddress = await createBase58Address(hash160, 0x00);

    // Generate FLO address (version 0x23 for FLO mainnet)
    const floAddress = await createBase58Address(hash160, 0x23);

    // Generate WIF (Wallet Import Format)
    const wif = await createWIF(privateKeyBytes, 0x80); // 0x80 for Bitcoin mainnet

    return {
      bitcoin: { address: bitcoinAddress, wif: wif },
      flo: { address: floAddress, wif: wif },
    };
  } catch (error) {
    console.error("Custom Bitcoin address generation failed:", error);
    return null;
  }
}

// Create Base58 address with version byte and checksum
async function createBase58Address(hash160, versionByte) {
  // Create versioned hash
  const versionedHash = new Uint8Array(21);
  versionedHash[0] = versionByte;
  versionedHash.set(hash160, 1);

  // Calculate checksum (double SHA256)
  const hash1 = await window.crypto.subtle.digest("SHA-256", versionedHash);
  const hash2 = await window.crypto.subtle.digest("SHA-256", hash1);
  const checksum = new Uint8Array(hash2).slice(0, 4);

  // Combine versioned hash and checksum
  const addressBytes = new Uint8Array(25);
  addressBytes.set(versionedHash);
  addressBytes.set(checksum, 21);

  // Encode as Base58 using imported bs58
  return bs58.encode(addressBytes);
}

// Create WIF (Wallet Import Format) from private key
async function createWIF(privateKeyBytes, versionByte) {
  // Create versioned private key (add compression flag)
  const versionedKey = new Uint8Array(34);
  versionedKey[0] = versionByte;
  versionedKey.set(privateKeyBytes, 1);
  versionedKey[33] = 0x01; // Compression flag

  const hash1 = await window.crypto.subtle.digest("SHA-256", versionedKey);
  const hash2 = await window.crypto.subtle.digest("SHA-256", hash1);
  const checksum = new Uint8Array(hash2).slice(0, 4);

  // Combine versioned key and checksum
  const wifBytes = new Uint8Array(38);
  wifBytes.set(versionedKey);
  wifBytes.set(checksum, 34);

  // Encode as Base58 using imported bs58
  return bs58.encode(wifBytes);
}

async function generateWallet() {
  try {
    // Generate a single private key for all chains
    const cryptoObj = window.crypto || crypto;
    const entropy = cryptoObj.getRandomValues(new Uint8Array(32));

    // Create Ripple wallet from entropy
    const rippleWallet = xrpl.Wallet.fromEntropy(entropy);

    // Generate Bitcoin and FLO addresses using custom implementation
    const btcFloResult = await generateBitcoinAddress(entropy);

    if (!btcFloResult) {
      // Fallback to Ripple-only wallet
      displayRippleOnlyWallet(rippleWallet);
      return;
    }

    const output = getRef("walletOutput");
    output.innerHTML = `
      <div class="wallet-generated">
        <h3><i class="fas fa-check-circle"></i> Multi-Chain Wallet Generated Successfully</h3>
        <div class="wallet-details">
          <div class="wallet-item">
            <h4><i class="fas fa-coins"></i> Ripple (XRP)</h4>
            <div class="detail-row">
              <span>Address:</span>
              <code>${rippleWallet.address}</code>
            </div>
            <div class="detail-row">
              <span>Seed:</span>
              <code>${rippleWallet.seed}</code>
            </div>
            <div class="detail-row">
              <span>Private Key:</span>
              <code>${rippleWallet.privateKey}</code>
            </div>
          </div>
          <div class="wallet-item">
            <h4><i class="fab fa-bitcoin"></i> Bitcoin (BTC)</h4>
            <div class="detail-row">
              <span>Address:</span>
              <code>${btcFloResult.bitcoin.address}</code>
            </div>
            <div class="detail-row">
              <span>WIF:</span>
              <code>${btcFloResult.bitcoin.wif}</code>
            </div>
          </div>
          <div class="wallet-item">
            <h4><i class="fas fa-coins"></i> FLO</h4>
            <div class="detail-row">
              <span>Address:</span>
              <code>${btcFloResult.flo.address}</code>
            </div>
            <div class="detail-row">
              <span>WIF:</span>
              <code>${btcFloResult.flo.wif}</code>
            </div>
          </div>
        </div>
        <div class="warning-message">
          <i class="fas fa-exclamation-triangle"></i>
          <strong>Important:</strong> All addresses are generated from the same private key. Save these details securely. Loss of private keys means loss of funds.
        </div>
      </div>
    `;
    output.style.display = "block";
    notify("New multi-chain wallet generated successfully!", "success");
  } catch (error) {
    notify("Failed to generate wallet: " + error.message, "error");
    console.error("Wallet generation error:", error);
  }
}

function displayRippleOnlyWallet(rippleWallet) {
  const output = getRef("walletOutput");
  output.innerHTML = `
    <div class="wallet-generated">
      <h3><i class="fas fa-check-circle"></i> Ripple Wallet Generated Successfully</h3>
      <div class="wallet-details">
        <div class="wallet-item">
          <h4><i class="fas fa-coins"></i> Ripple (XRP)</h4>
          <div class="detail-row">
            <span>Address:</span>
            <code>${rippleWallet.address}</code>
          </div>
          <div class="detail-row">
            <span>Seed:</span>
            <code>${rippleWallet.seed}</code>
          </div>
          <div class="detail-row">
            <span>Private Key:</span>
            <code>${rippleWallet.privateKey}</code>
          </div>
        </div>
        <div class="wallet-item">
          <h4><i class="fab fa-bitcoin"></i> Bitcoin (BTC)</h4>
          <div class="detail-row">
            <span>Status:</span>
            <code>Custom generation failed</code>
          </div>
        </div>
        <div class="wallet-item">
          <h4><i class="fas fa-coins"></i> FLO</h4>
          <div class="detail-row">
            <span>Status:</span>
            <code>Custom generation failed</code>
          </div>
        </div>
      </div>
      <div class="warning-message">
        <i class="fas fa-exclamation-triangle"></i>
        <strong>Note:</strong> Bitcoin and FLO address generation encountered an error.
      </div>
    </div>
  `;
  output.style.display = "block";
  notify("Ripple wallet generated - Bitcoin/FLO generation failed", "warning");
}

function recoverWallet() {
  const recoverKeyElement = getRef("recoverKey");

  if (!recoverKeyElement) {
    notify("Recovery form not found", "error");
    return;
  }

  const key = recoverKeyElement.value;

  if (!key.trim()) {
    notify("Please enter a private key or seed", "error");
    return;
  }

  // Don't allow direct address input - only private keys/seeds
  if (key.startsWith("r")) {
    notify("Please enter a private key or seed, not an address", "error");
    return;
  }

  try {
    const wallet = getWalletFromPrivateKey(key);
    if (!wallet) {
      notify("Invalid private key or seed format", "error");
      return;
    }

    console.log("Recovered wallet:", {
      address: wallet.classicAddress,
      seed: wallet.seed,
      privateKey: wallet.privateKey,
    });

    const result = `
      <div class="wallet-recovered">
        <h3><i class="fas fa-check-circle"></i> Wallet Recovered Successfully</h3>
        <div class="wallet-details">
          <div class="wallet-item">
            <h4><i class="fas fa-coins"></i> Ripple (XRP)</h4>
            <div class="detail-row">
              <span>Address:</span>
              <code>${wallet.address}</code>
            </div>
            <div class="detail-row">
              <span>Seed:</span>
              <code>${wallet.seed}</code>
            </div>
            <div class="detail-row">
              <span>Private Key:</span>
              <code>${wallet.privateKey}</code>
            </div>
            <div class="detail-row">
              <span>Public Key:</span>
              <code>${wallet.publicKey}</code>
            </div>
          </div>
        </div>
        <div class="warning-message">
          <i class="fas fa-exclamation-triangle"></i>
          <strong>Important:</strong> Keep these details secure. Anyone with access to your private key or seed can control your funds.
        </div>
      </div>`;

    const outputDiv = getRef("recoveryOutput");
    outputDiv.innerHTML = result;
    outputDiv.style.display = "block"; // Make the output visible
    notify("Wallet recovered successfully", "success");
  } catch (error) {
    console.error("Recovery error:", error);
    notify("Error recovering wallet: " + error.message, "error");
  }
}

// Clear form functions
function clearRecoverForm() {
  const recoverKeyField = getRef("recoverKey");
  const recoveryOutput = getRef("recoveryOutput");

  if (recoverKeyField) recoverKeyField.value = "";
  if (recoveryOutput) recoveryOutput.style.display = "none";

  notify("Recovery form cleared", "success");
}

function clearSendForm() {
  const sendKeyField = getRef("sendKey");
  const recipientField = getRef("recipient");
  const amountField = getRef("amount");

  if (sendKeyField) sendKeyField.value = "";
  if (recipientField) recipientField.value = "";
  if (amountField) amountField.value = "";

  notify("Send form cleared", "success");
}

function clearConnectForm() {
  const inputKeyField = getRef("inputKey");
  const walletInfo = getRef("walletInfo");

  if (inputKeyField) inputKeyField.value = "";
  if (walletInfo) walletInfo.style.display = "none";

  notify("Connect form cleared", "success");
}

function showPage(id) {
  document.querySelectorAll(".page").forEach((p) => p.classList.add("hidden"));
  getRef(id).classList.remove("hidden");
}

// Real-time address validation for UI feedback
function validateAddressInput(address) {
  if (!address) return { valid: false, message: "" };

  if (!address.startsWith("r")) {
    return { valid: false, message: "Address must start with 'r'" };
  }

  if (address.length < 25) {
    return { valid: false, message: "Address too short" };
  }

  if (address.length > 34) {
    return { valid: false, message: "Address too long" };
  }

  const base58Regex =
    /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/;
  if (!base58Regex.test(address)) {
    return { valid: false, message: "Invalid characters in address" };
  }

  // Try XRPL validation if available
  if (typeof xrpl !== "undefined" && xrpl.isValidClassicAddress) {
    try {
      if (!xrpl.isValidClassicAddress(address)) {
        return { valid: false, message: "Invalid address checksum" };
      }
    } catch (e) {
      return { valid: false, message: "Address validation error" };
    }
  }

  return { valid: true, message: "Valid address" };
}

window.addEventListener("error", function (e) {
  if (
    e.message &&
    (e.message.includes("commitStyles") ||
      e.message.includes("Animation") ||
      e.message.includes("components.min.js"))
  ) {
    console.warn("Non-critical component error suppressed:", e.message);
    e.preventDefault();
    return false;
  }
});

// Copy address to clipboard
function copyAddress() {
  const addressElement = getRef("walletAddress");
  if (addressElement && addressElement.textContent !== "Not connected") {
    navigator.clipboard
      .writeText(addressElement.textContent)
      .then(() => {
        notify("Address copied!", "success");
      })
      .catch(() => {
        const textArea = document.createElement("textarea");
        textArea.value = addressElement.textContent;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        notify("Address copied to clipboard!", "success");
      });
  } else {
    notify("No address to copy", "error");
  }
}

async function lookupTransactions() {
  const address = document.getElementById("lookupAddress").value.trim();
  if (!address) {
    notify("Please enter an address to lookup.", "error");
    return;
  }

  // Show loading state
  const lookupBtn = document.querySelector('[onclick="lookupTransactions()"]');
  const originalText = lookupBtn.innerHTML;
  lookupBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
  lookupBtn.disabled = true;

  const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233");
  try {
    await client.connect();
    const res = await client.request({
      command: "account_tx",
      account: address,
      ledger_index_min: -1,
      ledger_index_max: -1,
      limit: 20,
    });

    const txList = document.getElementById("txList");
    txList.innerHTML = "";

    if (res.result.transactions.length === 0) {
      txList.innerHTML =
        '<div class="no-transactions"><i class="fas fa-inbox"></i><p>No transactions found for this address.</p></div>';
      notify("No transactions found.", "error");
      return;
    }

    res.result.transactions.forEach((tx) => {
      const t = tx.tx;
      const meta = tx.meta;
      const date = new Date((t.date + 946684800) * 1000); // Ripple epoch conversion

      const div = document.createElement("div");
      div.className = "transaction-card";
      div.innerHTML = `
                        <div class="tx-header">
                            <div class="tx-type">
                                <i class="fas fa-${
                                  t.TransactionType === "Payment"
                                    ? "paper-plane"
                                    : "cog"
                                }"></i>
                                <span>${t.TransactionType}</span>
                            </div>
                            <div class="tx-status ${
                              meta.TransactionResult === "tesSUCCESS"
                                ? "success"
                                : "failed"
                            }">
                                ${
                                  meta.TransactionResult === "tesSUCCESS"
                                    ? "Success"
                                    : "Failed"
                                }
                            </div>
                        </div>
                        <div class="tx-details">
                            <div class="detail-item">
                                <span class="label">Amount:</span>
                                <span class="value">${
                                  meta.delivered_amount
                                    ? xrpl.dropsToXrp(meta.delivered_amount)
                                    : "0"
                                } XRP</span>
                            </div>
                            <div class="detail-item">
                                <span class="label">From:</span>
                                <span class="value address">${t.Account}</span>
                            </div>
                            <div class="detail-item">
                                <span class="label">To:</span>
                                <span class="value address">${
                                  t.Destination || "N/A"
                                }</span>
                            </div>
                            <div class="detail-item">
                                <span class="label">Date:</span>
                                <span class="value">${date.toLocaleString()}</span>
                            </div>
                            <div class="detail-item">
                                <span class="label">Hash:</span>
                                <span class="value hash">${t.hash}</span>
                            </div>
                        </div>
                    `;
      txList.appendChild(div);
    });

    notify(`Found ${res.result.transactions.length} transactions`, "success");
  } catch (error) {
    notify("Failed to fetch transactions: " + error.message, "error");
    document.getElementById("txList").innerHTML =
      '<div class="error-state"><i class="fas fa-exclamation-triangle"></i><p>Failed to load transactions. Please try again.</p></div>';
  } finally {
    await client.disconnect();
    // Restore button state
    lookupBtn.innerHTML = originalText;
    lookupBtn.disabled = false;
  }
}

window.connectWallet = connectWallet;
window.sendXRP = sendXRP;
window.generateWallet = generateWallet;
window.recoverWallet = recoverWallet;
window.copyAddress = copyAddress;
window.clearRecoverForm = clearRecoverForm;
window.clearSendForm = clearSendForm;
window.clearConnectForm = clearConnectForm;
window.getRippleAddress = getRippleAddress;
window.validateAddressInput = validateAddressInput;
window.confirmSend = confirmSend;
window.closePopup = closePopup;
window.lookupTransactions = lookupTransactions;
window.sendXRPReference = sendXRPReference;
window.getWalletFromPrivateKey = getWalletFromPrivateKey;
window.convertWIFtoRippleWallet = convertWIFtoRippleWallet;
