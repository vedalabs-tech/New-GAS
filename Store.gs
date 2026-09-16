/**
 * CART, COUPONS, CHECKOUT, ORDERS
 */

function getCart(email) {
  const sheet = getMasterDB().getSheetByName("Carts");
  if (!sheet) return ok_({ cart: "[]" });
  const found = findRowByColumn_(sheet, "Email", lower_(email));
  if (found.rowIndex < 0) return ok_({ cart: "[]" });
  return ok_({ cart: found.row[col_(found.headers, "CartJSON")] || "[]" });
}

function syncCart(email, cartItemsJSON) {
  const sheet = getMasterDB().getSheetByName("Carts");
  const payload = typeof cartItemsJSON === "string" ? cartItemsJSON : JSON.stringify(cartItemsJSON || []);
  const found = findRowByColumn_(sheet, "Email", lower_(email));
  if (found.rowIndex > 0) {
    writeRowByHeaders_(sheet, found.rowIndex, { CartJSON: payload, UpdatedAt: now_() });
  } else {
    appendRowByHeaders_(sheet, { Email: lower_(email), CartJSON: payload, UpdatedAt: now_() });
  }
  return ok_();
}

function getOrderHistory(email) {
  return rowsAsObjects_(getMasterDB().getSheetByName("Orders"))
    .filter(row => lower_(row.Email) === lower_(email))
    .map(stripInternal_);
}

function parseCartItems_(raw) {
  const parsed = parseJson_(raw, []);
  if (!Array.isArray(parsed)) return [];
  return parsed.map(it => ({
    id: it.id || it.ID || it.productId,
    qty: Math.max(1, toNumber_(it.qty || it.quantity, 1)),
    name: it.name || ""
  })).filter(it => it.id);
}

function quoteCart_(items, couponCode) {
  const productSheet = getMasterDB().getSheetByName("Products");
  const at = now_();
  const settings = getAllSettings_();
  const maxQty = toNumber_(settings.maxQtyPerItem, 10);
  const lines = [];
  let subtotal = 0;
  let tax = 0;
  let allowsCod = toBool_(settings.codGlobalEnabled, true);
  const defaultTax = toNumber_(settings.taxPercent, 0);

  for (let i = 0; i < items.length; i++) {
    const found = findRowByColumn_(productSheet, "ID", items[i].id);
    if (found.rowIndex < 0) return { error: "Product " + items[i].id + " was not found." };
    const p = {};
    found.headers.forEach((h, idx) => p[h] = found.row[idx]);
    if (!productIsVisibleToCustomer_(p, at)) return { error: p.Name + " is not available yet." };
    const stock = toNumber_(p.Stock, 0);
    const qty = Math.min(items[i].qty, maxQty);
    if (qty > stock) return { error: p.Name + " only has " + stock + " in stock." };
    const unit = toNumber_(p.Price, 0);
    const line = unit * qty;
    const lineTaxPct = p.TaxPercent === "" || p.TaxPercent === null ? defaultTax : toNumber_(p.TaxPercent, 0);
    subtotal += line;
    tax += line * (lineTaxPct / 100);
    if (!toBool_(p.CODEnabled, true)) allowsCod = false;
    lines.push({ id: p.ID, name: p.Name, qty: qty, price: unit, lineTotal: line });
  }

  let discount = 0;
  let coupon = null;
  let couponRowIndex = -1;
  if (couponCode) {
    const applied = applyCouponValue_(couponCode, subtotal);
    if (applied.error) return applied;
    discount = applied.discount;
    coupon = applied.coupon;
    couponRowIndex = applied.rowIndex;
  }

  const shippingFlat = toNumber_(settings.shippingFlat, 0);
  const freeMin = toNumber_(settings.freeShippingMin, 0);
  const shipping = (freeMin > 0 && (subtotal - discount) >= freeMin) ? 0 : shippingFlat;
  const amount = Math.max(0, Math.round((subtotal + tax + shipping - discount) * 100) / 100);
  return { lines: lines, subtotal: subtotal, tax: tax, shipping: shipping, discount: discount, amount: amount, allowsCod: allowsCod, coupon: coupon, rowIndex: couponRowIndex };
}

