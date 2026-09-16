/**
 * PHOTO + VIDEO UPLOADS (admin product galleries, customer review media)
 */

function uploadImageWithFallback(base64Data, filename, mimeType) {
  return saveMediaFile_({
    base64: base64Data,
    filename: filename,
    mimeType: mimeType,
    ownerType: "legacy",
    ownerId: "",
    uploadedBy: "system"
  });
}

function uploadMedia(data) {
  const auth = data.sessionToken ? requireUser_(data) : { user: { Email: "anonymous", Role: "Customer" } };
  if (auth.error) return auth.error;

  const ownerType = safeString_(data.ownerType || "product");
  if (ownerType === "product" || ownerType === "category") {
    const admin = requireAdmin_(data);
    if (admin.error) return admin.error;
  }
  if (ownerType === "review" && !toBool_(getSetting_("reviewMediaEnabled"), true)) {
    return error_("Review media uploads are disabled by the admin.");
  }
  if ((ownerType === "product" || ownerType === "category") && !toBool_(getSetting_("productMediaEnabled"), true)) {
    return error_("Product media uploads are disabled by the admin.");
  }

  return saveMediaFile_({
    base64: data.base64,
    filename: data.filename,
    mimeType: data.mimeType,
    ownerType: ownerType,
    ownerId: data.ownerId || data.productId || data.reviewId || "",
    uploadedBy: auth.user ? auth.user.Email : "unknown"
  });
}

function saveMediaFile_(opts) {
  try {
    if (!opts.base64) return error_("No file data received.");
    const mime = safeString_(opts.mimeType || "application/octet-stream");
    const allowed = ALLOWED_IMAGE_TYPES.concat(ALLOWED_VIDEO_TYPES);
    if (allowed.indexOf(mime) === -1) {
      return error_("Unsupported file type. Allowed: images (jpg, png, webp, gif) and videos (mp4, webm, mov).");
    }
    const raw = String(opts.base64).replace(/^data:[^;]+;base64,/, "");
    const decoded = Utilities.base64Decode(raw);
    if (decoded.length > MAX_MEDIA_BYTES) {
      return error_("File is too large. Maximum size is " + Math.floor(MAX_MEDIA_BYTES / (1024 * 1024)) + " MB per file.");
    }
    const folderId = PropertiesService.getScriptProperties().getProperty("MEDIA_VAULT_ID");
    const folder = folderId ? DriveApp.getFolderById(folderId) : DriveApp.getRootFolder();
    const filename = safeString_(opts.filename) || ("media_" + Date.now());
    const blob = Utilities.newBlob(decoded, mime, filename);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const url = mediaViewUrl_(file.getId(), mime);
    const mediaId = uid_("MED");
    const sheet = getMasterDB().getSheetByName("Media");
    appendRowByHeaders_(sheet, {
      MediaID: mediaId,
      OwnerType: opts.ownerType || "",
      OwnerID: opts.ownerId || "",
      FileID: file.getId(),
      Url: url,
      MimeType: mime,
      Filename: filename,
      Size: decoded.length,
      Status: "Active",
      UploadedBy: opts.uploadedBy || "",
      CreatedAt: now_()
    });
    return ok_({
      mediaId: mediaId,
      url: url,
      mimeType: mime,
      kind: mime.indexOf("video") === 0 ? "video" : "image"
    });
  } catch (error) {
    return error_("Upload failed. Try a smaller file.");
  }
}

function mediaViewUrl_(fileId, mime) {
  if (mime && mime.indexOf("video") === 0) {
    return "https://drive.google.com/file/d/" + fileId + "/preview";
  }
  return "https://drive.google.com/uc?export=view&id=" + fileId;
}

function attachMediaToProduct_(productId, urls, videos) {
  const sheet = getMasterDB().getSheetByName("Products");
  const found = findRowByColumn_(sheet, "ID", productId);
  if (found.rowIndex < 0) return;
  const existing = parseJson_(found.row[col_(found.headers, "Media_JSON")], []);
  const next = existing.concat(urls || []);
  if (next.length > MAX_PRODUCT_MEDIA) next.length = MAX_PRODUCT_MEDIA;
  const imageUrls = next.filter(m => !m.kind || m.kind === "image").map(m => m.url || m);
  const videoUrls = next.filter(m => m.kind === "video").map(m => m.url || m);
  writeRowByHeaders_(sheet, found.rowIndex, {
    Media_JSON: JSON.stringify(next),
    Image_URL: imageUrls.join(","),
    Video_URL: (videos || videoUrls).join(",")
  });
}

function adminDeleteMedia(data) {
  const auth = requireAdmin_(data);
  if (auth.error) return auth.error;
  const sheet = getMasterDB().getSheetByName("Media");
  const found = findRowByColumn_(sheet, "MediaID", data.mediaId);
  if (found.rowIndex < 0) return error_("Media not found.");
  const fileId = found.row[col_(found.headers, "FileID")];
  try { if (fileId) DriveApp.getFileById(fileId).setTrashed(true); } catch (e) {}
  writeRowByHeaders_(sheet, found.rowIndex, { Status: "Deleted" });
  audit_(auth.user.Email, "Admin", "DELETE_MEDIA", data.mediaId, {});
  return ok_({ message: "Media removed." });
}

function normalizeDriveUrls_(value) {
  if (!value) return "";
  return String(value).split(",").map(u => {
    const trimmed = u.trim();
    if (trimmed.indexOf("drive.google.com") > -1 && trimmed.indexOf("uc?export=view") === -1 && trimmed.indexOf("/preview") === -1) {
      const fileId = trimmed.match(/[-\w]{25,}/);
      if (fileId) return "https://drive.google.com/uc?export=view&id=" + fileId[0];
    }
    return trimmed;
  }).filter(Boolean).join(",");
}

