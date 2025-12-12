// app.js
// Tech Career Path Quiz
// - Splash → 5→1 preloader → multi-step quiz
// - Rule-based recommendation as a senior engineer/career coach
// - Supabase insert for responses (frontend-safe anon key only)

/* global supabase */

// ---------- Supabase setup ----------
const { createClient } = supabase; // IMPORTANT for CDN usage

// Your project details (safe to expose because RLS is enabled and we only insert)
const SUPABASE_URL = "https://dikptazrcdeypabrybjd.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpa3B0YXpyY2RleXBhYnJ5YmpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0NDQyMDgsImV4cCI6MjA4MTAyMDIwOH0.Sj2rwFXRff16aFmuKCexJsmSv0zNd0ePwFjg2H2grnE";

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- DOM elements ----------
const splashScreen = document.getElementById("splashScreen");
const preloaderScreen = document.getElementById("preloaderScreen");
const quizScreen = document.getElementById("quizScreen");
const resultScreen = document.getElementById("resultScreen");

const startQuizBtn = document.getElementById("startQuizBtn");
const preloaderNumber = document.getElementById("preloaderNumber");
const preloaderMessage = document.getElementById("preloaderMessage");
const preloaderBar = document.getElementById("preloaderBar");

const quizForm = document.getElementById("quizForm");
const stepsContainer = document.getElementById("stepsContainer");
const stepElems = Array.from(document.querySelectorAll(".js-step"));

const progressBar = document.getElementById("progressBar");
const stepLabel = document.getElementById("stepLabel");
const statusText = document.getElementById("statusText");
const errorMsg = document.getElementById("errorMsg");

const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const submitBtn = document.getElementById("submitBtn");

const resultTitle = document.getElementById("resultTitle");
const resultSubtitle = document.getElementById("resultSubtitle");
const resultReasons = document.getElementById("resultReasons");
const resultResources = document.getElementById("resultResources");
const restartBtn = document.getElementById("restartBtn");

let currentStep = 0;
const TOTAL_STEPS = stepElems.length;

// ---------- Helpers: screens ----------
function showOnlyScreen(screen) {
  [splashScreen, preloaderScreen, quizScreen, resultScreen].forEach((el) => {
    if (!el) return;
    if (el === screen) {
      el.classList.remove("hidden");
    } else {
      el.classList.add("hidden");
    }
  });
}

// ---------- Preloader ----------
function startPreloaderThenQuiz() {
  startQuizBtn.disabled = true;
  showOnlyScreen(preloaderScreen);

  let countdown = 5;
  const total = 5;

  const messages = {
    5: "Warming up your personalised journey…",
    4: "Looking at how you like to learn and work…",
    3: "Lining up questions that reveal your strengths…",
    2: "Preparing possible tech paths that match you…",
    1: "Almost there! Your first questions are ready…",
  };

  function tick() {
    preloaderNumber.textContent = countdown.toString();
    if (messages[countdown]) {
      preloaderMessage.textContent = messages[countdown];
    }

    const progress = ((total - countdown + 1) / total) * 100;
    preloaderBar.style.width = `${progress}%`;

    if (countdown <= 1) {
      setTimeout(() => {
        // Show quiz
        showOnlyScreen(quizScreen);
        currentStep = 0;
        showStep(currentStep);
      }, 700);
    } else {
      countdown -= 1;
      setTimeout(tick, 1000);
    }
  }

  tick();
}

// ---------- Step / navigation ----------
function getStepName(stepIndex) {
  switch (stepIndex) {
    case 0:
      return "About you";
    case 1:
      return "Work style & strengths";
    case 2:
      return "Tech interests & time";
    case 3:
      return "Values & goals";
    default:
      return "";
  }
}

function showStep(index) {
  stepElems.forEach((el, idx) => {
    if (idx === index) {
      el.classList.remove("hidden");
    } else {
      el.classList.add("hidden");
    }
  });

  const stepNumber = index + 1;
  const percent = Math.round((stepNumber / TOTAL_STEPS) * 100);
  progressBar.style.width = `${percent}%`;
  stepLabel.textContent = `Step ${stepNumber} of ${TOTAL_STEPS} · ${getStepName(
    index
  )}`;

  prevBtn.disabled = index === 0;
  nextBtn.classList.toggle("hidden", index === TOTAL_STEPS - 1);
  submitBtn.classList.toggle("hidden", index !== TOTAL_STEPS - 1);

  errorMsg.classList.add("hidden");
  statusText.textContent =
    index === TOTAL_STEPS - 1
      ? "Last step – submit to see your suggested path."
      : "You can move back and forth; answers are kept.";
}

