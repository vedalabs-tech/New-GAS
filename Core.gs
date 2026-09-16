/**
 * STORE CONFIGURATION
 * Secrets should live in Script Properties. Fallbacks exist only so an
 * existing deployment keeps working after upgrade. Rotate leaked keys.
 *
 * Required Script Properties (File > Project settings > Script properties):
 *   MAIN_FOLDER_ID, APP_TOKEN, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
 *   ADMIN_BOOTSTRAP_EMAIL (optional)
 */

const STORE_NAME = "Aarambh Naturals";
const STORE_URL = "https://www.aarambhntpl.com/";
const LOGO_URL = "https://raw.githubusercontent.com/TOOLS-droid724/Logo/ae0efe81ab05d73bf85a3df1e9be516c3ca35f21/34826.png";
const TIMEZONE = "Asia/Kolkata";

const DEFAULT_APP_TOKEN = "PT_SECURE_2026";
const DEFAULT_FOLDER_ID = "1jlHfRHBat1ZlO32uRkBYM2Cw03vhgv86";

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_MAX_REQUESTS_PER_WINDOW = 3;
const OTP_WINDOW_MS = 15 * 60 * 1000;

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const PROFILE_UPDATES_PER_MONTH = 8;
const MAX_MEDIA_BYTES = 8 * 1024 * 1024;
const MAX_REVIEW_MEDIA = 6;
const MAX_PRODUCT_MEDIA = 40;
const LOW_STOCK_THRESHOLD_DEFAULT = 5;

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

const USER_TYPES_DEFAULT = [];

const ORDER_STATUSES = ["Pending", "Confirmed", "Packed", "Shipped", "Delivered", "Cancelled", "Refunded"];

const PUBLIC_SETTINGS_KEYS = [
  "storeName", "storeUrl", "currency", "currencySymbol", "taxPercent",
  "shippingFlat", "freeShippingMin", "codFee", "codGlobalEnabled",
  "maintenanceMode", "supportEmail", "logoUrl", "userTypes", "reviewMediaEnabled",
  "includeDescendantsInParent", "showOutOfStock", "allowParentCategoryProducts"
];

const ADMIN_ONLY_SHEETS = [
  "Users", "Products", "Categories", "Orders", "Carts", "Waitlist",
  "Reviews", "Wishlist", "Coupons", "CouponRedemptions", "Settings",
  "Sessions", "Media", "InventoryLog", "AuditLog", "Tickets", "UserTypes"
];

function cfg_(key, fallback) {
  const props = PropertiesService.getScriptProperties();
  const value = props.getProperty(key);
  return (value === null || value === "") ? fallback : value;
}

function getAppToken_() {
  return cfg_("APP_TOKEN", DEFAULT_APP_TOKEN);
}

function getMainFolderId_() {
  return cfg_("MAIN_FOLDER_ID", DEFAULT_FOLDER_ID);
}

function getRazorpayKeyId_() {
  return cfg_("RAZORPAY_KEY_ID", "rzp_live_SVstISgPrcivjP");
}

function getRazorpayKeySecret_() {
  return cfg_("RAZORPAY_KEY_SECRET", "");
}

function now_() {
  return new Date();
}

