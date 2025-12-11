# Tech Career Fit Quiz

A small web app that helps someone figure out which tech career path might fit them best, based on their interests, work style, values and goals.

- 🧠 Mix of multiple-choice + open questions
- ✨ Animated multi-step modal with progress bar
- ⏱️ Fun 10→1 “thinking” countdown before showing the result
- 🔐 Responses stored in Supabase (using anon key + RLS)
- 📤 Result is easy to copy or share (Web Share API where supported)
- 🌐 Ready to host on GitHub Pages (pure static files)

---

## Stack

- **Frontend:** HTML + Tailwind CSS (CDN) + vanilla JS
- **Backend / DB:** Supabase (Postgres) – `career_responses` table
- **Hosting:** GitHub Pages or any static host

---

## Project structure

```text
.
├─ index.html      # Landing card + modal questionnaire
├─ styles.css      # Extra styling on top of Tailwind
├─ app.js          # Logic, Supabase integration, scoring & countdown
└─ README.md       # You are here