/**
 * NESTED CATEGORIES — create, edit, delete, archive, schedule
 */

function slugify_(name) {
  return lower_(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || uid_("cat").toLowerCase();
}

function getAllCategoriesRaw_() {
  return rowsAsObjects_(getMasterDB().getSheetByName("Categories"));
}

function categoryIsLive_(cat, at) {
  const status = safeString_(cat.Status) || "Active";
  if (status === "Archived" || status === "Hidden") return false;
  if (status === "Scheduled" || cat.GoLiveAt) {
    if (cat.GoLiveAt && new Date(cat.GoLiveAt).getTime() > at.getTime()) return false;
  }
  return status === "Active" || status === "Scheduled";
}

function getCategoryTree(includeHidden) {
  const at = now_();
  let rows = getAllCategoriesRaw_();
  if (!includeHidden) rows = rows.filter(c => categoryIsLive_(c, at));
  const byId = {};
  rows.forEach(c => {
    byId[c.ID] = {
      id: c.ID,
      name: c.Name,
      parentId: c.ParentID || "",
      slug: c.Slug,
      description: c.Description,
      image: c.Image,
      status: c.Status,
      sortOrder: toNumber_(c.SortOrder, 0),
      goLiveAt: c.GoLiveAt || "",
      children: []
    };
  });
  const roots = [];
  Object.keys(byId).forEach(id => {
    const node = byId[id];
    if (node.parentId && byId[node.parentId]) byId[node.parentId].children.push(node);
    else roots.push(node);
  });
  const sortNodes = list => {
    list.sort((a, b) => a.sortOrder - b.sortOrder || String(a.name).localeCompare(String(b.name)));
    list.forEach(n => sortNodes(n.children));
  };
  sortNodes(roots);
  return roots;
}

function getCategoriesPublic() {
  return ok_({ categories: getCategoryTree(false) });
}

function adminGetCategories(data) {
  const auth = requireAdmin_(data);
  if (auth.error) return auth.error;
  return ok_({ categories: getCategoryTree(true), flat: getAllCategoriesRaw_().map(stripInternal_) });
}

function wouldCreateCycle_(all, id, parentId) {
  if (!parentId) return false;
  if (id && String(id) === String(parentId)) return true;
  const byId = {};
  all.forEach(c => { byId[String(c.ID)] = c; });
  let guard = 0;
  let cursor = String(parentId);
  while (cursor && guard < 50) {
    if (id && cursor === String(id)) return true;
    const node = byId[cursor];
    if (!node) break;
    cursor = node.ParentID ? String(node.ParentID) : "";
    guard++;
  }
  return false;
}

function adminSaveCategory(data) {
  const auth = requireAdmin_(data);
  if (auth.error) return auth.error;
  const name = safeString_(data.name || data.Name);
  if (!name) return error_("Category name is required.");
  const sheet = getMasterDB().getSheetByName("Categories");
  const all = getAllCategoriesRaw_();
  const parentId = safeString_(data.parentId || data.ParentID);
  const id = safeString_(data.id || data.ID) || uid_("CAT");
  if (wouldCreateCycle_(all, data.id ? id : "", parentId)) {
    return error_("A category cannot be nested under itself.");
  }
  const payload = {
    ID: id,
    Name: name,
    ParentID: parentId,
    Slug: safeString_(data.slug) || slugify_(name),
    Description: safeString_(data.description),
    Image: safeString_(data.image),
    Status: safeString_(data.status) || "Active",
    SortOrder: toNumber_(data.sortOrder, 0),
    GoLiveAt: data.goLiveAt || "",
    UpdatedAt: now_()
  };
  const found = findRowByColumn_(sheet, "ID", id);
  if (found.rowIndex > 0) {
    writeRowByHeaders_(sheet, found.rowIndex, payload);
  } else {
    payload.CreatedAt = now_();
    appendRowByHeaders_(sheet, payload);
  }
  audit_(auth.user.Email, "Admin", "SAVE_CATEGORY", id, payload);
  return ok_({ category: payload });
}

function adminArchiveCategory(data) {
  const auth = requireAdmin_(data);
  if (auth.error) return auth.error;
  return setCategoryStatus_(data, "Archived", auth);
}

function adminHideCategory(data) {
  const auth = requireAdmin_(data);
  if (auth.error) return auth.error;
  return setCategoryStatus_(data, "Hidden", auth);
}

function adminRestoreCategory(data) {
  const auth = requireAdmin_(data);
  if (auth.error) return auth.error;
  return setCategoryStatus_(data, "Active", auth);
}

function setCategoryStatus_(data, status, auth) {
  const sheet = getMasterDB().getSheetByName("Categories");
  const idOrName = data.categoryId || data.id || data.categoryName;
  let found = findRowByColumn_(sheet, "ID", idOrName);
  if (found.rowIndex < 0) {
    const all = getAllCategoriesRaw_();
    const match = all.filter(c => lower_(c.Name) === lower_(idOrName))[0];
    if (match) found = { rowIndex: match._row, headers: sheetHeaders_(sheet), row: null };
  }
  if (found.rowIndex < 0) return error_("Category not found.");
  writeRowByHeaders_(sheet, found.rowIndex, { Status: status, UpdatedAt: now_() });
  audit_(auth.user.Email, "Admin", "CATEGORY_STATUS", idOrName, { status: status });
  return ok_({ message: "Category set to " + status + "." });
}

function deleteCategory(categoryName) {
  return adminDeleteCategory({ categoryName: categoryName, _legacy: true });
}

function adminDeleteCategory(data) {
  if (!data._legacy) {
    const auth = requireAdmin_(data);
    if (auth.error) return auth.error;
  }
  const sheet = getMasterDB().getSheetByName("Categories");
  const all = getAllCategoriesRaw_();
  const key = data.categoryId || data.id || data.categoryName;
  const target = all.filter(c => String(c.ID) === String(key) || lower_(c.Name) === lower_(key))[0];
  if (!target) return error_("Category not found.");
  const children = all.filter(c => String(c.ParentID) === String(target.ID));
  if (children.length && !data.force) {
    return error_("This category has subcategories. Archive it or pass force=true after moving children.");
  }
  const products = rowsAsObjects_(getMasterDB().getSheetByName("Products"));
  const used = products.filter(p => String(p.CategoryID) === String(target.ID) || lower_(p.Category) === lower_(target.Name));
  if (used.length && !data.force) {
    return error_("Products still use this category. Reassign them or archive the category instead.");
  }
  sheet.deleteRow(target._row);
  SpreadsheetApp.flush();
  return ok_({ message: "Category '" + target.Name + "' deleted." });
}

function categoryMap_() {
  const map = {};
  getAllCategoriesRaw_().forEach(c => { map[String(c.ID)] = c; });
  return map;
}

function categoryPath_(categoryId) {
  const map = categoryMap_();
  const names = [];
  let cursor = String(categoryId || "");
  let guard = 0;
  while (cursor && map[cursor] && guard < 20) {
    names.unshift(map[cursor].Name);
    cursor = map[cursor].ParentID ? String(map[cursor].ParentID) : "";
    guard++;
  }
  return names.join(" / ");
}

function descendantIds_(categoryId, includeSelf) {
  const all = getAllCategoriesRaw_();
  const ids = [];
  if (includeSelf !== false) ids.push(String(categoryId));
  const walk = parent => {
    all.forEach(c => {
      if (String(c.ParentID) === String(parent)) {
        ids.push(String(c.ID));
        walk(c.ID);
      }
    });
  };
  walk(categoryId);
  return ids;
}

function categoryDepthLabel_(cat, map) {
  map = map || categoryMap_();
  const path = categoryPath_(cat.ID);
  const depth = path ? path.split(" / ").length - 1 : 0;
  const pad = depth ? new Array(depth + 1).join("— ") : "";
  const kind = cat.ParentID ? "subcategory" : "parent category";
  return { path: path, label: pad + cat.Name + " (" + kind + ")", depth: depth, kind: kind };
}

function adminCategoryOptions(data) {
  const auth = data && data.sessionToken ? requireAdmin_(data) : { user: { Role: "Admin" } };
  if (auth.error) return auth.error;
  const map = categoryMap_();
  const rows = getAllCategoriesRaw_().map(c => {
    const meta = categoryDepthLabel_(c, map);
    return {
      id: c.ID,
      name: c.Name,
      parentId: c.ParentID || "",
      status: c.Status,
      path: meta.path,
      label: meta.label,
      kind: meta.kind,
      productCount: 0
    };
  });
  const products = rowsAsObjects_(getMasterDB().getSheetByName("Products"));
  rows.forEach(opt => {
    opt.productCount = products.filter(p => productBelongsToCategory_(p, opt.id, false)).length;
    opt.productCountWithChildren = products.filter(p => productBelongsToCategory_(p, opt.id, true)).length;
  });
  rows.sort((a, b) => String(a.path).localeCompare(String(b.path)));
  return ok_({ options: rows });
}

/**
 * PRODUCTS, STOCK, COD TOGGLE, COMING SOON
 */

function productIsVisibleToCustomer_(p, at) {
  const status = safeString_(p.Status) || "Active";
  if (status === "Hidden" || status === "Archived" || status === "Draft") return false;
  if (p.GoLiveAt && new Date(p.GoLiveAt).getTime() > at.getTime()) return false;
  return status === "Active" || status === "Scheduled";
}

function decorateProduct_(p, forAdmin) {
  const at = now_();
  const media = parseJson_(p.Media_JSON, []);
  const visible = productIsVisibleToCustomer_(p, at);
  const comingSoon = !!(p.GoLiveAt && new Date(p.GoLiveAt).getTime() > at.getTime());
  const out = {
    ID: p.ID,
    SKU: p.SKU,
    Name: p.Name,
    CategoryID: p.CategoryID,
    CategoryIDs: normalizeCategoryIds_(p),
    Category: p.Category || categoryPath_(p.CategoryID),
    CategoryPath: p.CategoryPath || categoryPath_(p.CategoryID),
    Tags: p.Tags || "",
    ShortDescription: p.ShortDescription || "",
    Price: toNumber_(p.Price, 0),
    MRP: toNumber_(p.MRP, 0),
    Stock: comingSoon && !forAdmin ? 0 : toNumber_(p.Stock, 0),
    Image_URL: normalizeDriveUrls_(p.Image_URL),
    Video_URL: p.Video_URL || "",
    Media: media,
    Description: p.Description,
    Status: p.Status,
    CODEnabled: toBool_(p.CODEnabled, true),
    Featured: toBool_(p.Featured, false),
    WeightGrams: toNumber_(p.WeightGrams, 0),
    TaxPercent: p.TaxPercent === "" || p.TaxPercent === null ? null : toNumber_(p.TaxPercent, 0),
    comingSoon: comingSoon,
    goLiveAt: p.GoLiveAt || "",
    visible: visible
  };
  if (forAdmin) {
    out.ScheduledStock = p.ScheduledStock;
    out.LowStockAt = p.LowStockAt;
    out.CreatedAt = p.CreatedAt;
    out.UpdatedAt = p.UpdatedAt;
  }
  return out;
}

function normalizeCategoryIds_(p) {
  const fromJson = parseJson_(p.CategoryIDs, []);
  const ids = Array.isArray(fromJson) ? fromJson.map(String) : [];
  if (p.CategoryID && ids.indexOf(String(p.CategoryID)) === -1) ids.unshift(String(p.CategoryID));
  return ids.filter(Boolean);
}

function productBelongsToCategory_(p, categoryId, includeDescendants) {
  if (!categoryId) return true;
  const assigned = normalizeCategoryIds_(p);
  if (assigned.indexOf(String(categoryId)) > -1) return true;
  if (!includeDescendants) return false;
  const tree = descendantIds_(categoryId, true);
  return assigned.some(id => tree.indexOf(String(id)) > -1);
}

function listProducts_(opts) {
  opts = opts || {};
  const at = now_();
  const includeHidden = !!opts.forAdmin;
  const includeDesc = (opts.includeDescendants === undefined || opts.includeDescendants === "")
    ? toBool_(getSetting_("includeDescendantsInParent"), true)
    : toBool_(opts.includeDescendants, true);
  const showOos = toBool_(getSetting_("showOutOfStock"), true);
  const q = lower_(opts.query || opts.q || "");
  let rows = rowsAsObjects_(getMasterDB().getSheetByName("Products"));
  if (!includeHidden) rows = rows.filter(p => productIsVisibleToCustomer_(p, at));
  if (opts.categoryId) rows = rows.filter(p => productBelongsToCategory_(p, opts.categoryId, includeDesc));
  if (opts.featured) rows = rows.filter(p => toBool_(p.Featured, false));
  if (q) {
    rows = rows.filter(p => {
      const blob = lower_([p.Name, p.SKU, p.Description, p.ShortDescription, p.Tags, p.CategoryPath, categoryPath_(p.CategoryID)].join(" "));
      return blob.indexOf(q) > -1;
    });
  }
  let products = rows.map(p => decorateProduct_(p, includeHidden));
  if (!includeHidden && !showOos) products = products.filter(p => p.comingSoon || p.Stock > 0);
  const sort = safeString_(opts.sort || "featured");
  products.sort((a, b) => {
    if (sort === "priceAsc") return a.Price - b.Price;
    if (sort === "priceDesc") return b.Price - a.Price;
    if (sort === "name") return String(a.Name).localeCompare(String(b.Name));
    if (sort === "newest") return String(b.CreatedAt || "").localeCompare(String(a.CreatedAt || ""));
    return (b.Featured ? 1 : 0) - (a.Featured ? 1 : 0) || String(a.Name).localeCompare(String(b.Name));
  });
  if (opts.userType && sort !== "priceAsc" && sort !== "priceDesc" && sort !== "name") {
    products = applyPersonalization_(products, opts.userType);
  }
  return products;
}

function getProductsFromSheet() {
  return listProducts_({});
}

function getCatalog(data) {
  data = data || {};
  if (isMaintenance_()) {
    return ok_({ maintenance: true, products: [], categories: getCategoryTree(false), featured: [] });
  }
  const userType = personTypeFromRequest_(data);
  const products = listProducts_({
    categoryId: data.categoryId,
    query: data.query,
    sort: data.sort,
    includeDescendants: data.includeDescendants,
    userType: userType
  });
  const forYou = products.filter(p => p.personalized);
  return ok_({
    maintenance: false,
    categories: getCategoryTree(false),
    products: products,
    forYou: forYou,
    userType: userType || "",
    featured: listProducts_({ featured: true, userType: userType }).slice(0, 12),
    includeDescendantsInParent: toBool_(getSetting_("includeDescendantsInParent"), true)
  });
}

function searchProducts(data) {
  const userType = personTypeFromRequest_(data);
  return ok_({
    products: listProducts_({
      query: data.query || data.q,
      categoryId: data.categoryId,
      sort: data.sort,
      userType: userType
    }),
    userType: userType || ""
  });
}

function getProductPublic(productId) {
  const sheet = getMasterDB().getSheetByName("Products");
  const found = findRowByColumn_(sheet, "ID", productId);
  if (found.rowIndex < 0) return error_("Product not found.");
  const obj = {};
  found.headers.forEach((h, i) => obj[h] = found.row[i]);
  if (!productIsVisibleToCustomer_(obj, now_())) return error_("Product not available.");
  const product = decorateProduct_(obj, false);
  const related = listProducts_({ categoryId: product.CategoryID, includeDescendants: true })
    .filter(p => p.ID !== product.ID)
    .slice(0, 8);
  return ok_({ product: product, related: related, reviews: getReviewsPublic(product.ID) });
}

function adminGetProducts(data) {
  const auth = requireAdmin_(data);
  if (auth.error) return auth.error;
  return ok_({
    products: rowsAsObjects_(getMasterDB().getSheetByName("Products")).map(p => decorateProduct_(p, true))
  });
}

function adminSaveProduct(data) {
  const auth = requireAdmin_(data);
  if (auth.error) return auth.error;
  const name = safeString_(data.name || data.Name);
  if (!name) return error_("Product name is required.");
  const sheet = getMasterDB().getSheetByName("Products");
  const id = safeString_(data.id || data.ID) || uid_("PRD");
  const media = data.media || parseJson_(data.Media_JSON, []);
  const imageUrl = Array.isArray(data.imageUrls)
    ? data.imageUrls.join(",")
    : (data.Image_URL || data.imageUrl || "");
  const videoUrl = Array.isArray(data.videoUrls)
    ? data.videoUrls.join(",")
    : (data.Video_URL || data.videoUrl || "");

  let status = safeString_(data.status || data.Status) || "Active";
  const goLiveAt = data.goLiveAt || data.GoLiveAt || "";
  if (goLiveAt && new Date(goLiveAt).getTime() > now_().getTime() && status === "Active") {
    status = "Scheduled";
  }

  if (!toBool_(getSetting_("allowParentCategoryProducts"), true)) {
    const chosen = safeString_(data.categoryId || data.CategoryID);
    const children = getAllCategoriesRaw_().filter(c => String(c.ParentID) === chosen);
    if (chosen && children.length) {
      return error_("Parent-category products are disabled. Assign this item to a subcategory such as " + children[0].Name + ".");
    }
  }

  const categoryIds = Array.isArray(data.categoryIds || data.CategoryIDs)
    ? (data.categoryIds || data.CategoryIDs).map(String).filter(Boolean)
    : [];
  const primaryCategory = safeString_(data.categoryId || data.CategoryID || categoryIds[0]);
  if (primaryCategory && categoryIds.indexOf(primaryCategory) === -1) categoryIds.unshift(primaryCategory);

  const payload = {
    ID: id,
    SKU: safeString_(data.sku || data.SKU) || id,
    Name: name,
    CategoryID: primaryCategory,
    CategoryIDs: JSON.stringify(categoryIds),
    CategoryPath: categoryPath_(primaryCategory),
    Tags: safeString_(data.tags || data.Tags),
    ShortDescription: safeString_(data.shortDescription || data.ShortDescription),
    Price: toNumber_(data.price || data.Price, 0),
    MRP: toNumber_(data.mrp || data.MRP, 0),
    Stock: toNumber_(data.stock !== undefined ? data.stock : data.Stock, 0),
    LowStockAt: toNumber_(data.lowStockAt || data.LowStockAt, toNumber_(getSetting_("lowStockThreshold"), 5)),
    Image_URL: imageUrl,
    Video_URL: videoUrl,
    Media_JSON: JSON.stringify(media),
    Description: data.description || data.Description || "",
    Status: status,
    CODEnabled: toBool_(data.codEnabled !== undefined ? data.codEnabled : data.CODEnabled, true),
    GoLiveAt: goLiveAt,
    ScheduledStock: data.scheduledStock !== undefined ? data.scheduledStock : (data.ScheduledStock || ""),
    Featured: toBool_(data.featured || data.Featured, false),
    WeightGrams: toNumber_(data.weightGrams || data.WeightGrams, 0),
    TaxPercent: data.taxPercent === undefined ? (data.TaxPercent === undefined ? "" : data.TaxPercent) : data.taxPercent,
    UpdatedAt: now_()
  };

  const found = findRowByColumn_(sheet, "ID", id);
  const previousStock = found.rowIndex > 0 ? toNumber_(found.row[col_(found.headers, "Stock")], 0) : null;
  if (found.rowIndex > 0) {
    writeRowByHeaders_(sheet, found.rowIndex, payload);
  } else {
    payload.CreatedAt = now_();
    appendRowByHeaders_(sheet, payload);
  }

  if (previousStock !== null && previousStock !== payload.Stock) {
    logInventory_(id, payload.Stock - previousStock, "admin_adjust", "", auth.user.Email);
  } else if (previousStock === null) {
    logInventory_(id, payload.Stock, "admin_create", "", auth.user.Email);
  }

  audit_(auth.user.Email, "Admin", "SAVE_PRODUCT", id, { name: name, cod: payload.CODEnabled, status: status });
  return ok_({ product: decorateProduct_(payload, true) });
}

function adminToggleCod(data) {
  const auth = requireAdmin_(data);
  if (auth.error) return auth.error;
  const sheet = getMasterDB().getSheetByName("Products");
  const found = findRowByColumn_(sheet, "ID", data.productId || data.id);
  if (found.rowIndex < 0) return error_("Product not found.");
  const enabled = toBool_(data.codEnabled, false);
  writeRowByHeaders_(sheet, found.rowIndex, { CODEnabled: enabled, UpdatedAt: now_() });
  audit_(auth.user.Email, "Admin", "TOGGLE_COD", data.productId || data.id, { enabled: enabled });
  return ok_({ message: "COD " + (enabled ? "enabled" : "disabled") + " for this product.", codEnabled: enabled });
}

function adminAdjustStock(data) {
  const auth = requireAdmin_(data);
  if (auth.error) return auth.error;
  return withLock_(function() {
    const sheet = getMasterDB().getSheetByName("Products");
    const found = findRowByColumn_(sheet, "ID", data.productId);
    if (found.rowIndex < 0) return error_("Product not found.");
    const current = toNumber_(found.row[col_(found.headers, "Stock")], 0);
    const next = data.setTo !== undefined && data.setTo !== null
      ? toNumber_(data.setTo, 0)
      : current + toNumber_(data.delta, 0);
    if (next < 0) return error_("Stock cannot be negative.");
    writeRowByHeaders_(sheet, found.rowIndex, { Stock: next, UpdatedAt: now_() });
    logInventory_(data.productId, next - current, data.reason || "admin_adjust", "", auth.user.Email);
    return ok_({ stock: next });
  });
}

function deleteProduct(productId) {
  return adminDeleteProduct({ productId: productId, _legacy: true });
}

function adminDeleteProduct(data) {
  if (!data._legacy) {
    const auth = requireAdmin_(data);
    if (auth.error) return auth.error;
  }
  const db = getMasterDB();
  const productSheet = db.getSheetByName("Products");
  const found = findRowByColumn_(productSheet, "ID", data.productId);
  if (found.rowIndex < 0) return error_("Product not found.");
  productSheet.deleteRow(found.rowIndex);
  ["Waitlist", "Reviews", "Wishlist"].forEach(name => {
    const sh = db.getSheetByName(name);
    if (!sh) return;
    const rows = sh.getDataRange().getValues();
    const headers = rows[0] || [];
    const idx = col_(headers, "ProductID") === -1 ? 0 : col_(headers, "ProductID");
    for (let j = rows.length - 1; j > 0; j--) {
      if (String(rows[j][idx]) === String(data.productId)) sh.deleteRow(j + 1);
    }
  });
  SpreadsheetApp.flush();
  return ok_({ message: "Product and related waitlist/review/wishlist rows removed." });
}

function logInventory_(productId, delta, reason, orderId, adminEmail) {
  const sheet = getMasterDB().getSheetByName("InventoryLog");
  appendRowByHeaders_(sheet, {
    LogID: uid_("INV"),
    ProductID: productId,
    Delta: delta,
    Reason: reason,
    Order_ID: orderId || "",
    AdminEmail: adminEmail || "",
    Date: now_()
  });
}

function decrementStockForItems_(items, orderId) {
  const sheet = getMasterDB().getSheetByName("Products");
  items.forEach(item => {
    const found = findRowByColumn_(sheet, "ID", item.id);
    if (found.rowIndex < 0) return;
    const current = toNumber_(found.row[col_(found.headers, "Stock")], 0);
    const next = Math.max(0, current - toNumber_(item.qty, 0));
    writeRowByHeaders_(sheet, found.rowIndex, { Stock: next, UpdatedAt: now_() });
    logInventory_(item.id, -toNumber_(item.qty, 0), "order", orderId, "");
    if (next <= toNumber_(found.row[col_(found.headers, "LowStockAt")], toNumber_(getSetting_("lowStockThreshold"), 5))) {
      try { sendLowStockEmail_(item.id, found.row[col_(found.headers, "Name")], next); } catch (e) {}
    }
  });
}

function restoreStockForItems_(items, orderId) {
  const sheet = getMasterDB().getSheetByName("Products");
  items.forEach(item => {
    const found = findRowByColumn_(sheet, "ID", item.id);
    if (found.rowIndex < 0) return;
    const current = toNumber_(found.row[col_(found.headers, "Stock")], 0);
    const next = current + toNumber_(item.qty, 0);
    writeRowByHeaders_(sheet, found.rowIndex, { Stock: next, UpdatedAt: now_() });
    logInventory_(item.id, toNumber_(item.qty, 0), "restore", orderId, "");
  });
}

function adminListProducts(data) {
  const auth = requireAdmin_(data);
  if (auth.error) return auth.error;
  return ok_({
    products: listProducts_({
      forAdmin: true,
      categoryId: data.categoryId,
      query: data.query,
      sort: data.sort || "name",
      includeDescendants: data.includeDescendants === undefined ? true : toBool_(data.includeDescendants, true)
    })
  });
}

function adminMoveProducts(data) {
  const auth = requireAdmin_(data);
  if (auth.error) return auth.error;
  const target = safeString_(data.categoryId);
  if (!target) return error_("Choose a destination category (parent or subcategory).");
  const cat = categoryMap_()[target];
  if (!cat) return error_("Category not found.");
  const ids = data.productIds || (data.productId ? [data.productId] : []);
  if (!ids.length) return error_("No products selected.");
  const sheet = getMasterDB().getSheetByName("Products");
  let moved = 0;
  ids.forEach(id => {
    const found = findRowByColumn_(sheet, "ID", id);
    if (found.rowIndex < 0) return;
    const extra = Array.isArray(data.addCategoryIds) ? data.addCategoryIds.map(String) : [];
    const nextIds = data.replace === false
      ? normalizeCategoryIds_({ CategoryID: found.row[col_(found.headers, "CategoryID")], CategoryIDs: found.row[col_(found.headers, "CategoryIDs")] }).concat([target]).concat(extra)
      : [target].concat(extra);
    const unique = [];
    nextIds.forEach(x => { if (x && unique.indexOf(x) === -1) unique.push(x); });
    writeRowByHeaders_(sheet, found.rowIndex, {
      CategoryID: unique[0],
      CategoryIDs: JSON.stringify(unique),
      CategoryPath: categoryPath_(unique[0]),
      UpdatedAt: now_()
    });
    moved++;
  });
  audit_(auth.user.Email, "Admin", "MOVE_PRODUCTS", target, { count: moved, ids: ids });
  return ok_({ message: moved + " product(s) assigned to " + (cat.Name || target) + ".", moved: moved });
}

function adminBulkProducts(data) {
  const auth = requireAdmin_(data);
  if (auth.error) return auth.error;
  const ids = data.productIds || [];
  if (!ids.length) return error_("No products selected.");
  const sheet = getMasterDB().getSheetByName("Products");
  const op = safeString_(data.op || data.bulkOp);
  let count = 0;
  ids.forEach(id => {
    const found = findRowByColumn_(sheet, "ID", id);
    if (found.rowIndex < 0) return;
    const patch = { UpdatedAt: now_() };
    if (op === "hide") patch.Status = "Hidden";
    else if (op === "archive") patch.Status = "Archived";
    else if (op === "activate") patch.Status = "Active";
    else if (op === "feature") patch.Featured = true;
    else if (op === "unfeature") patch.Featured = false;
    else if (op === "codOn") patch.CODEnabled = true;
    else if (op === "codOff") patch.CODEnabled = false;
    else return;
    writeRowByHeaders_(sheet, found.rowIndex, patch);
    count++;
  });
  audit_(auth.user.Email, "Admin", "BULK_PRODUCTS", op, { count: count });
  return ok_({ message: "Updated " + count + " product(s).", count: count });
}

function adminDuplicateProduct(data) {
  const auth = requireAdmin_(data);
  if (auth.error) return auth.error;
  const sheet = getMasterDB().getSheetByName("Products");
  const found = findRowByColumn_(sheet, "ID", data.productId);
  if (found.rowIndex < 0) return error_("Product not found.");
  const obj = {};
  found.headers.forEach((h, i) => obj[h] = found.row[i]);
  const copy = {
    id: uid_("PRD"),
    name: (obj.Name || "Product") + " copy",
    sku: safeString_(obj.SKU) + "-COPY",
    categoryId: obj.CategoryID,
    categoryIds: normalizeCategoryIds_(obj),
    price: obj.Price,
    mrp: obj.MRP,
    stock: 0,
    description: obj.Description,
    shortDescription: obj.ShortDescription,
    media: parseJson_(obj.Media_JSON, []),
    imageUrl: obj.Image_URL,
    videoUrl: obj.Video_URL,
    codEnabled: obj.CODEnabled,
    featured: false,
    status: "Draft",
    tags: obj.Tags
  };
  return adminSaveProduct(Object.assign({ sessionToken: data.sessionToken, adminKey: data.adminKey, token: data.token }, copy));
}

/**
 * PERSON TYPES (admin-created). Not hardcoded.
 * Admin names them (example only: Farmer) and links each type to parent categories.
 * Catalog then lifts products from those parent trees to the top for that shopper.
 */

function listUserTypeRecords_(activeOnly) {
  const sheet = getMasterDB().getSheetByName("UserTypes");
  if (!sheet) return [];
  let rows = rowsAsObjects_(sheet);
  if (activeOnly) rows = rows.filter(r => safeString_(r.Status || "Active") === "Active");
  rows.sort((a, b) => toNumber_(a.SortOrder, 0) - toNumber_(b.SortOrder, 0) || String(a.Name).localeCompare(String(b.Name)));
  return rows.map(r => ({
    id: r.ID,
    name: r.Name,
    description: r.Description || "",
    status: r.Status || "Active",
    sortOrder: toNumber_(r.SortOrder, 0),
    categoryIds: parseJson_(r.CategoryIDs, []).map(String).filter(Boolean)
  }));
}

function syncUserTypeSetting_() {
  const names = listUserTypeRecords_(true).map(t => t.name);
  setSetting_("userTypes", JSON.stringify(names));
}

function allowedUserTypes_() {
  const fromSheet = listUserTypeRecords_(true).map(t => t.name);
  if (fromSheet.length) return fromSheet;
  return parseJson_(getSetting_("userTypes"), []);
}

function publicUserTypes_() {
  return listUserTypeRecords_(true).map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    categoryIds: t.categoryIds
  }));
}