function iso_(date) {
  return Utilities.formatDate(date || now_(), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function uid_(prefix) {
  const rand = Utilities.getUuid().replace(/-/g, "").slice(0, 10).toUpperCase();
  return (prefix || "ID") + "-" + rand;
}

function safeString_(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function lower_(value) {
  return safeString_(value).toLowerCase();
}

function toBool_(value, fallback) {
  if (value === true || value === false) return value;
  if (value === null || value === undefined || value === "") {
    return fallback === undefined ? false : fallback;
  }
  const s = lower_(value);
  if (s === "true" || s === "1" || s === "yes" || s === "on") return true;
  if (s === "false" || s === "0" || s === "no" || s === "off") return false;
  return fallback === undefined ? false : fallback;
}

function toNumber_(value, fallback) {
  const n = Number(value);
  return isFinite(n) ? n : (fallback || 0);
}

function parseJson_(text, fallback) {
  try {
    if (text === null || text === undefined || text === "") return fallback;
    if (typeof text === "object") return text;
    return JSON.parse(text);
  } catch (e) {
    return fallback;
  }
}

function jsonResponse_(data, statusCode) {
  const out = ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return out;
}

function error_(message, extra) {
  const res = { status: "error", message: message || "Unexpected error." };
  if (extra) Object.keys(extra).forEach(k => res[k] = extra[k]);
  return res;
}

function ok_(payload) {
  const res = payload && typeof payload === "object" ? payload : {};
  res.status = "success";
  return res;
}

/**
 * DATABASE, SCHEMA, FOLDERS
 */

const SCHEMA = {
  Users: [
    "UserID", "Name", "Email", "Phone", "UserType", "Role", "OTP", "OTPExpiry",
    "OTPAttempts", "OTPRequestedAt", "OTPRequestCount", "Status", "ProfilePic",
    "Visits", "Device", "UpdateCount", "Month", "VaultID", "AddressFileID",
    "LastSeen", "CreatedAt", "MarketingOptIn", "Notes"
  ],
  Products: [
    "ID", "SKU", "Name", "CategoryID", "CategoryIDs", "CategoryPath", "Tags",
    "ShortDescription", "Price", "MRP", "Stock", "LowStockAt",
    "Image_URL", "Video_URL", "Media_JSON", "Description", "Status",
    "CODEnabled", "GoLiveAt", "ScheduledStock", "Featured", "WeightGrams",
    "TaxPercent", "CreatedAt", "UpdatedAt"
  ],
  Categories: [
    "ID", "Name", "ParentID", "Slug", "Description", "Image", "Status",
    "SortOrder", "GoLiveAt", "CreatedAt", "UpdatedAt"
  ],
  Orders: [
    "Order_ID", "Email", "UserID", "Items", "ItemsJSON", "Amount", "Subtotal",
    "Tax", "Shipping", "Discount", "CouponCode", "PaymentMethod", "Razorpay_ID",
    "COD", "Status", "Date", "Delivery_Address", "Phone", "Notes", "AdminNotes",
    "UpdatedAt"
  ],
  Carts: ["Email", "CartJSON", "UpdatedAt"],
  Waitlist: ["ProductID", "Email", "Date"],
  Reviews: [
    "ReviewID", "ProductID", "Email", "UserName", "Rating", "Comment",
    "Media_JSON", "Status", "Date", "AdminReply"
  ],
  Wishlist: ["Email", "ProductID", "Date"],
  Coupons: [
    "Code", "Type", "Value", "MinOrder", "MaxUses", "UsedCount", "ExpiresAt",
    "Status", "CreatedAt"
  ],
  CouponRedemptions: ["Code", "Email", "Order_ID", "Date"],
  Settings: ["Key", "Value"],
  Sessions: ["TokenHash", "Email", "UserID", "Role", "ExpiresAt", "CreatedAt", "Device"],
  Media: [
    "MediaID", "OwnerType", "OwnerID", "FileID", "Url", "MimeType", "Filename",
    "Size", "Status", "UploadedBy", "CreatedAt"
  ],
  InventoryLog: ["LogID", "ProductID", "Delta", "Reason", "Order_ID", "AdminEmail", "Date"],
  AuditLog: ["LogID", "ActorEmail", "ActorRole", "Action", "Target", "Details", "Date"],
  Tickets: ["TicketID", "Email", "Subject", "Message", "Status", "AdminReply", "Date", "UpdatedAt"],
  UserTypes: ["ID", "Name", "CategoryIDs", "Description", "Status", "SortOrder", "CreatedAt", "UpdatedAt"]
};

function getOrCreateFolder(parentFolder, folderName) {
  const folders = parentFolder.getFoldersByName(folderName);
  return folders.hasNext() ? folders.next() : parentFolder.createFolder(folderName);
}

function getMasterDB() {
  const id = PropertiesService.getScriptProperties().getProperty("MASTER_SHEET_ID");
  if (!id) throw new Error("System is not ready. Run setupEcosystem() first.");
  return SpreadsheetApp.openById(id);
}

function setupEcosystem() {
  const mainFolder = DriveApp.getFolderById(getMainFolderId_());
  const adminVault = getOrCreateFolder(mainFolder, "Admin_Vault");
  const customerBase = getOrCreateFolder(mainFolder, "Customer_Base");
  const securityLogs = getOrCreateFolder(mainFolder, "Security_Logs");
  const mediaVault = getOrCreateFolder(mainFolder, "Media_Vault");
  const addressVault = getOrCreateFolder(mainFolder, "Address_Vault");

  const props = PropertiesService.getScriptProperties();
  props.setProperty("CUSTOMER_BASE_ID", customerBase.getId());
  props.setProperty("SECURITY_LOGS_ID", securityLogs.getId());
  props.setProperty("MEDIA_VAULT_ID", mediaVault.getId());
  props.setProperty("ADDRESS_VAULT_ID", addressVault.getId());

  let masterSheetId = props.getProperty("MASTER_SHEET_ID");
  if (!masterSheetId) {
    const newMaster = SpreadsheetApp.create("MASTER_DB");
    DriveApp.getFileById(newMaster.getId()).moveTo(adminVault);
    masterSheetId = newMaster.getId();
    props.setProperty("MASTER_SHEET_ID", masterSheetId);
  }

  ensureSchema();
  seedDefaultSettings_();
  installTriggers();
  return ok_({ message: "Ecosystem installed and schema upgraded." });
}

function ensureSchema() {
  const ss = getMasterDB();
  Object.keys(SCHEMA).forEach(name => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(SCHEMA[name]);
    } else {
      ensureColumns_(sheet, SCHEMA[name]);
    }
  });
  const leftover = ss.getSheetByName("Sheet1");
  if (leftover && ss.getSheets().length > 1) {
    try { leftover.setName("Dashboard"); } catch (e) {}
  }
}

function ensureColumns_(sheet, required) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  let headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => safeString_(h));
  const lower = headers.map(h => lower_(h));
  let added = false;
  required.forEach(col => {
    if (lower.indexOf(lower_(col)) === -1) {
      sheet.getRange(1, headers.length + 1).setValue(col);
      headers.push(col);
      lower.push(lower_(col));
      added = true;
    }
  });
  if (added) SpreadsheetApp.flush();
  return headers;
}

