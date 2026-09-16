/**
 * HTTP ENTRY — JSON API ONLY
 * No HTML. Customer and admin apps call doGet / doPost.
 */

function doGet(e) {
  e = e || {};
  const params = e.parameter || {};
  if (!checkAppToken_(params.token)) return jsonResponse_(error_("Access denied."));
  try {
    return jsonResponse_(dispatch_("GET", params.action, params));
  } catch (err) {
    return jsonResponse_(error_(err.message || "Server error."));
  }
}

function doPost(e) {
  if (!e || !e.postData || !e.postData.contents) return jsonResponse_(error_("No data received."));
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse_(error_("Invalid JSON body."));
  }
  if (!checkAppToken_(data.token)) return jsonResponse_(error_("Access denied."));
  try {
    return jsonResponse_(dispatch_("POST", data.action, data));
  } catch (err) {
    return jsonResponse_(error_(err.message || "Server error."));
  }
}

function dispatch_(method, action, data) {
  data = data || {};
  switch (action) {
    case "getStoreConfig": return getPublicStoreConfig();
    case "getUserTypes": return getUserTypesPublic();
    case "getProducts": return listProducts_({
      categoryId: data.categoryId,
      query: data.query,
      sort: data.sort,
      includeDescendants: data.includeDescendants,
      userType: personTypeFromRequest_(data)
    });
    case "getCatalog": return getCatalog(data);
    case "searchProducts": return searchProducts(data);
    case "getProduct": return getProductPublic(data.productId || data.id);
    case "getCategories": return getCategoriesPublic();
    case "getReviews": return data.productId ? getReviewsPublic(data.productId) : getReviewsPublic();
    case "getOrderHistory": return getOrderHistory(data.email);
    case "getCart": return getCart(data.email);
    case "getMe": return getMe(data);
    case "getWishlist": return getWishlist(data);

    case "requestRegisterOTP": return requestRegisterOTP(data.name, data.email, data.phone, data.userType);
    case "verifyRegisterOTP": return verifyRegisterOTP(data.email, data.otp, data.deviceInfo);
    case "requestLoginOTP": return requestLoginOTP(data.email);
    case "verifyLoginOTP": return verifyLoginOTP(data.email, data.otp, data.deviceInfo);
    case "logout": return logoutUser(data);
    case "updateProfile": return updateSecureProfile(data);
    case "placeOrder": return processOrder(data);
    case "previewOrder": return previewOrder(data);
    case "syncCart": return syncCart(data.email, data.cartItems);
    case "addWaitlist": return addToWaitlist(data.email, data.productId);
    case "addReview": return addReview(data);
    case "toggleWishlist": return toggleWishlist(data);
    case "cancelMyOrder": return cancelMyOrder(data);
    case "createTicket": return createTicket(data);
    case "logActivity": return logActivity(data.email, data.activityType, data.details);
    case "uploadImage": return uploadImageWithFallback(data.base64, data.filename, data.mimeType);
    case "uploadMedia": return uploadMedia(data);

    case "adminGetUserTypes": return adminGetUserTypes(data);
    case "adminSaveUserType": return adminSaveUserType(data);
    case "adminDeleteUserType": return adminDeleteUserType(data);
    case "adminGetSettings": return adminGetSettings(data);
    case "adminUpdateSettings": return adminUpdateSettings(data);
    case "adminGetProducts": return adminGetProducts(data);
    case "adminListProducts": return adminListProducts(data);
    case "adminCategoryOptions": return adminCategoryOptions(data);
    case "adminMoveProducts": return adminMoveProducts(data);
    case "adminBulkProducts": return adminBulkProducts(data);
    case "adminDuplicateProduct": return adminDuplicateProduct(data);
    case "adminSaveProduct": return adminSaveProduct(data);
    case "adminDeleteProduct": return adminDeleteProduct(data);
    case "adminToggleCod": return adminToggleCod(data);
    case "adminAdjustStock": return adminAdjustStock(data);
    case "adminScheduleProduct": return adminScheduleProduct(data);
    case "adminGetCategories": return adminGetCategories(data);
    case "adminSaveCategory": return adminSaveCategory(data);
    case "adminDeleteCategory": return adminDeleteCategory(data);
    case "adminArchiveCategory": return adminArchiveCategory(data);
    case "adminHideCategory": return adminHideCategory(data);
    case "adminRestoreCategory": return adminRestoreCategory(data);
    case "adminScheduleCategory": return adminScheduleCategory(data);
    case "adminUpdateOrderStatus": return adminUpdateOrderStatus(data);
    case "adminModerateReview": return adminModerateReview(data);
    case "adminReplyTicket": return adminReplyTicket(data);
    case "adminSetUserStatus": return adminSetUserStatus(data);
    case "adminSaveCoupon": return adminSaveCoupon(data);
    case "adminDeleteMedia": return adminDeleteMedia(data);
    case "updateOrderStatus": return adminUpdateOrderStatus(data);
    case "deleteCategory": return adminDeleteCategory(data);
    case "deleteProduct": return adminDeleteProduct(data);
    case "sendAdminReply": {
      const auth = requireAdmin_(data);
      if (auth.error) return auth.error;
      return sendAdminReply(data.email, data.replyText);
    }
    case "sendBulkPromo": {
      const auth = requireAdmin_(data);
      if (auth.error) return auth.error;
      return sendBulkPromo(data.title, data.message, data.bannerUrl);
    }
    case "readUniversal": {
      const auth = requireAdmin_(data);
      if (auth.error) return auth.error;
      if (!assertSafeSheet_(data.sheetName)) return error_("Unknown sheet.");
      return getUniversalData(data.sheetName);
    }
    case "universalWrite": {
      const auth = requireAdmin_(data);
      if (auth.error) return auth.error;
      if (!assertSafeSheet_(data.sheetName)) return error_("Unknown sheet.");
      return universalWrite(data.sheetName, data.rowData);
    }
    case "universalWriteDynamic": {
      const auth = requireAdmin_(data);
      if (auth.error) return auth.error;
      if (!assertSafeSheet_(data.sheetName)) return error_("Unknown sheet.");
      return universalWriteDynamic(data.sheetName, data.payload);
    }
    case "universalUpdate": {
      const auth = requireAdmin_(data);
      if (auth.error) return auth.error;
      if (!assertSafeSheet_(data.sheetName)) return error_("Unknown sheet.");
      return universalUpdate(data.sheetName, data.searchCol, data.searchValue, data.updateCol, data.updateValue);
    }
    default:
      return error_(method === "GET" ? "Invalid GET action" : "Invalid POST action");
  }
}

