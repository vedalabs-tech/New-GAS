/**
 * One-time harvest seed. Run seedHarvestCatalog() from the Apps Script editor.
 * Idempotent: upserts by ID. Writes into MASTER_DB (the live database).
 */

function harvestCatalog_() {
  return {
    categories: [
      { id: "farmers", name: "Farmers", parentId: "", sortOrder: 0, description: "Parent aisle — mixed harvest crates and whole-farm lots." },
      { id: "seeds", name: "Seeds", parentId: "farmers", sortOrder: 1, description: "Oilseeds and tempering seeds." },
      { id: "pulses", name: "Pulses", parentId: "farmers", sortOrder: 2, description: "Dals and beans." },
      { id: "cereals", name: "Cereals", parentId: "farmers", sortOrder: 3, description: "Wheat, rice and daily grains." },
      { id: "millets", name: "Millets", parentId: "farmers", sortOrder: 4, description: "Bajra, ragi, jowar and the small millets." },
    ],
    personTypes: [
      { id: "farmer", name: "Farmer", description: "Growers and farm kitchens — Farmers aisle first", categoryIds: ["farmers"] },
      { id: "home", name: "Home cook", description: "Staples for the family table", categoryIds: ["cereals", "pulses", "millets"] },
      { id: "chef", name: "Chef", description: "Restaurant and hotel kitchens", categoryIds: ["farmers", "seeds", "pulses", "cereals"] },
    ],
    products: [
      {
        id: "f-harvest-crate", name: "Farmer's Harvest Crate", categoryId: "farmers",
        price: 2499, mrp: 2890, stock: 18,
        imageUrl: "/catalog/crate.jpg,/catalog/wheat.jpg,/catalog/toor.jpg", videoUrl: "/videos/wheat.mp4",
        featured: true, codEnabled: false, status: "Active", goLiveAt: "",
        tags: "kit, gift, pantry, Multi-state partner farms, Seasonal mixed lot", description: "A curated crate of the season: a cereal, a pulse, a millet and a seed, packed from the same week's mill run. Prepaid only — we hold the lot until it clears the lab.",
        media: [{"url": "/catalog/crate.jpg", "kind": "image", "mimeType": "image/jpeg"}, {"url": "/catalog/wheat.jpg", "kind": "image", "mimeType": "image/jpeg"}, {"url": "/catalog/toor.jpg", "kind": "image", "mimeType": "image/jpeg"}, {"url": "/videos/wheat.mp4", "kind": "video", "mimeType": "video/mp4"}]
      },
      {
        id: "f-daily-grain", name: "Daily Grain Box", categoryId: "farmers",
        price: 1299, mrp: 1490, stock: 32,
        imageUrl: "/catalog/wheat.jpg,/catalog/basmati.jpg,/catalog/oats.jpg", videoUrl: "",
        featured: true, codEnabled: true, status: "Active", goLiveAt: "",
        tags: "kit, breakfast, Madhya Pradesh & Punjab, Wheat, rice, oats", description: "Three everyday cereals in one house box — Sharbati wheat, aged basmati and rolled oats. Filed under Farmers so kitchens can order the parent assortment without picking each bag.",
        media: [{"url": "/catalog/wheat.jpg", "kind": "image", "mimeType": "image/jpeg"}, {"url": "/catalog/basmati.jpg", "kind": "image", "mimeType": "image/jpeg"}, {"url": "/catalog/oats.jpg", "kind": "image", "mimeType": "image/jpeg"}]
      },
      {
        id: "f-pulse-pantry", name: "Pulse Pantry Set", categoryId: "farmers",
        price: 1599, mrp: 1840, stock: 24,
        imageUrl: "/catalog/toor.jpg,/catalog/moong-dal.jpg,/catalog/masoor.jpg", videoUrl: "/videos/toor.mp4",
        featured: false, codEnabled: true, status: "Active", goLiveAt: "",
        tags: "kit, dal, Maharashtra & Madhya Pradesh, Toor, moong, masoor", description: "The three dals a working kitchen actually finishes: toor, moong and masoor, steam-cleaned and packed as a parent-category set.",
        media: [{"url": "/catalog/toor.jpg", "kind": "image", "mimeType": "image/jpeg"}, {"url": "/catalog/moong-dal.jpg", "kind": "image", "mimeType": "image/jpeg"}, {"url": "/catalog/masoor.jpg", "kind": "image", "mimeType": "image/jpeg"}, {"url": "/videos/toor.mp4", "kind": "video", "mimeType": "video/mp4"}]
      },
      {
        id: "f-millet-starter", name: "Millet Starter Kit", categoryId: "farmers",
        price: 1199, mrp: 1380, stock: 27,
        imageUrl: "/catalog/bajra.jpg,/catalog/ragi.jpg,/catalog/foxtail.jpg", videoUrl: "/videos/millet.mp4",
        featured: false, codEnabled: true, status: "Active", goLiveAt: "",
        tags: "kit, millet, Karnataka & Rajasthan, Bajra, ragi, foxtail", description: "A three-millet introduction from the Farmers parent aisle — pearl millet, finger millet and foxtail — for porridge, rotis and baking.",
        media: [{"url": "/catalog/bajra.jpg", "kind": "image", "mimeType": "image/jpeg"}, {"url": "/catalog/ragi.jpg", "kind": "image", "mimeType": "image/jpeg"}, {"url": "/catalog/foxtail.jpg", "kind": "image", "mimeType": "image/jpeg"}, {"url": "/videos/millet.mp4", "kind": "video", "mimeType": "video/mp4"}]
      },
      {
        id: "s-mustard", name: "Black Mustard Seeds", categoryId: "seeds",
        price: 189, mrp: 230, stock: 48,
        imageUrl: "/catalog/mustard.jpg", videoUrl: "",
        featured: false, codEnabled: true, status: "Active", goLiveAt: "",
        tags: "tempering, rai, Rajasthan, Rai", description: "Small, pungent black mustard for tadka. Harvested in Rajasthan, cleaned and sieved so the seeds pop evenly in hot oil.",
        media: [{"url": "/catalog/mustard.jpg", "kind": "image", "mimeType": "image/jpeg"}]
      },
      {
        id: "s-sesame", name: "White Sesame Seeds", categoryId: "seeds",
        price: 265, mrp: 310, stock: 48,
        imageUrl: "/catalog/sesame.jpg,/catalog/crate.jpg", videoUrl: "/videos/sesame.mp4",
        featured: true, codEnabled: true, status: "Active", goLiveAt: "",
        tags: "til, sweets, oilseed, Gujarat, Til", description: "Hulled white sesame with a sweet, nutty finish. Use for ladoo, chikki, tahini or a last scatter over vegetables.",
        media: [{"url": "/catalog/sesame.jpg", "kind": "image", "mimeType": "image/jpeg"}, {"url": "/catalog/crate.jpg", "kind": "image", "mimeType": "image/jpeg"}, {"url": "/videos/sesame.mp4", "kind": "video", "mimeType": "video/mp4"}]
      },
      {
        id: "s-flax", name: "Brown Flaxseed", categoryId: "seeds",
        price: 220, mrp: 260, stock: 48,
        imageUrl: "/catalog/flax.jpg", videoUrl: "",
        featured: false, codEnabled: true, status: "Active", goLiveAt: "",
        tags: "alsi, omega, Madhya Pradesh, Alsi", description: "Whole brown flax, cool-stored after cleaning. Grind fresh for atta mixes, or toast lightly for yoghurt and porridge.",
        media: [{"url": "/catalog/flax.jpg", "kind": "image", "mimeType": "image/jpeg"}]
      },
      {
        id: "s-sunflower", name: "Sunflower Kernels", categoryId: "seeds",
        price: 310, mrp: 360, stock: 48,
        imageUrl: "/catalog/sunflower.jpg", videoUrl: "",
        featured: false, codEnabled: true, status: "Active", goLiveAt: "",
        tags: "snack, baking, Karnataka, Hulled kernel", description: "Hulled sunflower kernels, pale and sweet. A clean snack, a salad topper, or a quiet protein in house granola.",
        media: [{"url": "/catalog/sunflower.jpg", "kind": "image", "mimeType": "image/jpeg"}]
      },
      {
        id: "s-pumpkin", name: "Pumpkin Seeds", categoryId: "seeds",
        price: 420, mrp: 490, stock: 6,
        imageUrl: "/catalog/pumpkin.jpg", videoUrl: "",
        featured: false, codEnabled: true, status: "Active", goLiveAt: "",
        tags: "pepita, snack, Uttar Pradesh, Pepita", description: "Green pepitas from winter squash, dried low and slow. Limited lot this week — only a few kilos remain after packing.",
        media: [{"url": "/catalog/pumpkin.jpg", "kind": "image", "mimeType": "image/jpeg"}]
      },
      {
        id: "s-cumin", name: "Cumin Seeds", categoryId: "seeds",
        price: 340, mrp: 390, stock: 48,
        imageUrl: "/catalog/cumin.jpg", videoUrl: "",
        featured: false, codEnabled: true, status: "Active", goLiveAt: "",
        tags: "jeera, spice, Rajasthan, Jeera", description: "Rajasthan jeera with a high essential-oil note. Temper whole, or grind to order for the kitchen's daily masala.",
        media: [{"url": "/catalog/cumin.jpg", "kind": "image", "mimeType": "image/jpeg"}]
      },
      {
        id: "s-fenugreek", name: "Fenugreek Seeds", categoryId: "seeds",
        price: 165, mrp: 198, stock: 48,
        imageUrl: "/catalog/fenugreek.jpg", videoUrl: "",
        featured: false, codEnabled: true, status: "Active", goLiveAt: "",
        tags: "methi, bitter, Madhya Pradesh, Methi dana", description: "Amber methi dana, used in pickles, kasuri blends and a careful pinch in dal. Lab-checked for moisture before bagging.",
        media: [{"url": "/catalog/fenugreek.jpg", "kind": "image", "mimeType": "image/jpeg"}]
      },
      {
        id: "s-coriander", name: "Coriander Seeds", categoryId: "seeds",
        price: 210, mrp: 248, stock: 48,
        imageUrl: "/catalog/coriander.jpg", videoUrl: "",
        featured: false, codEnabled: true, status: "Active", goLiveAt: "",
        tags: "dhania, spice, Madhya Pradesh, Dhania", description: "Round, citrusy coriander from the Malwa belt. Toast until the oils lift, then crush — never a dusty pre-grind.",
        media: [{"url": "/catalog/coriander.jpg", "kind": "image", "mimeType": "image/jpeg"}]
      },
      {
        id: "s-fennel", name: "Fennel Seeds", categoryId: "seeds",
        price: 255, mrp: 295, stock: 48,
        imageUrl: "/catalog/fennel.jpg", videoUrl: "",
        featured: false, codEnabled: true, status: "Active", goLiveAt: "",
        tags: "saunf, digestif, Gujarat, Saunf", description: "Pale green saunf, sweet enough to finish a meal, sturdy enough for Kashmiri gravies and house chai.",
        media: [{"url": "/catalog/fennel.jpg", "kind": "image", "mimeType": "image/jpeg"}]
      },
      {
        id: "s-chia", name: "Garden Chia", categoryId: "seeds",
        price: 480, mrp: 560, stock: 0,
        imageUrl: "/catalog/flax.jpg", videoUrl: "",
        featured: false, codEnabled: true, status: "Scheduled", goLiveAt: "2026-10-15T09:00:00+05:30",
        tags: "coming soon, Contract farms, Madhya Pradesh, Black chia", description: "A small black-chia trial with two FPOs. Goes live when the moisture spec clears — leave your name and we will write.",
        media: [{"url": "/catalog/flax.jpg", "kind": "image", "mimeType": "image/jpeg"}]
      },
      {
        id: "p-toor", name: "Toor Dal", categoryId: "pulses",
        price: 168, mrp: 198, stock: 48,
        imageUrl: "/catalog/toor.jpg", videoUrl: "/videos/toor.mp4",
        featured: true, codEnabled: true, status: "Active", goLiveAt: "",
        tags: "dal, everyday, Maharashtra, Arhar, unpolished", description: "Unpolished arhar from Vidarbha. Holds its shape in sambar, softens cleanly in Gujarati dal. Steam-sterilised in Indore.",
        media: [{"url": "/catalog/toor.jpg", "kind": "image", "mimeType": "image/jpeg"}, {"url": "/videos/toor.mp4", "kind": "video", "mimeType": "video/mp4"}]
      },
      {
        id: "p-moong-dal", name: "Moong Dal", categoryId: "pulses",
        price: 156, mrp: 185, stock: 48,
        imageUrl: "/catalog/moong-dal.jpg", videoUrl: "",
        featured: false, codEnabled: true, status: "Active", goLiveAt: "",
        tags: "dal, khichdi, Rajasthan, Split yellow", description: "Split yellow moong, quick to cook and light on the stomach. The house default for khichdi and a weekday tadka dal.",
        media: [{"url": "/catalog/moong-dal.jpg", "kind": "image", "mimeType": "image/jpeg"}]
      },
      {
        id: "p-masoor", name: "Masoor Dal", categoryId: "pulses",
        price: 132, mrp: 158, stock: 48,
        imageUrl: "/catalog/masoor.jpg", videoUrl: "",
        featured: false, codEnabled: true, status: "Active", goLiveAt: "",
        tags: "dal, soup, Madhya Pradesh, Split red", description: "Salmon-red masoor that collapses into a silk soup. Mild, fast, and the pulse we recommend for first-time bulk orders.",
        media: [{"url": "/catalog/masoor.jpg", "kind": "image", "mimeType": "image/jpeg"}]
      },
      {
        id: "p-chana-dal", name: "Chana Dal", categoryId: "pulses",
        price: 118, mrp: 142, stock: 48,
        imageUrl: "/catalog/chana-dal.jpg", videoUrl: "",
        featured: false, codEnabled: true, status: "Active", goLiveAt: "",
        tags: "dal, snack, Madhya Pradesh, Split Bengal gram", description: "Sturdy split chana for sambar, cholar dal and a roasted evening snack. Graded for even size so it cooks as one.",
        media: [{"url": "/catalog/chana-dal.jpg", "kind": "image", "mimeType": "image/jpeg"}]
      },
      {
        id: "p-urad", name: "Urad Dal", categoryId: "pulses",
        price: 172, mrp: 205, stock: 48,
        imageUrl: "/catalog/urad.jpg", videoUrl: "",
        featured: false, codEnabled: true, status: "Active", goLiveAt: "",
        tags: "idli, dosa, Uttar Pradesh, Split, washed", description: "Washed split urad with the ferment that idli and dosa batters need. Low grit, high foam — mill-tested in Indore.",
        media: [{"url": "/catalog/urad.jpg", "kind": "image", "mimeType": "image/jpeg"}]
      },
      {
        id: "p-rajma", name: "Kashmiri Rajma", categoryId: "pulses",
        price: 198, mrp: 240, stock: 8,
        imageUrl: "/catalog/rajma.jpg", videoUrl: "",
        featured: false, codEnabled: true, status: "Active", goLiveAt: "",
        tags: "bean, curry, Jammu & Kashmir, Small red", description: "Small, deep-red Kashmiri beans that cook creamy without falling apart. A short lot this month.",
        media: [{"url": "/catalog/rajma.jpg", "kind": "image", "mimeType": "image/jpeg"}]
      },
      {
        id: "p-kabuli", name: "Kabuli Chana", categoryId: "pulses",
        price: 154, mrp: 182, stock: 48,
        imageUrl: "/catalog/chickpea.jpg", videoUrl: "",
        featured: false, codEnabled: true, status: "Active", goLiveAt: "",
        tags: "chole, hummus, Madhya Pradesh, Large white", description: "Large white chickpeas for chole and hummus. Soaked overnight they split cleanly; no dark eyes, no chalky cores.",
        media: [{"url": "/catalog/chickpea.jpg", "kind": "image", "mimeType": "image/jpeg"}]
      },
      {
        id: "p-moong-whole", name: "Whole Green Moong", categoryId: "pulses",
        price: 148, mrp: 176, stock: 48,
        imageUrl: "/catalog/moong-whole.jpg", videoUrl: "",
        featured: false, codEnabled: true, status: "Active", goLiveAt: "",
        tags: "sprout, salad, Rajasthan, Whole green", description: "Whole green moong with a high sprout rate. Rinse, rest, and they green up in a day — or simmer as a rustic sabut dal.",
        media: [{"url": "/catalog/moong-whole.jpg", "kind": "image", "mimeType": "image/jpeg"}]
      },
      {
        id: "p-horse-gram", name: "Horse Gram", categoryId: "pulses",
        price: 96, mrp: 120, stock: 48,
        imageUrl: "/catalog/horse-gram.jpg", videoUrl: "",
        featured: false, codEnabled: true, status: "Active", goLiveAt: "",
        tags: "kulthi, rustic, Karnataka, Kulthi", description: "Kulthi from the Deccan — the pulse of rasam, winter stews and a quietly high-protein kitchen. Stone-cleaned.",
        media: [{"url": "/catalog/horse-gram.jpg", "kind": "image", "mimeType": "image/jpeg"}]
      },
      {
        id: "p-white-peas", name: "White Peas", categoryId: "pulses",
        price: 110, mrp: 135, stock: 0,
        imageUrl: "/catalog/white-peas.jpg", videoUrl: "",
        featured: false, codEnabled: true, status: "Scheduled", goLiveAt: "2026-10-15T09:00:00+05:30",
        tags: "coming soon, ragda, Uttar Pradesh, Vatana", description: "Dried white vatana for ragda and a winter ghugni. The next lot is on the dryer — it will land here the morning it is graded.",
        media: [{"url": "/catalog/white-peas.jpg", "kind": "image", "mimeType": "image/jpeg"}]
      },
      {
        id: "c-wheat", name: "Sharbati Wheat", categoryId: "cereals",
        price: 72, mrp: 88, stock: 48,
        imageUrl: "/catalog/wheat.jpg", videoUrl: "/videos/wheat.mp4",
        featured: true, codEnabled: true, status: "Active", goLiveAt: "",
        tags: "atta, roti, Madhya Pradesh, Sehore, Sharbati", description: "Sehore Sharbati, the wheat chapati flour aspires to. Soft gluten, a sweet crumb. Sold as whole grain so you mill to your stone.",
        media: [{"url": "/catalog/wheat.jpg", "kind": "image", "mimeType": "image/jpeg"}, {"url": "/videos/wheat.mp4", "kind": "video", "mimeType": "video/mp4"}]
      },
      {
        id: "c-basmati", name: "Aged Basmati", categoryId: "cereals",
        price: 268, mrp: 320, stock: 48,
        imageUrl: "/catalog/basmati.jpg", videoUrl: "",
        featured: true, codEnabled: false, status: "Active", goLiveAt: "",
        tags: "rice, export, Punjab, Extra-long, aged 18 months", description: "Eighteen-month aged extra-long basmati. Prepaid on this SKU — export lots move on a tight inventory, and we do not risk a refused COD.",
        media: [{"url": "/catalog/basmati.jpg", "kind": "image", "mimeType": "image/jpeg"}]
      },
      {
        id: "c-brown-rice", name: "Brown Rice", categoryId: "cereals",
        price: 145, mrp: 172, stock: 48,
        imageUrl: "/catalog/brown-rice.jpg", videoUrl: "",
        featured: false, codEnabled: true, status: "Active", goLiveAt: "",
        tags: "rice, wholegrain, Uttarakhand, Unpolished", description: "Unpolished brown rice with the bran left on. A nutty weekday rice that still steams separate if you soak it twenty minutes.",
        media: [{"url": "/catalog/brown-rice.jpg", "kind": "image", "mimeType": "image/jpeg"}]
      },
      {
        id: "c-barley", name: "Hulled Barley", categoryId: "cereals",
        price: 98, mrp: 120, stock: 48,
        imageUrl: "/catalog/barley.jpg", videoUrl: "",
        featured: false, codEnabled: true, status: "Active", goLiveAt: "",
        tags: "jau, soup, Rajasthan, Jau", description: "Hulled barley for soups, sattu and a cooling summer water. The grain keeps a chew after a long simmer.",
        media: [{"url": "/catalog/barley.jpg", "kind": "image", "mimeType": "image/jpeg"}]
      },
      {
        id: "c-oats", name: "Rolled Oats", categoryId: "cereals",
        price: 186, mrp: 220, stock: 48,
        imageUrl: "/catalog/oats.jpg", videoUrl: "",
        featured: false, codEnabled: true, status: "Active", goLiveAt: "",
        tags: "breakfast, Punjab, Rolled, not instant", description: "Thick-rolled oats, not the dust of instant sachets. Porridge in six minutes, granola overnight, a binder in tikki.",
        media: [{"url": "/catalog/oats.jpg", "kind": "image", "mimeType": "image/jpeg"}]
      },
      {
        id: "c-maize", name: "Yellow Maize", categoryId: "cereals",
        price: 64, mrp: 78, stock: 48,
        imageUrl: "/catalog/maize.jpg", videoUrl: "",
        featured: false, codEnabled: true, status: "Active", goLiveAt: "",
        tags: "makka, flour, Karnataka, Flint", description: "Flint maize for makki atta and a country polenta. Dried on the cob, then shelled — the colour is the sugar, not a dye.",
        media: [{"url": "/catalog/maize.jpg", "kind": "image", "mimeType": "image/jpeg"}]
      },
      {
        id: "c-dalia", name: "Broken Wheat Dalia", categoryId: "cereals",
        price: 78, mrp: 95, stock: 48,
        imageUrl: "/catalog/wheat.jpg", videoUrl: "",
        featured: false, codEnabled: true, status: "Active", goLiveAt: "",
        tags: "porridge, upma, Madhya Pradesh, Cracked Sharbati", description: "Cracked Sharbati for breakfast porridge and a savoury upma. Even mesh so it hydrates as one, not a sludge of flour.",
        media: [{"url": "/catalog/wheat.jpg", "kind": "image", "mimeType": "image/jpeg"}]
      },
      {
        id: "c-red-rice", name: "Unpolished Red Rice", categoryId: "cereals",
        price: 162, mrp: 195, stock: 9,
        imageUrl: "/catalog/red-rice.jpg", videoUrl: "",
        featured: false, codEnabled: true, status: "Active", goLiveAt: "",
        tags: "rice, mineral, Kerala / Karnataka belt, Matta-style red", description: "A red, unpolished rice with a mineral finish. Cooks firm. Short stock after the last mill run.",
        media: [{"url": "/catalog/red-rice.jpg", "kind": "image", "mimeType": "image/jpeg"}]
      },
      {
        id: "m-bajra", name: "Pearl Millet", categoryId: "millets",
        price: 86, mrp: 105, stock: 48,
        imageUrl: "/catalog/bajra.jpg", videoUrl: "/videos/millet.mp4",
        featured: true, codEnabled: true, status: "Active", goLiveAt: "",
        tags: "bajra, roti, Rajasthan, Bajra", description: "Rajasthan bajra, the winter roti grain. Mill fresh; the flour stales faster than wheat, which is why we sell the seed, not the dust.",
        media: [{"url": "/catalog/bajra.jpg", "kind": "image", "mimeType": "image/jpeg"}, {"url": "/videos/millet.mp4", "kind": "video", "mimeType": "video/mp4"}]
      },
      {
        id: "m-ragi", name: "Finger Millet", categoryId: "millets",
        price: 92, mrp: 112, stock: 48,
        imageUrl: "/catalog/ragi.jpg", videoUrl: "",
        featured: false, codEnabled: true, status: "Active", goLiveAt: "",
        tags: "ragi, porridge, Karnataka, Ragi", description: "Dark Karnataka ragi for malt, porridge and a quietly strong dosa. Calcium-rich, earthy, and the millet most of our chefs start with.",
        media: [{"url": "/catalog/ragi.jpg", "kind": "image", "mimeType": "image/jpeg"}]
      },
      {
        id: "m-foxtail", name: "Foxtail Millet", categoryId: "millets",
        price: 118, mrp: 142, stock: 48,
        imageUrl: "/catalog/foxtail.jpg", videoUrl: "",
        featured: false, codEnabled: true, status: "Active", goLiveAt: "",
        tags: "thinai, rice-swap, Andhra Pradesh, Kangni / korra", description: "Fine golden foxtail that stands in for rice. Rinse well; it cooks in the time of a cup of tea.",
        media: [{"url": "/catalog/foxtail.jpg", "kind": "image", "mimeType": "image/jpeg"}]
      },
      {
        id: "m-little", name: "Little Millet", categoryId: "millets",
        price: 124, mrp: 148, stock: 48,
        imageUrl: "/catalog/foxtail.jpg", videoUrl: "",
        featured: false, codEnabled: true, status: "Active", goLiveAt: "",
        tags: "samai, Tamil Nadu, Samai", description: "Samai — the smallest of the house millets, with a soft porridge grain and a clean, almost green taste.",
        media: [{"url": "/catalog/foxtail.jpg", "kind": "image", "mimeType": "image/jpeg"}]
      },
      {
        id: "m-kodo", name: "Kodo Millet", categoryId: "millets",
        price: 128, mrp: 155, stock: 0,
        imageUrl: "/catalog/jowar.jpg", videoUrl: "",
        featured: false, codEnabled: true, status: "Scheduled", goLiveAt: "2026-10-15T09:00:00+05:30",
        tags: "coming soon, Madhya Pradesh, Kodon", description: "Kodon from tribal belts of Madhya Pradesh. Next lot is on the grader; it will appear here the same day it is signed off.",
        media: [{"url": "/catalog/jowar.jpg", "kind": "image", "mimeType": "image/jpeg"}]
      },
      {
        id: "m-barnyard", name: "Barnyard Millet", categoryId: "millets",
        price: 136, mrp: 162, stock: 48,
        imageUrl: "/catalog/foxtail.jpg", videoUrl: "",
        featured: false, codEnabled: true, status: "Active", goLiveAt: "",
        tags: "vrat, sanwa, Uttarakhand, Sanwa", description: "Sanwa for fasting days and a light khichdi. Cooks like a small risotto grain if you keep the water shy.",
        media: [{"url": "/catalog/foxtail.jpg", "kind": "image", "mimeType": "image/jpeg"}]
      },
      {
        id: "m-jowar", name: "Sorghum", categoryId: "millets",
        price: 74, mrp: 92, stock: 48,
        imageUrl: "/catalog/jowar.jpg", videoUrl: "",
        featured: false, codEnabled: true, status: "Active", goLiveAt: "",
        tags: "jowar, bhakri, Maharashtra, Jowar", description: "Cream-white jowar for bhakri and a gluten-free house atta. The grain should look like this — round, pale, not chalk-dusted.",
        media: [{"url": "/catalog/jowar.jpg", "kind": "image", "mimeType": "image/jpeg"}]
      },
      {
        id: "m-mixed", name: "Mixed Millet Blend", categoryId: "millets",
        price: 154, mrp: 185, stock: 48,
        imageUrl: "/catalog/bajra.jpg,/catalog/ragi.jpg,/catalog/foxtail.jpg,/catalog/jowar.jpg", videoUrl: "/videos/millet.mp4",
        featured: false, codEnabled: true, status: "Active", goLiveAt: "",
        tags: "blend, everyday, House blend, Indore mill, Bajra, ragi, foxtail, jowar", description: "Four millets, one bag, balanced for daily porridge and a mixed atta. Blended after each grain is cleaned, never before.",
        media: [{"url": "/catalog/bajra.jpg", "kind": "image", "mimeType": "image/jpeg"}, {"url": "/catalog/ragi.jpg", "kind": "image", "mimeType": "image/jpeg"}, {"url": "/catalog/foxtail.jpg", "kind": "image", "mimeType": "image/jpeg"}, {"url": "/catalog/jowar.jpg", "kind": "image", "mimeType": "image/jpeg"}, {"url": "/videos/millet.mp4", "kind": "video", "mimeType": "video/mp4"}]
      },
    ]
  };
}