function applyCouponValue_(code, subtotal) {
  const sheet = getMasterDB().getSheetByName("Coupons");
  const found = findRowByColumn_(sheet, "Code", safeString_(code).toUpperCase());
  if (found.rowIndex < 0) return { error: "Invalid coupon." };
  const c = {};
  found.headers.forEach((h, i) => c[h] = found.row[i]);
  if (safeString_(c.Status) !== "Active") return { error: "Coupon is not active." };
  if (c.ExpiresAt && new Date(c.ExpiresAt).getTime() < now_().getTime()) return { error: "Coupon has expired." };
  if (toNumber_(c.MaxUses, 0) > 0 && toNumber_(c.UsedCount, 0) >= toNumber_(c.MaxUses, 0)) return { error: "Coupon usage limit reached." };
  if (subtotal < toNumber_(c.MinOrder, 0)) return { error: "Minimum order for this coupon is " + c.MinOrder + "." };
  let discount = 0;
  if (lower_(c.Type) === "percent") discount = subtotal * (toNumber_(c.Value, 0) / 100);
  else discount = toNumber_(c.Value, 0);
  discount = Math.min(discount, subtotal);
  return { discount: discount, coupon: c, rowIndex: found.rowIndex };
}

function previewOrder(data) {
  const auth = requireUser_(data);
  if (auth.error) return auth.error;
  const items = parseCartItems_(data.items || data.cartItems);
  if (!items.length) return error_("Cart is empty.");
  const quote = quoteCart_(items, data.couponCode);
  if (quote.error) return error_(quote.error);
  return ok_(quote);
}

function processOrder(orderData) {
  if (isMaintenance_()) return error_("The store is temporarily closed for maintenance.");
  return withLock_(function() {
    const email = lower_(orderData.email);
    const items = parseCartItems_(orderData.items || orderData.cartItems || orderData.Items);
    if (!items.length) return error_("Cart is empty.");
    const quote = quoteCart_(items, orderData.couponCode);
    if (quote.error) return error_(quote.error);

    const clientAmount = toNumber_(orderData.amount, quote.amount);
    if (Math.abs(clientAmount - quote.amount) > 1) {
      return error_("Order total changed. Refresh and try again.", { expected: quote.amount });
    }

    const method = safeString_(orderData.paymentMethod || orderData.PaymentMethod || (orderData.razorpayId === "COD" ? "COD" : "Razorpay"));
    const isCod = lower_(method) === "cod" || safeString_(orderData.razorpayId) === "COD";
    if (isCod) {
      if (!toBool_(getSetting_("codGlobalEnabled"), true)) return error_("Cash on Delivery is disabled.");
      if (!quote.allowsCod) return error_("Cash on Delivery is not available for one or more items in this cart.");
    } else {
      const verified = verifyRazorpayPayment_(orderData.razorpayId, quote.amount);
      if (!verified.ok) return error_(verified.message);
    }

    const orderId = "ORD-" + Date.now();
    const db = getMasterDB();
    const orderSheet = db.getSheetByName("Orders");
    const userSheet = db.getSheetByName("Users");
    const userRow = findRowIndexByEmailCaseInsensitive(email, userSheet);
    let userId = "";
    let phone = orderData.phone || "";
    if (userRow > 0) {
      const uh = sheetHeaders_(userSheet);
      userId = userSheet.getRange(userRow, col_(uh, "UserID") + 1).getValue();
      if (!phone) phone = userSheet.getRange(userRow, col_(uh, "Phone") + 1).getValue();
    }

    const summary = quote.lines.map(l => l.name + " x" + l.qty).join("; ");
    appendRowByHeaders_(orderSheet, {
      Order_ID: orderId,
      Email: email,
      UserID: userId,
      Items: orderData.items && typeof orderData.items === "string" ? orderData.items : summary,
      ItemsJSON: JSON.stringify(quote.lines),
      Amount: quote.amount,
      Subtotal: quote.subtotal,
      Tax: quote.tax,
      Shipping: quote.shipping,
      Discount: quote.discount,
      CouponCode: orderData.couponCode || "",
      PaymentMethod: isCod ? "COD" : "Razorpay",
      Razorpay_ID: isCod ? "COD" : orderData.razorpayId,
      COD: isCod,
      Status: isCod ? "Pending" : "Confirmed",
      Date: now_(),
      Delivery_Address: orderData.Delivery_Address || orderData.address || "",
      Phone: phone,
      Notes: orderData.notes || "",
      UpdatedAt: now_()
    });

    decrementStockForItems_(quote.lines, orderId);
    if (quote.coupon) {
      const couponSheet = db.getSheetByName("Coupons");
      const used = toNumber_(quote.coupon.UsedCount, 0) + 1;
      writeRowByHeaders_(couponSheet, quote.rowIndex, { UsedCount: used });
      appendRowByHeaders_(db.getSheetByName("CouponRedemptions"), {
        Code: quote.coupon.Code, Email: email, Order_ID: orderId, Date: now_()
      });
    }

    syncCart(email, "[]");

    if (userRow > 0) {
      const uh = sheetHeaders_(userSheet);
      const vaultId = userSheet.getRange(userRow, col_(uh, "VaultID") + 1).getValue();
      if (vaultId) {
        try {
          SpreadsheetApp.openById(vaultId).getSheetByName("Profile_And_Orders")
            .appendRow([orderId, summary, quote.amount, now_().toLocaleDateString(), isCod ? "Pending" : "Confirmed"]);
        } catch (e) {}
      }
    }

    SpreadsheetApp.flush();
    sendOrderReceivedEmail({
      email: email,
      amount: quote.amount,
      razorpayId: isCod ? "Cash on Delivery" : orderData.razorpayId,
      Delivery_Address: orderData.Delivery_Address || orderData.address || "Default Profile Address",
      paymentMethod: isCod ? "Cash on Delivery" : "Online"
    }, orderId);
    return ok_({ orderId: orderId, amount: quote.amount, status: isCod ? "Pending" : "Confirmed" });
  });
}