function resolvePersonType_(nameOrId) {
  const key = safeString_(nameOrId);
  if (!key) return null;
  const all = listUserTypeRecords_(true);
  return all.filter(t => String(t.id) === key || lower_(t.name) === lower_(key))[0] || null;
}

function parentCategoryIdsForPersonType_(nameOrId) {
  const type = resolvePersonType_(nameOrId);
  const mapped = type ? type.categoryIds.slice() : [];
  const label = type ? type.name : safeString_(nameOrId);
  if (!label) return uniqueIds_(mapped);
  getAllCategoriesRaw_().forEach(c => {
    const isParent = !c.ParentID;
    if (isParent && lower_(c.Name) === lower_(label) && mapped.indexOf(String(c.ID)) === -1) {
      mapped.push(String(c.ID));
    }
  });
  return uniqueIds_(mapped);
}

function uniqueIds_(ids) {
  const out = [];
  (ids || []).forEach(id => {
    const s = String(id);
    if (s && out.indexOf(s) === -1) out.push(s);
  });
  return out;
}

function productMatchesPersonType_(product, parentIds) {
  if (!parentIds || !parentIds.length) return false;
  return parentIds.some(id => productBelongsToCategory_({
    CategoryID: product.CategoryID,
    CategoryIDs: JSON.stringify(product.CategoryIDs || [])
  }, id, true));
}

