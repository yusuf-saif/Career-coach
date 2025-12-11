// app.js
// -----------------------------------------------------------------------------
//  Tech Career Fit Quiz – Frontend logic
//  - Multi-step modal form
//  - Supabase insert (public anon key only)
//  - Simple rules-based recommendation engine + starter resource links
// -----------------------------------------------------------------------------
//
//  SETUP NOTES
//  -----------
//  1. Replace SUPABASE_URL and SUPABASE_ANON_KEY with your own values from:
//     Supabase dashboard → Project Settings → API
//  2. Use the *anon/publishable* key ONLY (never the secret key) in this file.
//  3. Ensure you created the `career_responses` table and insert policy as
//     discussed in your SQL script.
//
// -----------------------------------------------------------------------------

// ===== Supabase client setup ================================================

const { createClient } = window.supabase;

// TODO: Replace these with YOUR project settings.
//
// Example:
// const SUPABASE_URL = "https://abcd1234.supabase.co";
// const SUPABASE_ANON_KEY = "sb_publishable_xxx";
//
const SUPABASE_URL = "https://dikptazrcdeypabrybjd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpa3B0YXpyY2RleXBhYnJ5YmpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0NDQyMDgsImV4cCI6MjA4MTAyMDIwOH0.Sj2rwFXRff16aFmuKCexJsmSv0zNd0ePwFjg2H2grnE";

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== DOM references =======================================================

const modal = document.getElementById("quizModal");
const openModalBtn = document.getElementById("openModalBtn");
const closeModalBtn = document.getElementById("closeModalBtn");

const progressBar = document.getElementById("progressBar");
const stepLabel = document.getElementById("stepLabel");
const stepPercent = document.getElementById("stepPercent");
const stepIndicatorCurrent = document.getElementById("stepIndicatorCurrent");

const form = document.getElementById("quizForm");
const formSteps = Array.from(document.querySelectorAll(".form-step"));
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const submitBtn = document.getElementById("submitBtn");

const statusText = document.getElementById("statusText");
const errorMsg = document.getElementById("errorMsg");
const successMsg = document.getElementById("successMsg");

const resultPanel = document.getElementById("resultPanel");
const careerTitle = document.getElementById("careerTitle");
const careerDescription = document.getElementById("careerDescription");
const careerResources = document.getElementById("careerResources");

// ===== Stepper state ========================================================

let currentStep = 0;
const TOTAL_STEPS = formSteps.length;

// ===== Modal helpers ========================================================

function openModal() {
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  modal.setAttribute("aria-hidden", "false");
  currentStep = 0;
  resultPanel.classList.add("hidden"); // reset
  showStep(currentStep);

  // Focus first field for accessibility
  const firstInput = formSteps[0].querySelector("input, textarea, select");
  if (firstInput) firstInput.focus();
}

function closeModal() {
  modal.classList.remove("flex");
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
}

// Close modal when clicking overlay
modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    closeModal();
  }
});

// Close on Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modal.classList.contains("hidden")) {
    closeModal();
  }
});

openModalBtn.addEventListener("click", openModal);
closeModalBtn.addEventListener("click", closeModal);

// ===== Step UI / navigation ==================================================

function getStepName(stepIndex) {
  switch (stepIndex) {
    case 0:
      return "Contact";
    case 1:
      return "Work style";
    case 2:
      return "Interests";
    case 3:
      return "Lifestyle";
    case 4:
      return "Motivation";
    default:
      return "";
  }
}

function showStep(stepIndex) {
  formSteps.forEach((step, idx) => {
    if (idx === stepIndex) {
      step.classList.remove("hidden");
    } else {
      step.classList.add("hidden");
    }
  });

  const stepNumber = stepIndex + 1;
  const percentage = Math.round((stepNumber / TOTAL_STEPS) * 100);

  progressBar.style.width = `${percentage}%`;
  stepLabel.textContent = `Step ${stepNumber} of ${TOTAL_STEPS} · ${getStepName(
    stepIndex
  )}`;
  stepPercent.textContent = `${percentage}%`;
  stepIndicatorCurrent.textContent = `Step ${stepNumber}`;

  prevBtn.disabled = stepIndex === 0;
  nextBtn.classList.toggle("hidden", stepIndex === TOTAL_STEPS - 1);
  submitBtn.classList.toggle("hidden", stepIndex !== TOTAL_STEPS - 1);

  statusText.textContent =
    stepIndex === TOTAL_STEPS - 1
      ? "Almost there – submit to see your recommended path."
      : "You can move back and forth; answers are kept as you go.";

  // Clear messages when navigating
  errorMsg.classList.add("hidden");
  successMsg.classList.add("hidden");
}