function validateCurrentStep() {
  const activeStep = stepElems[currentStep];
  const requiredFields = activeStep.querySelectorAll("[required]");

  for (const field of requiredFields) {
    if (!field.checkValidity()) {
      field.reportValidity();
      field.focus();
      return false;
    }
  }

  // Extra: ensure at least one activity selected on step 2
  if (activeStep.dataset.step === "2") {
    const actInputs = activeStep.querySelectorAll("input[name='q_activities']");
    const anyChecked = Array.from(actInputs).some((i) => i.checked);
    if (!anyChecked) {
      errorMsg.textContent =
        "Please pick at least one activity that sounds interesting to you.";
      errorMsg.classList.remove("hidden");
      return false;
    }
  }

  return true;
}

function goToNextStep() {
  if (!validateCurrentStep()) return;
  if (currentStep < TOTAL_STEPS - 1) {
    currentStep += 1;
    showStep(currentStep);
  }
}

function goToPrevStep() {
  if (currentStep > 0) {
    currentStep -= 1;
    showStep(currentStep);
  }
}

// ---------- Collect answers ----------
function getFormAnswers() {
  const data = new FormData(quizForm);
  const answers = {};

  data.forEach((value, key) => {
    if (answers[key] === undefined) {
      answers[key] = value;
    } else if (Array.isArray(answers[key])) {
      answers[key].push(value);
    } else {
      answers[key] = [answers[key], value];
    }
  });

  return answers;
}