function verifyRazorpayPayment_(paymentId, expectedAmount) {
  if (!paymentId) return { ok: false, message: "Missing payment id." };
  const secret = getRazorpayKeySecret_();
  const keyId = getRazorpayKeyId_();
  if (!secret) return { ok: false, message: "Payment verification is not configured. Set RAZORPAY_KEY_SECRET in Script Properties." };
  try {
    const auth = Utilities.base64Encode(keyId + ":" + secret);
    const response = UrlFetchApp.fetch("https://api.razorpay.com/v1/payments/" + encodeURIComponent(paymentId), {
      method: "get",
      headers: { Authorization: "Basic " + auth },
      muteHttpExceptions: true
    });
    const resCode = response.getResponseCode();
    const rzpData = parseJson_(response.getContentText(), {});
    if (resCode !== 200 || (rzpData.status !== "captured" && rzpData.status !== "authorized")) {
      return { ok: false, message: "Payment verification failed or payment not captured." };
    }
    if (rzpData.amount && expectedAmount) {
      const paidMajor = Number(rzpData.amount) / 100;
      if (Math.abs(paidMajor - Number(expectedAmount)) > 1) {
        return { ok: false, message: "Paid amount does not match order total." };
      }
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, message: "Payment verification error." };
  }
}

function updateOrderStatusAndAlert(orderId, newStatus) {
  return adminUpdateOrderStatus({ orderId: orderId, status: newStatus, _legacy: true });
}

function adminUpdateOrderStatus(data) {
  if (!data._legacy) {
    const auth = requireAdmin_(data);
    if (auth.error) return auth.error;
  }
  const status = safeString_(data.status || data.newStatus);
  if (ORDER_STATUSES.indexOf(status) === -1) return error_("Invalid order status.");
  const sheet = getMasterDB().getSheetByName("Orders");
  const found = findRowByColumn_(sheet, "Order_ID", data.orderId);
  if (found.rowIndex < 0) return error_("Order not found.");
  const previous = safeString_(found.row[col_(found.headers, "Status")]);
  writeRowByHeaders_(sheet, found.rowIndex, { Status: status, UpdatedAt: now_(), AdminNotes: data.adminNotes || found.row[col_(found.headers, "AdminNotes")] || "" });
  const items = parseJson_(found.row[col_(found.headers, "ItemsJSON")], []);
  if ((status === "Cancelled" || status === "Refunded") && previous !== "Cancelled" && previous !== "Refunded") {
    restoreStockForItems_(items, data.orderId);
  }
  const email = found.row[col_(found.headers, "Email")];
  if (status === "Delivered") sendOrderDeliveredEmail(email, data.orderId);
  if (status === "Shipped") sendOrderShippedEmail_(email, data.orderId, data.tracking || "");
  if (status === "Cancelled") sendOrderCancelledEmail_(email, data.orderId);
  SpreadsheetApp.flush();
  return ok_({ message: "Order updated to " + status });
}

