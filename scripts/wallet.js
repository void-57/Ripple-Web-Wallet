import bs58check from "https://cdn.jsdelivr.net/npm/bs58check/+esm";
const uiGlobals = {};

// IndexedDB for storing searched addresses
class SearchedAddressDB {
  constructor() {
    this.dbName = "RippleWalletDB";
    this.version = 1;
    this.storeName = "searchedAddresses";
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, {
            keyPath: "address",
          });
          store.createIndex("timestamp", "timestamp", { unique: false });
        }
      };
    });
  }

  async saveSearchedAddress(address, balance, timestamp = Date.now()) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);

      const data = {
        address,
        balance,
        timestamp,
        formattedBalance: `${balance} XRP`,
      };

      const request = store.put(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getSearchedAddresses() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], "readonly");
      const store = transaction.objectStore(this.storeName);
      const index = store.index("timestamp");

      // Get all records sorted by timestamp (newest first)
      const request = index.getAll();
      request.onsuccess = () => {
        const results = request.result.sort(
          (a, b) => b.timestamp - a.timestamp
        );
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteSearchedAddress(address) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);

      const request = store.delete(address);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearAllSearchedAddresses() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);

      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

// Initialize the database
const searchedAddressDB = new SearchedAddressDB();

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
const debounce = (callback, wait) => {
  let timeoutId = null;
  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      callback.apply(null, args);
    }, wait);
  };
};

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

document.addEventListener("popupclosed", (e) => {
  zIndex--;
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
      break;
  }
  if (mode === "error") {
    console.error(message);
  }
  return getRef("notification_drawer").push(message, { icon, ...options });
}

// Input field control functions
function togglePasswordVisibility(inputId) {
  const input = document.getElementById(inputId);
  const toggleBtn = input.parentElement.querySelector(".toggle-password");

  if (input.type === "password") {
    input.type = "text";
    toggleBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
    toggleBtn.title = "Hide";
  } else {
    input.type = "password";
    toggleBtn.innerHTML = '<i class="fas fa-eye"></i>';
    toggleBtn.title = "Show";
  }
}

function clearInput(inputId) {
  const input = document.getElementById(inputId);
  input.value = "";
  input.focus();

  // If it's a password field that was shown, hide it again
  if (input.type === "text" && input.classList.contains("password-field")) {
    const toggleBtn = input.parentElement.querySelector(".toggle-password");
    input.type = "password";
    toggleBtn.innerHTML = '<i class="fas fa-eye"></i>';
    toggleBtn.title = "Show";
  }

  notify("Input cleared", "success");
}