// ---------- Recommendation engine ----------
function computeCareerRecommendation(answers) {
  const roles = {
    "Frontend / Web Development": 0,
    "Backend / Cloud Engineering": 0,
    "UI/UX Design": 0,
    "Data / Analytics": 0,
    "Product / Project Management": 0,
    "QA / Testing": 0,
    "No-Code / Automation": 0,
    "Digital Marketing / Content": 0,
  };

  const bump = (role, points = 1) => {
    if (roles[role] !== undefined) {
      roles[role] += points;
    }
  };

  const toArray = (val) =>
    Array.isArray(val) ? val : val ? [val] : [];

  // 1) Subjects
  const subjects = toArray(answers["q_subjects"]);

  if (subjects.includes("maths-logic")) {
    bump("Backend / Cloud Engineering", 2);
    bump("Data / Analytics", 2);
    bump("QA / Testing", 1);
    bump("Frontend / Web Development", 1);
  }
  if (subjects.includes("arts-design")) {
    bump("UI/UX Design", 3);
    bump("Frontend / Web Development", 1);
    bump("Digital Marketing / Content", 1);
  }
  if (subjects.includes("writing-language")) {
    bump("Product / Project Management", 2);
    bump("Digital Marketing / Content", 2);
  }
  if (subjects.includes("business-econ")) {
    bump("Product / Project Management", 2);
    bump("Data / Analytics", 1);
    bump("Digital Marketing / Content", 1);
  }
  if (subjects.includes("science-tech")) {
    bump("Backend / Cloud Engineering", 2);
    bump("Frontend / Web Development", 1);
    bump("Data / Analytics", 1);
  }
  if (subjects.includes("social-people")) {
    bump("Product / Project Management", 2);
    bump("Digital Marketing / Content", 2);
    bump("UI/UX Design", 1);
  }

  // 2) Digital comfort
  switch (answers["q_digital_comfort"]) {
    case "intermediate":
      bump("Frontend / Web Development", 1);
      bump("No-Code / Automation", 1);
      break;
    case "advanced":
      bump("Frontend / Web Development", 2);
      bump("Backend / Cloud Engineering", 2);
      bump("Data / Analytics", 1);
      break;
    default:
      break;
  }

  // 3) Work style
  switch (answers["q_work_style"]) {
    case "structured":
      bump("QA / Testing", 1);
      bump("Data / Analytics", 1);
      break;
    case "explore":
      bump("Frontend / Web Development", 1);
      bump("UI/UX Design", 1);
      bump("No-Code / Automation", 1);
      break;
    case "mix":
      bump("Product / Project Management", 1);
      break;
    default:
      break;
  }

  // 4) Collaboration style
  switch (answers["q_collab_style"]) {
    case "solo":
      bump("Frontend / Web Development", 1);
      bump("Backend / Cloud Engineering", 1);
      bump("Data / Analytics", 1);
      bump("QA / Testing", 1);
      break;
    case "people":
      bump("Product / Project Management", 2);
      bump("Digital Marketing / Content", 1);
      bump("UI/UX Design", 1);
      break;
    case "both":
      bump("Product / Project Management", 1);
      bump("No-Code / Automation", 1);
      break;
    default:
      break;
  }

  // 5) Strengths
  const strengths = toArray(answers["q_strengths"]);
  if (strengths.includes("visual")) {
    bump("UI/UX Design", 3);
    bump("Frontend / Web Development", 1);
  }
  if (strengths.includes("numbers")) {
    bump("Data / Analytics", 3);
    bump("Backend / Cloud Engineering", 1);
  }
  if (strengths.includes("communication")) {
    bump("Product / Project Management", 2);
    bump("Digital Marketing / Content", 1);
  }
  if (strengths.includes("organising")) {
    bump("Product / Project Management", 3);
    bump("QA / Testing", 1);
  }
  if (strengths.includes("detail")) {
    bump("QA / Testing", 3);
    bump("Data / Analytics", 1);
  }
  if (strengths.includes("tinkering")) {
    bump("Backend / Cloud Engineering", 2);
    bump("No-Code / Automation", 2);
  }

  // 6) Activities
  const activities = toArray(answers["q_activities"]);
  if (activities.includes("frontend")) bump("Frontend / Web Development", 3);
  if (activities.includes("backend")) bump("Backend / Cloud Engineering", 3);
  if (activities.includes("uiux")) bump("UI/UX Design", 3);
  if (activities.includes("data")) bump("Data / Analytics", 3);
  if (activities.includes("product")) bump("Product / Project Management", 3);
  if (activities.includes("qa")) bump("QA / Testing", 3);
  if (activities.includes("nocode")) bump("No-Code / Automation", 3);
  if (activities.includes("marketing"))
    bump("Digital Marketing / Content", 3);

  // 7) Coding feel
  switch (answers["q_coding_feel"]) {
    case "love":
      bump("Frontend / Web Development", 2);
      bump("Backend / Cloud Engineering", 2);
      bump("Data / Analytics", 1);
      break;
    case "some":
      bump("No-Code / Automation", 2);
      bump("Product / Project Management", 1);
      bump("UI/UX Design", 1);
      break;
    case "minimal":
      bump("Product / Project Management", 2);
      bump("Digital Marketing / Content", 2);
      bump("UI/UX Design", 1);
      break;
    default:
      break;
  }

  // 8) Values
  const values = toArray(answers["q_values"]);
  if (values.includes("income")) {
    bump("Backend / Cloud Engineering", 2);
    bump("Data / Analytics", 2);
    bump("Frontend / Web Development", 1);
  }
  if (values.includes("flexibility")) {
    bump("No-Code / Automation", 2);
    bump("Frontend / Web Development", 1);
    bump("Digital Marketing / Content", 1);
  }
  if (values.includes("creativity")) {
    bump("UI/UX Design", 2);
    bump("Digital Marketing / Content", 1);
    bump("Frontend / Web Development", 1);
  }
  if (values.includes("stability")) {
    bump("QA / Testing", 2);
    bump("Data / Analytics", 1);
  }
  if (values.includes("impact")) {
    bump("Product / Project Management", 2);
    bump("UI/UX Design", 1);
  }
  if (values.includes("leadership")) {
    bump("Product / Project Management", 3);
  }

  // 9) Problem type
  switch (answers["q_problem_type"]) {
    case "logic":
      bump("Backend / Cloud Engineering", 2);
      bump("QA / Testing", 2);
      bump("Frontend / Web Development", 1);
      break;
    case "design":
      bump("UI/UX Design", 3);
      bump("Frontend / Web Development", 1);
      break;
    case "people":
      bump("Product / Project Management", 2);
      bump("Digital Marketing / Content", 2);
      bump("UI/UX Design", 1);
      break;
    case "planning":
      bump("Product / Project Management", 3);
      bump("QA / Testing", 1);
      break;
    case "data":
      bump("Data / Analytics", 3);
      bump("Backend / Cloud Engineering", 1);
      break;
    default:
      break;
  }

  // Hours (mainly affects how “heavy” path is)
  switch (answers["q_hours"]) {
    case "0-3":
      bump("No-Code / Automation", 1);
      bump("Digital Marketing / Content", 1);
      break;
    case "4-7":
      bump("UI/UX Design", 1);
      bump("No-Code / Automation", 1);
      bump("Frontend / Web Development", 1);
      break;
    case "8-12":
      bump("Frontend / Web Development", 1);
      bump("Data / Analytics", 1);
      bump("Backend / Cloud Engineering", 1);
      break;
    case "13+":
      bump("Backend / Cloud Engineering", 1);
      bump("Data / Analytics", 1);
      bump("Product / Project Management", 1);
      break;
    default:
      break;
  }

  const sorted = Object.entries(roles)
    .map(([role, score]) => ({ role, score }))
    .sort((a, b) => b.score - a.score);

  const best = sorted[0];
  const second = sorted[1];

  return { best, second, scores: roles, sorted };
}