function ensureDynamicColumns(sheet, dataObject) {
  let headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  let lowerHeaders = headers.map(h => lower_(h));
  let columnsAdded = false;
  Object.keys(dataObject || {}).forEach(key => {
    if (key === "action" || key === "token" || key === "sessionToken") return;
    if (lowerHeaders.indexOf(lower_(key)) === -1) {
      sheet.getRange(1, headers.length + 1).setValue(key);
      headers.push(key);
      lowerHeaders.push(lower_(key));
      columnsAdded = true;
    }
  });
  if (columnsAdded) SpreadsheetApp.flush();
  return headers;
}

function sheetHeaders_(sheet) {
  if (!sheet || sheet.getLastColumn() < 1) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => safeString_(h));
}

function col_(headers, name) {
  const want = lower_(name);
  for (let i = 0; i < headers.length; i++) {
    if (lower_(headers[i]) === want) return i;
  }
  return -1;
}

function rowsAsObjects_(sheet) {
  if (!sheet) return [];
  const range = sheet.getDataRange();
  const values = range.getValues();
  if (values.length <= 1) return [];
  const headers = values.shift();
  return values.map((row, idx) => {
    const obj = { _row: idx + 2 };
    headers.forEach((h, i) => { obj[safeString_(h)] = row[i]; });
    return obj;
  });
}

function getUniversalData(sheetName) {
  SpreadsheetApp.flush();
  const sheet = getMasterDB().getSheetByName(sheetName);
  if (!sheet) return [];
  const rows = rowsAsObjects_(sheet);
  if (sheetName === "Users") {
    return rows.map(sanitizeUserRecord_);
  }
  return rows.map(stripInternal_);
}

function stripInternal_(obj) {
  const copy = {};
  Object.keys(obj).forEach(k => {
    if (k !== "_row") copy[k] = obj[k];
  });
  return copy;
}

function sanitizeUserRecord_(obj) {
  const copy = stripInternal_(obj);
  delete copy.OTP;
  delete copy.OTPExpiry;
  delete copy.OTPAttempts;
  delete copy.OTPRequestedAt;
  delete copy.OTPRequestCount;
  copy.Addresses_JSON = loadAddressesJson_(copy.AddressFileID);
  return copy;
}

function findRowIndexByEmailCaseInsensitive(email, sheet) {
  if (!email || !sheet) return -1;
  const data = sheet.getDataRange().getValues();
  if (!data.length) return -1;
  const headers = data[0];
  let emailCol = col_(headers, "Email");
  if (emailCol === -1) emailCol = 1;
  const search = lower_(email);
  for (let i = 1; i < data.length; i++) {
    if (lower_(data[i][emailCol]) === search) return i + 1;
  }
  return -1;
}

