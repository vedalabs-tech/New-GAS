/**
 * REGISTRATION, LOGIN, PROFILE, ADDRESSES
 */

function requestRegisterOTP(name, email, phone, userType) {
  email = lower_(email);
  name = safeString_(name);
  phone = safeString_(phone);
  userType = safeString_(userType);

  if (!name || !email || email.indexOf("@") === -1) {
    return error_("Please provide a valid name and email.");
  }
  if (!rateLimit_("reg_" + email, OTP_MAX_REQUESTS_PER_WINDOW, Math.floor(OTP_WINDOW_MS / 1000))) {
    return error_("Too many OTP requests. Try again later.");
  }

  const types = allowedUserTypes_();
  if (!types.length) {
    return error_("The store admin has not created person types yet.");
  }
  if (!userType || types.indexOf(userType) === -1) {
    return error_("Choose a person type created by the admin: " + types.join(", "));
  }

  const sheet = getMasterDB().getSheetByName("Users");
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const emailCol = col_(headers, "Email");
  const phoneCol = col_(headers, "Phone");
  const statusCol = col_(headers, "Status");

  for (let i = 1; i < data.length; i++) {
    const dbEmail = lower_(data[i][emailCol]);
    const dbPhone = safeString_(data[i][phoneCol]);
    if (dbEmail === email || (phone && dbPhone && dbPhone === phone)) {
      if (String(data[i][statusCol]) === "Active") {
        return error_("This email or phone number is already registered. Please log in.");
      }
    }
  }

  const otp = generateOtp_();
  const existingRow = findRowIndexByEmailCaseInsensitive(email, sheet);
  if (existingRow > 0) {
    writeRowByHeaders_(sheet, existingRow, {
      Name: name,
      Phone: phone,
      UserType: userType,
      OTP: otp,
      OTPExpiry: new Date(now_().getTime() + OTP_TTL_MS),
      OTPAttempts: 0,
      OTPRequestedAt: now_(),
      Status: "Pending_OTP"
    });
  } else {
    appendRowByHeaders_(sheet, {
      UserID: uid_("USR"),
      Name: name,
      Email: email,
      Phone: phone,
      UserType: userType,
      Role: "Customer",
      OTP: otp,
      OTPExpiry: new Date(now_().getTime() + OTP_TTL_MS),
      OTPAttempts: 0,
      OTPRequestedAt: now_(),
      OTPRequestCount: 1,
      Status: "Pending_OTP",
      Visits: 0,
      Device: "Unknown",
      UpdateCount: 0,
      Month: "",
      CreatedAt: now_(),
      MarketingOptIn: true
    });
  }
  SpreadsheetApp.flush();
  sendOTPEmail(email, otp, "Registration");
  return ok_({ message: "Registration OTP sent successfully." });
}

function verifyRegisterOTP(email, otp, deviceInfo) {
  return consumeOtp_(email, otp, deviceInfo, true);
}

function requestLoginOTP(email) {
  email = lower_(email);
  if (!rateLimit_("login_" + email, OTP_MAX_REQUESTS_PER_WINDOW, Math.floor(OTP_WINDOW_MS / 1000))) {
    return error_("Too many OTP requests. Try again later.");
  }
  const sheet = getMasterDB().getSheetByName("Users");
  const rowIndex = findRowIndexByEmailCaseInsensitive(email, sheet);
  if (rowIndex < 0) return error_("Account not found! Please register first.");
  const headers = sheetHeaders_(sheet);
  const status = sheet.getRange(rowIndex, col_(headers, "Status") + 1).getValue();
  if (status === "Suspended" || status === "Banned") return error_("This account has been suspended.");
  if (status !== "Active") return error_("Account is not active. Complete registration first.");
  const otp = generateOtp_();
  writeRowByHeaders_(sheet, rowIndex, {
    OTP: otp,
    OTPExpiry: new Date(now_().getTime() + OTP_TTL_MS),
    OTPAttempts: 0,
    OTPRequestedAt: now_()
  });
  SpreadsheetApp.flush();
  sendOTPEmail(email, otp, "Login");
  return ok_({ message: "Login OTP sent successfully." });
}

function verifyLoginOTP(email, otp, deviceInfo) {
  return consumeOtp_(email, otp, deviceInfo, false);
}

