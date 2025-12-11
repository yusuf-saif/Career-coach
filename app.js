// app.js
// -----------------------------------------------------------------------------
// Tech Career Fit Quiz – Frontend logic
// - Multi-step modal form
// - Supabase insert (anon key only)
// - Rules-based recommendation engine + starter resource links
// - Fun 10→1 countdown before revealing the result
// - Copy & share helpers
// -----------------------------------------------------------------------------
//
// SECURITY NOTE
// -------------
// Use ONLY the anon/publishable key from Supabase on the frontend.
// Do NOT expose your service_role / secret key in any client code.
//
// -----------------------------------------------------------------------------

/* global supabase */

// ===== Supabase client setup ================================================

const { createClient } = supabase;

// Your project details (safe to expose because RLS is enabled and we only insert)
const SUPABASE_URL = "https://dikptazrcdeypabrybjd.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpa3B0YXpyY2RleXBhYnJ5YmpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0NDQyMDgsImV4cCI6MjA4MTAyMDIwOH0.Sj2rwFXRff16aFmuKCexJsmSv0zNd0ePwFjg2H2grnE";

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

const formPanel = document.getElementById("formPanel");
const loadingPanel = document.getElementById("loadingPanel");
const countdownNumber = document.getElementById("countdownNumber");
const countdownMessage = document.getElementById("countdownMessage");
const countdownBar = document.getElementById("countdownBar");

const resultPanel = document.getElementById("resultPanel");
const careerTitle = document.getElementById("careerTitle");
const careerDescription = document.getElementById("careerDescription");
const careerSummaryText = document.getElementById("careerSummaryText");
const careerResources = document.getElementById("careerResources");

const copyResultBtn = document.getElementById("copyResultBtn");
const shareResultBtn = document.getElementById("shareResultBtn");
const copyShareStatus = document.getElementById("copyShareStatus");

let currentStep = 0;
const TOTAL_STEPS = formSteps.length;

let lastShareText = ""; // built when recommendation is computed

// ===== Modal helpers ========================================================

function openModal() {
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  modal.setAttribute("aria-hidden", "false");

  currentStep = 0;
  resultPanel.classList.add("hidden");
  loadingPanel.classList.add("hidden");
  formPanel.classList.remove("hidden");

  showStep(currentStep);

  const firstInput = formSteps[0].querySelector("input, textarea, select");
  if (firstInput) firstInput.focus();
}

function closeModal() {
  modal.classList.remove("flex");
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
}

openModalBtn.addEventListener("click", openModal);
closeModalBtn.addEventListener("click", closeModal);

// Close on backdrop click
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

// ===== Step UI / navigation =================================================

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

  errorMsg.classList.add("hidden");
  successMsg.classList.add("hidden");
}