function findRowByColumn_(sheet, columnName, value) {
  const data = sheet.getDataRange().getValues();
  if (!data.length) return { rowIndex: -1, headers: [], row: null };
  const headers = data[0];
  const idx = col_(headers, columnName);
  if (idx === -1) return { rowIndex: -1, headers: headers, row: null };
  const search = String(value);
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idx]) === search) {
      return { rowIndex: i + 1, headers: headers, row: data[i] };
    }
  }
  return { rowIndex: -1, headers: headers, row: null };
}

function writeRowByHeaders_(sheet, rowIndex, mapped) {
  const headers = ensureDynamicColumns(sheet, mapped);
  Object.keys(mapped).forEach(key => {
    const i = col_(headers, key);
    if (i > -1) sheet.getRange(rowIndex, i + 1).setValue(mapped[key]);
  });
}

function appendRowByHeaders_(sheet, mapped) {
  const headers = ensureDynamicColumns(sheet, mapped);
  const row = headers.map(h => (mapped.hasOwnProperty(h) ? mapped[h] : ""));
  sheet.appendRow(row);
  return sheet.getLastRow();
}

function loadAddressesJson_(fileId) {
  if (!fileId) return "[]";
  try {
    const addrSheet = SpreadsheetApp.openById(fileId).getSheetByName("Saved_Addresses");
    if (!addrSheet) return "[]";
    const aData = addrSheet.getDataRange().getValues();
    const aArr = [];
    for (let r = 1; r < aData.length; r++) {
      aArr.push({
        l1: String(aData[r][0] || ""),
        l2: String(aData[r][1] || ""),
        city: String(aData[r][2] || ""),
        state: String(aData[r][3] || ""),
        pin: String(aData[r][4] || "")
      });
    }
    return JSON.stringify(aArr);
  } catch (e) {
    return "[]";
  }
}

function seedDefaultSettings_() {
  const defaults = {
    storeName: STORE_NAME,
    storeUrl: STORE_URL,
    logoUrl: LOGO_URL,
    currency: "INR",
    currencySymbol: "₹",
    taxPercent: "0",
    shippingFlat: "0",
    freeShippingMin: "0",
    codFee: "0",
    codGlobalEnabled: "true",
    maintenanceMode: "false",
    supportEmail: "",
    userTypes: JSON.stringify(USER_TYPES_DEFAULT),
    reviewMediaEnabled: "true",
    productMediaEnabled: "true",
    lowStockThreshold: String(LOW_STOCK_THRESHOLD_DEFAULT),
    allowGuestCheckout: "false",
    cancelPendingHours: "24",
    reviewsRequireApproval: "true",
    maxQtyPerItem: "10",
    includeDescendantsInParent: "true",
    showOutOfStock: "true",
    allowParentCategoryProducts: "true",
    personalizeByUserType: "true"
  };
  Object.keys(defaults).forEach(k => {
    if (getSetting_(k) === null) setSetting_(k, defaults[k]);
  });
}

/**
 * STORE SETTINGS — every feature is admin-controlled
 */

function getSetting_(key) {
  const sheet = getMasterDB().getSheetByName("Settings");
  if (!sheet) return null;
  const found = findRowByColumn_(sheet, "Key", key);
  if (found.rowIndex < 0) return null;
  return found.row[col_(found.headers, "Value")];
}

function setSetting_(key, value) {
  const sheet = getMasterDB().getSheetByName("Settings");
  const found = findRowByColumn_(sheet, "Key", key);
  if (found.rowIndex < 0) {
    appendRowByHeaders_(sheet, { Key: key, Value: value });
  } else {
    sheet.getRange(found.rowIndex, col_(found.headers, "Value") + 1).setValue(value);
  }
}

function getAllSettings_() {
  const sheet = getMasterDB().getSheetByName("Settings");
  const map = {};
  rowsAsObjects_(sheet).forEach(r => { map[r.Key] = r.Value; });
  return map;
}

