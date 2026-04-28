// ===== FOOD DATA =====
const foods = {
  breakfastProteins: [
    { name: "Sausage", weight: "heavy" },
    { name: "Bacon", weight: "heavy" },
    { name: "Small steak", weight: "heavy" },
  ],
  leanModerate: [
    { name: "Grilled chicken", weight: "lean", grill: true },
    { name: "Smoked turkey breast", weight: "lean" },
    { name: "Tuna bowl", weight: "lean", fish: true, tuna: true },
    { name: "Tuna wrap", weight: "moderate", fish: true, tuna: true, hasCarb: true },
    { name: "Mahi", weight: "lean", fish: true, grill: true },
    { name: "Burger plate (no cheese)", weight: "moderate", grill: true },
    { name: "Burger plate (with cheese)", weight: "heavy", grill: true },
    { name: "NY strip", weight: "moderate", grill: true },
    { name: "Ribeye", weight: "heavy", grill: true },
    { name: "Country ribs", weight: "heavy", grill: true },
    { name: "Spaghetti and meatballs", weight: "heavy", hasCarb: true },
  ],
  standalone: [
    { name: "Carnivore chili", weight: "heavy", standalone: true, comfort: true },
    { name: "Cheeseburger soup", weight: "heavy", standalone: true, comfort: true },
  ],
  sides: [
    { name: "Green beans", carb: false },
    { name: "Jalapeños", carb: false, addon: true },
    { name: "Carrots", carb: true, grillOnly: true },
    { name: "Coleslaw", carb: true },
    { name: "Peas", carb: true },
    { name: "Lima beans", carb: true },
  ],
};

const heavyPickerItems = [
  { name: "Spaghetti and meatballs", label: "🍝 Spaghetti & Meatballs" },
  { name: "Carnivore chili", label: "🌶️ Carnivore Chili" },
  { name: "Cheeseburger soup", label: "🧀 Cheeseburger Soup" },
  { name: "Ribeye", label: "🥩 Ribeye" },
  { name: "Country ribs", label: "🍖 Country Ribs" },
  { name: "Burger plate (with cheese)", label: "🍔 Cheeseburger" },
];

// ===== STATE =====
let currentDay = { breakfast: null, meal2: null, dinner: null };
let locked = { breakfast: false, meal2: false, dinner: false };
let weekPlan = null;
let pantry = {};
let scheduledHeavy = {};

// ===== HELPERS =====
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

function getWeekData() {
  const data = JSON.parse(localStorage.getItem("mealWeek") || "{}");
  const weekStart = getWeekStart();
  if (data.weekStart !== weekStart) return { weekStart, days: [] };
  return data;
}
function getWeekStart() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().split("T")[0];
}
function saveWeekData(data) {
  localStorage.setItem("mealWeek", JSON.stringify(data));
}
function countWeekly(predicate) {
  const data = getWeekData();
  let count = 0;
  data.days.forEach(day => {
    ["breakfast", "meal2", "dinner"].forEach(slot => {
      if (day[slot] && predicate(day[slot])) count++;
    });
  });
  return count;
}

// ===== PANTRY =====
function loadPantry() {
  const saved = localStorage.getItem("mealPantry");
  if (saved) {
    pantry = JSON.parse(saved);
    // Migration: rename old "Wild boar sausage" to "Sausage"
    if (pantry.hasOwnProperty("Wild boar sausage")) {
      pantry["Sausage"] = pantry["Wild boar sausage"];
      delete pantry["Wild boar sausage"];
      savePantry();
    }
  } else {
    pantry = {};
    [...foods.breakfastProteins, ...foods.leanModerate, ...foods.standalone, ...foods.sides]
      .forEach(item => { pantry[item.name] = true; });
    savePantry();
  }
}
function savePantry() {
  localStorage.setItem("mealPantry", JSON.stringify(pantry));
}
function isAvailable(name) {
  return pantry[name] !== false;
}
function filterByPantry(items) {
  return items.filter(i => isAvailable(i.name));
}

// ===== SCHEDULED HEAVY =====
function loadScheduledHeavy() {
  const saved = localStorage.getItem("scheduledHeavy");
  scheduledHeavy = saved ? JSON.parse(saved) : {};
}
function saveScheduledHeavy() {
  localStorage.setItem("scheduledHeavy", JSON.stringify(scheduledHeavy));
}