function applyPersonalization_(products, userType) {
  if (!toBool_(getSetting_("personalizeByUserType"), true)) {
    return products;
  }
  const parentIds = parentCategoryIdsForPersonType_(userType);
  if (!parentIds.length) return products;
  const ranked = products.map(p => {
    const copy = Object.assign({}, p);
    copy.personalized = productMatchesPersonType_(p, parentIds);
    return copy;
  });
  ranked.sort((a, b) => {
    if (a.personalized !== b.personalized) return a.personalized ? -1 : 1;
    if (a.Featured !== b.Featured) return a.Featured ? -1 : 1;
    return String(a.Name).localeCompare(String(b.Name));
  });
  return ranked;
}

function personTypeFromRequest_(data) {
  if (data && data.userType) return safeString_(data.userType);
  if (data && data.sessionToken) {
    const auth = requireUser_(data);
    if (!auth.error && auth.user) return safeString_(auth.user.UserType);
  }
  return "";
}

function getUserTypesPublic() {
  return ok_({ userTypes: publicUserTypes_() });
}

function adminGetUserTypes(data) {
  const auth = requireAdmin_(data);
  if (auth.error) return auth.error;
  return ok_({
    userTypes: listUserTypeRecords_(false),
    parentCategories: getAllCategoriesRaw_()
      .filter(c => !c.ParentID)
      .map(c => ({ id: c.ID, name: c.Name, status: c.Status }))
  });
}