function validateCurrentStep() {
  const activeStep = formSteps[currentStep];

  // Check required inputs in this step
  const requiredFields = activeStep.querySelectorAll("[required]");
  for (const field of requiredFields) {
    if (!field.checkValidity()) {
      field.reportValidity();
      return false;
    }
  }

  // Additional custom validation for interests step: at least 1 selected
  if (activeStep.dataset.step === "2") {
    const interestInputs = activeStep.querySelectorAll(
      "input[name='q_interests']"
    );
    const anyChecked = Array.from(interestInputs).some((i) => i.checked);
    if (!anyChecked) {
      errorMsg.textContent =
        "Please pick at least one activity that sounds interesting.";
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

nextBtn.addEventListener("click", goToNextStep);
prevBtn.addEventListener("click", goToPrevStep);

// ===== Form data helpers =====================================================

/**
 * Collects all answers into a plain JS object.
 * Handles multi-select (checkbox) fields by returning an array for those keys.
 */
function getFormAnswers() {
  const formData = new FormData(form);
  const answers = {};

  formData.forEach((value, key) => {
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

// ===== Recommendation engine ================================================

/**
 * Rules-based scoring to suggest the most aligned tech path.
 * This is intentionally simple & transparent so you can tweak it for your
 * coaching style.
 */
function computeCareerRecommendation(answers) {
  const scores = {
    "Software Engineering": 0,
    "UI/UX Design": 0,
    "Data Analysis / Data Science": 0,
    "Product / Project Management": 0,
    "QA / Testing": 0,
    "No-Code / Automation Specialist": 0,
    "Digital Marketing / Growth": 0,
  };

  function bump(role, points = 1) {
    if (scores[role] !== undefined) {
      scores[role] += points;
    }
  }

  // --- Interests ------------------------------------------------------------
  const interestsRaw = answers["q_interests"];
  const interests = Array.isArray(interestsRaw)
    ? interestsRaw
    : interestsRaw
    ? [interestsRaw]
    : [];

  if (interests.includes("build-apps")) {
    bump("Software Engineering", 3);
    bump("No-Code / Automation Specialist", 1);
  }
  if (interests.includes("design-ui")) {
    bump("UI/UX Design", 3);
  }
  if (interests.includes("data")) {
    bump("Data Analysis / Data Science", 3);
  }
  if (interests.includes("product")) {
    bump("Product / Project Management", 3);
  }
  if (interests.includes("qa")) {
    bump("QA / Testing", 3);
  }
  if (interests.includes("nocode")) {
    bump("No-Code / Automation Specialist", 3);
    bump("Product / Project Management", 1);
  }
  if (interests.includes("marketing")) {
    bump("Digital Marketing / Growth", 3);
    bump("Product / Project Management", 1);
  }

  // --- Coding preference ----------------------------------------------------
  switch (answers["q_coding_feel"]) {
    case "love-code":
      bump("Software Engineering", 3);
      bump("Data Analysis / Data Science", 2);
      bump("QA / Testing", 1);
      break;
    case "ok-code":
      bump("No-Code / Automation Specialist", 2);
      bump("UI/UX Design", 1);
      bump("Product / Project Management", 1);
      break;
    case "minimal-code":
      bump("Product / Project Management", 2);
      bump("Digital Marketing / Growth", 2);
      bump("UI/UX Design", 1);
      bump("No-Code / Automation Specialist", 1);
      break;
    default:
      break;
  }

  // --- Problem type ---------------------------------------------------------
  switch (answers["q_problem_type"]) {
    case "logic":
      bump("Software Engineering", 2);
      bump("QA / Testing", 2);
      break;
    case "creative":
      bump("UI/UX Design", 3);
      bump("Digital Marketing / Growth", 1);
      break;
    case "people":
      bump("Product / Project Management", 3);
      bump("Digital Marketing / Growth", 2);
      break;
    case "organising":
      bump("Product / Project Management", 3);
      bump("QA / Testing", 1);
      break;
    case "numbers":
      bump("Data Analysis / Data Science", 3);
      break;
    default:
      break;
  }

  // --- People vs deep focus -------------------------------------------------
  switch (answers["q_people_vs_detail"]) {
    case "people-facing":
      bump("Product / Project Management", 2);
      bump("Digital Marketing / Growth", 1);
      break;
    case "deep-focus":
      bump("Software Engineering", 2);
      bump("Data Analysis / Data Science", 2);
      bump("QA / Testing", 1);
      break;
    case "balanced":
      bump("UI/UX Design", 1);
      bump("No-Code / Automation Specialist", 1);
      bump("Product / Project Management", 1);
      break;
    default:
      break;
  }

  // --- Values ---------------------------------------------------------------
  const valuesRaw = answers["q_values"];
  const values = Array.isArray(valuesRaw)
    ? valuesRaw
    : valuesRaw
    ? [valuesRaw]
    : [];

  if (values.includes("income")) {
    bump("Software Engineering", 2);
    bump("Data Analysis / Data Science", 2);
  }
  if (values.includes("flexibility")) {
    bump("No-Code / Automation Specialist", 2);
    bump("Digital Marketing / Growth", 1);
  }
  if (values.includes("creativity")) {
    bump("UI/UX Design", 2);
    bump("Digital Marketing / Growth", 2);
  }
  if (values.includes("stability")) {
    bump("QA / Testing", 2);
    bump("Data Analysis / Data Science", 1);
    bump("Product / Project Management", 1);
  }
  if (values.includes("growth")) {
    bump("Software Engineering", 1);
    bump("Data Analysis / Data Science", 1);
    bump("Product / Project Management", 1);
  }
  if (values.includes("impact")) {
    bump("Product / Project Management", 2);
    bump("UI/UX Design", 1);
  }
  if (values.includes("recognition")) {
    bump("Product / Project Management", 1);
    bump("Digital Marketing / Growth", 1);
  }

  // --- Compute best role ----------------------------------------------------
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [bestRole, bestScore] = sorted[0];

  const descriptions = {
    "Software Engineering":
      "You’re suited to roles where you build and debug systems — think frontend, backend or full-stack development. Start with web basics (HTML, CSS, JavaScript), then move into a framework and real-world projects.",
    "UI/UX Design":
      "You’re drawn to visuals, stories and how people feel when they use a product. UI/UX lets you design flows, wireframes and high-fidelity interfaces while collaborating closely with users and devs.",
    "Data Analysis / Data Science":
      "You’re comfortable with numbers and patterns. Data roles let you work with spreadsheets, SQL, dashboards and maybe Python to help teams make better decisions from data.",
    "Product / Project Management":
      "You think in terms of people, outcomes and priorities. Product/Project roles sit at the intersection of tech, design and business — deciding what to build, in what order, and why.",
    "QA / Testing":
      "You’re detail-oriented and enjoy catching issues before they blow up. QA roles focus on testing features, writing test cases and helping teams ship reliable products.",
    "No-Code / Automation Specialist":
      "You like building real solutions without going too deep into code. No-code/automation roles use tools like Zapier, Make, Notion, Airtable, Softr, Webflow and more to build workflows and internal tools quickly.",
    "Digital Marketing / Growth":
      "You’re interested in content, audiences and experiments. Growth roles mix creativity with analytics — landing pages, emails, social, SEO and data to acquire and retain users.",
  };

  return {
    role: bestRole,
    score: bestScore,
    description: descriptions[bestRole],
    scores,
  };
}

/**
 * Simple resource mapping: role -> starter links
 * Keep these high-level, free/low-cost, and beginner-friendly.
 */
function getResourcesForRole(role) {
  const resourceMap = {
    "Software Engineering": [
      {
        label: "freeCodeCamp – Responsive Web Design",
        url: "https://www.freecodecamp.org/learn/2022/responsive-web-design/",
      },
      {
        label: "The Odin Project – Full Stack JavaScript",
        url: "https://www.theodinproject.com/paths/full-stack-javascript",
      },
      {
        label: "Frontend Mentor (practice building real UIs)",
        url: "https://www.frontendmentor.io/",
      },
    ],
    "UI/UX Design": [
      {
        label: "Figma – Free design tool",
        url: "https://www.figma.com/",
      },
      {
        label: "Google UX Design Certificate (overview page)",
        url: "https://www.coursera.org/professional-certificates/google-ux-design",
      },
      {
        label: "LearnUX – UI/UX basics & patterns",
        url: "https://learnux.io/",
      },
    ],
    "Data Analysis / Data Science": [
      {
        label: "Google Data Analytics Certificate (overview)",
        url: "https://www.coursera.org/professional-certificates/google-data-analytics",
      },
      {
        label: "Kaggle – Intro to Python & Data Analysis",
        url: "https://www.kaggle.com/learn",
      },
      {
        label: "DataCamp – Free Intro to SQL",
        url: "https://www.datacamp.com/",
      },
    ],
    "Product / Project Management": [
      {
        label: "Google Project Management Certificate (overview)",
        url: "https://www.coursera.org/professional-certificates/google-project-management",
      },
      {
        label: "Product School – Free resources",
        url: "https://productschool.com/resources",
      },
      {
        label: "Mind the Product – Articles & talks",
        url: "https://www.mindtheproduct.com/",
      },
    ],
    "QA / Testing": [
      {
        label: "Ministry of Testing – Intro resources",
        url: "https://www.ministryoftesting.com/",
      },
      {
        label: "Test Automation University",
        url: "https://testautomationu.applitools.com/",
      },
      {
        label: "Software Testing Fundamentals",
        url: "https://softwaretestingfundamentals.com/",
      },
    ],
    "No-Code / Automation Specialist": [
      {
        label: "Zapier University – automation basics",
        url: "https://zapier.com/university",
      },
      {
        label: "Make (formerly Integromat) – tutorials",
        url: "https://www.make.com/en/academy",
      },
      {
        label: "Airtable Guides – building simple tools",
        url: "https://support.airtable.com/docs",
      },
    ],
    "Digital Marketing / Growth": [
      {
        label: "Google Digital Garage – Fundamentals of Digital Marketing",
        url: "https://learndigital.withgoogle.com/digitalgarage/course/digital-marketing",
      },
      {
        label: "HubSpot Academy – free marketing courses",
        url: "https://academy.hubspot.com/courses/marketing",
      },
      {
        label: "Ahrefs Blog – SEO & content strategy",
        url: "https://ahrefs.com/blog/",
      },
    ],
  };

  return resourceMap[role] || [];
}

// ===== Submit handler =======================================================

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  errorMsg.classList.add("hidden");
  successMsg.classList.add("hidden");
  statusText.textContent = "Computing your best fit…";

  const answers = getFormAnswers();

  // Basic safety check on contact fields
  if (!answers.name || !answers.email || !answers.phone) {
    errorMsg.textContent =
      "Please fill in your name, email, and phone number.";
    errorMsg.classList.remove("hidden");
    statusText.textContent = "Please complete the required contact details.";
    return;
  }

  // 1) Compute recommendation
  const recommendation = computeCareerRecommendation(answers);

  // 2) Render result panel immediately (even if Supabase fails)
  careerTitle.textContent = recommendation.role;
  careerDescription.textContent = recommendation.description;

  // Render resources
  const resources = getResourcesForRole(recommendation.role);
  careerResources.innerHTML = "";
  resources.forEach((res) => {
    const li = document.createElement("li");
    const link = document.createElement("a");
    link.href = res.url;
    link.textContent = res.label;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className =
      "hover:underline inline-flex items-center gap-1";
    const icon = document.createElement("span");
    icon.textContent = "↗";
    icon.className = "text-[0.7rem]";
    link.appendChild(icon);
    li.appendChild(link);
    careerResources.appendChild(li);
  });

  resultPanel.classList.remove("hidden");

  // 3) Save to Supabase
  submitBtn.disabled = true;
  submitBtn.textContent = "Saving...";

  try {
    const payload = {
      name: answers.name,
      email: answers.email,
      phone: answers.phone,
      answers, // full JSON blob of all answers
      recommended_career: recommendation.role,
    };

    const { error } = await sb.from("career_responses").insert(payload);

    if (error) {
      console.error("Supabase insert error:", error);
      errorMsg.textContent =
        "We generated your result, but saving it to the database failed. You may want to screenshot this result.";
      errorMsg.classList.remove("hidden");
    } else {
      successMsg.textContent =
        "Saved! You can revisit this recommendation in your coaching session.";
      successMsg.classList.remove("hidden");
    }
  } catch (err) {
    console.error("Unexpected error while saving:", err);
    errorMsg.textContent =
      "Unexpected error while saving your results. Please screenshot this page and share it with your coach.";
    errorMsg.classList.remove("hidden");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Get my best-fit path";
    statusText.textContent =
      "Result generated. You can close the modal when you’re done.";
  }
});

// ===== Initial step render (in case modal is already open) ==================
showStep(currentStep);