// ===== RENDER PANTRY =====
function renderPantry() {
  const groups = [
    { id: "pantry-breakfast", items: foods.breakfastProteins },
    { id: "pantry-mains", items: foods.leanModerate },
    { id: "pantry-sides", items: foods.sides },
  ];

  groups.forEach(g => {
    const container = document.getElementById(g.id);
    container.innerHTML = g.items.map(item => `
      <label class="check-item">
        <input type="checkbox" class="pantry-check" data-name="${item.name}" ${isAvailable(item.name) ? "checked" : ""}>
        <span>${item.name}</span>
      </label>
    `).join("");
  });

  document.querySelectorAll(".pantry-check").forEach(cb => {
    cb.addEventListener("change", () => {
      pantry[cb.dataset.name] = cb.checked;
      savePantry();
      if (!cb.checked && scheduledHeavy[cb.dataset.name]) {
        delete scheduledHeavy[cb.dataset.name];
        saveScheduledHeavy();
      }
      renderPantryStatus();
      renderPantryBanners();
      renderHeavyPicker();
      renderWeekHeavySummary();
    });
  });

  renderPantryStatus();
}

function renderPantryStatus() {
  const total = [...foods.breakfastProteins, ...foods.leanModerate, ...foods.sides].length;
  const available = [...foods.breakfastProteins, ...foods.leanModerate, ...foods.sides]
    .filter(item => isAvailable(item.name)).length;
  const status = document.getElementById("pantry-status");
  if (status) {
    status.innerHTML = `<strong>${available}</strong> of ${total} items available. ${available < 5 ? "⚠️ Very few items available — generator may struggle." : ""}`;
  }
}

function renderPantryBanners() {
  const dayBanner = document.getElementById("pantry-banner-day");
  const weekBanner = document.getElementById("pantry-banner-week");

  const mainProteins = filterByPantry(foods.leanModerate);
  const breakfastProteins = filterByPantry(foods.breakfastProteins);
  const sides = filterByPantry(foods.sides.filter(s => !s.addon));

  let warnings = [];
  if (breakfastProteins.length === 0) warnings.push("No breakfast proteins");
  if (mainProteins.length === 0) warnings.push("No main proteins");
  if (sides.length === 0) warnings.push("No sides");

  const trackedItems = [...foods.breakfastProteins, ...foods.leanModerate, ...foods.sides];
  const total = trackedItems.filter(item => isAvailable(item.name)).length;
  const allItems = trackedItems.length;

  let msg = "";
  let warning = false;

  if (warnings.length > 0) {
    msg = `⚠️ <strong>Pantry issue:</strong> ${warnings.join(", ")}. <a onclick="switchView('pantry')">Update pantry</a>`;
    warning = true;
  } else if (total < allItems) {
    msg = `🛒 Using ${total}/${allItems} items from your pantry. <a onclick="switchView('pantry')">Edit</a>`;
  }

  [dayBanner, weekBanner].forEach(b => {
    if (b) {
      if (msg) {
        b.innerHTML = msg;
        b.classList.add("active");
        b.classList.toggle("warning", warning);
      } else {
        b.classList.remove("active");
      }
    }
  });
}

function selectAllPantry(value) {
  [...foods.breakfastProteins, ...foods.leanModerate, ...foods.standalone, ...foods.sides]
    .forEach(item => { pantry[item.name] = value; });
  if (!value) {
    scheduledHeavy = {};
    saveScheduledHeavy();
  }
  savePantry();
  renderPantry();
  renderPantryBanners();
  renderHeavyPicker();
  renderWeekHeavySummary();
}