function consumeOtp_(email, otp, deviceInfo, isRegister) {
  const sheet = getMasterDB().getSheetByName("Users");
  const rowIndex = findRowIndexByEmailCaseInsensitive(email, sheet);
  if (rowIndex < 0) return error_("Invalid OTP provided.");
  const headers = sheetHeaders_(sheet);
  const row = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
  const stored = otpDigits_(row[col_(headers, "OTP")]);
  const expiry = row[col_(headers, "OTPExpiry")];
  let attempts = toNumber_(row[col_(headers, "OTPAttempts")], 0);

  if (!stored) return error_("No OTP pending. Request a new code.");
  if (expiry && new Date(expiry).getTime() < now_().getTime()) {
    sheet.getRange(rowIndex, col_(headers, "OTP") + 1).clearContent();
    return error_("OTP expired. Request a new code.");
  }
  if (attempts >= OTP_MAX_ATTEMPTS) {
    return error_("Too many incorrect attempts. Request a new code.");
  }
  if (stored !== otpDigits_(otp)) {
    sheet.getRange(rowIndex, col_(headers, "OTPAttempts") + 1).setValue(attempts + 1);
    return error_("Invalid OTP provided.");
  }

  const userId = row[col_(headers, "UserID")] || uid_("USR");
  const name = row[col_(headers, "Name")];
  const phone = row[col_(headers, "Phone")];
  const role = row[col_(headers, "Role")] || "Customer";
  const userType = row[col_(headers, "UserType")] || "Individual";
  const visits = toNumber_(row[col_(headers, "Visits")], 0) + 1;

  const updates = {
    OTP: "",
    OTPAttempts: 0,
    Status: "Active",
    Visits: visits,
    Device: deviceInfo || "Browser",
    LastSeen: iso_(now_()),
    UserID: userId,
    Role: role
  };

  if (isRegister) {
    const vaultCol = col_(headers, "VaultID");
    const existingVault = vaultCol > -1 ? row[vaultCol] : "";
    if (!existingVault) {
      updates.VaultID = generateVisualCustomerVault(userId, name, lower_(email));
    }
  }

  writeRowByHeaders_(sheet, rowIndex, updates);
  SpreadsheetApp.flush();

  const user = {
    UserID: userId,
    Email: lower_(email),
    Role: role,
    Name: name,
    UserType: userType
  };
  const session = createSession_(user, deviceInfo, lower_(role) === "admin");
  try {
    audit_(lower_(email), role, isRegister ? "REGISTER" : "LOGIN", userId, { device: deviceInfo || "Browser" });
  } catch (e) {}
  queueAuthMail_({
    kind: isRegister ? "register" : "login",
    email: lower_(email),
    name: name,
    phone: phone,
    userId: userId,
    userType: userType,
    device: deviceInfo,
    visits: visits
  });

  return ok_({
    message: isRegister ? "Registration successful!" : "Login successful!",
    userId: userId,
    name: name,
    role: role,
    userType: userType,
    sessionToken: session.sessionToken,
    expiresAt: session.expiresAt
  });
}

function otpDigits_(value) {
  return safeString_(value).replace(/\.0+$/, "").replace(/\D/g, "");
}

function generateOtp_() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function logoutUser(data) {
  destroySession_(data.sessionToken);
  return ok_({ message: "Logged out." });
}

function getMe(data) {
  const auth = requireUser_(data);
  if (auth.error) return auth.error;
  const user = sanitizeUserRecord_(auth.user);
  return ok_({ user: user });
}

function updateSecureProfile(data) {
  const auth = requireUser_(data);
  if (auth.error) return auth.error;
  const sheet = getMasterDB().getSheetByName("Users");
  const rowIndex = auth.user._row;
  const headers = sheetHeaders_(sheet);
  const currentMonth = (now_().getMonth() + 1) + "-" + now_().getFullYear();
  let limitCount = toNumber_(auth.user.UpdateCount, 0);
  let limitMonth = safeString_(auth.user.Month);
  if (limitMonth !== currentMonth) {
    limitCount = 0;
    limitMonth = currentMonth;
  }
  if (limitCount >= PROFILE_UPDATES_PER_MONTH) {
    createSecurityLog(auth.user.UserID, auth.user.Email, "System", "Profile Update Blocked (Limit Reached)");
    return error_("You cannot update your profile more than " + PROFILE_UPDATES_PER_MONTH + " times a month.");
  }

  const allowed = ["Name", "Phone", "ProfilePic", "UserType", "MarketingOptIn"];
  const mapped = {};
  allowed.forEach(k => {
    const camel = k.charAt(0).toLowerCase() + k.slice(1);
    if (data[k] !== undefined) mapped[k] = data[k];
    else if (data[camel] !== undefined) mapped[k] = data[camel];
    else if (data[lower_(k)] !== undefined) mapped[k] = data[lower_(k)];
  });
  if (mapped.UserType && allowedUserTypes_().indexOf(mapped.UserType) === -1) {
    return error_("Invalid user type.");
  }

  const addressPayload = data.addressesJSON || data.address || data.Addresses_JSON || data.Addresses_JSON_Payload;
  writeRowByHeaders_(sheet, rowIndex, mapped);

  if (addressPayload) {
    let addrFileIdIndex = col_(headers, "AddressFileID");
    if (addrFileIdIndex === -1) {
      ensureColumns_(sheet, ["AddressFileID"]);
      headers.push("AddressFileID");
      addrFileIdIndex = headers.length - 1;
    }
    const currentAddrFileId = sheet.getRange(rowIndex, addrFileIdIndex + 1).getValue();
    const newName = mapped.Name || auth.user.Name;
    const newAddrFileId = saveDedicatedAddress(auth.user.UserID, newName, typeof addressPayload === "string" ? addressPayload : JSON.stringify(addressPayload), currentAddrFileId);
    if (currentAddrFileId !== newAddrFileId) {
      sheet.getRange(rowIndex, addrFileIdIndex + 1).setValue(newAddrFileId);
    }
  }

  writeRowByHeaders_(sheet, rowIndex, { UpdateCount: limitCount + 1, Month: currentMonth });
  SpreadsheetApp.flush();
  createSecurityLog(auth.user.UserID, auth.user.Email, "Browser", "Profile Updated");
  return ok_({ message: "Profile updated successfully.", count: limitCount + 1 });
}

