# Aarambh Naturals — Google Apps Script API

JSON API only. Customer shop still uses email OTP. Admin uses a PIN. No bootstrapAdmin. No admin email.

## Admin PIN

**PIN: `7314`**

Send this PIN on every admin request as `pin`.

### Log in as admin

```
action: adminLogin
pin: 7314
token: PT_SECURE_2026
```

You get a sessionToken. You can keep sending `pin: 7314` instead of a session.

### Push all harvest products into MASTER_DB

In the Apps Script editor: choose **seedHarvestCatalog** → Run.

Or after you deploy:

```
action: seedHarvestCatalog
pin: 7314
token: PT_SECURE_2026
```

That writes Farmers + Seeds / Pulses / Cereals / Millets and about 40 products.

### Save one product

```
action: adminSaveProduct
pin: 7314
token: PT_SECURE_2026
name, categoryId, price, mrp, stock, codEnabled, description, imageUrl
```

## Setup (once)

1. Paste these files: Core, Auth, Catalog, Store, Email, Main, Seed, appsscript.json
2. Run **setupEcosystem**
3. Run **seedHarvestCatalog**
4. Deploy as web app. Execute as Me. Access: Anyone

Script properties: MAIN_FOLDER_ID, APP_TOKEN, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET. Optional: ADMIN_PIN (default 7314).

## Customer actions

requestRegisterOTP / verifyRegisterOTP
requestLoginOTP / verifyLoginOTP
logout, getMe, updateProfile
getStoreConfig, getUserTypes, getCatalog, getProducts, getProduct, getCategories
getCart / syncCart, previewOrder / placeOrder
getOrderHistory / cancelMyOrder
addReview / getReviews, uploadMedia
addWaitlist / toggleWishlist / getWishlist
createTicket

## Admin actions (add pin: 7314)

adminLogin
seedHarvestCatalog
adminGetUserTypes / adminSaveUserType / adminDeleteUserType
adminGetSettings / adminUpdateSettings
adminCategoryOptions
adminGetCategories / adminSaveCategory
adminArchiveCategory / adminHideCategory / adminRestoreCategory / adminDeleteCategory
adminScheduleCategory
adminListProducts / adminGetProducts / adminSaveProduct
adminMoveProducts / adminBulkProducts / adminDuplicateProduct
adminToggleCod / adminAdjustStock / adminScheduleProduct
adminDeleteProduct / adminDeleteMedia
adminUpdateOrderStatus
adminModerateReview / adminReplyTicket / adminSetUserStatus / adminSaveCoupon
sendBulkPromo
readUniversal