function getPublicStoreConfig() {
  const all = getAllSettings_();
  const pub = {
    status: "success",
    rzpKey: getRazorpayKeyId_(),
    storeName: all.storeName || STORE_NAME,
    logoUrl: all.logoUrl || LOGO_URL
  };
  PUBLIC_SETTINGS_KEYS.forEach(k => { if (all[k] !== undefined) pub[k] = all[k]; });
  pub.userTypes = publicUserTypes_();
  pub.personalizeByUserType = toBool_(all.personalizeByUserType, true);
  pub.codGlobalEnabled = toBool_(all.codGlobalEnabled, true);
  pub.maintenanceMode = toBool_(all.maintenanceMode, false);
  pub.reviewMediaEnabled = toBool_(all.reviewMediaEnabled, true);
  pub.includeDescendantsInParent = toBool_(all.includeDescendantsInParent, true);
  pub.allowParentCategoryProducts = toBool_(all.allowParentCategoryProducts, true);
  pub.showOutOfStock = toBool_(all.showOutOfStock, true);
  return pub;
}

function adminGetSettings(data) {
  const auth = requireAdmin_(data);
  if (auth.error) return auth.error;
  return ok_({ settings: getAllSettings_() });
}

function adminUpdateSettings(data) {
  const auth = requireAdmin_(data);
  if (auth.error) return auth.error;
  const payload = data.settings || data.payload || {};
  Object.keys(payload).forEach(k => {
    if (k === "action" || k === "token" || k === "sessionToken") return;
    setSetting_(k, payload[k]);
  });
  audit_(auth.user.Email, "Admin", "UPDATE_SETTINGS", "Settings", payload);
  return ok_({ settings: getAllSettings_() });
}

function isMaintenance_() {
  return toBool_(getSetting_("maintenanceMode"), false);
}

/**
 * AUTH TOKENS, RATE LIMITS, AUDIT, LOCKS
 */

function hashToken_(token) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token)
    .map(b => ("0" + (b & 0xff).toString(16)).slice(-2))
    .join("");
}

function randomToken_() {
  return Utilities.getUuid() + Utilities.getUuid().replace(/-/g, "");
}

function checkAppToken_(provided) {
  return safeString_(provided) !== "" && safeString_(provided) === getAppToken_();
}

