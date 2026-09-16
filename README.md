# Aarambh Naturals — Google Apps Script API

This project is Google Apps Script only. There are no HTML files. Your customer app and admin app call the deployed web app with JSON.

Create these exact editor files and paste the matching zip contents: Core, Auth, Catalog, Store, Email, Main, plus appsscript.json. Delete unused Code if present.

## Setup

1. Script properties: MAIN_FOLDER_ID, APP_TOKEN, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, ADMIN_BOOTSTRAP_EMAIL, optional ADMIN_API_KEY.
2. Run setupEcosystem() then bootstrapAdmin().
3. Deploy as web app. Execute as Me. Access: Anyone.
4. Every request sends token. Logged-in requests also send sessionToken from OTP verify. Admin writes need an Admin session or adminKey.

Rotate the old Razorpay keys. They were leaked in the previous source and are not stored here.

## Customer actions

requestRegisterOTP — name, email, phone, userType
verifyRegisterOTP — sessionToken, userId, userType
requestLoginOTP / verifyLoginOTP
logout
getMe — profile + saved addresses
updateProfile — name, phone, userType, addressesJSON
getStoreConfig — public settings, Razorpay key id, admin-created person types
getUserTypes — person types the admin created (no hardcoded names)
getCatalog — pass sessionToken or userType. Matching parent-category products are first and flagged personalized. Also returns forYou[]
getProducts / searchProducts / getProduct
getCategories — nested tree
getCart / syncCart
previewOrder / placeOrder — quote, stock, COD rules, Razorpay verify
getOrderHistory / cancelMyOrder
addReview / getReviews
uploadMedia — ownerType review or product
addWaitlist / toggleWishlist / getWishlist
createTicket

Parent categories: pass categoryId of IT. When includeDescendantsInParent is true, products filed on IT and on Computers both return.

## Admin actions

adminGetUserTypes / adminSaveUserType / adminDeleteUserType — create person types and link them to parent categories
adminGetSettings / adminUpdateSettings
adminCategoryOptions — parent and child list with product counts
adminGetCategories / adminSaveCategory
adminArchiveCategory / adminHideCategory / adminRestoreCategory / adminDeleteCategory
adminScheduleCategory
adminListProducts / adminGetProducts / adminSaveProduct — categoryId may be a parent
adminMoveProducts — productIds + destination categoryId
adminBulkProducts — activate, hide, archive, feature, COD
adminDuplicateProduct
adminToggleCod / adminAdjustStock / adminScheduleProduct
adminDeleteProduct / adminDeleteMedia
adminUpdateOrderStatus
adminModerateReview / adminReplyTicket / adminSetUserStatus / adminSaveCoupon
sendBulkPromo
readUniversal

## Product save

action adminSaveProduct
name, categoryId (parent or child), categoryIds (extra nodes), price, mrp, stock, codEnabled, goLiveAt, scheduledStock, featured, status, description, media[]

## Admin-owned settings

storeName, taxPercent, shippingFlat, freeShippingMin, codFee, codGlobalEnabled, maintenanceMode, userTypes, reviewMediaEnabled, productMediaEnabled, reviewsRequireApproval, lowStockThreshold, cancelPendingHours, allowParentCategoryProducts, includeDescendantsInParent, showOutOfStock

## Files

Person types are not parent categories and not coupon percent. Admin creates names (Farmer is only an example) and attaches parent category IDs. getCatalog then puts products from those parent trees at the top.

Core.gs Auth.gs Catalog.gs Store.gs Email.gs Main.gs appsscript.json