function validateCurrentStep() {
  const activeStep = formSteps[currentStep];

  const requiredFields = activeStep.querySelectorAll("[required]");
  for (const field of requiredFields) {
    if (!field.checkValidity()) {
      field.reportValidity();
      return false;
    }
  }

  // Custom: on interests step, require at least 1 checkbox
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

// ===== Form data helpers ====================================================

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

// ===== Recommendation engine ===============================================

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

  // Interests (multi-select)
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

  // Coding preference
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

  // Problem type
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

  // People vs deep focus
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

  // Values (multi-select)
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

  // Pick highest scoring role
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
      "You like building real solutions without going deep into code. No-code/automation roles use tools like Zapier, Make, Notion, Airtable, Webflow and more to build workflows and internal tools quickly.",
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

// Starter links per role
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
        label: "Frontend Mentor – practice UI builds",
        url: "https://www.frontendmentor.io/",
      },
    ],
    "UI/UX Design": [
      { label: "Figma – Free design tool", url: "https://www.figma.com/" },
      {
        label: "Google UX Design Certificate (overview)",
        url: "https://www.coursera.org/professional-certificates/google-ux-design",
      },
      { label: "LearnUX – UI/UX basics", url: "https://learnux.io/" },
    ],
    "Data Analysis / Data Science": [
      {
        label: "Google Data Analytics Certificate (overview)",
        url: "https://www.coursera.org/professional-certificates/google-data-analytics",
      },
      { label: "Kaggle – free data courses", url: "https://www.kaggle.com/learn" },
      { label: "DataCamp – SQL & Python", url: "https://www.datacamp.com/" },
    ],
    "Product / Project Management": [
      {
        label: "Google Project Management Certificate (overview)",
        url: "https://www.coursera.org/professional-certificates/google-project-management",
      },
      {
        label: "Product School – resources",
        url: "https://productschool.com/resources",
      },
      {
        label: "Mind the Product – articles & talks",
        url: "https://www.mindtheproduct.com/",
      },
    ],
    "QA / Testing": [
      {
        label: "Ministry of Testing – intro resources",
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
        label: "Make (Integromat) – tutorials",
        url: "https://www.make.com/en/academy",
      },
      {
        label: "Airtable Guides – building tools",
        url: "https://support.airtable.com/docs",
      },
    ],
    "Digital Marketing / Growth": [
      {
        label: "Google Digital Garage – Marketing fundamentals",
        url: "https://learndigital.withgoogle.com/digitalgarage/course/digital-marketing",
      },
      {
        label: "HubSpot Academy – marketing courses",
        url: "https://academy.hubspot.com/courses/marketing",
      },
      { label: "Ahrefs Blog – SEO & content", url: "https://ahrefs.com/blog/" },
    ],
  };

  return resourceMap[role] || [];
}

// Build a shareable text block for copy/share
function buildShareText(name, recommendation, resources) {
  const lines = [];

  if (name) {
    lines.push(`Hey ${name}, here’s your suggested tech path 👇`);
  } else {
    lines.push("Here’s a suggested tech path based on my answers 👇");
  }

  lines.push("");
  lines.push(`Best-fit career: ${recommendation.role}`);
  lines.push("");
  lines.push(recommendation.description);
  lines.push("");

  if (resources.length > 0) {
    lines.push("Starter resources:");
    resources.forEach((r) => {
      lines.push(`- ${r.label}: ${r.url}`);
    });
  }

  lines.push("");
  lines.push("Remember: this is a starting point. You can always pivot as you learn.");

  return lines.join("\n");
}

// ===== Countdown logic ======================================================

/**
 * Runs a 10→1 countdown with UI updates and returns a Promise
 * that resolves after the countdown finishes.
 */
function runCountdown() {
  return new Promise((resolve) => {
    const totalSeconds = 10;
    let remaining = totalSeconds;

    countdownNumber.textContent = String(remaining);
    countdownMessage.textContent =
      "Give me about 10 seconds to think this through.";
    countdownBar.style.width = "0%";

    const timer = setInterval(() => {
      remaining -= 1;

      if (remaining >= 1) {
        countdownNumber.textContent = String(remaining);

        if (remaining > 5) {
          countdownMessage.textContent =
            "Checking your interests, work style and values…";
        } else if (remaining > 2) {
          countdownMessage.textContent =
            "Aligning you with realistic, beginner-friendly paths…";
        } else {
          countdownMessage.textContent =
            "Alright chief, lining up the path that fits you best…";
        }

        const progressPercent = ((totalSeconds - remaining) / totalSeconds) * 100;
        countdownBar.style.width = `${progressPercent}%`;
      } else {
        // 0 reached: finish
        clearInterval(timer);
        countdownNumber.textContent = "0";
        countdownBar.style.width = "100%";
        countdownMessage.textContent =
          "Alright chief, here’s the tech path that fits you best.";
        setTimeout(() => resolve(), 600); // tiny pause for drama
      }
    }, 1000);
  });
}