function universalWriteDynamic(sheetName, payloadObj) {
  const sheet = getOrCreateNamedSheet_(sheetName);
  appendRowByHeaders_(sheet, payloadObj || {});
  SpreadsheetApp.flush();
  return ok_();
}

function universalWrite(sheetName, rowDataArray) {
  const sheet = getOrCreateNamedSheet_(sheetName);
  sheet.appendRow(rowDataArray);
  SpreadsheetApp.flush();
  return ok_();
}

function universalUpdate(sheetName, searchColIndex, searchValue, updateColIndex, updateValue) {
  const sheet = getMasterDB().getSheetByName(sheetName);
  if (!sheet) return error_("Sheet not found.");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][searchColIndex] == searchValue) {
      sheet.getRange(i + 1, updateColIndex + 1).setValue(updateValue);
      SpreadsheetApp.flush();
      return ok_();
    }
  }
  return error_("Record not found.");
}

function getOrCreateNamedSheet_(sheetName) {
  let sheet = getMasterDB().getSheetByName(sheetName);
  if (!sheet) sheet = getMasterDB().insertSheet(sheetName);
  return sheet;
}

/** Optional in-editor test helper. Not used by HTTP. */
function dispatchAction(payload) {
  payload = payload || {};
  return dispatch_("POST", payload.action, payload);
}