function rateLimit_(key, max, windowSeconds) {
  const cache = CacheService.getScriptCache();
  const stampKey = "rl_" + key;
  const raw = cache.get(stampKey);
  let hits = raw ? parseInt(raw, 10) : 0;
  if (hits >= max) return false;
  cache.put(stampKey, String(hits + 1), windowSeconds);
  return true;
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return fn();
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function createSession_(user, device, isAdmin) {
  const token = randomToken_();
  const ttl = isAdmin ? ADMIN_SESSION_TTL_MS : SESSION_TTL_MS;
  const expires = new Date(now_().getTime() + ttl);
  const sheet = getMasterDB().getSheetByName("Sessions");
  appendRowByHeaders_(sheet, {
    TokenHash: hashToken_(token),
    Email: lower_(user.Email),
    UserID: user.UserID,
    Role: user.Role || "Customer",
    ExpiresAt: expires,
    CreatedAt: now_(),
    Device: device || "Browser"
  });
  purgeExpiredSessions_();
  return { sessionToken: token, expiresAt: iso_(expires), role: user.Role || "Customer" };
}

function resolveSession_(sessionToken) {
  if (!sessionToken) return null;
  const hash = hashToken_(sessionToken);
  const sheet = getMasterDB().getSheetByName("Sessions");
  if (!sheet) return null;
  const found = findRowByColumn_(sheet, "TokenHash", hash);
  if (found.rowIndex < 0) return null;
  const headers = found.headers;
  const expires = found.row[col_(headers, "ExpiresAt")];
  if (expires && new Date(expires).getTime() < now_().getTime()) {
    sheet.deleteRow(found.rowIndex);
    return null;
  }
  return {
    email: found.row[col_(headers, "Email")],
    userId: found.row[col_(headers, "UserID")],
    role: found.row[col_(headers, "Role")] || "Customer",
    rowIndex: found.rowIndex
  };
}

function destroySession_(sessionToken) {
  if (!sessionToken) return;
  const hash = hashToken_(sessionToken);
  const sheet = getMasterDB().getSheetByName("Sessions");
  const found = findRowByColumn_(sheet, "TokenHash", hash);
  if (found.rowIndex > 0) sheet.deleteRow(found.rowIndex);
}

function purgeExpiredSessions_() {
  const sheet = getMasterDB().getSheetByName("Sessions");
  if (!sheet || sheet.getLastRow() < 2) return;
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const expCol = col_(headers, "ExpiresAt");
  const nowMs = now_().getTime();
  for (let i = data.length - 1; i >= 1; i--) {
    const exp = data[i][expCol];
    if (exp && new Date(exp).getTime() < nowMs) sheet.deleteRow(i + 1);
  }
}

function requireUser_(data) {
  data = data || {};
  const session = resolveSession_(data.sessionToken);
  if (!session) return { error: error_("Please log in again.", { code: "UNAUTHENTICATED" }) };
  const users = getMasterDB().getSheetByName("Users");
  const rowIndex = findRowIndexByEmailCaseInsensitive(session.email, users);
  if (rowIndex < 0) return { error: error_("Account not found.", { code: "UNAUTHENTICATED" }) };
  const headers = sheetHeaders_(users);
  const row = users.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
  const status = row[col_(headers, "Status")];
  if (status !== "Active") return { error: error_("Account is not active.", { code: "FORBIDDEN" }) };
  const user = {};
  headers.forEach((h, i) => user[h] = row[i]);
  user._row = rowIndex;
  user.Role = user.Role || session.role || "Customer";
  return { user: user, session: session };
}

function requireAdmin_(data) {
  const adminKey = cfg_("ADMIN_API_KEY", "");
  if (adminKey && data && safeString_(data.adminKey) === adminKey) {
    return { user: { Email: "api-admin", Role: "Admin", UserID: "API" }, session: { role: "Admin" } };
  }
  const auth = requireUser_(data);
  if (auth.error) return auth;
  if (lower_(auth.user.Role) !== "admin") {
    return { error: error_("Admin access required.", { code: "FORBIDDEN" }) };
  }
  return auth;
}

function audit_(actorEmail, actorRole, action, target, details) {
  try {
    const sheet = getMasterDB().getSheetByName("AuditLog");
    appendRowByHeaders_(sheet, {
      LogID: uid_("AUD"),
      ActorEmail: actorEmail || "",
      ActorRole: actorRole || "",
      Action: action || "",
      Target: target || "",
      Details: typeof details === "string" ? details : JSON.stringify(details || {}),
      Date: now_()
    });
  } catch (e) {}
}

function createSecurityLog(userId, email, device, action) {
  try {
    const folderId = PropertiesService.getScriptProperties().getProperty("SECURITY_LOGS_ID");
    if (!folderId) return;
    const folder = DriveApp.getFolderById(folderId);
    const logName = (userId || "UNKNOWN") + "_Security_Log";
    const files = folder.getFilesByName(logName);
    let doc;
    if (files.hasNext()) {
      doc = DocumentApp.openById(files.next().getId());
    } else {
      doc = DocumentApp.create(logName);
      DriveApp.getFileById(doc.getId()).moveTo(folder);
    }
    doc.getBody().appendParagraph(
      "[" + iso_(now_()) + "] Action: " + action + " | Device: " + (device || "Unknown") + " | Email: " + (email || "")
    );
  } catch (e) {}
}

function assertSafeSheet_(sheetName) {
  return ADMIN_ONLY_SHEETS.indexOf(sheetName) !== -1;
}

function bootstrapAdmin() {
  const email = cfg_("ADMIN_BOOTSTRAP_EMAIL", Session.getEffectiveUser().getEmail());
  if (!email) throw new Error("Set ADMIN_BOOTSTRAP_EMAIL or run as a Google user.");
  ensureSchema();
  const sheet = getMasterDB().getSheetByName("Users");
  let rowIndex = findRowIndexByEmailCaseInsensitive(email, sheet);
  if (rowIndex < 0) {
    appendRowByHeaders_(sheet, {
      UserID: uid_("ADM"),
      Name: "Store Admin",
      Email: lower_(email),
      Phone: "",
      UserType: "",
      Role: "Admin",
      Status: "Active",
      Visits: 0,
      Device: "Setup",
      UpdateCount: 0,
      Month: "",
      CreatedAt: now_(),
      MarketingOptIn: true
    });
  } else {
    const headers = sheetHeaders_(sheet);
    sheet.getRange(rowIndex, col_(headers, "Role") + 1).setValue("Admin");
    sheet.getRange(rowIndex, col_(headers, "Status") + 1).setValue("Active");
  }
  audit_(email, "Admin", "BOOTSTRAP_ADMIN", email, {});
  return ok_({ message: "Admin ready for " + email });
}