// ---------- Descriptions & resources ----------
function getRoleDescription(role) {
  switch (role) {
    case "Frontend / Web Development":
      return "You enjoy creating things people can see and click on, with a mix of logic and creativity. Frontend lets you build interfaces users interact with every day.";
    case "Backend / Cloud Engineering":
      return "You like logical systems, structure and making things work reliably behind the scenes. Backend focuses on APIs, databases and performance.";
    case "UI/UX Design":
      return "You’re drawn to visuals, user journeys and how products feel. UI/UX design blends creativity, psychology and problem-solving.";
    case "Data / Analytics":
      return "You like patterns, numbers and evidence-based decisions. Data work lets you turn raw data into insights that guide products and strategy.";
    case "Product / Project Management":
      return "You enjoy coordinating people, ideas and execution. Product/project roles sit at the intersection of users, business and tech.";
    case "QA / Testing":
      return "You have an eye for detail and quality. QA/testing is about breaking things before users do, and making sure products feel solid.";
    case "No-Code / Automation":
      return "You like connecting tools and creating value quickly without deep code. No-code/automation focuses on workflows, ops and MVPs.";
    case "Digital Marketing / Content":
      return "You’re interested in communication, campaigns and growth. Digital marketing is about bringing users in and keeping them engaged.";
    default:
      return "You have strengths that could fit several paths. This suggestion is a strong starting lane; you can still explore and pivot.";
  }
}

function getRoleReasons(role) {
  switch (role) {
    case "Frontend / Web Development":
      return [
        "You show a mix of logic and visual interest, which suits building user interfaces.",
        "You’re open to coding and working with visible results.",
      ];
    case "Backend / Cloud Engineering":
      return [
        "You’re comfortable with logical, structured thinking and deeper technical work.",
        "You can handle complexity and enjoy making systems work behind the scenes.",
      ];
    case "UI/UX Design":
      return [
        "You’re drawn to visuals, experiences and how things feel to real people.",
        "You value creativity and empathising with users.",
      ];
    case "Data / Analytics":
      return [
        "You’re comfortable with numbers, patterns and evidence-based thinking.",
        "You like questions like “what’s really happening here?” and “what do the numbers say?”.",
      ];
    case "Product / Project Management":
      return [
        "You enjoy coordinating people, ideas and execution rather than only coding.",
        "You care about impact, communication and making sure things actually ship.",
      ];
    case "QA / Testing":
      return [
        "You have patience for details and enjoy catching mistakes.",
        "You’re okay with structured work that protects quality for real users.",
      ];
    case "No-Code / Automation":
      return [
        "You’re interested in building and connecting tools without going super deep into code.",
        "You like the idea of quickly automating workflows and experimenting.",
      ];
    case "Digital Marketing / Content":
      return [
        "You enjoy communication, content or social aspects of tech.",
        "You value impact, visibility and connecting products with people.",
      ];
    default:
      return [];
  }
}