// ===== HEAVY PICKER =====
function renderHeavyPicker() {
  const container = document.getElementById("heavy-picker");
  const status = document.getElementById("heavy-status");
  if (!container) return;

  // For standalones (chili, soup), always show in picker
  // For other heavies (ribeye, ribs, etc.), they need to be in main proteins pantry
  const available = heavyPickerItems.filter(item => {
    const isStandalone = foods.standalone.some(f => f.name === item.name);
    if (isStandalone) return true;
    return isAvailable(item.name);
  });

  if (available.length === 0) {
    container.innerHTML = '<p class="hint" style="grid-column:1/-1;">No heavy meals available — check some heavy proteins above to enable scheduling.</p>';
    if (status) status.innerHTML = "";
    return;
  }

  container.innerHTML = available.map(item => `
    <label class="check-item">
      <input type="checkbox" class="heavy-pick" value="${item.name}" data-name="${item.name}" ${scheduledHeavy[item.name] ? "checked" : ""}>
      <span>${item.label}</span>
    </label>
  `).join("");

  container.querySelectorAll(".heavy-pick").forEach(cb => {
    cb.addEventListener("change", () => {
      const name = cb.dataset.name;
      const isStandalone = foods.standalone.some(f => f.name === name);

      if (cb.checked) {
        scheduledHeavy[name] = true;
        if (isStandalone) {
          pantry[name] = true;
          savePantry();
        }
      } else {
        delete scheduledHeavy[name];
        if (isStandalone) {
          pantry[name] = false;
          savePantry();
        }
      }
      saveScheduledHeavy();
      renderWeekHeavySummary();
      renderHeavyStatus();
      renderPantryBanners();
    });
  });

  renderHeavyStatus();
}

function renderHeavyStatus() {
  const status = document.getElementById("heavy-status");
  if (!status) return;
  const count = Object.keys(scheduledHeavy).length;
  if (count === 0) {
    status.innerHTML = `<strong>0</strong> heavy meals scheduled — week will be fully lean.`;
  } else {
    status.innerHTML = `<strong>${count}</strong> heavy meal${count > 1 ? "s" : ""} scheduled this week.`;
  }
}

function renderWeekHeavySummary() {
  const summary = document.getElementById("week-heavy-summary");
  if (!summary) return;
  const items = Object.keys(scheduledHeavy);
  if (items.length === 0) {
    summary.classList.add("empty");
    summary.textContent = "None selected — week will be fully lean";
  } else {
    summary.classList.remove("empty");
    summary.innerHTML = items.map(name => {
      const item = heavyPickerItems.find(i => i.name === name);
      return `<span class="pill">${item ? item.label : name}</span>`;
    }).join("");
  }
}

// Tuna yesterday check
function tunaYesterday() {
  const data = getWeekData();
  if (data.days.length === 0) return false;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yDate = yesterday.toISOString().split("T")[0];
  const yDay = data.days.find(d => d.date === yDate);
  if (!yDay) return false;
  return ["breakfast","meal2","dinner"].some(s => yDay[s]?.tuna);
}

// ===== MEAL BUILDERS =====
function buildBreakfast(pattern, forceLight = false) {
  const eggs = "2-3 eggs";

  if (forceLight || pattern === "lean" || pattern === "comfort") {
    const lightOptions = [];
    if (isAvailable("Bacon")) lightOptions.push({ name: "Bacon (light)", weight: "moderate" });
    if (isAvailable("Sausage")) lightOptions.push({ name: "Sausage (small portion)", weight: "moderate" });

    if (lightOptions.length === 0) {
      return { slot: "breakfast", items: [eggs], addon: null, weight: "lean" };
    }
    const protein = rand(lightOptions);
    return {
      slot: "breakfast",
      items: [eggs, protein.name],
      addon: isAvailable("Jalapeños") && Math.random() > 0.5 ? "Jalapeños" : null,
      weight: protein.weight,
    };
  }

  const pool = filterByPantry(foods.breakfastProteins);
  if (pool.length === 0) {
    return { slot: "breakfast", items: [eggs], addon: null, weight: "lean" };
  }

  const protein = rand(pool);
  return {
    slot: "breakfast",
    items: [eggs, protein.name],
    addon: isAvailable("Jalapeños") && Math.random() > 0.6 ? "Jalapeños" : null,
    weight: protein.weight,
  };
}

