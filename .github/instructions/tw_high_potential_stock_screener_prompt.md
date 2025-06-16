# 🛠 **Task Prompt Template** — Taiwan High‑Potential Stock Screener

> **Always start every request with**
>
> **“Base Specification imported. Generate only the files requested below.”**
>
> *(The Base Spec lives in `tw_high_potential_stock_screener_prompt.md` and is assumed to be in context.)*

---

## 1  Task Description *(replace for each sprint)*

**Implement FR‑1 *Valuation & Growth Data Fetchers*.**
Create TypeScript modules that download raw JSON/CSV from TWSE OpenAPI, normalise field names to English, and upsert into SQLite tables `valuation` and `growth`.

### Requirements

1. Retry with exponential back‑off (max 3 retries).
2. Respect TWSE `robots.txt` — ≥ 120 ms delay between calls.
3. Idempotent: running twice on same date must not duplicate rows.
4. Edge cases: missing values, halted stocks handled gracefully.

### Deliverables (FILES TO CREATE / MODIFY)

| Path                     | Purpose                                             |
| ------------------------ | --------------------------------------------------- |
| `src/fetchValuation.ts`  | Fetch PER / PBR / Dividend Yield.                   |
| `src/fetchRevenue.ts`    | Fetch monthly revenue + EPS.                        |
| `tests/fetchers.spec.ts` | Unit tests (Vitest).                                |
| `package.json`           | Add scripts `"fetch-valuation"`, `"fetch-revenue"`. |
| `README.md` (append)     | Add usage snippet.                                  |

---

## 2  File Generation 📂

When responding, **output each file in a fenced code‑block** in the exact format below. Do **not** include any additional commentary:

````markdown
```ts filename="src/fetchValuation.ts"
// <contents>
```

```ts filename="src/fetchRevenue.ts"
// <contents>
```

```json filename="package.json" patch
{ /* partial or full JSON */ }
```

...etc.
````

*If a file already exists and you are updating it, use the same pattern with `patch` comment or show a `diff --git` block.*

---

## 3  Acceptance Tests (extract from Base Spec)

* **T‑01** through **T‑03** must pass.

---

## 4  Submission Rules

1. **No explanatory text** outside the code fences.
2. Assume Base Spec types/interfaces are available.
3. Keep lines ≤ 120 chars.

---

*Copy this template, customise §1 & §3 for the next feature, then feed it to your code‑generation AI.*