function cancelMyOrder(data) {
  const auth = requireUser_(data);
  if (auth.error) return auth.error;
  const sheet = getMasterDB().getSheetByName("Orders");
  const found = findRowByColumn_(sheet, "Order_ID", data.orderId);
  if (found.rowIndex < 0) return error_("Order not found.");
  if (lower_(found.row[col_(found.headers, "Email")]) !== lower_(auth.user.Email)) {
    return error_("You cannot cancel this order.");
  }
  const status = safeString_(found.row[col_(found.headers, "Status")]);
  if (["Shipped", "Delivered", "Cancelled", "Refunded"].indexOf(status) > -1) {
    return error_("This order can no longer be cancelled.");
  }
  const hours = toNumber_(getSetting_("cancelPendingHours"), 24);
  const created = new Date(found.row[col_(found.headers, "Date")]);
  if ((now_().getTime() - created.getTime()) > hours * 3600000 && status !== "Pending") {
    return error_("Cancellation window has closed. Contact support.");
  }
  return adminUpdateOrderStatus({ orderId: data.orderId, status: "Cancelled", _legacy: true });
}

function addToWaitlist(email, productId) {
  appendRowByHeaders_(getMasterDB().getSheetByName("Waitlist"), {
    ProductID: productId, Email: lower_(email), Date: now_()
  });
  return ok_();
}

function toggleWishlist(data) {
  const auth = requireUser_(data);
  if (auth.error) return auth.error;
  const sheet = getMasterDB().getSheetByName("Wishlist");
  const rows = rowsAsObjects_(sheet);
  const existing = rows.filter(r => lower_(r.Email) === lower_(auth.user.Email) && String(r.ProductID) === String(data.productId))[0];
  if (existing) {
    sheet.deleteRow(existing._row);
    return ok_({ wishlisted: false });
  }
  appendRowByHeaders_(sheet, { Email: lower_(auth.user.Email), ProductID: data.productId, Date: now_() });
  return ok_({ wishlisted: true });
}

function getWishlist(data) {
  const auth = requireUser_(data);
  if (auth.error) return auth.error;
  const ids = rowsAsObjects_(getMasterDB().getSheetByName("Wishlist"))
    .filter(r => lower_(r.Email) === lower_(auth.user.Email))
    .map(r => String(r.ProductID));
  const products = rowsAsObjects_(getMasterDB().getSheetByName("Products"))
    .filter(p => ids.indexOf(String(p.ID)) > -1)
    .map(p => decorateProduct_(p, false));
  return ok_({ products: products });
}

function adminSaveCoupon(data) {
  const auth = requireAdmin_(data);
  if (auth.error) return auth.error;
  const code = safeString_(data.code).toUpperCase();
  if (!code) return error_("Coupon code required.");
  const sheet = getMasterDB().getSheetByName("Coupons");
  const payload = {
    Code: code,
    Type: lower_(data.type) === "percent" ? "percent" : "fixed",
    Value: toNumber_(data.value, 0),
    MinOrder: toNumber_(data.minOrder, 0),
    MaxUses: toNumber_(data.maxUses, 0),
    UsedCount: toNumber_(data.usedCount, 0),
    ExpiresAt: data.expiresAt || "",
    Status: data.status || "Active",
    CreatedAt: now_()
  };
  const found = findRowByColumn_(sheet, "Code", code);
  if (found.rowIndex > 0) writeRowByHeaders_(sheet, found.rowIndex, payload);
  else appendRowByHeaders_(sheet, payload);
  audit_(auth.user.Email, "Admin", "SAVE_COUPON", code, payload);
  return ok_({ coupon: payload });
}