function buildMeal2(pattern, breakfast, ctx = null, forceLight = false) {
  const tunaCount = ctx ? ctx.tunaCount : countWeekly(m => m.tuna);
  const noTunaToday = ctx ? ctx.tunaYesterday : tunaYesterday();

  let pool = filterByPantry(foods.leanModerate).filter(f => {
    if (f.weight === "heavy") return false;
    if (f.tuna && tunaCount >= 3) return false;
    if (f.tuna && noTunaToday) return false;
    return true;
  });

  if (pattern === "lean" || forceLight) pool = pool.filter(f => f.weight === "lean");

  if (pool.length === 0) {
    pool = filterByPantry(foods.leanModerate).filter(f => f.weight !== "heavy" && !f.tuna);
  }
  if (pool.length === 0) {
    return { slot: "meal2", items: ["⚠️ No proteins available"], side: "—", weight: "lean" };
  }

  const protein = rand(pool);
  const side = pickSide(protein);

  return {
    slot: "meal2",
    items: [protein.name],
    side: side ? side.name : null,
    weight: protein.weight,
    fish: protein.fish || false,
    tuna: protein.tuna || false,
    hasCarb: protein.hasCarb || false,
  };
}

function buildDinner(pattern, breakfast, meal2, ctx = null, forceLight = false) {
  const comfortCount = ctx ? ctx.comfortCount : countWeekly(m => m.comfort);
  const heavyToday = breakfast.weight === "heavy" || meal2.weight === "heavy";
  const noTunaToday = ctx ? ctx.tunaYesterday : tunaYesterday();

  if (pattern === "comfort" && comfortCount < 3 && !heavyToday && !forceLight) {
    // Day view: only allow comfort meals that are scheduled
    // Week view (ctx exists): use pantry only (week handles scheduling separately)
    const availableComfort = filterByPantry(foods.standalone).filter(f => {
      if (ctx) return true;
      return scheduledHeavy[f.name] === true;
    });
    if (availableComfort.length > 0) {
      let comfort;
      const chiliCount = ctx ? ctx.chiliCount : 0;
      const soupCount = ctx ? ctx.soupCount : 0;
      const chili = availableComfort.find(f => f.name === "Carnivore chili");
      const soup = availableComfort.find(f => f.name === "Cheeseburger soup");
      if (chili && (!soup || soupCount >= chiliCount)) {
        comfort = chili;
      } else if (soup) {
        comfort = soup;
      } else {
        comfort = rand(availableComfort);
      }
      return {
        slot: "dinner",
        items: [comfort.name],
        side: isAvailable("Jalapeños") && Math.random() > 0.5 ? "Jalapeños" : null,
        weight: comfort.weight,
        comfort: true,
        standalone: true,
        comfortType: comfort.name,
      };
    }
  }

  let pool = filterByPantry(foods.leanModerate);
  if (meal2.fish) pool = pool.filter(f => !f.fish);
  if (heavyToday || forceLight) pool = pool.filter(f => f.weight !== "heavy");

  // Day view: only allow heavy meals that are scheduled
  if (!ctx) {
    pool = pool.filter(f => f.weight !== "heavy" || scheduledHeavy[f.name] === true);
  }

  const tunaCount = (ctx ? ctx.tunaCount : countWeekly(m => m.tuna)) + (meal2.tuna ? 1 : 0);
  if (tunaCount >= 3) pool = pool.filter(f => !f.tuna);
  if (noTunaToday) pool = pool.filter(f => !f.tuna);

  if (pattern === "grill") {
    const grillPool = pool.filter(f => f.grill);
    if (grillPool.length) pool = grillPool;
  }
  if (pattern === "lean" || forceLight) pool = pool.filter(f => f.weight !== "heavy");

  if (pool.length === 0) {
    pool = filterByPantry(foods.leanModerate).filter(f => !f.fish && f.weight !== "heavy");
  }
  if (pool.length === 0) {
    return { slot: "dinner", items: ["⚠️ No proteins available"], side: "—", weight: "lean" };
  }

  const protein = rand(pool);
  const side = pickSide(protein);

  return {
    slot: "dinner",
    items: [protein.name],
    side: side ? side.name : null,
    weight: protein.weight,
    fish: protein.fish || false,
    tuna: protein.tuna || false,
    hasCarb: protein.hasCarb || false,
  };
}

