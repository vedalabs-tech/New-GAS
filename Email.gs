/**
 * TRANSACTIONAL EMAIL
 */

const EMAIL_STYLES = `
  body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6; padding: 20px; color: #1f2937; margin: 0; }
  .container { max-width: 600px; margin: 0 auto; background: #ffffff; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e5e7eb; }
  .header { text-align: center; padding: 32px 20px; background-color: #ffffff; border-bottom: 1px solid #e5e7eb; }
  .header img { max-width: 80px; }
  .content { padding: 32px 24px; line-height: 1.6; }
  .footer { text-align: center; padding: 24px; font-size: 13px; color: #6b7280; background-color: #f9fafb; border-top: 1px solid #e5e7eb; }
  .btn { display: inline-block; padding: 12px 24px; background-color: #0f172a; color: #ffffff; text-decoration: none; font-weight: 500; margin-top: 16px; }
  .highlight-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; margin: 20px 0; }
  h2 { color: #111827; font-size: 22px; font-weight: 600; margin-top: 0; margin-bottom: 16px; }
  p { margin: 0 0 16px 0; }
`;

function storeName_() {
  return getSetting_("storeName") || STORE_NAME;
}

function storeUrl_() {
  return getSetting_("storeUrl") || STORE_URL;
}

function logoUrl_() {
  return getSetting_("logoUrl") || LOGO_URL;
}

function buildEmailHtml(contentHtml) {
  return `
    <html>
      <head><style>${EMAIL_STYLES}</style></head>
      <body>
        <div class="container">
          <div class="header"><img src="${logoUrl_()}" alt="${storeName_()} Logo"></div>
          <div class="content">${contentHtml}</div>
          <div class="footer">&copy; ${new Date().getFullYear()} ${storeName_()}. All rights reserved.</div>
        </div>
      </body>
    </html>
  `;
}

function sendOrderReceivedEmail(orderData, orderId) {
  const content = `
    <h2>Order Received</h2>
    <p>We have received your order and are preparing it for shipment.</p>
    <div class="highlight-box">
      <p style="margin-bottom: 8px;"><strong>Order ID:</strong> ${orderId}</p>
      <p style="margin-bottom: 8px;"><strong>Total Amount:</strong> ₹${orderData.amount}</p>
      <p style="margin-bottom: 8px;"><strong>Payment:</strong> ${orderData.paymentMethod || orderData.razorpayId}</p>
      <p style="margin-bottom: 0;"><strong>Delivery Address:</strong> ${orderData.Delivery_Address || "Default Profile Address"}</p>
    </div>
    <p>Thank you for shopping with ${storeName_()}.</p>
  `;
  MailApp.sendEmail({ to: orderData.email, subject: `Order Confirmation #${orderId}`, htmlBody: buildEmailHtml(content) });
}

function sendOrderDeliveredEmail(email, orderId) {
  const content = `
    <h2>Order Delivered</h2>
    <p>Your order <strong>#${orderId}</strong> has been delivered.</p>
    <p>We would love a review with photos or a short video of your product.</p>
  `;
  MailApp.sendEmail({ to: email, subject: "Your order has been delivered", htmlBody: buildEmailHtml(content) });
}

function sendOrderShippedEmail_(email, orderId, tracking) {
  const content = `
    <h2>Order Shipped</h2>
    <p>Your order <strong>#${orderId}</strong> is on the way.</p>
    ${tracking ? `<p><strong>Tracking:</strong> ${tracking}</p>` : ""}
  `;
  MailApp.sendEmail({ to: email, subject: "Your order has shipped", htmlBody: buildEmailHtml(content) });
}

function sendOrderCancelledEmail_(email, orderId) {
  const content = `
    <h2>Order Cancelled</h2>
    <p>Order <strong>#${orderId}</strong> has been cancelled. If you paid online, a refund will be processed by the store admin.</p>
  `;
  MailApp.sendEmail({ to: email, subject: "Order cancelled #" + orderId, htmlBody: buildEmailHtml(content) });
}

function sendBackInStockEmail_(email, name) {
  const content = `
    <h2>Back in stock</h2>
    <p><strong>${name}</strong> is available again.</p>
    <div style="text-align:center"><a href="${storeUrl_()}" class="btn">Shop now</a></div>
  `;
  MailApp.sendEmail({ to: email, subject: name + " is back in stock", htmlBody: buildEmailHtml(content) });
}

function sendLowStockEmail_(productId, name, stock) {
  const admin = cfg_("ADMIN_BOOTSTRAP_EMAIL", Session.getEffectiveUser().getEmail());
  if (!admin) return;
  const content = `<h2>Low stock</h2><p>${name} (${productId}) is down to ${stock} units.</p>`;
  MailApp.sendEmail({ to: admin, subject: "Low stock: " + name, htmlBody: buildEmailHtml(content) });
}