function getRoleResources(role) {
  switch (role) {
    case "Frontend / Web Development":
      return [
        {
          label: "FreeCodeCamp – Responsive Web Design & JS",
          url: "https://www.freecodecamp.org/",
        },
        {
          label: "MDN Web Docs – HTML/CSS/JS basics",
          url: "https://developer.mozilla.org/",
        },
      ];
    case "Backend / Cloud Engineering":
      return [
        {
          label: "Backend roadmap (roadmap.sh)",
          url: "https://roadmap.sh/backend",
        },
        {
          label: "FreeCodeCamp – Relational Databases & APIs",
          url: "https://www.freecodecamp.org/learn",
        },
      ];
    case "UI/UX Design":
      return [
        {
          label: "Figma – free UI design tool & tutorials",
          url: "https://www.figma.com/resources/learn-design/",
        },
        {
          label: "Google UX Design certificate (overview)",
          url: "https://grow.google/certificates/ux-design/",
        },
      ];
    case "Data / Analytics":
      return [
        {
          label: "Kaggle – Python & data courses",
          url: "https://www.kaggle.com/learn",
        },
        {
          label: "Google Data Analytics (overview)",
          url: "https://grow.google/certificates/data-analytics/",
        },
      ];
    case "Product / Project Management":
      return [
        {
          label: "Product School – free product resources",
          url: "https://www.productschool.com/resources",
        },
        {
          label: "Atlassian Agile Coach",
          url: "https://www.atlassian.com/agile",
        },
      ];
    case "QA / Testing":
      return [
        {
          label: "Ministry of Testing – testing basics",
          url: "https://www.ministryoftesting.com/",
        },
        {
          label: "Test Automation University",
          url: "https://testautomationu.applitools.com/",
        },
      ];
    case "No-Code / Automation":
      return [
        {
          label: "Zapier University – automation basics",
          url: "https://zapier.com/university",
        },
        {
          label: "Make (Integromat) Academy",
          url: "https://www.make.com/en/academy",
        },
      ];
    case "Digital Marketing / Content":
      return [
        {
          label:
            "Google Digital Garage – Fundamentals of Digital Marketing",
          url: "https://learndigital.withgoogle.com/digitalgarage",
        },
        {
          label: "HubSpot Academy – Free marketing courses",
          url: "https://academy.hubspot.com/",
        },
      ];
    default:
      return [];
  }
}

// ---------- Supabase save ----------
async function saveToSupabase(answers, recommendation) {
  try {
    const payload = {
      answers,
      best_role: recommendation.best.role,
      scores: recommendation.scores,
      created_at: new Date().toISOString(),
    };

    const { error } = await sb.from("career_responses").insert(payload);

    if (error) {
      console.error("Supabase insert error:", error);
    }
  } catch (err) {
    console.error("Unexpected Supabase error:", err);
  }
}

// ---------- Show result ----------
function renderResult(recommendation, answers) {
  const { best, second } = recommendation;

  resultTitle.textContent = best.role;

  const desc = getRoleDescription(best.role);
  resultSubtitle.textContent = desc;

  resultReasons.innerHTML = "";
  const reasons = getRoleReasons(best.role);
  reasons.forEach((r) => {
    const li = document.createElement("li");
    li.textContent = r;
    resultReasons.appendChild(li);
  });

  resultReasons.appendChild(document.createElement("li")).textContent =
    second && second.score > 0
      ? `You also showed signals for “${second.role}”. You could explore it as a secondary option.`
      : "You can still explore other paths – this is your strongest fit based on your answers.";

  resultResources.innerHTML = "";
  const resources = getRoleResources(best.role);
  resources.forEach((res) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = res.url;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.textContent = res.label;
    a.className =
      "underline underline-offset-4 decoration-emerald-300/70 hover:decoration-emerald-100";
    li.appendChild(a);
    resultResources.appendChild(li);
  });

  showOnlyScreen(resultScreen);
}

// ---------- Events ----------
startQuizBtn.addEventListener("click", () => {
  showOnlyScreen(preloaderScreen);
  startPreloaderThenQuiz();
});

nextBtn.addEventListener("click", goToNextStep);
prevBtn.addEventListener("click", goToPrevStep);

quizForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!validateCurrentStep()) return;

  const answers = getFormAnswers();
  const recommendation = computeCareerRecommendation(answers);

  // Save to Supabase (non-blocking)
  saveToSupabase(answers, recommendation);

  // (Optionally call Gemini backend here in the future)

  renderResult(recommendation, answers);
});

restartBtn.addEventListener("click", () => {
  quizForm.reset();
  currentStep = 0;
  showStep(currentStep);
  showOnlyScreen(quizScreen);
});

// Initial screen
showOnlyScreen(splashScreen);
const payload = {
  answers,
  best_role: recommendation.best.role,
  scores: recommendation.scores,
  created_at: new Date().toISOString(),
};