function adminSaveUserType(data) {
  const auth = requireAdmin_(data);
  if (auth.error) return auth.error;
  const name = safeString_(data.name || data.Name);
  if (!name) return error_("Person type name is required.");
  const sheet = getMasterDB().getSheetByName("UserTypes");
  const id = safeString_(data.id || data.ID) || uid_("UTY");
  const categoryIds = Array.isArray(data.categoryIds || data.CategoryIDs)
    ? (data.categoryIds || data.CategoryIDs).map(String).filter(Boolean)
    : [];
  const payload = {
    ID: id,
    Name: name,
    CategoryIDs: JSON.stringify(categoryIds),
    Description: safeString_(data.description),
    Status: safeString_(data.status) || "Active",
    SortOrder: toNumber_(data.sortOrder, 0),
    UpdatedAt: now_()
  };
  const found = findRowByColumn_(sheet, "ID", id);
  if (found.rowIndex > 0) writeRowByHeaders_(sheet, found.rowIndex, payload);
  else {
    payload.CreatedAt = now_();
    appendRowByHeaders_(sheet, payload);
  }
  syncUserTypeSetting_();
  audit_(auth.user.Email, "Admin", "SAVE_USER_TYPE", id, payload);
  return ok_({ userType: Object.assign({ categoryIds: categoryIds }, payload) });
}