function sendBulkPromoEmail(emailsBCC, title, message, bannerUrl) {
  const bannerHtml = bannerUrl ? `<img src="${bannerUrl}" style="width:100%; margin-bottom:24px;">` : "";
  const content = `
    ${bannerHtml}
    <h2>${title}</h2>
    <p style="font-size: 16px; color: #4b5563;">${message}</p>
    <div style="text-align: center; margin-top: 32px;">
      <a href="${storeUrl_()}" class="btn">Shop the Collection</a>
    </div>
  `;
  MailApp.sendEmail({ to: Session.getEffectiveUser().getEmail() || "no-reply@store.com", bcc: emailsBCC, subject: `Special Update: ${title}`, htmlBody: buildEmailHtml(content) });
}

function sendAdminReply(email, replyText) {
  const content = `
    <h2>Support Update</h2>
    <p>${replyText}</p>
    <p>Best regards,<br>${storeName_()} Support</p>
  `;
  MailApp.sendEmail({ to: email, subject: "Support update", htmlBody: buildEmailHtml(content) });
  return ok_();
}

function sendOTPEmail(email, otp, type) {
  const content = `
    <h2>Your ${type} Verification Code</h2>
    <p>Use this code to continue. It expires in 10 minutes.</p>
    <div style="text-align: center; margin: 32px 0;">
      <span style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #0f172a; background: #f1f5f9; padding: 16px 24px;">${otp}</span>
    </div>
    <p style="color: #6b7280; font-size: 14px;">Do not share this code with anyone. ${storeName_()} will never ask for it.</p>
  `;
  MailApp.sendEmail({ to: email, subject: `Your ${type} Code`, htmlBody: buildEmailHtml(content) });
}

function sendRegistrationPDF(email, name, phone, userId, userType) {
  const maskedPhone = phone && String(phone).length > 4 ? "XXXXXX" + String(phone).slice(-4) : "XXXX";
  const html = `
    <div style="font-family: Helvetica, Arial, sans-serif; padding: 40px; text-align: center; color: #1f2937;">
      <h1 style="color: #0f172a; margin-bottom: 8px;">Account Registration</h1>
      <h2 style="color: #6b7280; font-weight: normal; margin-top: 0;">Registration complete</h2>
      <hr style="border:0; border-top: 1px solid #e5e7eb; margin: 32px 0;">
      <div style="text-align: left; max-width: 350px; margin: 0 auto; font-size: 16px; line-height: 2;">
        <p style="margin:0;"><strong>Account Name:</strong> ${name}</p>
        <p style="margin:0;"><strong>Registered Email:</strong> ${email}</p>
        <p style="margin:0;"><strong>User Type:</strong> ${userType || "Individual"}</p>
        <p style="margin:0;"><strong>Linked Phone:</strong> ${maskedPhone}</p>
        <p style="margin:0;"><strong>User ID:</strong> ${userId}</p>
      </div>
      <p style="font-size:12px; color:#9ca3af; margin-top: 48px;">Save this document for your records.</p>
    </div>
  `;
  const blob = Utilities.newBlob(html, MimeType.HTML).getAs(MimeType.PDF).setName("Account_Details.pdf");
  MailApp.sendEmail({
    to: email,
    subject: "Welcome to " + storeName_(),
    body: "Welcome to " + storeName_() + ". Your account details are attached.",
    attachments: [blob]
  });
}

function sendDeviceAlert(email, device, visits) {
  const content = `
    <h2 style="color: #dc2626;">Security Alert: New Login</h2>
    <p>A new login was recorded on your account.</p>
    <div class="highlight-box" style="border-color: #fecaca; background: #fef2f2;">
      <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
        <li><strong>Device:</strong> ${device || "Browser"}</li>
        <li><strong>Total logins:</strong> ${visits}</li>
        <li><strong>Time:</strong> ${iso_(now_())}</li>
      </ul>
    </div>
    <p style="font-size: 14px; color: #6b7280;">If this was you, you can ignore this email.</p>
  `;
  MailApp.sendEmail({ to: email, subject: "Security Alert - New Login Detected", htmlBody: buildEmailHtml(content) });
}

function sendBulkPromo(title, message, bannerUrl) {
  const users = rowsAsObjects_(getMasterDB().getSheetByName("Users"));
  const emailList = users
    .filter(u => u.Email && String(u.Email).indexOf("@") > -1 && u.Status === "Active" && toBool_(u.MarketingOptIn, true))
    .map(u => u.Email);
  if (!emailList.length) return error_("No recipient list found.");
  const chunk = 40;
  for (let i = 0; i < emailList.length; i += chunk) {
    sendBulkPromoEmail(emailList.slice(i, i + chunk).join(","), title, message, bannerUrl);
  }
  return ok_({ message: "Promotional email sent to " + emailList.length + " customers." });
}