function buildSpecificDinner(mealName, breakfast, meal2) {
  const allDinners = [...foods.leanModerate, ...foods.standalone];
  const meal = allDinners.find(f => f.name === mealName);

  if (!meal) {
    console.error("Meal not found:", mealName);
    return buildDinner("balanced", breakfast, meal2);
  }

  if (meal.standalone) {
    return {
      slot: "dinner",
      items: [meal.name],
      side: isAvailable("Jalapeños") && Math.random() > 0.5 ? "Jalapeños" : null,
      weight: meal.weight,
      comfort: true,
      standalone: true,
      comfortType: meal.name,
    };
  }

  const side = pickSide(meal);
  return {
    slot: "dinner",
    items: [meal.name],
    side: side ? side.name : null,
    weight: meal.weight,
    fish: meal.fish || false,
    tuna: meal.tuna || false,
    hasCarb: meal.hasCarb || false,
  };
}

function pickSide(protein) {
  let pool = filterByPantry(foods.sides).filter(s => {
    if (s.grillOnly && !protein.grill) return false;
    if (s.carb && protein.hasCarb) return false;
    if (s.addon) return false;
    return true;
  });
  if (pool.length === 0) return null;
  return rand(pool);
}

// ===== DAY GEN =====
function generateDay() {
  const pattern = document.getElementById("pattern").value;
  const actualPattern = pattern === "auto" ? autoPattern() : pattern;

  if (!locked.breakfast) currentDay.breakfast = buildBreakfast(actualPattern);
  if (!locked.meal2) currentDay.meal2 = buildMeal2(actualPattern, currentDay.breakfast);
  if (!locked.dinner) currentDay.dinner = buildDinner(actualPattern, currentDay.breakfast, currentDay.meal2);

  renderMeal("breakfast", currentDay.breakfast);
  renderMeal("meal2", currentDay.meal2);
  renderMeal("dinner", currentDay.dinner);
  renderNotes();
}

function autoPattern() {
  const comfortCount = countWeekly(m => m.comfort);
  const data = getWeekData();
  const recentHeavy = data.days.slice(-2).filter(d =>
    ["breakfast","meal2","dinner"].some(s => d[s]?.weight === "heavy")
  ).length;
  if (recentHeavy >= 2) return "lean";
  if (comfortCount < 2 && Math.random() > 0.6) return "comfort";
  if (Math.random() > 0.5) return "grill";
  return "balanced";
}

// ===== WEEK GEN =====
function generateWeek() {
  const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  const selectedHeavy = Object.keys(scheduledHeavy).filter(name => {
    const isStandalone = foods.standalone.some(f => f.name === name);
    if (isStandalone) return true;
    return isAvailable(name);
  });

  if (selectedHeavy.length > 7) {
    alert("⚠️ You picked more than 7 heavy meals. Please reduce to 7 or fewer.");
    return;
  }

  const heavyDayIndexes = pickHeavyDays(selectedHeavy.length);
  const shuffledHeavy = [...selectedHeavy].sort(() => Math.random() - 0.5);

  const heavyAssignments = {};
  heavyDayIndexes.forEach((dayIdx, i) => {
    heavyAssignments[dayIdx] = shuffledHeavy[i];
  });

  const ctx = {
    tunaCount: 0,
    comfortCount: 0,
    chiliCount: 0,
    soupCount: 0,
    tunaYesterday: false,
  };
  const week = [];

  for (let i = 0; i < 7; i++) {
    const assignedHeavy = heavyAssignments[i];
    let pattern;

    if (assignedHeavy === "Carnivore chili" || assignedHeavy === "Cheeseburger soup") {
      pattern = "comfort";
    } else if (assignedHeavy === "Ribeye" || assignedHeavy === "Country ribs" || assignedHeavy === "Burger plate (with cheese)") {
      pattern = "grill";
    } else if (assignedHeavy) {
      pattern = "balanced";
    } else {
      pattern = Math.random() > 0.5 ? "lean" : "balanced";
    }

    const dinnerWillBeHeavy = !!assignedHeavy;
    const breakfast = buildBreakfast(pattern, dinnerWillBeHeavy);

    const meal2 = buildMeal2(pattern, breakfast, ctx, dinnerWillBeHeavy);
    if (meal2.tuna) ctx.tunaCount++;

    let dinner;
    if (assignedHeavy) {
      dinner = buildSpecificDinner(assignedHeavy, breakfast, meal2);
      if (dinner.comfort) {
        ctx.comfortCount++;
        if (dinner.comfortType === "Carnivore chili") ctx.chiliCount++;
        else ctx.soupCount++;
      }
    } else {
      dinner = buildDinner("lean", breakfast, meal2, ctx);
      if (dinner.tuna) ctx.tunaCount++;
    }

    const todayHadTuna = meal2.tuna || dinner.tuna;
    ctx.tunaYesterday = todayHadTuna;

    week.push({ day: dayNames[i], pattern, breakfast, meal2, dinner, plannedHeavy: assignedHeavy || null });
  }

  weekPlan = { week, ctx, selectedHeavy };
  renderWeek();
}