function adminDeleteUserType(data) {
  const auth = requireAdmin_(data);
  if (auth.error) return auth.error;
  const sheet = getMasterDB().getSheetByName("UserTypes");
  const key = data.id || data.userTypeId || data.name;
  const rows = rowsAsObjects_(sheet);
  const target = rows.filter(r => String(r.ID) === String(key) || lower_(r.Name) === lower_(key))[0];
  if (!target) return error_("Person type not found.");
  sheet.deleteRow(target._row);
  syncUserTypeSetting_();
  audit_(auth.user.Email, "Admin", "DELETE_USER_TYPE", key, {});
  return ok_({ message: "Person type removed." });
}

/**
 * COMING SOON / AUTO-STOCK SCHEDULER
 * Admin sets GoLiveAt + optional ScheduledStock on a product or category.
 * A time-driven trigger publishes them automatically.
 */

function installTriggers() {
  const existing = ScriptApp.getProjectTriggers();
  const names = existing.map(t => t.getHandlerFunction());
  if (names.indexOf("processScheduledStock") === -1) {
    ScriptApp.newTrigger("processScheduledStock").timeBased().everyMinutes(5).create();
  }
  if (names.indexOf("purgeExpiredSessions_") === -1) {
    ScriptApp.newTrigger("purgeExpiredSessions_").timeBased().everyHours(6).create();
  }
  if (names.indexOf("drainAuthMailQueue") === -1) {
    ScriptApp.newTrigger("drainAuthMailQueue").timeBased().everyMinutes(1).create();
  }
}