function saveDedicatedAddress(userId, name, addressesJSON, currentAddressFileId) {
  const folderId = PropertiesService.getScriptProperties().getProperty("ADDRESS_VAULT_ID");
  const folder = folderId ? DriveApp.getFolderById(folderId) : DriveApp.getRootFolder();
  let fileId = currentAddressFileId;
  let sheet;
  if (!fileId) {
    const file = SpreadsheetApp.create("Addresses_" + name + "_" + userId);
    DriveApp.getFileById(file.getId()).moveTo(folder);
    fileId = file.getId();
    sheet = file.getActiveSheet();
    sheet.setName("Saved_Addresses");
    sheet.appendRow(["Line1", "Line2", "City", "State", "Pincode"]);
  } else {
    try {
      sheet = SpreadsheetApp.openById(fileId).getSheetByName("Saved_Addresses");
      if (!sheet) {
        sheet = SpreadsheetApp.openById(fileId).insertSheet("Saved_Addresses");
        sheet.appendRow(["Line1", "Line2", "City", "State", "Pincode"]);
      }
    } catch (e) {
      const file = SpreadsheetApp.create("Addresses_" + name + "_" + userId);
      DriveApp.getFileById(file.getId()).moveTo(folder);
      fileId = file.getId();
      sheet = file.getActiveSheet();
      sheet.setName("Saved_Addresses");
      sheet.appendRow(["Line1", "Line2", "City", "State", "Pincode"]);
    }
  }
  try {
    let addrs = parseJson_(addressesJSON, []);
    if (!Array.isArray(addrs)) addrs = [addrs];
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, 5).clearContent();
    if (addrs.length > 0) {
      const rowsToInsert = addrs.map(a => [a.l1 || a.line1 || "", a.l2 || a.line2 || "", a.city || "", a.state || "", a.pin || a.pincode || ""]);
      sheet.getRange(2, 1, rowsToInsert.length, 5).setValues(rowsToInsert);
    }
  } catch (e) {}
  SpreadsheetApp.flush();
  return fileId;
}

function generateVisualCustomerVault(userId, name, email) {
  const folder = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty("CUSTOMER_BASE_ID"));
  const vaultSheet = SpreadsheetApp.create(userId + "_Customer_Vault");
  DriveApp.getFileById(vaultSheet.getId()).moveTo(folder);
  const sheet = vaultSheet.getActiveSheet();
  sheet.setName("Profile_And_Orders");
  sheet.getRange("A1:E2").merge().setValue("OFFICIAL CUSTOMER VAULT").setBackground("#0f172a").setFontColor("#ffffff").setFontSize(16).setHorizontalAlignment("center");
  sheet.getRange("A4").setValue("Customer ID:").setFontWeight("bold");
  sheet.getRange("B4").setValue(userId);
  sheet.getRange("A5").setValue("Name:").setFontWeight("bold");
  sheet.getRange("B5").setValue(name);
  sheet.getRange("A6").setValue("Email:").setFontWeight("bold");
  sheet.getRange("B6").setValue(email);
  sheet.getRange("A9:E9").setValues([["Order ID", "Items", "Amount", "Date", "Status"]]).setBackground("#2563eb").setFontColor("#ffffff").setFontWeight("bold");
  return vaultSheet.getId();
}

function logActivity(email, type, details) {
  if (type !== "LastSeen") return ok_();
  const sheet = getMasterDB().getSheetByName("Users");
  const rowIndex = findRowIndexByEmailCaseInsensitive(email, sheet);
  if (rowIndex > 0) {
    const headers = sheetHeaders_(sheet);
    const i = col_(headers, "LastSeen");
    if (i > -1) sheet.getRange(rowIndex, i + 1).setValue(details || iso_(now_()));
  }
  return ok_();
}

function adminSetUserStatus(data) {
  const auth = requireAdmin_(data);
  if (auth.error) return auth.error;
  const sheet = getMasterDB().getSheetByName("Users");
  const rowIndex = findRowIndexByEmailCaseInsensitive(data.targetEmail || data.email, sheet);
  if (rowIndex < 0) return error_("User not found.");
  const allowed = ["Active", "Suspended", "Banned"];
  if (allowed.indexOf(data.userStatus || data.status) === -1) return error_("Invalid status.");
  const headers = sheetHeaders_(sheet);
  sheet.getRange(rowIndex, col_(headers, "Status") + 1).setValue(data.userStatus || data.status);
  if (data.role && ["Admin", "Customer", "Staff"].indexOf(data.role) > -1) {
    sheet.getRange(rowIndex, col_(headers, "Role") + 1).setValue(data.role);
  }
  audit_(auth.user.Email, "Admin", "SET_USER_STATUS", data.targetEmail || data.email, data);
  return ok_({ message: "User updated." });
}