function pickHeavyDays(count) {
  if (count === 0) return [];
  if (count >= 7) return [0,1,2,3,4,5,6];
  const allDays = [0,1,2,3,4,5,6];
  const picked = [];
  const spacing = Math.floor(7 / count);
  let start = Math.floor(Math.random() * spacing);
  for (let i = 0; i < count; i++) {
    const dayIdx = (start + i * spacing) % 7;
    picked.push(dayIdx);
  }
  picked.sort((a,b) => a-b);
  for (let i = 1; i < picked.length; i++) {
    if (picked[i] - picked[i-1] === 1) {
      const available = allDays.filter(d => !picked.includes(d) &&
        !picked.includes(d-1) && !picked.includes(d+1));
      if (available.length) {
        picked[i] = available[0];
        picked.sort((a,b) => a-b);
      }
    }
  }
  return picked;
}

function renderWeek() {
  if (!weekPlan) return;
  const container = document.getElementById("week-plan");
  const summary = document.getElementById("week-summary");

  const heavyDays = weekPlan.week.filter(d => d.plannedHeavy).length;
  const restDays = 7 - heavyDays;

  summary.classList.add("active");
  summary.innerHTML = `
    <h3>📊 Week Summary</h3>
    <div class="summary-grid">
      <div class="summary-item"><strong>${heavyDays}</strong>Heavy meal days</div>
      <div class="summary-item"><strong>${restDays}</strong>Lean/balanced days</div>
      <div class="summary-item"><strong>${weekPlan.ctx.tunaCount}</strong>Tuna meals</div>
      <div class="summary-item"><strong>${weekPlan.ctx.comfortCount}</strong>Comfort meals</div>
    </div>
  `;

  container.innerHTML = weekPlan.week.map(d => `
    <div class="day-block">
      <h3>
        ${d.day}
        ${d.plannedHeavy ? `<span class="pattern-badge heavy-badge">⭐ ${d.plannedHeavy}</span>` : `<span class="pattern-badge">${d.pattern}</span>`}
      </h3>
      ${miniMeal("Breakfast", d.breakfast)}
      ${miniMeal("Meal 2", d.meal2)}
      ${miniMeal("Dinner", d.dinner)}
    </div>
  `).join("");
}

function miniMeal(label, meal) {
  let text = meal.items.join(" + ");
  if (meal.side) text += ` + ${meal.side}`;
  if (meal.addon) text += ` + ${meal.addon}`;
  return `<div class="mini-meal ${meal.weight}"><span class="label">${label}</span>${text}</div>`;
}

// ===== RENDER =====
function renderMeal(slotId, meal) {
  const card = document.getElementById(`${slotId}-card`);
  const content = document.getElementById(`${slotId}-content`);
  card.classList.remove("lean", "moderate", "heavy");
  card.classList.add(meal.weight);
  let html = `<div class="protein">${meal.items.join(" + ")}`;
  html += ` <span class="tag ${meal.weight}">${meal.weight}</span></div>`;
  if (meal.side) html += `<div class="side">+ ${meal.side}</div>`;
  if (meal.addon) html += `<div class="side">+ ${meal.addon}</div>`;
  content.innerHTML = html;
}

function renderTracker() {
  const tunaCount = countWeekly(m => m.tuna);
  const comfortCount = countWeekly(m => m.comfort);
  const data = getWeekData();
  let heavyDays = 0;
  data.days.forEach(d => {
    const hasHeavy = ["breakfast","meal2","dinner"].some(s => d[s]?.weight === "heavy");
    if (hasHeavy) heavyDays++;
  });
  document.getElementById("tunaCount").textContent = tunaCount;
  document.getElementById("comfortCount").textContent = comfortCount;
  document.getElementById("heavyCount").textContent = heavyDays;
}