// ===== Submit handler =======================================================

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  errorMsg.classList.add("hidden");
  successMsg.classList.add("hidden");
  copyShareStatus.textContent = "";
  statusText.textContent = "Computing your best fit…";

  const answers = getFormAnswers();

  // Guard on core contact fields
  if (!answers.name || !answers.email || !answers.phone) {
    errorMsg.textContent =
      "Please fill in your name, email, and phone number.";
    errorMsg.classList.remove("hidden");
    statusText.textContent =
      "Please complete the required contact details before submitting.";
    return;
  }

  // 1) Compute recommendation
  const recommendation = computeCareerRecommendation(answers);

  // Prepare resources + share text
  const resources = getResourcesForRole(recommendation.role);

  // 2) Swap UI: show countdown loader
  formPanel.classList.remove("hidden");
  resultPanel.classList.add("hidden");
  loadingPanel.classList.remove("hidden");
  formPanel.classList.add("pointer-events-none");
  submitBtn.disabled = true;
  nextBtn.disabled = true;
  prevBtn.disabled = true;

  // 3) Save to Supabase in the background (don't block countdown)
  const payload = {
    name: answers.name,
    email: answers.email,
    phone: answers.phone,
    answers,
    recommended_career: recommendation.role,
  };

  const savePromise = sb.from("career_responses").insert(payload);

  // 4) Run countdown
  await runCountdown();

  // 5) Reveal result
  loadingPanel.classList.add("hidden");
  formPanel.classList.remove("pointer-events-none");
  resultPanel.classList.remove("hidden");

  careerTitle.textContent = recommendation.role;
  careerDescription.textContent = recommendation.description;

  // Render resources list
  careerResources.innerHTML = "";
  resources.forEach((res) => {
    const li = document.createElement("li");
    const link = document.createElement("a");
    link.href = res.url;
    link.textContent = res.label;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = "hover:underline inline-flex items-center gap-1";
    const icon = document.createElement("span");
    icon.textContent = "↗";
    icon.className = "text-[0.7rem]";
    link.appendChild(icon);
    li.appendChild(link);
    careerResources.appendChild(li);
  });

  // Build shareable text
  lastShareText = buildShareText(answers.name, recommendation, resources);
  careerSummaryText.textContent = lastShareText;

  statusText.textContent =
    "Result generated. You can copy or share this, and close the modal when you’re done.";

  // 6) Handle Supabase save result when it completes
  savePromise
    .then(({ error }) => {
      if (error) {
        console.error("Supabase insert error:", error);
        errorMsg.textContent =
          "We generated your result, but saving it to the database failed. You may want to screenshot or copy this result.";
        errorMsg.classList.remove("hidden");
      } else {
        successMsg.textContent =
          "Saved! You can revisit this recommendation later with your coach.";
        successMsg.classList.remove("hidden");
      }
    })
    .catch((err) => {
      console.error("Unexpected error while saving:", err);
      errorMsg.textContent =
        "Unexpected error while saving your results. Please screenshot or copy this result.";
      errorMsg.classList.remove("hidden");
    })
    .finally(() => {
      submitBtn.disabled = false;
      nextBtn.disabled = false;
      prevBtn.disabled = false;
    });
});

// ===== Copy & share handlers ===============================================

copyResultBtn.addEventListener("click", async () => {
  copyShareStatus.textContent = "";
  if (!lastShareText) return;

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(lastShareText);
      copyShareStatus.textContent = "Copied to clipboard ✅";
    } else {
      // Fallback: select the pre text
      const range = document.createRange();
      range.selectNodeContents(careerSummaryText);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      copyShareStatus.textContent = "Select + copy from the box above.";
    }
  } catch (err) {
    console.error("Copy failed:", err);
    copyShareStatus.textContent = "Copy failed. Try selecting manually.";
  }
});

shareResultBtn.addEventListener("click", async () => {
  copyShareStatus.textContent = "";
  if (!lastShareText) return;

  if (navigator.share) {
    try {
      await navigator.share({
        title: "My Tech Career Fit Result",
        text: lastShareText,
      });
      copyShareStatus.textContent = "Shared 🎉";
    } catch (err) {
      if (err && err.name !== "AbortError") {
        console.error("Share failed:", err);
        copyShareStatus.textContent = "Share failed. You can copy instead.";
      }
    }
  } else {
    copyShareStatus.textContent =
      "Sharing isn’t supported here. Try the copy button instead.";
  }
});

// Initial state for steps
showStep(currentStep);