/**
 * REVIEWS + SUPPORT TICKETS
 */

function getReviewsPublic(productId) {
  const requireApproval = toBool_(getSetting_("reviewsRequireApproval"), true);
  return rowsAsObjects_(getMasterDB().getSheetByName("Reviews"))
    .filter(r => {
      if (productId && String(r.ProductID) !== String(productId)) return false;
      if (requireApproval && safeString_(r.Status) !== "Approved") return false;
      return true;
    })
    .map(r => ({
      reviewId: r.ReviewID,
      productId: r.ProductID,
      userName: r.UserName,
      rating: toNumber_(r.Rating, 0),
      comment: r.Comment,
      media: parseJson_(r.Media_JSON, []),
      date: r.Date,
      adminReply: r.AdminReply || ""
    }));
}

function addReview(reviewData) {
  const email = lower_(reviewData.email);
  if (reviewData.sessionToken) {
    const auth = requireUser_(reviewData);
    if (auth.error) return auth.error;
  }
  const rating = toNumber_(reviewData.rating, 0);
  if (rating < 1 || rating > 5) return error_("Rating must be between 1 and 5.");
  const media = reviewData.media || parseJson_(reviewData.Media_JSON, []);
  if (media.length > MAX_REVIEW_MEDIA) return error_("Too many review attachments.");
  const approved = toBool_(getSetting_("reviewsRequireApproval"), true) ? "Pending" : "Approved";
  const reviewId = uid_("REV");
  appendRowByHeaders_(getMasterDB().getSheetByName("Reviews"), {
    ReviewID: reviewId,
    ProductID: reviewData.productId,
    Email: email,
    UserName: reviewData.userName || "Customer",
    Rating: rating,
    Comment: safeString_(reviewData.comment),
    Media_JSON: JSON.stringify(media),
    Status: approved,
    Date: now_(),
    AdminReply: ""
  });
  return ok_({
    message: approved === "Pending" ? "Review submitted for admin approval." : "Review published.",
    reviewId: reviewId,
    status: approved
  });
}

function adminModerateReview(data) {
  const auth = requireAdmin_(data);
  if (auth.error) return auth.error;
  const sheet = getMasterDB().getSheetByName("Reviews");
  const found = findRowByColumn_(sheet, "ReviewID", data.reviewId);
  if (found.rowIndex < 0) return error_("Review not found.");
  const status = safeString_(data.reviewStatus || data.status);
  if (["Approved", "Rejected", "Hidden"].indexOf(status) === -1) return error_("Invalid review status.");
  writeRowByHeaders_(sheet, found.rowIndex, { Status: status, AdminReply: data.adminReply || found.row[col_(found.headers, "AdminReply")] || "" });
  audit_(auth.user.Email, "Admin", "MODERATE_REVIEW", data.reviewId, { status: status });
  return ok_({ message: "Review " + status + "." });
}

function createTicket(data) {
  const auth = requireUser_(data);
  if (auth.error) return auth.error;
  const id = uid_("TCK");
  appendRowByHeaders_(getMasterDB().getSheetByName("Tickets"), {
    TicketID: id,
    Email: lower_(auth.user.Email),
    Subject: safeString_(data.subject) || "Support",
    Message: safeString_(data.message),
    Status: "Open",
    AdminReply: "",
    Date: now_(),
    UpdatedAt: now_()
  });
  return ok_({ ticketId: id });
}

function adminReplyTicket(data) {
  const auth = requireAdmin_(data);
  if (auth.error) return auth.error;
  const sheet = getMasterDB().getSheetByName("Tickets");
  const found = findRowByColumn_(sheet, "TicketID", data.ticketId);
  if (found.rowIndex < 0) return error_("Ticket not found.");
  writeRowByHeaders_(sheet, found.rowIndex, {
    AdminReply: data.replyText,
    Status: data.ticketStatus || "Replied",
    UpdatedAt: now_()
  });
  const email = found.row[col_(found.headers, "Email")];
  sendAdminReply(email, data.replyText);
  return ok_();
}