function seedHarvestCatalog() {
  ensureSchema();
  const data = harvestCatalog_();
  const catSheet = getMasterDB().getSheetByName("Categories");
  const productSheet = getMasterDB().getSheetByName("Products");
  const typeSheet = getMasterDB().getSheetByName("UserTypes");
  const at = now_();
  let categories = 0;
  let products = 0;
  let types = 0;

  data.categories.forEach(function (c) {
    const payload = {
      ID: c.id,
      Name: c.name,
      ParentID: c.parentId || "",
      Slug: slugify_(c.name),
      Description: c.description || "",
      Image: "",
      Status: "Active",
      SortOrder: c.sortOrder || 0,
      GoLiveAt: "",
      UpdatedAt: at
    };
    const found = findRowByColumn_(catSheet, "ID", c.id);
    if (found.rowIndex > 0) writeRowByHeaders_(catSheet, found.rowIndex, payload);
    else {
      payload.CreatedAt = at;
      appendRowByHeaders_(catSheet, payload);
    }
    categories++;
  });

  data.products.forEach(function (p) {
    const media = p.media || [];
    const payload = {
      ID: p.id,
      SKU: p.id,
      Name: p.name,
      CategoryID: p.categoryId,
      CategoryIDs: JSON.stringify([p.categoryId]),
      CategoryPath: categoryPath_(p.categoryId),
      Tags: p.tags || "",
      ShortDescription: p.description || "",
      Price: p.price,
      MRP: p.mrp,
      Stock: p.stock,
      LowStockAt: 5,
      Image_URL: p.imageUrl || "",
      Video_URL: p.videoUrl || "",
      Media_JSON: JSON.stringify(media),
      Description: p.description || "",
      Status: p.status || "Active",
      CODEnabled: p.codEnabled !== false,
      GoLiveAt: p.goLiveAt || "",
      ScheduledStock: p.status === "Scheduled" ? p.stock : "",
      Featured: !!p.featured,
      WeightGrams: 500,
      TaxPercent: "",
      UpdatedAt: at
    };
    const found = findRowByColumn_(productSheet, "ID", p.id);
    if (found.rowIndex > 0) writeRowByHeaders_(productSheet, found.rowIndex, payload);
    else {
      payload.CreatedAt = at;
      appendRowByHeaders_(productSheet, payload);
    }
    products++;
  });

  data.personTypes.forEach(function (t) {
    const payload = {
      ID: t.id,
      Name: t.name,
      CategoryIDs: JSON.stringify(t.categoryIds || []),
      Description: t.description || "",
      Status: "Active",
      SortOrder: 0,
      UpdatedAt: at
    };
    const found = findRowByColumn_(typeSheet, "ID", t.id);
    if (found.rowIndex > 0) writeRowByHeaders_(typeSheet, found.rowIndex, payload);
    else {
      payload.CreatedAt = at;
      appendRowByHeaders_(typeSheet, payload);
    }
    types++;
  });
  if (typeof syncUserTypeSetting_ === "function") syncUserTypeSetting_();
  SpreadsheetApp.flush();
  return ok_({
    message: "Harvest catalog written to Google Apps Script database.",
    categories: categories,
    products: products,
    personTypes: types
  });
}

function seedHarvestCatalogHttp(data) {
  data = data || {};
  const existing = rowsAsObjects_(getMasterDB().getSheetByName("Products"));
  if (existing.length) {
    const auth = requireAdmin_(data);
    if (auth.error) return error_("Catalog already has products. Admin login is required to re-seed.");
  }
  return seedHarvestCatalog();
}