function renderNotes() {
  const notes = [];
  const heavyCount = ["breakfast","meal2","dinner"].filter(s => currentDay[s]?.weight === "heavy").length;
  if (heavyCount > 1) notes.push("⚠️ Rule 3 violated: Multiple heavy meals today. Unlock and reroll one to fix.");
  if (tunaYesterday()) notes.push("🐟 Tuna was logged yesterday — Rule 10 is blocking tuna today.");
  const notesEl = document.getElementById("notes");
  if (notes.length) {
    notesEl.innerHTML = "<strong>Notes:</strong><ul>" + notes.map(n => `<li>${n}</li>`).join("") + "</ul>";
    notesEl.classList.add("active");
  } else {
    notesEl.classList.remove("active");
  }
}

// ===== ACTIONS =====
function rerollMeal(slot) {
  const pattern = document.getElementById("pattern").value;
  const actualPattern = pattern === "auto" ? "balanced" : pattern;

  if (slot !== "breakfast" && !currentDay.breakfast) {
    currentDay.breakfast = buildBreakfast(actualPattern);
    renderMeal("breakfast", currentDay.breakfast);
  }
  if (slot === "dinner" && !currentDay.meal2) {
    currentDay.meal2 = buildMeal2(actualPattern, currentDay.breakfast);
    renderMeal("meal2", currentDay.meal2);
  }

  if (slot === "breakfast") {
    const otherHeavyLocked =
      (locked.meal2 && currentDay.meal2?.weight === "heavy") ||
      (locked.dinner && currentDay.dinner?.weight === "heavy");
    currentDay.breakfast = buildBreakfast(actualPattern, otherHeavyLocked);
  } else if (slot === "meal2") {
    currentDay.meal2 = buildMeal2(actualPattern, currentDay.breakfast);
  } else {
    currentDay.dinner = buildDinner(actualPattern, currentDay.breakfast, currentDay.meal2);
  }

  renderMeal(slot, currentDay[slot]);
  renderNotes();
}

function toggleLock(slot, btn) {
  locked[slot] = !locked[slot];
  btn.textContent = locked[slot] ? "🔒" : "🔓";
  document.getElementById(`${slot}-card`).classList.toggle("locked", locked[slot]);
}

function logToday() {
  if (!currentDay.breakfast) { alert("Generate a day first!"); return; }
  const data = getWeekData();
  const today = new Date().toISOString().split("T")[0];
  data.days = data.days.filter(d => d.date !== today);
  data.days.push({ date: today, ...currentDay });
  saveWeekData(data);
  renderTracker();
  renderNotes();
  alert("✅ Day saved to week tracker!");
}

function resetWeek() {
  if (confirm("Reset this week's tracking data?")) {
    localStorage.removeItem("mealWeek");
    renderTracker();
    renderNotes();
  }
}

function switchView(viewName) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.view === viewName));
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById(`${viewName}-view`).classList.add("active");
}

// ===== EVENTS =====
document.getElementById("generateDay").addEventListener("click", generateDay);
document.getElementById("generateWeek").addEventListener("click", generateWeek);
document.getElementById("printWeek").addEventListener("click", () => window.print());
document.getElementById("logDay").addEventListener("click", logToday);
document.getElementById("resetWeek").addEventListener("click", resetWeek);
document.getElementById("selectAll").addEventListener("click", () => selectAllPantry(true));
document.getElementById("deselectAll").addEventListener("click", () => selectAllPantry(false));
document.getElementById("resetPantry").addEventListener("click", () => {
  if (confirm("Reset pantry to all items available? (Heavy meal selections will be kept.)")) {
    localStorage.removeItem("mealPantry");
    loadPantry();
    renderPantry();
    renderPantryBanners();
    renderHeavyPicker();
    renderWeekHeavySummary();
  }
});

document.querySelectorAll(".reroll-btn").forEach(btn => {
  btn.addEventListener("click", () => rerollMeal(btn.dataset.meal));
});
document.querySelectorAll(".lock-btn").forEach(btn => {
  btn.addEventListener("click", () => toggleLock(btn.dataset.meal, btn));
});
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => switchView(btn.dataset.view));
});

// ===== INIT =====
loadPantry();
loadScheduledHeavy();
renderPantry();
renderHeavyPicker();
renderWeekHeavySummary();
renderPantryBanners();
renderTracker();
renderNotes();