function processScheduledStock() {
  try { drainAuthMailQueue(); } catch (e) {}
  const at = now_();
  const products = getMasterDB().getSheetByName("Products");
  rowsAsObjects_(products).forEach(p => {
    if (!p.GoLiveAt) return;
    if (new Date(p.GoLiveAt).getTime() > at.getTime()) return;
    const updates = { Status: "Active", UpdatedAt: at };
    if (p.ScheduledStock !== "" && p.ScheduledStock !== null && p.ScheduledStock !== undefined) {
      updates.Stock = toNumber_(p.ScheduledStock, toNumber_(p.Stock, 0));
      updates.ScheduledStock = "";
      logInventory_(p.ID, updates.Stock - toNumber_(p.Stock, 0), "scheduled_golive", "", "system");
      notifyWaitlist_(p.ID, p.Name);
    }
    updates.GoLiveAt = "";
    writeRowByHeaders_(products, p._row, updates);
  });

  const cats = getMasterDB().getSheetByName("Categories");
  rowsAsObjects_(cats).forEach(c => {
    if (!c.GoLiveAt) return;
    if (new Date(c.GoLiveAt).getTime() > at.getTime()) return;
    writeRowByHeaders_(cats, c._row, { Status: "Active", GoLiveAt: "", UpdatedAt: at });
  });
}