// Initialize input containers with controls
function initializeInputControls() {
  // List of input IDs that need controls
  const inputIds = [
    "sendKey", // Send page - sender key
    "recipient", // Send page - recipient
    "amount", // Send page - amount
    "recoverKey", // Retrieve page
    "checkAddress", // Balance check
    "lookupAddress", // Transaction lookup
    "generateKey", // Generate page
  ];

  inputIds.forEach((inputId) => {
    const input = document.getElementById(inputId);
    if (!input) return;

    // Skip if already wrapped
    if (input.parentElement.classList.contains("input-container")) return;

    // Create wrapper container
    const container = document.createElement("div");
    container.className = "input-container";

    // Insert container before input
    input.parentNode.insertBefore(container, input);

    // Move input into container
    container.appendChild(input);

    // Determine if this is a sensitive field (private keys, seeds)
    const isSensitiveField = ["sendKey", "recoverKey", "generateKey"].includes(
      inputId
    );

    // Add password-field class for sensitive fields
    if (isSensitiveField) {
      input.classList.add("password-field");
      input.type = "password";
    }

    // Create controls container
    const controls = document.createElement("div");
    controls.className = "input-controls";

    // Add show/hide button for sensitive fields
    if (isSensitiveField) {
      const toggleBtn = document.createElement("button");
      toggleBtn.className = "input-control-btn toggle-password";
      toggleBtn.innerHTML = '<i class="fas fa-eye"></i>';
      toggleBtn.title = "Show";
      toggleBtn.type = "button";
      toggleBtn.onclick = () => togglePasswordVisibility(inputId);
      controls.appendChild(toggleBtn);
    }

    // Add clear button for all fields
    const clearBtn = document.createElement("button");
    clearBtn.className = "input-control-btn clear-input";
    clearBtn.innerHTML = '<i class="fas fa-times"></i>';
    clearBtn.title = "Clear";
    clearBtn.type = "button";
    clearBtn.onclick = () => clearInput(inputId);
    controls.appendChild(clearBtn);

    // Add controls to container
    container.appendChild(controls);
  });
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
// Simple state management for the wallet
let selectedCurrency = "xrp";
window.addEventListener("load", () => {
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
  try {
    const decoded = bs58check.decode(wif);
    let keyBuffer = decoded.slice(1); // remove version byte

    if (keyBuffer.length === 33 && keyBuffer[32] === 0x01) {
      keyBuffer = keyBuffer.slice(0, -1); // remove compression flag
    }
    const data = xrpl.Wallet.fromEntropy(keyBuffer);
    console.log(data);

    return {
      address: data.address,
      seed: data.seed,
    };
  } catch (error) {
    console.error("WIF conversion error:", error);
    throw new Error("Invalid WIF private key format: " + error.message);
  }
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
    let wallet;
    if (senderKey.startsWith("s")) {
      wallet = xrpl.Wallet.fromSeed(senderKey);
    } else {
      wallet = convertWIFtoRippleWallet(senderKey);
      wallet = xrpl.Wallet.fromSeed(wallet.seed);
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
          <span class="detail-value">${
            wallet.address || wallet.classicAddress
          }</span>
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
    notify("Error processing transaction: ", "error");
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
      // Get the correct address from wallet object
      const walletAddress = wallet.classicAddress || wallet.address;

      const accountInfo = await client.request({
        command: "account_info",
        account: walletAddress,
        ledger_index: "validated",
      });

      

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
   

    const tx = {
      TransactionType: "Payment",
      Account: wallet.classicAddress || wallet.address,
      Destination: destination,
      Amount: xrpl.xrpToDrops(amount.toString()),
      LastLedgerSequence: currentLedger + 20,
    };

    const prepared = await client.autofill(tx);
  

    let signed;
    try {
      if (wallet.seed && wallet.seed.startsWith("s")) {
        const seedWallet = xrpl.Wallet.fromSeed(wallet.seed);
        signed = seedWallet.sign(prepared);
      } else {
        throw new Error("Invalid wallet object - no signing method available");
      }
    } catch (signError) {
      console.error("Error signing transaction:", signError);
      throw new Error(`Failed to sign transaction: ${signError.message}`);
    }

    const result = await client.submitAndWait(signed.tx_blob);

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

    const Ledger_Index = result.result.ledger_index || "N/A";
    const fee = xrpl.dropsToXrp(result.result.Fee);

    // Check if transaction was successful
    if (result.result?.meta?.TransactionResult === "tesSUCCESS") {
      const fee = xrpl.dropsToXrp(result.result.Fee);

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

function clearSendForm() {
  const sendKeyField = getRef("sendKey");
  const recipientField = getRef("recipient");
  const amountField = getRef("amount");

  if (sendKeyField) sendKeyField.value = "";
  if (recipientField) recipientField.value = "";
  if (amountField) amountField.value = "";

  notify("Send form cleared", "success");
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
  const addressElement = document.getElementById("checkedAddress");
  const address = addressElement.textContent;

  if (address && address !== "-") {
    navigator.clipboard
      .writeText(address)
      .then(() => {
        notify("Address copied to clipboard!", "success");
      })
      .catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = address;
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

// Check balance for any Ripple address without requiring private key
async function checkBalance() {
  try {
    const addressInput = document.getElementById("checkAddress");
    const address = addressInput.value.trim();

    if (!address) {
      notify("Please enter a Ripple address", "error");
      return;
    }

    // Validate Ripple address format
    if (
      !address.startsWith("r") ||
      address.length < 25 ||
      address.length > 34
    ) {
      notify("Invalid Ripple address format", "error");
      return;
    }

    // Show loading state
    const checkBtn = document.querySelector('[onclick="checkBalance()"]');
    const originalText = checkBtn.innerHTML;
    checkBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';
    checkBtn.disabled = true;

    // Create XRPL client instance
    const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233");

    try {
      await client.connect();

      // Get account info
      try {
        const accountInfo = await client.request({
          command: "account_info",
          account: address,
          ledger_index: "current",
        });

        const balance =
          parseFloat(accountInfo.result.account_data.Balance) / 1000000; // Convert drops to XRP
        const reserve =
          parseFloat(accountInfo.result.account_data.OwnerCount || 0) * 2 + 10; // Base reserve + owner reserve

        // Update balance display
        document.getElementById(
          "displayBalance"
        ).textContent = `${balance.toLocaleString()} XRP`;
        document.getElementById("checkedAddress").textContent = address;

        // Save to IndexedDB
        try {
          await searchedAddressDB.saveSearchedAddress(
            address,
            balance.toLocaleString()
          );
          await updateSearchedAddressesList();
        } catch (dbError) {
          console.warn("Failed to save address to IndexedDB:", dbError);
        }

        // Show balance info
        document.getElementById("balanceInfo").style.display = "block";

        notify(`Balance: ${balance.toLocaleString()} XRP`, "success");
      } catch (error) {
        if (error.data && error.data.error === "actNotFound") {
          // Account not found (not activated)
          document.getElementById("displayBalance").textContent = "0 XRP";
          document.getElementById("checkedAddress").textContent = address;

          // Save to IndexedDB
          try {
            await searchedAddressDB.saveSearchedAddress(address, "0");
            await updateSearchedAddressesList();
          } catch (dbError) {
            console.warn("Failed to save address to IndexedDB:", dbError);
          }

          // Show balance info
          document.getElementById("balanceInfo").style.display = "block";

          notify(
            "Account not found - Address not activated (needs 10 XRP minimum)",
            "warning"
          );
        } else {
          throw error;
        }
      }
    } finally {
      await client.disconnect();
      // Restore button state
      checkBtn.innerHTML = originalText;
      checkBtn.disabled = false;
    }
  } catch (error) {
    console.error("Error checking balance:", error);
    notify(`Error checking balance: ${error.message}`, "error");
    // Restore button state on error
    const checkBtn = document.querySelector('[onclick="checkBalance()"]');
    if (checkBtn) {
      checkBtn.innerHTML = '<i class="fas fa-search-dollar"></i> Check Balance';
      checkBtn.disabled = false;
    }
  }
}

// Searched Addresses Management
async function updateSearchedAddressesList() {
  try {
    const searchedAddresses = await searchedAddressDB.getSearchedAddresses();
    displaySearchedAddresses(searchedAddresses);
  } catch (error) {
    console.error("Error loading searched addresses:", error);
  }
}

function displaySearchedAddresses(addresses) {
  // Check if we need to create the searched addresses container
  let container = document.getElementById("searchedAddressesContainer");

  if (!container && addresses.length > 0) {
    // Create the container after the balance check card
    const balanceCard = document.querySelector("#connectPage .card");
    container = document.createElement("div");
    container.id = "searchedAddressesContainer";
    container.className = "card searched-addresses-card";
    balanceCard.parentNode.insertBefore(container, balanceCard.nextSibling);
  }

  if (!container) return;

  if (addresses.length === 0) {
    container.style.display = "none";
    return;
  }

  container.style.display = "block";
  container.innerHTML = `
    <div class="searched-addresses-header">
      <h3><i class="fas fa-history"></i> Searched addresses</h3>
      <button onclick="clearAllSearchedAddresses()" class="btn-clear-all" title="Clear all">
        <i class="fas fa-trash"></i> Clear All
      </button>
    </div>
    <div class="searched-addresses-list">
      ${addresses
        .map(
          (addr) => `
        <div class="searched-address-item">
          <div class="address-info">
            <div class="address-text" title="${addr.address}">${addr.address}</div>
            <div class="address-balance">${addr.formattedBalance}</div>
          </div>
          <div class="address-actions">
            <button onclick="copyAddressToClipboard('${addr.address}')" class="btn-copy" title="Copy">
              <i class="fas fa-copy"></i> COPY
            </button>
            <button onclick="deleteSearchedAddress('${addr.address}')" class="btn-delete" title="Delete">
              Delete
            </button>
            <button onclick="recheckBalance('${addr.address}')" class="btn-check" title="Check balance">
              Check balance
            </button>
          </div>
        </div>
      `
        )
        .join("")}
    </div>
  `;
}

async function deleteSearchedAddress(address) {
  try {
    await searchedAddressDB.deleteSearchedAddress(address);
    await updateSearchedAddressesList();
    notify("Address removed from history", "success");
  } catch (error) {
    console.error("Error deleting searched address:", error);
    notify("Failed to remove address", "error");
  }
}

async function clearAllSearchedAddresses() {
  try {
    await searchedAddressDB.clearAllSearchedAddresses();
    await updateSearchedAddressesList();
    notify("All searched addresses cleared", "success");
  } catch (error) {
    console.error("Error clearing searched addresses:", error);
    notify("Failed to clear addresses", "error");
  }
}

async function copyAddressToClipboard(address) {
  try {
    await navigator.clipboard.writeText(address);
    notify("Address copied to clipboard", "success");
  } catch (error) {
    console.error("Error copying to clipboard:", error);
    notify("Failed to copy address", "error");
  }
}

async function recheckBalance(address) {
  document.getElementById("checkAddress").value = address;
  await checkBalance();
}

// Transaction pagination and filtering
let allTransactions = [];
let filteredTransactions = [];
let currentPage = 1;
const transactionsPerPage = 10;
let currentFilter = "all";

function setTransactionFilter(filter) {
  currentFilter = filter;
  currentPage = 1;

  // Update filter button states
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.classList.remove("active");
    if (btn.dataset.filter === filter) {
      btn.classList.add("active");
    }
  });

  // Filter transactions
  filterAndDisplayTransactions();
}

function filterAndDisplayTransactions() {
  const address = document.getElementById("lookupAddress").value.trim();

  // Filter transactions based on current filter
  switch (currentFilter) {
    case "received":
      filteredTransactions = allTransactions.filter(
        (tx) => tx.tx.Destination === address
      );
      break;
    case "sent":
      filteredTransactions = allTransactions.filter(
        (tx) => tx.tx.Account === address
      );
      break;
    default:
      filteredTransactions = [...allTransactions];
  }

  displayTransactionsPage();
  updatePaginationControls();
}

function displayTransactionsPage() {
  const startIndex = (currentPage - 1) * transactionsPerPage;
  const endIndex = startIndex + transactionsPerPage;
  const pageTransactions = filteredTransactions.slice(startIndex, endIndex);

  const txList = document.getElementById("txList");
  const address = document.getElementById("lookupAddress").value.trim();

  if (pageTransactions.length === 0) {
    if (filteredTransactions.length === 0 && allTransactions.length > 0) {
      txList.innerHTML = `
        <div class="no-transactions">
          <i class="fas fa-filter"></i>
          <p>No ${
            currentFilter === "all" ? "" : currentFilter
          } transactions found for this filter.</p>
        </div>
      `;
    } else {
      txList.innerHTML = `
        <div class="no-transactions">
          <i class="fas fa-inbox"></i>
          <p>No transactions found for this address.</p>
        </div>
      `;
    }
    return;
  }

  txList.innerHTML = "";

  pageTransactions.forEach((tx) => {
    const t = tx.tx;
    const meta = tx.meta;
    const date = new Date((t.date + 946684800) * 1000); // Ripple epoch conversion

    // Determine transaction direction and type
    const isIncoming = t.Destination === address;
    const direction = isIncoming ? "Received" : "Sent";
    const directionIcon = isIncoming ? "fa-arrow-down" : "fa-arrow-up";
    const directionClass = isIncoming ? "incoming" : "outgoing";

    // Get amount - handle different formats
    let amount = "0";
    if (meta.delivered_amount) {
      amount = xrpl.dropsToXrp(meta.delivered_amount);
    } else if (t.Amount && typeof t.Amount === "string") {
      amount = xrpl.dropsToXrp(t.Amount);
    }

    // Format date
    const formattedDate = date.toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const formattedTime = date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    // Transaction status
    const isSuccess = meta.TransactionResult === "tesSUCCESS";
    const statusText = isSuccess ? "Confirmed" : "Failed";
    const statusClass = isSuccess ? "success" : "failed";

    const div = document.createElement("div");
    div.className = `transaction-card ${directionClass}`;
    div.innerHTML = `
      <div class="tx-main">
        <div class="tx-icon">
          <i class="fas ${directionIcon}"></i>
        </div>
        <div class="tx-info">
          <div class="tx-header">
            <span class="tx-direction">${direction}</span>
            <span class="tx-date">${formattedDate}, ${formattedTime}</span>
          </div>
          <div class="tx-amount ${directionClass}">
            ${amount} XRP
          </div>
          <div class="tx-addresses">
            <div class="tx-address-row">
              <span class="address-label">From:</span>
              <span class="address-value">${t.Account.substring(
                0,
                8
              )}...${t.Account.substring(t.Account.length - 6)}</span>
            </div>
            <div class="tx-address-row">
              <span class="address-label">To:</span>
              <span class="address-value">${
                t.Destination
                  ? t.Destination.substring(0, 8) +
                    "..." +
                    t.Destination.substring(t.Destination.length - 6)
                  : "N/A"
              }</span>
            </div>
          </div>
          <div class="tx-hash">
            <span class="hash-label">Tx:</span>
            <span class="hash-value">${t.hash.substring(
              0,
              8
            )}...${t.hash.substring(t.hash.length - 6)}</span>
          </div>
        </div>
        <div class="tx-status ${statusClass}">
          ${statusText}
        </div>
      </div>
    `;
    txList.appendChild(div);
  });
}

function updatePaginationControls() {
  const totalPages = Math.ceil(
    filteredTransactions.length / transactionsPerPage
  );
  const startIndex = (currentPage - 1) * transactionsPerPage + 1;
  const endIndex = Math.min(
    currentPage * transactionsPerPage,
    filteredTransactions.length
  );

  // Update pagination info
  document.getElementById(
    "paginationInfo"
  ).textContent = `Showing ${startIndex} - ${endIndex} of ${filteredTransactions.length} transactions`;

  // Update previous/next buttons
  document.getElementById("prevBtn").disabled = currentPage === 1;
  document.getElementById("nextBtn").disabled =
    currentPage === totalPages || totalPages === 0;

  // Update page numbers
  generatePageNumbers(totalPages);
}

function generatePageNumbers(totalPages) {
  const pageNumbers = document.getElementById("pageNumbers");
  pageNumbers.innerHTML = "";

  if (totalPages <= 1) return;

  // Calculate which page numbers to show
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, startPage + 4);

  if (endPage - startPage < 4) {
    startPage = Math.max(1, endPage - 4);
  }

  // Add first page and ellipsis if needed
  if (startPage > 1) {
    addPageNumber(1);
    if (startPage > 2) {
      const ellipsis = document.createElement("span");
      ellipsis.textContent = "...";
      ellipsis.className = "page-ellipsis";
      pageNumbers.appendChild(ellipsis);
    }
  }

  // Add page numbers
  for (let i = startPage; i <= endPage; i++) {
    addPageNumber(i);
  }

  // Add last page and ellipsis if needed
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const ellipsis = document.createElement("span");
      ellipsis.textContent = "...";
      ellipsis.className = "page-ellipsis";
      pageNumbers.appendChild(ellipsis);
    }
    addPageNumber(totalPages);
  }
}

function addPageNumber(pageNum) {
  const pageNumbers = document.getElementById("pageNumbers");
  const pageBtn = document.createElement("button");
  pageBtn.className = `page-number ${pageNum === currentPage ? "active" : ""}`;
  pageBtn.textContent = pageNum;
  pageBtn.onclick = () => goToPage(pageNum);
  pageNumbers.appendChild(pageBtn);
}

function goToPage(page) {
  currentPage = page;
  displayTransactionsPage();
  updatePaginationControls();
}

function goToPreviousPage() {
  if (currentPage > 1) {
    goToPage(currentPage - 1);
  }
}

function goToNextPage() {
  const totalPages = Math.ceil(
    filteredTransactions.length / transactionsPerPage
  );
  if (currentPage < totalPages) {
    goToPage(currentPage + 1);
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

  // Hide controls initially
  document.getElementById("transactionControls").style.display = "none";

  const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233");
  try {
    await client.connect();
    const res = await client.request({
      command: "account_tx",
      account: address,
      ledger_index_min: -1,
      ledger_index_max: -1,
      limit: 1000,
    });

    // Store all transactions
    allTransactions = res.result.transactions;

    // Reset pagination state
    currentPage = 1;
    currentFilter = "all";

    // Reset filter buttons
    document.querySelectorAll(".filter-btn").forEach((btn) => {
      btn.classList.remove("active");
      if (btn.dataset.filter === "all") {
        btn.classList.add("active");
      }
    });

    if (allTransactions.length === 0) {
      document.getElementById("txList").innerHTML =
        '<div class="no-transactions"><i class="fas fa-inbox"></i><p>No transactions found for this address.</p></div>';
      notify("No transactions found.", "error");
      return;
    }

    // Show controls and display transactions
    document.getElementById("transactionControls").style.display = "block";
    filterAndDisplayTransactions();

    notify(`Found ${allTransactions.length} transactions`, "success");
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

// Generate specific cryptocurrency addresses
async function generateXRPAddress() {
  try {
    // Get private key from the wallet generation form input
    const keyInput = document.getElementById("generateKey");
    if (!keyInput) {
      notify("Private key input field not found", "error");
      return;
    }

    const sourcePrivateKey = keyInput.value.trim();
    if (!sourcePrivateKey) {
      notify(
        "Please enter a private key from any blockchain (BTC/FLO)",
        "error"
      );
      return;
    }

    // Show loading state
    const generateBtn = document.querySelector(
      '[onclick="generateXRPAddress()"]'
    );
    const originalText = generateBtn.innerHTML;
    generateBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Generating...';
    generateBtn.disabled = true;

    notify("Converting private key to multiple addresses...", "info");

    // Convert the source private key using improved logic
    let xrpResult;
    let btcResult = null;
    let floResult = null;
    let sourceBlockchain = "Unknown";

    try {
      if (
        sourcePrivateKey.startsWith("L") ||
        sourcePrivateKey.startsWith("K")
      ) {
        // Bitcoin WIF format
        sourceBlockchain = "Bitcoin";
        xrpResult = convertWIFtoRippleWallet(sourcePrivateKey);

        // Generate FLO from BTC
        floResult = generateFLOFromPrivateKey(sourcePrivateKey);

        // Keep original BTC info
        btcResult = generateBTCFromPrivateKey(sourcePrivateKey);
      } else {
        // Try to decode as WIF (FLO or other)
        try {
          sourceBlockchain = "FLO/Other";
          xrpResult = convertWIFtoRippleWallet(sourcePrivateKey);

          // Generate BTC from FLO
          btcResult = generateBTCFromPrivateKey(sourcePrivateKey);

          // Keep original FLO info (if floCrypto available)
          floResult = generateFLOFromPrivateKey(sourcePrivateKey);
        } catch (e) {
          throw new Error(
            "Unsupported private key format. Please use BTC WIF, FLO WIF private key."
          );
        }
      }

      // Display result with all blockchain information
      const outputDiv = document.getElementById("walletOutput");
      if (outputDiv) {
        outputDiv.innerHTML = `
          <div class="wallet-result">
            <h3><i class="fas fa-coins"></i> Multi-Blockchain Addresses Generated</h3>
            <div class="wallet-details">
              
              <!-- XRP Section -->
              <div class="blockchain-section">
                <h4><i class="fas fa-coins" style="color: #23b469;"></i> Ripple (XRP)</h4>
                <div class="detail-row">
                  <label>XRP Address:</label>
                  <div class="value-container">
                    <code>${xrpResult.address}</code>
                    <button onclick="copyToClipboard('${
                      xrpResult.address
                    }')" class="btn-copy">
                      <i class="fas fa-copy"></i>
                    </button>
                  </div>
                </div>
                <div class="detail-row">
                  <label>XRP Seed:</label>
                  <div class="value-container">
                    <code>${xrpResult.seed}</code>
                    <button onclick="copyToClipboard('${
                      xrpResult.seed
                    }')" class="btn-copy">
                      <i class="fas fa-copy"></i>
                    </button>
                  </div>
                </div>
              </div>

              ${
                btcResult
                  ? `
              <!-- BTC Section -->
              <div class="blockchain-section">
                <h4><i class="fab fa-bitcoin" style="color: #f2a900;"></i> Bitcoin (BTC)</h4>
                <div class="detail-row">
                  <label>BTC Address:</label>
                  <div class="value-container">
                    <code>${btcResult.address}</code>
                    <button onclick="copyToClipboard('${btcResult.address}')" class="btn-copy">
                      <i class="fas fa-copy"></i>
                    </button>
                  </div>
                </div>
                <div class="detail-row">
                  <label>BTC Private Key:</label>
                  <div class="value-container">
                    <code>${btcResult.privateKey}</code>
                    <button onclick="copyToClipboard('${btcResult.privateKey}')" class="btn-copy">
                      <i class="fas fa-copy"></i>
                    </button>
                  </div>
                </div>
              </div>
              `
                  : ""
              }

              ${
                floResult
                  ? `
              <!-- FLO Section -->
              <div class="blockchain-section">
                <h4><i class="fas fa-leaf" style="color: #00d4aa;"></i> FLO Chain</h4>
                <div class="detail-row">
                  <label>FLO Address:</label>
                  <div class="value-container">
                    <code>${floResult.address}</code>
                    <button onclick="copyToClipboard('${floResult.address}')" class="btn-copy">
                      <i class="fas fa-copy"></i>
                    </button>
                  </div>
                </div>
                <div class="detail-row">
                  <label>FLO Private Key:</label>
                  <div class="value-container">
                    <code>${floResult.privateKey}</code>
                    <button onclick="copyToClipboard('${floResult.privateKey}')" class="btn-copy">
                      <i class="fas fa-copy"></i>
                    </button>
                  </div>
                </div>
              </div>
              `
                  : ""
              }

            </div>
            <div class="warning-message" style="margin-top: 1rem; padding: 0.75rem; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; color: #856404;">
              <i class="fas fa-exclamation-triangle"></i>
              <strong>Important:</strong> These addresses are mathematically derived from your ${sourceBlockchain} private key using proper elliptic curve cryptography. Keep all private keys secure.
            </div>
          </div>
        `;
        outputDiv.style.display = "block";
      }

      const blockchainCount = 1 + (btcResult ? 1 : 0) + (floResult ? 1 : 0);
      notify(
        `${blockchainCount} blockchain addresses generated successfully from ${sourceBlockchain} private key!`,
        "success"
      );
    } catch (conversionError) {
      console.error("Private key conversion error:", conversionError);
      notify(
        "Failed to convert private key: " + conversionError.message,
        "error"
      );
    }
  } catch (error) {
    console.error("XRP generation error:", error);
    notify("Failed to generate XRP address: " + error.message, "error");
  } finally {
    // Restore button state
    const generateBtn = document.querySelector(
      '[onclick="generateXRPAddress()"]'
    );
    if (generateBtn) {
      generateBtn.innerHTML =
        '<i class="fas fa-coins"></i> Generate XRP Address';
      generateBtn.disabled = false;
    }
  }
}

// Retrieve specific cryptocurrency addresses from private key
async function retrieveXRPAddress() {
  const keyInput = document.getElementById("recoverKey");
  if (!keyInput || !keyInput.value.trim()) {
    notify("Please enter a private key or seed", "error");
    return;
  }

  // Show loading state
  const retrieveBtn = document.querySelector(
    '[onclick="retrieveXRPAddress()"]'
  );
  const originalText = retrieveBtn.innerHTML;
  retrieveBtn.innerHTML =
    '<i class="fas fa-spinner fa-spin"></i> Retrieving...';
  retrieveBtn.disabled = true;

  try {
    const sourceKey = keyInput.value.trim();
    let walletResult;
    let sourceType;
    let sourceBlockchain = "XRP";
    let btcResult = null;
    let floResult = null;
    // Check if it's an XRP seed first (starts with 's')
    if (sourceKey.startsWith("s") && sourceKey.length >= 25) {
      try {
        sourceType = "XRP Seed";
        sourceBlockchain = "XRP";
        notify("Retrieving addresses from XRP seed...", "info");
        const rippleWallet = xrpl.Wallet.fromSeed(sourceKey);
        walletResult = {
          address: rippleWallet.address,
          publicKey: rippleWallet.publicKey,
          privateKey: rippleWallet.privateKey,
          seed: rippleWallet.seed,
        };
      } catch (seedError) {
        throw new Error("Invalid XRP seed format");
      }
    }
    // Check if it's a Bitcoin WIF format (starts with "L" or "K")
    else if (sourceKey.startsWith("L") || sourceKey.startsWith("K")) {
      if (typeof elliptic === "undefined") {
        throw new Error(
          "elliptic library not loaded. Please refresh the page."
        );
      }
      if (typeof bs58check === "undefined") {
        throw new Error(
          "bs58check library not loaded. Please refresh the page."
        );
      }

      sourceType = "Bitcoin WIF";
      sourceBlockchain = "Bitcoin";
      notify("Converting Bitcoin WIF to multi-blockchain addresses...", "info");
      walletResult = convertWIFtoRippleWallet(sourceKey);
      try {
        floResult = generateFLOFromPrivateKey(sourceKey);
      } catch (error) {
        console.warn("Could not generate FLO address:", error.message);
      }
      try {
        btcResult = generateBTCFromPrivateKey(sourceKey);
      } catch (error) {
        console.warn("Could not generate BTC address:", error.message);
      }
    } else {
      try {
        if (
          typeof elliptic === "undefined" ||
          typeof bs58check === "undefined"
        ) {
          throw new Error(
            "Required libraries not loaded. Please refresh the page."
          );
        }

        sourceType = "FLO/Other WIF";
        sourceBlockchain = "FLO";
        notify("Converting WIF key to multi-blockchain addresses...", "info");
        walletResult = convertWIFtoRippleWallet(sourceKey);
        try {
          floResult = generateFLOFromPrivateKey(sourceKey);
        } catch (error) {
          console.warn("Could not generate FLO address:", error.message);
        }
        try {
          btcResult = generateBTCFromPrivateKey(sourceKey);
        } catch (error) {
          console.warn("Could not generate BTC address:", error.message);
        }
      } catch (e) {
        throw new Error(
          `Unsupported key/seed format. Supported formats:
          • XRP Seed (s...)
          • Bitcoin WIF (L.../K...)
          • FLO WIF`
        );
      }
    }

    // Display the retrieved wallet information
    const outputDiv = document.getElementById("recoveryOutput");
    if (outputDiv) {
      outputDiv.innerHTML = `
        <div class="wallet-result">
          <h3><i class="fas fa-key"></i> Multi-Blockchain Addresses Retrieved</h3>
          <div class="wallet-details">
            <div class="detail-row">
              <label>Source:</label>
              <span>${sourceType} (${sourceBlockchain})</span>
            </div>
            
            <!-- XRP Section -->
            <div class="blockchain-section">
              <h4><i class="fas fa-coins" style="color: #23b469;"></i> Ripple (XRP)</h4>
              <div class="detail-row">
                <label>XRP Address:</label>
                <div class="value-container">
                  <code>${walletResult.address}</code>
                  <button onclick="copyToClipboard('${
                    walletResult.address
                  }')" class="btn-copy">
                    <i class="fas fa-copy"></i>
                  </button>
                </div>
              </div>
              <div class="detail-row">
                <label>XRP Seed:</label>
                <div class="value-container">
                  <code>${walletResult.seed}</code>
                  <button onclick="copyToClipboard('${
                    walletResult.seed
                  }')" class="btn-copy">
                    <i class="fas fa-copy"></i>
                  </button>
                </div>
              </div>
            </div>

            ${
              btcResult
                ? `
            <!-- BTC Section -->
            <div class="blockchain-section">
              <h4><i class="fab fa-bitcoin" style="color: #f2a900;"></i> Bitcoin (BTC)</h4>
              <div class="detail-row">
                <label>BTC Address:</label>
                <div class="value-container">
                  <code>${btcResult.address}</code>
                  <button onclick="copyToClipboard('${btcResult.address}')" class="btn-copy">
                    <i class="fas fa-copy"></i>
                  </button>
                </div>
              </div>
              <div class="detail-row">
                <label>BTC Private Key:</label>
                <div class="value-container">
                  <code>${btcResult.privateKey}</code>
                  <button onclick="copyToClipboard('${btcResult.privateKey}')" class="btn-copy">
                    <i class="fas fa-copy"></i>
                  </button>
                </div>
              </div>
            </div>
            `
                : ""
            }

            ${
              floResult
                ? `
            <!-- FLO Section -->
            <div class="blockchain-section">
              <h4><i class="fas fa-leaf" style="color: #00d4aa;"></i> FLO Chain</h4>
              <div class="detail-row">
                <label>FLO Address:</label>
                <div class="value-container">
                  <code>${floResult.address}</code>
                  <button onclick="copyToClipboard('${floResult.address}')" class="btn-copy">
                    <i class="fas fa-copy"></i>
                  </button>
                </div>
              </div>
              <div class="detail-row">
                <label>FLO Private Key:</label>
                <div class="value-container">
                  <code>${floResult.privateKey}</code>
                  <button onclick="copyToClipboard('${floResult.privateKey}')" class="btn-copy">
                    <i class="fas fa-copy"></i>
                  </button>
                </div>
              </div>
            </div>
            `
                : ""
            }

          </div>
          <div class="warning-message" style="margin-top: 1rem; padding: 0.75rem; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; color: #856404;">
            <i class="fas fa-exclamation-triangle"></i>
            <strong>Retrieved from ${sourceType}:</strong> ${
        sourceType === "XRP Seed"
          ? "These addresses were generated from your original XRP seed."
          : `These addresses are mathematically derived from your ${sourceType} using elliptic curve cryptography.`
      } Keep all private keys secure.
          </div>
        </div>
      `;
      outputDiv.style.display = "block";
    }

    const blockchainCount = 1 + (btcResult ? 1 : 0) + (floResult ? 1 : 0);
    notify(
      `${blockchainCount} blockchain addresses retrieved successfully from ${sourceType}!`,
      "success"
    );
  } catch (conversionError) {
    console.error("Key/seed conversion error:", conversionError);
    notify("Failed to retrieve address: " + conversionError.message, "error");
  } finally {
    // Restore button state
    const retrieveBtn = document.querySelector(
      '[onclick="retrieveXRPAddress()"]'
    );
    if (retrieveBtn) {
      retrieveBtn.innerHTML = '<i class="fas fa-coins"></i> Retrieve Addresses';
      retrieveBtn.disabled = false;
    }
  }
}

// Helper function for copying to clipboard
function copyToClipboard(text) {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      notify("Copied to clipboard!", "success");
    })
    .catch(() => {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      notify("Copied to clipboard!", "success");
    });
}

// Helper function to convert hex to Uint8Array
function hexToUint8Array(hex) {
  const cleanHex = hex.replace(/^0x/, "");
  const result = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    result[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
  }
  return result;
}

function generateBTCFromPrivateKey(privateKey) {
  try {
    if (typeof btcOperator === "undefined") {
      throw new Error("btcOperator library not available");
    }

    // Convert private key to WIF format if it's hex
    let wifKey = privateKey;
    if (/^[0-9a-fA-F]{64}$/.test(privateKey)) {
      wifKey = coinjs.privkey2wif(privateKey);
    }
    let btcPrivateKey = btcOperator.convert.wif(wifKey);
    let btcAddress;
    btcAddress = btcOperator.bech32Address(wifKey);

    return {
      address: btcAddress,
      privateKey: btcPrivateKey,
    };
  } catch (error) {
    console.warn("BTC generation error:", error.message);
    return null;
  }
}

// FLO address generation
function generateFLOFromPrivateKey(privateKey) {
  try {
    let flowif = privateKey;

    if (/^[0-9a-fA-F]{64}$/.test(privateKey)) {
      flowif = coinjs.privkey2wif(privateKey);
    }

    let floprivateKey = btcOperator.convert.wif(flowif, bitjs.priv);
    let floAddress = floCrypto.getFloID(floprivateKey);

    if (!floAddress) {
      throw new Error("No working FLO address generation method found");
    }

    return {
      address: floAddress,
      privateKey: floprivateKey, // Returns the format that actually works
    };
  } catch (error) {
    console.warn("FLO generation not available:", error.message);
    return null;
  }
}

window.sendXRP = sendXRP;

window.generateXRPAddress = generateXRPAddress;
window.retrieveXRPAddress = retrieveXRPAddress;
window.copyAddress = copyAddress;
window.copyToClipboard = copyToClipboard;
window.checkBalance = checkBalance;
window.clearSendForm = clearSendForm;
window.getRippleAddress = getRippleAddress;
window.validateAddressInput = validateAddressInput;
window.confirmSend = confirmSend;
window.closePopup = closePopup;
window.lookupTransactions = lookupTransactions;

window.convertWIFtoRippleWallet = convertWIFtoRippleWallet;

// Multi-blockchain function exports
window.generateBTCFromPrivateKey = generateBTCFromPrivateKey;
window.generateFLOFromPrivateKey = generateFLOFromPrivateKey;

window.setTransactionFilter = setTransactionFilter;
window.goToPreviousPage = goToPreviousPage;
window.goToNextPage = goToNextPage;
// Input control functions
window.togglePasswordVisibility = togglePasswordVisibility;
window.clearInput = clearInput;
// Searched addresses functions
window.updateSearchedAddressesList = updateSearchedAddressesList;
window.deleteSearchedAddress = deleteSearchedAddress;
window.clearAllSearchedAddresses = clearAllSearchedAddresses;
window.copyAddressToClipboard = copyAddressToClipboard;
window.recheckBalance = recheckBalance;

// Initialize input controls when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  initializeInputControls();
});
