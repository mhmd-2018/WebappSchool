/* =========================================================
   STUDIA — shared course data
   Used by: courses.html, index.html, dashboard.html, feedback.html
   ========================================================= */

const CATEGORY_COLORS = {
  "Development": "#3B2F8C",
  "Design": "#B8862B",
  "Data Science": "#1F7A6C",
  "Business": "#14181F",
  "Marketing": "#E4572E",
  "Language": "#6C6350",
  "Photography": "#5C4B8A",
  "Music": "#A13D63"
};

const COURSES = [
  {
    id: "c1", name: "Systems Thinking for Product Design", category: "Design",
    instructor: "Mara Ionescu", level: "Intermediate", duration: "6h 20m", rating: 4.8, ratingCount: 612,
    price: 49, initials: "ST",
    summary: "Learn to map the invisible relationships between components, users, and constraints before you draw a single screen. Built around three real product teardown case studies."
  },
  {
    id: "c2", name: "Modern JavaScript: From Fundamentals to Async", category: "Development",
    instructor: "Deshawn Cole", level: "Beginner", duration: "9h 45m", rating: 4.7, ratingCount: 1830,
    price: 39, initials: "JS",
    summary: "A ground-up path through variables, closures, the event loop, and promises, ending with a small app you build alongside each lesson."
  },
  {
    id: "c3", name: "Statistics for Decision Making", category: "Data Science",
    instructor: "Priya Nandakumar", level: "Beginner", duration: "7h 10m", rating: 4.6, ratingCount: 940,
    price: 44, initials: "SD",
    summary: "Covers distributions, hypothesis testing, and regression using spreadsheet tools first, then Python — so the math never outruns the intuition."
  },
  {
    id: "c4", name: "Negotiation Tactics for New Managers", category: "Business",
    instructor: "Owen Faulkner", level: "Intermediate", duration: "4h 55m", rating: 4.5, ratingCount: 388,
    price: 59, initials: "NT",
    summary: "Role-played scenarios for salary talks, vendor contracts, and cross-team conflict, with scripts you can adapt rather than memorize."
  },
  {
    id: "c5", name: "Performance Marketing on a Small Budget", category: "Marketing",
    instructor: "Lucia Vargas", level: "Beginner", duration: "5h 30m", rating: 4.4, ratingCount: 501,
    price: 35, initials: "PM",
    summary: "How to run and read paid campaigns when every dollar has to earn its place — attribution basics, creative testing, and when to stop a losing ad."
  },
  {
    id: "c6", name: "Conversational Spanish for Travel", category: "Language",
    instructor: "Alejandro Ruiz", level: "Beginner", duration: "8h 15m", rating: 4.9, ratingCount: 2210,
    price: 29, initials: "ES",
    summary: "Situational dialogues for airports, markets, and small talk, recorded with native speakers from three different regions."
  },
  {
    id: "c7", name: "Portrait Lighting in Natural Light", category: "Photography",
    instructor: "Hana Kobayashi", level: "Intermediate", duration: "3h 40m", rating: 4.8, ratingCount: 276,
    price: 42, initials: "PL",
    summary: "Working only with windows, reflectors, and time of day — no strobes required — to get consistent, flattering portraits anywhere."
  },
  {
    id: "c8", name: "Music Theory for Producers", category: "Music",
    instructor: "Femi Adeyemi", level: "Beginner", duration: "6h 05m", rating: 4.6, ratingCount: 654,
    price: 33, initials: "MT",
    summary: "Chords, modes, and tension explained through the lens of a DAW, so every concept turns into something you can immediately hear."
  },
  {
    id: "c9", name: "React from First Principles", category: "Development",
    instructor: "Deshawn Cole", level: "Intermediate", duration: "11h 20m", rating: 4.7, ratingCount: 1420,
    price: 54, initials: "RC",
    summary: "Components, state, and rendering explained by building the same small app three different ways to expose the trade-offs."
  },
  {
    id: "c10", name: "Brand Identity Systems", category: "Design",
    instructor: "Mara Ionescu", level: "Advanced", duration: "5h 50m", rating: 4.9, ratingCount: 340,
    price: 62, initials: "BI",
    summary: "Beyond the logo: building a flexible visual language of type, color, and motion that survives contact with a hundred different touchpoints."
  },
  {
    id: "c11", name: "SQL for Everyday Analysis", category: "Data Science",
    instructor: "Priya Nandakumar", level: "Beginner", duration: "4h 15m", rating: 4.7, ratingCount: 1890,
    price: 25, initials: "SQ",
    summary: "Joins, window functions, and query performance taught against a single realistic sales dataset instead of scattered toy examples."
  },
  {
    id: "c12", name: "Financial Modeling for Startups", category: "Business",
    instructor: "Owen Faulkner", level: "Advanced", duration: "7h 40m", rating: 4.5, ratingCount: 298,
    price: 65, initials: "FM",
    summary: "Build a three-statement model and a cap table from scratch, then stress-test both against three funding scenarios."
  },
  {
    id: "c13", name: "Copywriting That Converts", category: "Marketing",
    instructor: "Lucia Vargas", level: "Intermediate", duration: "3h 55m", rating: 4.6, ratingCount: 712,
    price: 31, initials: "CW",
    summary: "Landing pages, email subject lines, and ad copy dissected line by line to show why one version outperforms another."
  },
  {
    id: "c14", name: "Japanese for Absolute Beginners", category: "Language",
    instructor: "Sana Fujimoto", level: "Beginner", duration: "10h 30m", rating: 4.8, ratingCount: 1560,
    price: 32, initials: "JP",
    summary: "Hiragana and katakana in the first week, then everyday phrases layered on top with spaced repetition built into every lesson."
  },
  {
    id: "c15", name: "Landscape Photography in Any Weather", category: "Photography",
    instructor: "Hana Kobayashi", level: "Beginner", duration: "4h 20m", rating: 4.7, ratingCount: 410,
    price: 38, initials: "LP",
    summary: "Fog, harsh midday sun, and storms treated as opportunities rather than obstacles, with a field kit checklist for each condition."
  },
  {
    id: "c16", name: "Python for Data Analysis", category: "Data Science",
    instructor: "Priya Nandakumar", level: "Intermediate", duration: "9h 05m", rating: 4.8, ratingCount: 2040,
    price: 47, initials: "PY",
    summary: "Pandas and visualization libraries taught through cleaning three messy real-world datasets end to end."
  }
];

/* ---- shared helpers ---- */

function starSVG(){
  return '<svg viewBox="0 0 20 20"><path d="M10 1.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L1.3 7.8l6.1-.7z"/></svg>';
}

function ratingChip(rating, count){
  return `<span class="rating">${starSVG()}${rating.toFixed(1)}<span class="rating-count">(${count})</span></span>`;
}

function courseThumb(course, size){
  const color = CATEGORY_COLORS[course.category] || "#3B2F8C";
  const style = size ? `width:${size}px;height:${size}px;` : "";
  return `<div class="thumb" style="${style}background:${color}">${course.initials}</div>`;
}

/* Mobile nav toggle — shared across all pages with .nav-burger */
document.addEventListener("DOMContentLoaded", () => {
  const burger = document.querySelector(".nav-burger");
  const links = document.querySelector(".nav-links");
  if (burger && links){
    burger.addEventListener("click", () => {
      const open = links.classList.toggle("is-open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }
  const nav = document.querySelector(".nav");
  if (nav){
    window.addEventListener("scroll", () => {
      nav.classList.toggle("is-scrolled", window.scrollY > 8);
    }, { passive: true });
  }
});