function notifyWaitlist_(productId, name) {
  const sheet = getMasterDB().getSheetByName("Waitlist");
  const rows = rowsAsObjects_(sheet).filter(r => String(r.ProductID) === String(productId));
  rows.forEach(r => {
    try { sendBackInStockEmail_(r.Email, name); } catch (e) {}
  });
}

function adminScheduleProduct(data) {
  const auth = requireAdmin_(data);
  if (auth.error) return auth.error;
  const sheet = getMasterDB().getSheetByName("Products");
  const found = findRowByColumn_(sheet, "ID", data.productId);
  if (found.rowIndex < 0) return error_("Product not found.");
  writeRowByHeaders_(sheet, found.rowIndex, {
    GoLiveAt: data.goLiveAt,
    ScheduledStock: data.scheduledStock !== undefined ? data.scheduledStock : "",
    Status: "Scheduled",
    UpdatedAt: now_()
  });
  installTriggers();
  audit_(auth.user.Email, "Admin", "SCHEDULE_PRODUCT", data.productId, data);
  return ok_({ message: "Product scheduled to go live at " + data.goLiveAt });
}

function adminScheduleCategory(data) {
  const auth = requireAdmin_(data);
  if (auth.error) return auth.error;
  const sheet = getMasterDB().getSheetByName("Categories");
  const found = findRowByColumn_(sheet, "ID", data.categoryId);
  if (found.rowIndex < 0) return error_("Category not found.");
  writeRowByHeaders_(sheet, found.rowIndex, {
    GoLiveAt: data.goLiveAt,
    Status: "Scheduled",
    UpdatedAt: now_()
  });
  installTriggers();
  audit_(auth.user.Email, "Admin", "SCHEDULE_CATEGORY", data.categoryId, data);
  return ok_({ message: "Category scheduled to go live at " + data.goLiveAt });
}
